# RAG Explore

A collection of Retrieval-Augmented Generation (RAG) examples built for learning — from a basic full-stack RAG app to an MCP-powered skills search system.

---

## Projects

### `basic/` — Full-Stack RAG App

A complete RAG application where you ingest documents and ask questions against them.

| Layer | Technology |
|---|---|
| LLM | OpenAI GPT-4o |
| Embeddings | OpenAI text-embedding-3-small |
| RAG chain | LangChain |
| Vector DB | PostgreSQL 16 + pgvector |
| API | FastAPI + Uvicorn |
| Frontend | Angular 19 |
| Container | Docker Compose |

**Quick start:**

```bash
# 1. Start the database
cd basic
docker compose up -d

# 2. Configure the backend
cd be
cp .env.example .env   # add your OPENAI_API_KEY

# 3. Run the backend
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000

# 4. Run the frontend
cd ../fe
npm install
ng serve                    # http://localhost:4200
```

**API endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| GET | /health | Health check |
| POST | /ingest | Upload a document (PDF, TXT, MD) |
| POST | /query | Ask a question against indexed documents |

See [basic/README.md](basic/README.md) for full details.

---

### `MCP/` — MCP-Powered Skills Search

A skills search system that parses resumes, stores skills in pgvector, and falls back to a LinkedIn MCP server when a skill isn't found locally.

**Components:**

- `MCP/be/` — FastAPI backend: uploads resume PDFs, extracts skills via OpenAI, searches pgvector with a LinkedIn MCP fallback
- `MCP/fe/` — Angular 19 frontend
- `MCP/mcp_linkedin.py` — MCP server that searches LinkedIn via DuckDuckGo

**Flow:**

```
Upload resume PDF
      │
      ▼
  FastAPI be ──► OpenAI (extract skills) ──► pgvector (store)

Search for skill
      │
      ▼
  pgvector (local lookup)
      │
      └── not found ──► LinkedIn MCP server ──► DuckDuckGo search
```

**Quick start:**

```bash
# Start the MCP LinkedIn server
cd MCP
python mcp_linkedin.py

# Start the backend
cd be
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000

# Start the frontend
cd ../fe
npm install
ng serve                    # http://localhost:4200
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+ and Angular CLI (`npm install -g @angular/cli`)
- Docker and Docker Compose
- OpenAI API key
