from langchain_openai import OpenAIEmbeddings
from langchain_postgres.vectorstores import PGVector

from config import settings

COLLECTION_NAME = "rag_documents"

_store = None


def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        openai_api_key=settings.openai_api_key,
    )


def get_vector_store() -> PGVector:
    global _store
    if _store is None:
        _store = PGVector(
            embeddings=get_embeddings(),
            collection_name=COLLECTION_NAME,
            connection=settings.postgres_url,
            use_jsonb=True,
        )
    return _store
