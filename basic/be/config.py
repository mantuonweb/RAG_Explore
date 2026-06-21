from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    postgres_url: str = "postgresql+psycopg://raguser:ragpassword@localhost:5432/ragdb"
    llm_model: str = "gpt-4o"
    embedding_model: str = "text-embedding-3-small"
    chunk_size: int = 1000
    chunk_overlap: int = 200

    class Config:
        env_file = ".env"


settings = Settings()
