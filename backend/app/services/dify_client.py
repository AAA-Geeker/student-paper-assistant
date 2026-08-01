"""
Dify 工作流 API 客户端。

将后端的 AI 调用从"直连 LLM"切换到 Dify 节点化工作流，从而：
  - 隐藏模型细节（模型、prompt、编排全在 Dify 侧）
  - 用工作流限制"直接问 AI"的自由对话（每个功能映射到固定工作流）

调用协议：POST {DIFY_BASE_URL}/v1/workflows/run
  body:  {"inputs": {...}, "user": "...", "response_mode": "blocking"}
  返回:  {"data": {"outputs": {...}, "status": "succeeded", ...}}

本客户端只依赖 httpx（项目已有），无第三方新依赖。
"""

import json
import httpx
from typing import Dict, Any, Optional

from app.config import settings


class DifyError(RuntimeError):
    """Dify 调用失败时抛出。"""


def dify_enabled() -> bool:
    """Dify 工作流总开关是否打开。"""
    return bool(settings.DIFY_ENABLED and settings.DIFY_API_KEY and settings.DIFY_BASE_URL)


def get_workflow_id(scene: str) -> Optional[str]:
    """根据场景名取对应的 Dify 工作流 id。scene 对应 schemas/commerce 里的场景名。"""
    mapping: Dict[str, str] = settings.DIFY_WORKFLOW_IDS or {}
    return (mapping.get(scene) or "").strip() or None


async def run_workflow(
    scene: str,
    inputs: Dict[str, Any],
    user: str = "student-paper-assistant",
    timeout: float = 120.0,
) -> Dict[str, Any]:
    """
    运行一个 Dify 工作流（阻塞模式），返回 data.outputs 字典。

    Args:
        scene: 场景名（aigc_rewrite / pre_review / paper_revision / advisor_revision / reviewer_revision ...）
        inputs: 传给工作流开始节点的输入变量
        user:   Dify 侧的 user 标识
        timeout: 超时（秒）
    Raises:
        DifyError: 工作流未配置 / 调用失败 / 非 succeeded
    """
    if not dify_enabled():
        raise DifyError("Dify 未启用：请配置 DIFY_ENABLED/DIFY_API_KEY/DIFY_BASE_URL")

    workflow_id = get_workflow_id(scene)
    if not workflow_id:
        raise DifyError(f"场景 {scene!r} 未配置 Dify workflow id（DIFY_WORKFLOW_IDS）")

    url = f"{settings.DIFY_BASE_URL.rstrip('/')}/v1/workflows/run"
    body = {
        "inputs": inputs,
        "user": user,
        "response_mode": "blocking",
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            r = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {settings.DIFY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            detail = r.text[:500] if "r" in locals() else str(e)
            raise DifyError(f"Dify workflow HTTP {e.response.status_code}: {detail}") from e
        except httpx.TimeoutException as e:
            raise DifyError(f"Dify workflow timeout: {e}") from e

    data = r.json()
    wf_data = data.get("data") or {}

    if wf_data.get("status") not in (None, "succeeded"):
        raise DifyError(f"Dify workflow failed: status={wf_data.get('status')} error={wf_data.get('error')}")

    outputs = wf_data.get("outputs", {})
    # Dify 返回的 outputs 可能序列化成 JSON 字符串，做一次容错解析
    if isinstance(outputs, str):
        try:
            outputs = json.loads(outputs)
        except json.JSONDecodeError:
            # 纯文本 fallback：包成 {result: <text>}
            outputs = {"result": outputs}

    result = {"outputs": outputs, "task_id": wf_data.get("task_id")}
    return result


async def run_workflow_text(
    scene: str,
    inputs: Dict[str, Any],
    user: str = "student-paper-assistant",
) -> str:
    """
    运行工作流并取出主文本结果。

    优先取 outputs.result；否则依次取 outputs 里的第一个字符串字段。
    文本生成类工作流（降重/审查等）最终都只关心一段文本来回填到原响应里。
    """
    res = await run_workflow(scene, inputs, user=user)
    outputs = res["outputs"]
    if not outputs:
        return ""

    if "result" in outputs and isinstance(outputs["result"], str):
        return outputs["result"]
    if "text" in outputs and isinstance(outputs["text"], str):
        return outputs["text"]
    for v in outputs.values():
        if isinstance(v, str):
            return v
    return ""
