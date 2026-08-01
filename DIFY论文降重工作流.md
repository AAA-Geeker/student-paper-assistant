# Dify 论文降重工作流 — 搭建记录 / DSL

> 记录在本地 Dify (`http://localhost:8080`) 中搭建"论文降重工作流"的进度、结构与 DSL。
> 目标：用节点化工作流替代"直接问 AI"，隐藏模型细节，供 FastAPI 后端通过 Dify Workflow API 调用。

## 一、应用信息

- 工作空间：Gongziqi's Workspace
- 应用：论文降重工作流（类型：Workflow / 工作流）
- 应用 App ID：`d5207fa1-e4f6-48da-83c1-4e3d13319adb`（编排 URL `/app/d5207fa1-e4f6-48da-83c1-4e3d13319adb/workflow`）
- 模型供应商：deepseek-r1:8b（本地 Ollama，CHAT）——本次编辑器中自动选用
- 状态：已配置开始节点 + LLM 节点，未发布

## 二、目标：三节点工作流

```
[开始] 用户输入 text, target
   │
[智能改写] LLM (deepseek-r1:8b)   ← 改写 prompt，引用 {{#start.text#}} {{#start.target#}}
   │
[输出] result = {{#rewrite.text#}}
```

> ⚠️ 已确认节点的 DOM/data id：
> - 开始节点 id = `1785506729912`
> - 智能改写节点 id = `1785509827030`
> - 输出节点 id = `1785510142210`
> 正确连线应满足：`1785506729912 → 1785509827030 → 1785510142210`（开始→智能改写→输出）。

### 2.1 开始节点输入变量

| 变量名 | 显示名称 | 类型 | 选项 | 必填 |
|--------|----------|------|------|------|
| `text` | 原文     | 段落 (paragraph) | —                | 是 |
| `target` | 改写目标 | 下拉选项 (select) | 降重 / 降AIGC / 同时 | 是 |

> 后续建议补充一个可选输入 `platform`（文本）：用于指定检测平台（如"知网/PaperPass"）以针对性改写。

### 2.2 LLM 改写节点（智能改写）

- 模型：deepseek-r1:8b（CHAT）
- SYSTEM 提示：`你是一位专业的学术论文改写助手。请根据用户指定的改写目标，对给定的论文原文进行改写，以降低重复率和/或降低 AIGC 检测率。`
- 用户提示（含变量引用）：

```
改写目标：{{#start.target#}}
（"降重"表示降低重复率，"降AIGC"表示降低AIGC检测率，"同时"表示两者兼顾）

要求：
1. 保持原意、数据、结论完全不变
2. 调整句式结构，替换同义词，拆分/合并长句
3. 保留所有专业术语，但改变表达形式
4. 输出流畅、符合学术规范的改写后文本

论文原文：
{{#start.text#}}
```

### 2.3 输出节点（result）

- 类型：输出 (Output / answer)
- 变量名：`result`，值引用 LLM 节点输出 `{{#rewrite.text#}}`（即智能改写节点生成的改写文本）
- 即后端 `data.outputs.result` 拿到的最终改写结果。

## 三、DSL（YAML，参考 Dify 1.x workflow DSL）

> 用于"导入 DSL 文件"快速重建同一工作流。`model` 指向 `deepseek-r1:8b`。
> ⚠️ 依你 Dify 版本节点 schema 可能略有差异（尤其 `provider_id`/`model` 字段与节点 id 命名），导入前如报错请照当前版本微调。

```yaml
app:
  mode: workflow
  name: 论文降重工作流
  description: 智能分析原文 → 逐段改写 → 质量校验 → 对比输出
  icon_type: emoji
  icon: 🤖
workflow:
  id: paper-dedupe
  title: 论文降重工作流
  description: 智能分析原文 → 逐段改写 → 质量校验 → 对比输出
  type: workflow
  environment_variables: []
  conversation_variables: []
  features:
    file_upload:
      enabled: false
  nodes:
    - id: start
      type: start
      title: 开始
      data:
        type: start
        title: 开始
        variables:
          - variable: text
            label:
              zh-Hans: 原文
            required: true
            type: paragraph
          - variable: target
            label:
              zh-Hans: 改写目标
            required: true
            type: select
            options:
              - 降重
              - 降AIGC
              - 同时
        advanced_settings:
          files: []
    - id: rewrite
      type: llm
      title: 智能改写
      position: { x: 260, y: 0 }
      data:
        type: llm
        title: 智能改写
        desc: 依据改写目标对原文进行降重/降AIGC改写
        model:
          provider: -provider-id-
          name: deepseek-r1:8b
          mode: chat
          completion_params:
            temperature: 0.7
        prompt_template:
          - role: system
            text: 你是一位专业的学术论文改写助手。请根据用户指定的改写目标，对给定的论文原文进行改写，以降低重复率和/或降低 AIGC 检测率。
          - role: user
            text: >-
              改写目标：{{#start.target#}}
              （"降重"表示降低重复率，"降AIGC"表示降低AIGC检测率，"同时"表示两者兼顾）

              要求：
              1. 保持原意、数据、结论完全不变
              2. 调整句式结构，替换同义词，拆分/合并长句
              3. 保留所有专业术语，但改变表达形式
              4. 输出流畅、符合学术规范的改写后文本

              论文原文：
              {{#start.text#}}
        outputs:
          - variable: text
          # 必要时的额外输出（若开启推理标签分离）:
          # - variable: reasoning_content
        memory: null
        context:
          enabled: false
    - id: end
      type: answer
      title: 输出
      position: { x: 520, y: 0 }
      data:
        type: answer
        title: 输出
        value:
          - type: variable
            value: '{{#rewrite.text#}}'
        answer: '{{#rewrite.text#}}'
  edges:
    - id: edge-start-rewrite
      source: start
      target: rewrite
      type: normal
      sourceHandle: source
      targetHandle: target
    - id: edge-rewrite-end
      source: rewrite
      target: end
      type: normal
      sourceHandle: source
      targetHandle: target
```

## 四、后端接入要点（下一步落代码）

- `POST {DIFY_BASE}/v1/workflows/run`
- 请求体：
  ```json
  {
    "inputs": { "text": "…原文…", "target": "同时" },
    "user": "student-paper-assistant",
    "response_mode": "blocking"
  }
  ```
- 从 `data.outputs` 取改写文本，回填到现有 `core_features._build_workflow_response("aigc_rewrite", …)` 的 `revised_text`。
