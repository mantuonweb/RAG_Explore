# RAG Explorer — MCP Edition

A full-stack Retrieval-Augmented Generation (RAG) system with a live web-search fallback powered by the Model Context Protocol (MCP).

| Package | Tech | Port |
|---------|------|------|
| `be/`  | Node.js 26 · TypeScript 7 · Express 5 · LangChain · pgvector | 3000 |
| `mcp/` | MCP SDK · StreamableHTTP · DuckDuckGo · Cheerio | 3001 |
| `fe/`  | Angular 19 · Angular Material · Standalone components | 4200 |
| DB     | PostgreSQL 16 + pgvector (Docker) | 5432 |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Angular Frontend (fe/)                        │
│                            port 4200                                 │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────────────┐ │
│  │ Upload docs  │   │  Ask a question  │   │  Manage documents    │ │
│  │ POST /upload │   │  POST /ask       │   │  GET/DELETE /docs    │ │
└──┴──────┬───────┴───┴────────┬─────────┴───┴──────────────────────┘─┘
           │                   │
           ▼                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Express Backend (be/)                            │
│                           port 3000                                   │
│                                                                       │
│  POST /api/documents/upload                                           │
│  ├─ PDF / TXT extracted                                               │
│  ├─ Chunked (RecursiveCharacterTextSplitter)                          │
│  └─ Embedded (text-embedding-3-small) → stored in pgvector           │
│                                                                       │
│  POST /api/documents/ask                                              │
│  │                                                                    │
│  ├─ 1. Vector search  ──── cosine similarity ────► pgvector          │
│  │       ↓                                                            │
│  ├─ 2. Threshold filter  (score < MIN_SIMILARITY → discard)          │
│  │       ↓ chunks pass                  ↓ no chunks pass             │
│  ├─ 3. LLM answer (gpt-4o)             └──► MCP web search ──┐      │
│  │    ┌ answer starts with [NO_MATCH]?                        │      │
│  │    │  Yes → MCP web search ─────────────────────────────┐ │      │
│  │    │  No  → return answer + sources ◄────────────────┐  │ │      │
│  │                                                        │  ▼ ▼     │
│  └─ 4. Synthesize web answer ◄─── MCP returns results ───┴──┘       │
│                                                                       │
│  POST /api/mcp/search   ─── proxy to MCP web_search tool             │
│  POST /api/mcp/linkedin ─── proxy to MCP linkedin_search tool        │
│  POST /api/mcp/fetch    ─── proxy to MCP fetch_url tool              │
└──────────────────────────────┬───────────────────────────────────────┘
                                │  JSON-RPC over StreamableHTTP
                                │  Accept: application/json, text/event-stream
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        MCP Server (mcp/)                              │
│                           port 3001                                   │
│                                                                       │
│  Tool: web_search     ── DuckDuckGo HTML search + Instant Answer API │
│  Tool: fetch_url      ── URL fetch → Cheerio HTML→text extraction    │
│  Tool: linkedin_search── DuckDuckGo site:linkedin.com filter         │
│  Tool: linkedin_fetch ── Fetch publicly visible LinkedIn text        │
└──────────────────────────────┬───────────────────────────────────────┘
                                │
                                ▼
                  ┌─────────────────────────┐
                  │   PostgreSQL + pgvector  │
                  │       port 5432          │
                  │  table: documents        │
                  │  col:   embedding vector │
                  └─────────────────────────┘
```

### Ask Flow — Step by Step

```
User: "Who is Mantu?"
  │
  ├─ pgvector cosine search → [resume chunks, score 0.62–0.89]
  ├─ threshold filter (≥ 0.3) → chunks pass
  ├─ LLM (gpt-4o): "Answer from context"
  │    context is relevant → answer returned with sources ✓
  │
User: "Who is Anoop Malhotra?"
  │
  ├─ pgvector search → [resume chunks, score ~0.5] (wrong person)
  ├─ threshold filter → chunks pass
  ├─ LLM: "[NO_MATCH] Context is about Mantu Nigam, not Anoop Malhotra"
  ├─ MCP web_search("Who is Anoop Malhotra")
  │    → DuckDuckGo results fetched
  ├─ LLM synthesizes web answer
  └─ returned with webSearch: true ✓

User: "Quantum entanglement basics?"
  │
  ├─ pgvector search → [chunks, score < 0.3]
  ├─ threshold filter → no chunks pass
  ├─ MCP web_search called immediately
  └─ web answer returned ✓
