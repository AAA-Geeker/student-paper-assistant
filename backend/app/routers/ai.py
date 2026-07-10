"""
AI 路由层——论文写作 AI 功能的所有 API 端点。

新增 Skill 执行端点，保留向后兼容的旧端点。
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.ai import (
    generate_outline,
    continue_writing,
    polish,
    generate_abstract,
    critical_analysis,
    improve_introduction_hook,
    polish_by_segments,
)
from app.services.skill_executor import (
    execute_skill,
    execute_skill_step,
    list_skills,
    BUILTIN_SKILLS,
)
from app.services.model_router import (
    list_available_models,
    estimate_tokens,
    estimate_cost,
    route_model,
)
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(tags=["ai"])


# ─── 请求/响应模型 ───────────────────────────────────────────────

class OutlineRequest(BaseModel):
    title: str
    requirements: str = ""
    model: str = "deepseek"  # 可选：指定模型


class ContinueRequest(BaseModel):
    context: str
    instruction: str = ""
    model: str = "deepseek"


class PolishRequest(BaseModel):
    text: str
    style: str = "学术"
    model: str = "gpt-4o-mini"
    segmented: bool = False  # 是否使用分段润色（节省 token）


class AbstractRequest(BaseModel):
    text: str
    model: str = "deepseek"


class AnalysisRequest(BaseModel):
    text: str
    analysis_type: str = "critical"  # "critical" | "hook"
    model: str = "gpt-4o-mini"


class SkillExecuteRequest(BaseModel):
    skill: str  # "paper-outline" | "paper-draft" | "paper-revise" | ...
    paper_id: Optional[int] = None
    title: str = ""
    content: str = ""
    outline: str = ""
    extra: str = ""  # 额外参数（如导师反馈文本）


class SkillStepRequest(BaseModel):
    skill: str
    step_name: str
    title: str = ""
    content: str = ""
    outline: str = ""
    extra: str = ""


class EstimateRequest(BaseModel):
    text: str
    model: str = "deepseek"


# ─── 向后兼容的旧端点 ───────────────────────────────────────────

@router.post("/outline")
async def outline(req: OutlineRequest, user: User = Depends(get_current_user)):
    return {"result": await generate_outline(req.title, req.requirements, model=req.model)}


@router.post("/continue")
async def continue_(req: ContinueRequest, user: User = Depends(get_current_user)):
    return {"result": await continue_writing(req.context, req.instruction, model=req.model)}


@router.post("/polish")
async def polish_(req: PolishRequest, user: User = Depends(get_current_user)):
    if req.segmented and len(req.text) > 2000:
        result = await polish_by_segments(req.text, req.style, model=req.model)
        return {
            "result": "\n\n".join(result["segments"]),
            "cost": result["total_cost"],
            "tokens": result["total_tokens"],
        }
    return {"result": await polish(req.text, req.style, model=req.model)}


@router.post("/abstract")
async def abstract(req: AbstractRequest, user: User = Depends(get_current_user)):
    return {"result": await generate_abstract(req.text, model=req.model)}


# ─── 新增：文献分析 ──────────────────────────────────────────

@router.post("/analyze")
async def analyze(req: AnalysisRequest, user: User = Depends(get_current_user)):
    """文献综述的 Critical Analysis 或 Introduction 钩子改进"""
    if req.analysis_type == "critical":
        return {"result": await critical_analysis(req.text, model=req.model)}
    elif req.analysis_type == "hook":
        return {"result": await improve_introduction_hook(req.text, model=req.model)}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown analysis type: {req.analysis_type}")


# ─── 新增：Skill 执行端点 ────────────────────────────────────

@router.get("/skills")
async def list_all_skills(user: User = Depends(get_current_user)):
    """列出所有可用 Skill 及其步骤"""
    return {"skills": list_skills()}


@router.get("/skills/{skill_name}")
async def get_skill_detail(skill_name: str, user: User = Depends(get_current_user)):
    """获取某个 Skill 的详细信息"""
    steps = BUILTIN_SKILLS.get(skill_name)
    if not steps:
        raise HTTPException(status_code=404, detail=f"Skill not found: {skill_name}")
    return {
        "name": skill_name,
        "steps": [{"name": s.name, "description": s.description, "prompt_preview": s.prompt_template[:200] + "..."}
                   for s in steps],
    }


@router.post("/skill/execute")
async def execute_skill_endpoint(req: SkillExecuteRequest, user: User = Depends(get_current_user)):
    """
    执行一个完整的 Skill 流程。

    所有步骤自动执行，返回最终结果 + 成本估算。
    """
    paper_data = {
        "title": req.title,
        "content": req.content,
        "outline": req.outline,
    }
    result = await execute_skill(req.skill, paper_data, req.extra)
    return {
        "success": result.success,
        "skill": result.skill,
        "steps_completed": result.steps_completed,
        "output": result.output,
        "estimated_cost_usd": result.estimated_cost,
        "estimated_tokens": result.estimated_tokens,
        "warnings": result.warnings,
    }


@router.post("/skill/step")
async def execute_skill_step_endpoint(req: SkillStepRequest, user: User = Depends(get_current_user)):
    """
    执行 Skill 的单个步骤（人在回路模式）。

    用户可以在每一步后确认，再执行下一步。
    """
    paper_data = {
        "title": req.title,
        "content": req.content,
        "outline": req.outline,
    }
    output, cost, tokens = await execute_skill_step(
        req.skill, req.step_name, paper_data, req.extra
    )
    return {
        "step": req.step_name,
        "output": output,
        "estimated_cost_usd": cost,
        "estimated_tokens": tokens,
    }


# ─── 新增：模型管理端点 ──────────────────────────────────────

@router.get("/models")
async def list_models(user: User = Depends(get_current_user)):
    """列出所有可用模型及其价格信息"""
    return {"models": list_available_models()}


@router.post("/estimate")
async def estimate(req: EstimateRequest, user: User = Depends(get_current_user)):
    """估算文本的 token 数和调用成本"""
    tokens = estimate_tokens(req.text)
    cost = estimate_cost(req.model, tokens, 0)
    return {
        "text_length_chars": len(req.text),
        "estimated_tokens": tokens,
        "estimated_input_cost_usd": round(cost, 6),
        "model": req.model,
    }


@router.post("/chat")
async def chat(req: dict, user: User = Depends(get_current_user)):
    """
    多轮对话端点（带上下文管理）。

    接受 messages 数组，返回 AI 回复 + token 估算。
    """
    messages = req.get("messages", [])
    model = req.get("model", "deepseek")
    if not messages:
        raise HTTPException(status_code=400, detail="messages is required")

    from app.services.ai import call_llm_with_config

    result = await call_llm_with_config(model, messages)
    in_tokens = sum(estimate_tokens(m.get("content", "")) for m in messages)
    out_tokens = estimate_tokens(result)
    cost = estimate_cost(model, in_tokens, out_tokens)

    return {
        "result": result,
        "estimated_tokens": in_tokens + out_tokens,
        "estimated_cost_usd": round(cost, 6),
    }
