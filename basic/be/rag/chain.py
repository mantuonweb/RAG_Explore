from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough

from config import settings
from rag.vector_store import get_vector_store

PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "You are a helpful assistant. Answer the user's question using only "
        "the context provided below. If the answer is not in the context, "
        "say you don't know.\n\nContext:\n{context}"
    )),
    ("human", "{question}"),
])


def _format_docs(docs) -> str:
    return "\n\n".join(d.page_content for d in docs)


def build_chain(doc_id: str | None = None, source: str | None = None):
    search_kwargs: dict = {"k": 4}
    if doc_id:
        search_kwargs["filter"] = {"doc_id": doc_id}
    elif source:
        search_kwargs["filter"] = {"source": source}
    retriever = get_vector_store().as_retriever(search_kwargs=search_kwargs)
    llm = ChatOpenAI(
        model=settings.llm_model,
        openai_api_key=settings.openai_api_key,
    )
    return (
        {"context": retriever | _format_docs, "question": RunnablePassthrough()}
        | PROMPT
        | llm
        | StrOutputParser()
    )
