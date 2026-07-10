"""
多模型路由层——根据 skill 类型、上下文大小、预算约束自动选择最优模型。

策略：
  L1 (廉价): DeepSeek-V3 — 大纲生成、初稿起草、摘要
  L2 (中等): GPT-4o-mini — 润色、修改、续写
  L3 (高级): GPT-4o — 质量审查、关键段落
  L4 (顶级): Claude Opus — 答辩准备、创意性内容（可选）
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class ModelTier(Enum):
    BUDGET = "budget"       # L1
    STANDARD = "standard"   # L2
    PREMIUM = "premium"     # L3
    ELITE = "elite"         # L4


@dataclass
class ModelConfig:
    provider: str
    model_id: str
    api_base: str
    api_key_env: str
    tier: ModelTier
    cost_per_1k_input: float  # USD
    cost_per_1k_output: float
    max_tokens: int
    supports_json_mode: bool = False


# 可用模型注册表
MODEL_REGISTRY: Dict[str, ModelConfig] = {
    "deepseek": ModelConfig(
        provider="deepseek",
        model_id="deepseek-chat",
        api_base="https://api.deepseek.com/v1",
        api_key_env="DEEPSEEK_API_KEY",
        tier=ModelTier.BUDGET,
        cost_per_1k_input=0.00014,
        cost_per_1k_output=0.00028,
        max_tokens=8192,
    ),
    "gpt-4o-mini": ModelConfig(
        provider="openai",
        model_id="gpt-4o-mini",
        api_base="https://api.openai.com/v1",
        api_key_env="LLM_API_KEY",
        tier=ModelTier.STANDARD,
        cost_per_1k_input=0.00015,
        cost_per_1k_output=0.00060,
        max_tokens=16384,
        supports_json_mode=True,
    ),
    "gpt-4o": ModelConfig(
        provider="openai",
        model_id="gpt-4o",
        api_base="https://api.openai.com/v1",
        api_key_env="LLM_API_KEY",
        tier=ModelTier.PREMIUM,
        cost_per_1k_input=0.00250,
        cost_per_1k_output=0.01000,
        max_tokens=16384,
        supports_json_mode=True,
    ),
    "claude-sonnet": ModelConfig(
        provider="anthropic",
        model_id="claude-sonnet-5",
        api_base="https://api.anthropic.com/v1",
        api_key_env="ANTHROPIC_API_KEY",
        tier=ModelTier.ELITE,
        cost_per_1k_input=0.00300,
        cost_per_1k_output=0.01500,
        max_tokens=4096,
    ),
}

# Skill → 模型路由表
SKILL_MODEL_MAP: Dict[str, Dict[str, str]] = {
    "outline":    {"generate": "deepseek", "review": "deepseek"},
    "draft":      {"generate": "deepseek", "refine": "deepseek"},
    "polish":     {"segment": "deepseek", "global_check": "deepseek"},
    "revise":     {"parse": "deepseek", "generate_plan": "deepseek", "apply": "deepseek"},
    "review":     {"structure": "deepseek", "argument": "deepseek", "comparison": "deepseek",
                    "format": "local", "language": "deepseek"},
    "abstract":   {"generate": "deepseek"},
    "defense":    {"questions": "deepseek", "answers": "deepseek"},
}


def estimate_tokens(text: str) -> int:
    """粗略估算 token 数：中文 ~1.5 char/token，英文 ~4 char/token"""
    chinese_chars = sum(1 for c in text if '一' <= c <= '鿿')
    other_chars = len(text) - chinese_chars
    return int(chinese_chars / 1.5 + other_chars / 4)


def estimate_cost(model_name: str, input_tokens: int, output_tokens: int = 0) -> float:
    """估算一次调用的成本（USD）"""
    cfg = MODEL_REGISTRY.get(model_name)
    if not cfg:
        return 0.0
    return (input_tokens * cfg.cost_per_1k_input + output_tokens * cfg.cost_per_1k_output) / 1000


def route_model(skill: str, step: str, budget_tier: Optional[ModelTier] = None) -> str:
    """
    根据 skill + step 选择模型。

    如果指定了 budget_tier，则降级到该 tier 以下的模型。
    """
    skill_routes = SKILL_MODEL_MAP.get(skill, {})
    model_name = skill_routes.get(step, "deepseek")  # 默认用最便宜的

    if budget_tier:
        cfg = MODEL_REGISTRY.get(model_name)
        if cfg and cfg.tier.value > budget_tier.value:
            # 降级：找 tier 内最便宜的模型
            fallback_order = ["deepseek", "gpt-4o-mini", "gpt-4o", "claude-sonnet"]
            for fallback in fallback_order:
                fb_cfg = MODEL_REGISTRY.get(fallback)
                if fb_cfg and fb_cfg.tier.value <= budget_tier.value:
                    return fallback

    return model_name


def get_model_config(model_name: str) -> Optional[ModelConfig]:
    return MODEL_REGISTRY.get(model_name)


def _get_api_key(key_env: str) -> str:
    """从 settings 或环境变量中获取 API key"""
    from app.config import settings
    # 尝试从 settings 获取（支持 pydantic-settings 的 .env 加载）
    key_map = {
        "DEEPSEEK_API_KEY": settings.DEEPSEEK_API_KEY,
        "LLM_API_KEY": settings.LLM_API_KEY,
        "ANTHROPIC_API_KEY": settings.ANTHROPIC_API_KEY,
    }
    if key_env in key_map and key_map[key_env]:
        return key_map[key_env]
    import os
    return os.getenv(key_env, "")


def list_available_models() -> List[dict]:
    """列出所有可用模型及其信息（给前端展示）"""
    result = []
    for name, cfg in MODEL_REGISTRY.items():
        api_key = _get_api_key(cfg.api_key_env)
        result.append({
            "name": name,
            "provider": cfg.provider,
            "tier": cfg.tier.value,
            "cost_per_1k_input": cfg.cost_per_1k_input,
            "cost_per_1k_output": cfg.cost_per_1k_output,
            "available": bool(api_key),
            "max_tokens": cfg.max_tokens,
        })
    return result
