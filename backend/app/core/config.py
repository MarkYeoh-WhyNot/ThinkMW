from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str
    FRONTEND_URL: str = "http://localhost:3000"

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str

    NEO4J_URI: str
    NEO4J_USER: str
    NEO4J_PASSWORD: str

    REDIS_URL: str = "redis://localhost:6379/0"

    # LLM provider: "deepseek" (dev) or "anthropic" (production)
    LLM_PROVIDER: str = "deepseek"
    DEEPSEEK_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str  # embeddings always via OpenAI

    # Semantic similarity thresholds
    SIMILARITY_AUTO_MAP: float = 0.88
    SIMILARITY_CONFIRM: float = 0.65
    SIMILARITY_LLM_JUDGE: float = 0.40

    # Scoring weights
    SCORE_WEIGHT_COVERAGE: float = 0.40
    SCORE_WEIGHT_NOVEL: float = 0.30
    SCORE_WEIGHT_STRUCTURE: float = 0.20
    SCORE_WEIGHT_COMPLETENESS: float = 0.10

    class Config:
        env_file = "env.local"
        extra = "ignore"


settings = Settings()
