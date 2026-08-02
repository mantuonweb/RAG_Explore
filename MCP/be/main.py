"""
Skills API — two endpoints:
  POST /upload  →  parse resume PDF, extract skills via OpenAI, store in pgvector
  POST /search  →  local pgvector first, LinkedIn MCP fallback
"""
import io
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from openai import OpenAI
from pydantic import BaseModel
from pypdf import PdfReader

from config import settings
from langchain_openai import OpenAIEmbeddings
from langchain_postgres.vectorstores import PGVector

COLLECTION = "skills"

# ── MCP session (LinkedIn server) ─────────────────────────────────────────────

_mcp: ClientSession | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _mcp
    params = StdioServerParameters(
        command="python3",
        args=["../mcp_linkedin.py"],
    )
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as session:
            await session.initialize()
            _mcp = session
            yield
    _mcp = None


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="Skills API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost:4300"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Vector store helper ───────────────────────────────────────────────────────

def vector_store() -> PGVector:
    return PGVector(
        embeddings=OpenAIEmbeddings(
            model=settings.embedding_model,
            openai_api_key=settings.openai_api_key,
        ),
        collection_name=COLLECTION,
        connection=settings.postgres_url,
        use_jsonb=True,
    )


# ── Upload ────────────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload(file: UploadFile):
    # 1. Extract text from PDF
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    content = await file.read()
    reader = PdfReader(io.BytesIO(content))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF.")

    # 2. Ask OpenAI to pull out the skills list
    client = OpenAI(api_key=settings.openai_api_key)
    response = client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[{
            "role": "user",
            "content": (
                "Extract all technical and professional skills from this resume. "
                "Return JSON with a single key 'skills' containing an array of strings.\n\n"
                + text[:6000]
            ),
        }],
    )
    skills: list[str] = json.loads(response.choices[0].message.content).get("skills", [])

    if not skills:
        raise HTTPException(status_code=422, detail="No skills found in resume.")

    # 3. Store each skill in pgvector
    store = vector_store()
    store.add_texts(
        texts=skills,
        metadatas=[{"skill": s, "source": file.filename} for s in skills],
    )

    return {"filename": file.filename, "skills_extracted": len(skills), "skills": skills}


# ── Search ────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    skill: str


@app.post("/search")
async def search(body: SearchRequest):
    store = vector_store()
    results = store.similarity_search_with_relevance_scores(body.skill, k=5)

    # Keep results above threshold, deduplicate by (skill, source)
    seen: set[tuple] = set()
    local = []
    for doc, score in results:
        if score >= settings.similarity_threshold:
            key = (doc.page_content.lower(), doc.metadata.get("source", ""))
            if key not in seen:
                seen.add(key)
                local.append({
                    "skill": doc.page_content,
                    "score": round(score, 3),
                    "source": doc.metadata.get("source", ""),
                })

    if local:
        return {"source": "local", "results": local}

    # ── Fallback: LinkedIn via MCP ────────────────────────────────────────────
    mcp_result = await _mcp.call_tool(
        "search_linkedin_skills",
        arguments={"skill": body.skill},
    )
    linkedin = []
    for item in mcp_result.content:
        if hasattr(item, "text"):
            try:
                obj = json.loads(item.text)
                if isinstance(obj, dict):
                    linkedin.append(obj)
                elif isinstance(obj, list):
                    linkedin.extend(obj)
            except Exception:
                pass

    return {"source": "linkedin", "results": linkedin}


@app.get("/health")
def health():
    return {"status": "ok"}
