import uuid
from pathlib import Path

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.documents import Document

from config import settings
from rag.vector_store import get_vector_store


def load_documents(file_path: str) -> list[Document]:
    path = Path(file_path)
    if path.suffix == ".pdf":
        loader = PyPDFLoader(file_path)
    else:
        loader = TextLoader(file_path)
    return loader.load()


def ingest_file(
    file_path: str,
    source_name: str | None = None,
    doc_name: str | None = None,
    doc_description: str | None = None,
) -> tuple[str, int]:
    doc_id = str(uuid.uuid4())
    docs = load_documents(file_path)

    for doc in docs:
        if source_name:
            doc.metadata["source"] = source_name
        doc.metadata["doc_id"] = doc_id
        doc.metadata["doc_name"] = doc_name or source_name or ""
        doc.metadata["doc_description"] = doc_description or ""

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    chunks = splitter.split_documents(docs)
    get_vector_store().add_documents(chunks)
    return doc_id, len(chunks)
