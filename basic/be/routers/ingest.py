import os
import shutil
import tempfile

from fastapi import APIRouter, Form, HTTPException, UploadFile

from rag.ingest import ingest_file

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("")
def ingest(
    file: UploadFile,
    name: str = Form(""),
    description: str = Form(""),
):
    allowed = {".pdf", ".txt", ".md"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        doc_id, chunks = ingest_file(
            tmp_path,
            source_name=file.filename,
            doc_name=name or file.filename,
            doc_description=description,
        )
    finally:
        os.unlink(tmp_path)

    return {"doc_id": doc_id, "filename": file.filename, "chunks_indexed": chunks}
