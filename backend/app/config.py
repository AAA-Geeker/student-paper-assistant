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

    # ─── Dify 工作流接入 ──────────────────────────────────────────
    # 开启后，核心功能（降重/审查/修改等）的 AI 调用改由 Dify 节点化工作流驱动，
    # 隐藏模型与 prompt 细节。关闭则保持现有"直连 LLM"逻辑（可安全回滚）。
    DIFY_ENABLED: bool = False
    DIFY_BASE_URL: str = ""                   # 例: http://localhost or https://api.dify.ai （不含 /v1）
    DIFY_API_KEY: str = ""                    # 工作流 App 的 API 密钥（app-xxxx）
    # 场景名 → Dify 工作流 app id 映射。场景名与 schemas/commerce.py 里的 CORE_PRICING key 对齐。
    DIFY_WORKFLOW_IDS: dict = {
        "aigc_rewrite": "36199d23-be18-4459-8d94-a3188206f097", # 论文降重(DSL版，deepseek-chat，已发布)
        "pre_submission_review": "1aa92ec9-4bb3-44ae-a24e-1002e271d342", # 投稿前审查
        "paper_revision": "ba15dfa9-f8d5-4699-8137-fd20f8adef54",        # 论文修改
        "advisor_revision": "b2f4df33-33d9-4bca-a181-f50ec6a8cc8c",     # 导师批注修改
        "reviewer_revision": "332f3f95-2d49-497a-a4ea-9bd906d39431",    # 审稿人修改
    }

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
