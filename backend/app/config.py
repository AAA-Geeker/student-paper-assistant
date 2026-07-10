from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ─── 应用配置 ──────────────────────────────────────────────────
    SECRET_KEY: str = "dev-secret-key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    DATABASE_URL: str = "sqlite:///./app.db"

    # ─── 默认 LLM 配置（向后兼容）──────────────────────────────────
    LLM_API_KEY: str = ""
    LLM_API_BASE: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_MAX_TOKENS: int = 4096

    # ─── 多模型 API Keys ──────────────────────────────────────────
    DEEPSEEK_API_KEY: str = ""       # DeepSeek API key
    # LLM_API_KEY 同时用于 OpenAI 系列（GPT-4o, GPT-4o-mini）
    ANTHROPIC_API_KEY: str = ""      # Anthropic Claude API key

    # ─── 额度控制 ──────────────────────────────────────────────────
    MONTHLY_BUDGET_USD: float = 10.0          # 月度预算（USD）
    WARN_AT_PERCENT: int = 80                  # 消耗达到 80% 时警告
    AUTO_DOWNGRADE: bool = True               # 预算紧张时自动降级模型
    DEFAULT_TIER: str = "standard"             # 默认模型层级: budget | standard | premium

    # ─── 上下文窗口控制 ────────────────────────────────────────────
    MAX_CONTEXT_TOKENS: int = 8000            # 单次请求最大上下文
    SEGMENT_POLISH_SIZE: int = 500            # 分段润色每段最大字符数

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
