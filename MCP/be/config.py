from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    postgres_url: str = "postgresql+psycopg://raguser:ragpassword@localhost:5432/ragdb"
    embedding_model: str = "text-embedding-3-small"
    similarity_threshold: float = 0.65   # below this → fall back to LinkedIn

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