```

---

## Prerequisites

- **Node.js 20+**
- **Docker & Docker Compose** (for PostgreSQL + pgvector)
- **OpenAI API key**

---

## Quick Start

### 1. Start the database

```bash
docker compose up -d
```

### 2. Configure the backend

```bash
cp be/.env.example be/.env
```

Edit `be/.env`:

```env
OPENAI_API_KEY=sk-...
POSTGRES_URL=postgresql://raguser:ragpassword@localhost:5432/ragdb
LLM_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
PORT=3000
NODE_ENV=development
MIN_SIMILARITY=0.3
```

### 3. Install all dependencies

```bash
npm run install:all
```

### 4. Start everything

```bash
npm start
```

This runs `be/`, `fe/`, and `mcp/` concurrently via `concurrently`.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| Backend API | http://localhost:3000 |
| MCP Server | http://localhost:3001 |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start all three packages concurrently |
| `npm run start:be` | Backend only |
| `npm run start:fe` | Frontend only |
| `npm run start:mcp` | MCP server only |
| `npm run install:all` | Install deps in be/, fe/, mcp/ |
| `npm run build` | Build all packages |
| `npm test` | Run tests across all packages |

---

## API Reference

### Documents

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/documents/upload` | Upload PDF or TXT — chunks + embeds |
| `GET` | `/api/documents` | List all indexed documents |
| `POST` | `/api/documents/search` | Raw vector search (returns chunks + scores) |
| `POST` | `/api/documents/ask` | RAG answer with MCP fallback |
| `PATCH` | `/api/documents/:id` | Update metadata or re-embed |
| `DELETE` | `/api/documents/:id` | Delete document chunks |

### MCP Proxy

| Method | Path | Body |
|--------|------|------|
| `POST` | `/api/mcp/search` | `{ "query": "..." }` |
| `POST` | `/api/mcp/linkedin` | `{ "name": "...", "company": "..." }` |
| `POST` | `/api/mcp/fetch` | `{ "url": "https://..." }` |

### Examples

```bash
# Upload a document
curl -X POST http://localhost:3000/api/documents/upload \
  -F "file=@resume.pdf"

# Ask a question
curl -X POST http://localhost:3000/api/documents/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "Who is Mantu?", "k": 5}'

# Web search via MCP
curl -X POST http://localhost:3000/api/mcp/search \
  -H "Content-Type: application/json" \
  -d '{"query": "latest AI news"}'
```

---

## Project Structure

```
mcp_rag/
├── package.json          # Root scripts (concurrently)
├── docker-compose.yml    # PostgreSQL 16 + pgvector
│
├── be/                   # Express backend
│   ├── src/
│   │   ├── config/env.ts          # Typed env config (no hardcoded values)
│   │   ├── lib/
│   │   │   ├── langchain.ts       # LLM, embeddings, vector store factory
│   │   │   ├── db.ts              # pg Pool singleton
│   │   │   └── mcp-client.ts      # HTTP client for MCP server
│   │   ├── controllers/
│   │   │   ├── documentController.ts  # Upload, search, ask
│   │   │   └── mcpController.ts       # Proxy to MCP tools
│   │   └── routes/
│   │       ├── documentRoutes.ts
│   │       └── mcpRoutes.ts
│   └── .env.example
│
├── mcp/                  # Standalone MCP server
│   └── src/
│       ├── index.ts               # Express + StreamableHTTPServerTransport
│       └── tools/
│           ├── web-search.ts      # DuckDuckGo search
│           ├── fetch-url.ts       # URL fetch + Cheerio extraction
│           └── linkedin.ts        # LinkedIn profile search/fetch
│
└── fe/                   # Angular 19 frontend
    └── src/app/
        ├── components/
        │   ├── search/            # Ask + answer + sources view
        │   ├── upload/            # File upload
        │   └── documents/         # Document list + management
        ├── services/
        │   └── document.service.ts
        └── models/
            └── document.model.ts
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| LLM & Embeddings | OpenAI (`gpt-4o`, `text-embedding-3-small`) |
| RAG orchestration | LangChain v1 (`@langchain/openai`, `@langchain/pgvector`) |
| Vector store | PostgreSQL 16 + pgvector (cosine similarity) |
| Backend | Node.js 26 · TypeScript 7 · Express 5 |
| MCP server | `@modelcontextprotocol/sdk` v1.30 · StreamableHTTP |
| Web search | DuckDuckGo HTML (no API key required) |
| Frontend | Angular 19 · Angular Material · Signals |
| Dev tooling | tsx · nodemon · concurrently |
