from fastapi import APIRouter
from pydantic import BaseModel

from rag.chain import build_chain

router = APIRouter(prefix="/query", tags=["query"])


class QueryRequest(BaseModel):
    question: str
    doc_id: str | None = None


class QueryResponse(BaseModel):
    answer: str


@router.post("", response_model=QueryResponse)
def query(body: QueryRequest):
    chain = build_chain(doc_id=body.doc_id)
    answer = chain.invoke(body.question)
    return QueryResponse(answer=answer)
