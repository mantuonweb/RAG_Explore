import psycopg
import numpy as np
from fastapi import APIRouter, HTTPException, Query
from pgvector.psycopg import register_vector
from pydantic import BaseModel

from config import settings
from rag.vector_store import get_embeddings

router = APIRouter(prefix="/documents", tags=["documents"])

COLLECTION_NAME = "rag_documents"


def _conn_str() -> str:
    return settings.postgres_url.replace("postgresql+psycopg://", "postgresql://")


# ── Static paths first (must come before /{doc_id}) ──────────────────────────

@router.get("/sources")
async def list_sources():
    """One row per uploaded document (grouped by doc_id), with metadata."""
    with psycopg.connect(_conn_str()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    COALESCE(e.cmetadata->>'doc_id', '') AS doc_id,
                    COALESCE(e.cmetadata->>'source', 'unknown') AS source,
                    COALESCE(e.cmetadata->>'doc_name', e.cmetadata->>'source', 'unknown') AS doc_name,
                    COALESCE(e.cmetadata->>'doc_description', '') AS doc_description,
                    COUNT(*)::int AS chunk_count
                FROM langchain_pg_embedding e
                JOIN langchain_pg_collection c ON e.collection_id = c.uuid
                WHERE c.name = %s
                GROUP BY doc_id, source, doc_name, doc_description
                ORDER BY doc_name
                """,
                (COLLECTION_NAME,),
            )
            rows = cur.fetchall()

    return [
        {
            "doc_id": row[0],
            "source": row[1],
            "filename": row[1].split("/")[-1],
            "doc_name": row[2],
            "doc_description": row[3],
            "chunk_count": row[4],
        }
        for row in rows
    ]


@router.delete("/by-source")
async def delete_by_source(source: str = Query(..., description="Original filename / source path")):
    """Delete every chunk that belongs to a specific source file."""
    with psycopg.connect(_conn_str()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM langchain_pg_embedding WHERE cmetadata->>'source' = %s",
                (source,),
            )
            deleted = cur.rowcount
        conn.commit()

    if deleted == 0:
        raise HTTPException(status_code=404, detail="No chunks found for that source")

    return {"source": source, "chunks_deleted": deleted}


@router.delete("/by-doc")
async def delete_by_doc_id(doc_id: str = Query(..., description="Document UUID")):
    """Delete every chunk that belongs to a specific document ID."""
    with psycopg.connect(_conn_str()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM langchain_pg_embedding WHERE cmetadata->>'doc_id' = %s",
                (doc_id,),
            )
            deleted = cur.rowcount
        conn.commit()

    if deleted == 0:
        raise HTTPException(status_code=404, detail="No chunks found for that doc_id")

    return {"doc_id": doc_id, "chunks_deleted": deleted}


# ── Chunk-level endpoints ─────────────────────────────────────────────────────

@router.get("")
async def list_chunks(source: str | None = Query(None, description="Filter by source filename")):
    """List all chunks, optionally filtered by source."""
    with psycopg.connect(_conn_str()) as conn:
        with conn.cursor() as cur:
            if source:
                cur.execute(
                    """
                    SELECT e.id, e.document, e.cmetadata
                    FROM langchain_pg_embedding e
                    JOIN langchain_pg_collection c ON e.collection_id = c.uuid
                    WHERE c.name = %s AND e.cmetadata->>'source' = %s
                    ORDER BY (e.cmetadata->>'page')::text
                    """,
                    (COLLECTION_NAME, source),
                )
            else:
                cur.execute(
                    """
                    SELECT e.id, e.document, e.cmetadata
                    FROM langchain_pg_embedding e
                    JOIN langchain_pg_collection c ON e.collection_id = c.uuid
                    WHERE c.name = %s
                    ORDER BY e.cmetadata->>'source', (e.cmetadata->>'page')::text
                    """,
                    (COLLECTION_NAME,),
                )
            rows = cur.fetchall()

    return [
        {
            "id": str(row[0]),
            "content": row[1],
            "source": (row[2] or {}).get("source", "unknown"),
            "page": (row[2] or {}).get("page", 0),
        }
        for row in rows
    ]


@router.get("/{doc_id}")
async def get_chunk(doc_id: str):
    with psycopg.connect(_conn_str()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, document, cmetadata FROM langchain_pg_embedding WHERE id = %s",
                (doc_id,),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Chunk not found")

    meta = row[2] or {}
    return {
        "id": str(row[0]),
        "content": row[1],
        "source": meta.get("source", "unknown"),
        "page": meta.get("page", 0),
    }


class DocumentUpdate(BaseModel):
    content: str


@router.put("/{doc_id}")
async def update_chunk(doc_id: str, body: DocumentUpdate):
    vector = get_embeddings().embed_query(body.content)
    embedding = np.array(vector, dtype=np.float32)

    with psycopg.connect(_conn_str()) as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE langchain_pg_embedding SET document = %s, embedding = %s WHERE id = %s",
                (body.content, embedding, doc_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Chunk not found")
        conn.commit()

    return {"id": doc_id, "updated": True}


@router.delete("/{doc_id}")
async def delete_chunk(doc_id: str):
    with psycopg.connect(_conn_str()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM langchain_pg_embedding WHERE id = %s",
                (doc_id,),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Chunk not found")
        conn.commit()

    return {"id": doc_id, "deleted": True}
