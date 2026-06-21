from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import documents, ingest, query

app = FastAPI(title="RAG API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Angular dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(query.router)
app.include_router(ingest.router)
app.include_router(documents.router)


@app.get("/health")
def health():
    return {"status": "ok"}
