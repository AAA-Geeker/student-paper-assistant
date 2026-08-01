"""
工作流引擎 — 以 Dify 风格节点化工作流替代"直接问 AI"的体验。
隐藏模型细节，用户只看到"输入→处理→输出"的流程节点。

工作流类型：
- aigc_rewrite: 降重/降AIGC流程（分析→改写→对比→输出）
- pre_review: 投稿审查流程（解析→审查→报告→建议）
- paper_revision: 论文修改流程（解析反馈→分点修改→整合输出）
- advisor_revision: 导师批注修改（导入PDF→解析批注→逐条修改→生成对比文档）
- reviewer_revision: 审稿人修改（导入审稿意见→逐条回复→修改→生成response letter）
"""

from typing import Dict, List, Optional, Callable, Any
import json


class WorkflowNode:
    """工作流节点，对应 Dify 中的一个处理块"""

    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        icon: str,
        status: str = "pending",  # pending | running | completed | error
    ):
        self.id = id
        self.name = name
        self.description = description
        self.icon = icon
        self.status = status
        self.input_summary = ""
        self.output_summary = ""


class Workflow:
    """完整工作流定义"""

    def __init__(self, workflow_type: str, title: str, description: str):
        self.workflow_type = workflow_type
        self.title = title
        self.description = description
        self.nodes: List[WorkflowNode] = []
        self._context: Dict[str, Any] = {}

    def add_node(self, node: WorkflowNode) -> "Workflow":
        self.nodes.append(node)
        return self

    def set_context(self, key: str, value: Any):
        self._context[key] = value

    def get_context(self, key: str, default=None):
        return self._context.get(key, default)

    def to_frontend(self) -> Dict:
        return {
            "type": self.workflow_type,
            "title": self.title,
            "description": self.description,
            "nodes": [
                {
                    "id": n.id,
                    "name": n.name,
                    "description": n.description,
                    "icon": n.icon,
                    "status": n.status,
                    "input_summary": n.input_summary,
                    "output_summary": n.output_summary,
                }
                for n in self.nodes
            ],
        }


# ─── 工作流工厂 ───────────────────────────────────────────────────

WORKFLOW_DEFINITIONS = {
    "aigc_rewrite": {
        "title": "论文降重工作流",
        "description": "智能分析原文 → 逐段改写 → 质量对比 → 导出结果",
        "nodes": [
            WorkflowNode(
                "analysis", "文本分析", "分析原文的重复率和AIGC特征", "🔍",
            ),
            WorkflowNode(
                "rewrite", "智能改写", "基于检测平台特征进行针对性改写", "✏️",
            ),
            WorkflowNode(
                "quality_check", "质量检查", "检查改写后的学术性和术语准确性", "✅",
            ),
            WorkflowNode(
                "comparison", "效果对比", "生成改写前后的对比报告", "📊",
            ),
            WorkflowNode(
                "export", "结果输出", "生成最终结果并导出", "📥",
            ),
        ],
    },
    "pre_review": {
        "title": "投稿审查工作流",
        "description": "论文解析 → 多维度审查 → 优先级报告 → 修改建议",
        "nodes": [
            WorkflowNode(
                "parse", "论文解析", "解析论文结构和核心内容", "📄",
            ),
            WorkflowNode(
                "structure_review", "结构审查", "审查论文框架和逻辑完整性", "🏗️",
            ),
            WorkflowNode(
                "method_review", "方法审查", "审查实验设计和方法的严谨性", "🔬",
            ),
            WorkflowNode(
                "language_review", "语言审查", "审查语言表达和学术规范性", "📝",
            ),
            WorkflowNode(
                "report", "审查报告", "生成带优先级的修改清单", "📋",
            ),
        ],
    },
    "paper_revision": {
        "title": "论文修改工作流",
        "description": "解析反馈 → 逐条修改 → 整合输出 → 复查确认",
        "nodes": [
            WorkflowNode(
                "feedback_parse", "反馈解析", "逐条解析导师/审稿人意见", "📌",
            ),
            WorkflowNode(
                "revision", "逐条修改", "针对每条反馈生成修改方案", "✏️",
            ),
            WorkflowNode(
                "integration", "整合输出", "将修改方案整合为完整论文", "🔄",
            ),
            WorkflowNode(
                "review_check", "复查确认", "确认修改是否匹配反馈要求", "✅",
            ),
        ],
    },
    "advisor_revision": {
        "title": "导师批注修改",
        "description": "导入PDF批注 → 解析批注 → 逐条修改 → 生成对比文档",
        "nodes": [
            WorkflowNode(
                "pdf_import", "PDF导入", "导入含有导师批注的PDF文件", "📎",
            ),
            WorkflowNode(
                "annotation_parse", "批注解析", "智能识别并解析导师批注意见", "📌",
            ),
            WorkflowNode(
                "revision", "逐条修改", "针对每条批注生成修改方案", "✏️",
            ),
            WorkflowNode(
                "comparison", "对比输出", "生成修改前后对比文档", "📊",
            ),
            WorkflowNode(
                "export", "结果导出", "导出修改后的文档", "📥",
            ),
        ],
    },
    "reviewer_revision": {
        "title": "审稿人修改",
        "description": "导入审稿意见 → 逐条回复 → 修改 → 生成Response Letter",
        "nodes": [
            WorkflowNode(
                "review_import", "审稿意见导入", "导入审稿人评审意见", "📎",
            ),
            WorkflowNode(
                "point_analysis", "逐条分析", "逐条分析审稿意见的核心要求", "🔍",
            ),
            WorkflowNode(
                "response_draft", "回复草稿", "生成给审稿人的逐条回复", "✉️",
            ),
            WorkflowNode(
                "revision", "论文修改", "根据审稿意见修改论文", "✏️",
            ),
            WorkflowNode(
                "finalize", "整合输出", "整合回复信和修改后论文", "📋",
            ),
        ],
    },
}


def get_workflow_definition(workflow_type: str) -> Optional[Dict]:
    """获取工作流定义"""
    return WORKFLOW_DEFINITIONS.get(workflow_type)


def create_workflow(workflow_type: str, original_text: str = "", **kwargs) -> Workflow:
    """创建工作流实例"""
    definition = get_workflow_definition(workflow_type)
    if not definition:
        raise ValueError(f"Unknown workflow type: {workflow_type}")

    wf = Workflow(
        workflow_type=workflow_type,
        title=definition["title"],
        description=definition["description"],
    )

    for node_def in definition["nodes"]:
        node = WorkflowNode(
            id=node_def.id,
            name=node_def.name,
            description=node_def.description,
            icon=node_def.icon,
        )
        wf.add_node(node)

    wf.set_context("original_text", original_text)
    for k, v in kwargs.items():
        wf.set_context(k, v)

    return wf
