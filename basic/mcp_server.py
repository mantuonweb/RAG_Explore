"""
RAG MCP Server — wraps the local RAG FastAPI backend as MCP tools.

MCP (Model Context Protocol) is a standard that lets an AI host (e.g. Claude
Desktop, Claude Code, Cursor) discover and call capabilities that live in this
server process. The AI host spawns this server over stdio and talks to it using
the MCP JSON-RPC protocol — you never write that protocol by hand; FastMCP
handles it.

Three MCP primitives are shown here:
  • Tools     — functions the AI can CALL (it decides when and how)
  • Resources — read-only data the AI can READ (like virtual files)
  • Prompts   — reusable prompt templates the AI can inject into the conversation
"""

import httpx
from mcp.server.fastmcp import FastMCP

# ── Configuration ─────────────────────────────────────────────────────────────
# Point at the running FastAPI backend (started with `uvicorn main:app`).
BASE_URL = "http://localhost:8000"

# ── Server bootstrap ──────────────────────────────────────────────────────────
# FastMCP is the high-level SDK entry point. The string you pass becomes the
# server's display name in the host's UI (e.g. Claude Desktop sidebar).
mcp = FastMCP("RAG Explorer")


# =============================================================================
# TOOLS
# =============================================================================
# Tools are functions the AI model can invoke by name with JSON arguments.
# FastMCP auto-generates the tool's JSON Schema from the function's type
# annotations and uses the docstring as the human-readable description.
#
# Rule of thumb: if you want the AI to *do* something → use a Tool.
# =============================================================================


@mcp.tool()
def query_rag(question: str, doc_id: str | None = None) -> str:
    """
    Ask a question and get an answer grounded in the indexed documents.

    The backend embeds the question, retrieves the top-4 relevant chunks
    from pgvector, and feeds them to GPT-4o to generate the answer.

    Args:
        question: The question to ask.
        doc_id:   Optional — scope the search to a single document's chunks.
                  Get doc_ids from list_documents().
    """
    payload: dict = {"question": question}
    if doc_id:
        payload["doc_id"] = doc_id

    # httpx is a sync HTTP client (analogous to requests).
    # We keep tools synchronous here for simplicity; FastMCP supports async too.
    response = httpx.post(f"{BASE_URL}/query", json=payload, timeout=30)
    response.raise_for_status()          # raises on 4xx/5xx → MCP surfaces as tool error
    return response.json()["answer"]


@mcp.tool()
def list_documents() -> list[dict]:
    """
    List every document that has been ingested into the knowledge base.

    Returns one entry per document with:
      - doc_id        (use this to scope query_rag to one document)
      - filename
      - doc_name
      - doc_description
      - chunk_count   (how many text chunks were stored)
    """
    response = httpx.get(f"{BASE_URL}/documents/sources", timeout=10)
    response.raise_for_status()
    return response.json()


@mcp.tool()
def ingest_document(file_path: str, name: str = "", description: str = "") -> dict:
    """
    Add a local file (PDF, TXT, or MD) to the RAG knowledge base.

    The backend splits the file into overlapping chunks, embeds each chunk
    with text-embedding-3-small, and stores the vectors in pgvector so they
    can be retrieved by future query_rag calls.

    Args:
        file_path:   Absolute path to the file (e.g. /Users/you/report.pdf).
        name:        Human-readable label for the document (optional).
        description: Short description of the document's content (optional).

    Returns:
        dict with doc_id, filename, and chunks_indexed.
    """
    with open(file_path, "rb") as fh:
        filename = file_path.split("/")[-1]
        response = httpx.post(
            f"{BASE_URL}/ingest",
            files={"file": (filename, fh)},
            data={"name": name, "description": description},
            timeout=60,
        )
    response.raise_for_status()
    return response.json()


# =============================================================================
# RESOURCES
# =============================================================================
# Resources are read-only URIs the AI (or user) can browse — think of them
# as virtual files the server exposes. The host can list available resources
# and fetch their content without the AI having to explicitly call a tool.
#
# Rule of thumb: if you want to expose *data the AI can read* → use a Resource.
# =============================================================================


@mcp.resource("rag://documents")
def documents_resource() -> str:
    """
    Live snapshot of all indexed documents.

    The host can fetch this URI whenever it wants an up-to-date view of
    the knowledge base without consuming a tool call turn.
    """
    response = httpx.get(f"{BASE_URL}/documents/sources", timeout=10)
    response.raise_for_status()
    docs = response.json()

    if not docs:
        return "Knowledge base is empty — no documents indexed yet."

    lines = ["# Indexed Documents\n"]
    for doc in docs:
        lines.append(
            f"## {doc['doc_name']}\n"
            f"- **doc_id**: `{doc['doc_id']}`\n"
            f"- **file**: {doc['filename']}\n"
            f"- **chunks**: {doc['chunk_count']}\n"
            + (f"- **description**: {doc['doc_description']}\n" if doc["doc_description"] else "")
        )
    return "\n".join(lines)


@mcp.resource("rag://health")
def health_resource() -> str:
    """Current health status of the RAG backend."""
    try:
        response = httpx.get(f"{BASE_URL}/health", timeout=5)
        data = response.json()
        return f"Backend status: {data.get('status', 'unknown')}"
    except Exception as exc:
        return f"Backend unreachable: {exc}"


# =============================================================================
# PROMPTS
# =============================================================================
# Prompts are named, parameterised message templates. The AI host surfaces
# them as slash commands or pre-built conversation starters. When invoked,
# the returned messages are injected into the conversation.
#
# Rule of thumb: if you want to give the AI a *reusable instruction pattern*
# → use a Prompt.
# =============================================================================


@mcp.prompt()
def rag_assistant(focus_area: str = "general topics") -> str:
    """
    Configure the AI to act as a grounded research assistant.

    Args:
        focus_area: The subject domain to focus on (e.g. "machine learning").
    """
    return f"""You are a helpful research assistant with access to a private
knowledge base via MCP tools.

Available tools:
- list_documents  — see what is indexed
- query_rag       — search the knowledge base and answer a question
- ingest_document — add a new document to the knowledge base

Focus area: {focus_area}

Always ground your answers in the indexed documents. Cite the document name
when you use it. If the knowledge base does not contain relevant information,
say so clearly rather than guessing."""


@mcp.prompt()
def summarise_document(doc_id: str) -> str:
    """
    Ask the AI to produce a summary of a specific document.

    Args:
        doc_id: The UUID of the document to summarise (from list_documents).
    """
    return (
        f"Please summarise the document with doc_id `{doc_id}`. "
        "Use the query_rag tool with questions like 'What is this document about?', "
        "'What are the main findings?', and 'What are the key conclusions?' "
        "to gather information, then write a concise summary."
    )


# =============================================================================
# Entry point
# =============================================================================
# When the MCP host spawns this server it runs `python mcp_server.py`.
# FastMCP defaults to stdio transport — the host writes JSON-RPC to stdin
# and reads responses from stdout. No port, no HTTP, no setup needed.
# =============================================================================

if __name__ == "__main__":
    mcp.run()
