# RAG Explorer — Basic

A full-stack Retrieval-Augmented Generation (RAG) application built for learning.

- **Backend** — FastAPI + LangChain + OpenAI + pgvector (PostgreSQL)
- **Frontend** — Angular 19 (SPA)
- **Database** — PostgreSQL 16 with pgvector extension via Docker

---

## Project Structure

```
basic/
├── docker-compose.yml       # PostgreSQL + pgvector
├── be/                      # Python backend
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Settings loaded from .env
│   ├── requirements.txt
│   ├── .env.example         # Copy to .env and fill in values
│   ├── routers/
│   │   ├── query.py         # POST /query  — ask a question
│   │   └── ingest.py        # POST /ingest — upload a document
│   └── rag/
│       ├── chain.py         # LangChain RAG chain (GPT-4o)
│       ├── ingest.py        # Document loading and chunking
│       └── vector_store.py  # PGVector store singleton
└── fe/                      # Angular frontend
    └── src/app/
        ├── services/
        │   └── rag-api.service.ts   # HTTP client for backend API
        ├── app.config.ts
        └── app.routes.ts
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+ and Angular CLI (`npm install -g @angular/cli`)
- Docker and Docker Compose
- OpenAI API key

---

## Getting Started

### 1. Start the Database

```bash
docker compose up -d
```

This starts PostgreSQL 16 with the pgvector extension on port `5432`. Data is persisted in a Docker volume.

### 2. Configure the Backend

```bash
cd be
cp .env.example .env
```

Edit `.env` and set your OpenAI API key:

```env
OPENAI_API_KEY=sk-...
POSTGRES_URL=postgresql+psycopg://raguser:ragpassword@localhost:5432/ragdb
LLM_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

### 3. Install Backend Dependencies

```bash
pip install -r requirements.txt
```

### 4. Start the Backend

```bash
uvicorn main:app --reload
```

API is available at `http://localhost:8000`.
Interactive docs at `http://localhost:8000/docs`.

### 5. Start the Frontend

```bash
cd ../fe
npm install
ng serve
```

Frontend is available at `http://localhost:4200`.

---

## API Endpoints

| Method | Endpoint  | Description                        |
|--------|-----------|------------------------------------|
| GET    | /health   | Health check                       |
| POST   | /ingest   | Upload a document (PDF, TXT, MD)   |
| POST   | /query    | Ask a question against the indexed documents |

### Ingest a document

```bash
curl -X POST http://localhost:8000/ingest \
  -F "file=@/path/to/document.pdf"
```

Response:
```json
{ "filename": "document.pdf", "chunks_indexed": 42 }
```

### Ask a question

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{ "question": "What is this document about?" }'
```

Response:
```json
{ "answer": "This document is about..." }
```

---

## How It Works

```
User Question
     │
     ▼
 Angular FE  ──── POST /query ────►  FastAPI
                                        │
                              Embed question (OpenAI)
                                        │
                              Retrieve top-4 chunks
                              from pgvector (cosine similarity)
                                        │
                              Build prompt with context
                                        │
                              GPT-4o generates answer
                                        │
                                        ▼
                                  Return answer
```

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| LLM        | OpenAI GPT-4o                     |
| Embeddings | OpenAI text-embedding-3-small     |
| RAG chain  | LangChain                         |
| Vector DB  | PostgreSQL 16 + pgvector          |
| API        | FastAPI + Uvicorn                 |
| Frontend   | Angular 19                        |
| Container  | Docker Compose                    |

---

## Stopping the Database

```bash
docker compose down          # stop containers, keep data
docker compose down -v       # stop containers and delete data
```
