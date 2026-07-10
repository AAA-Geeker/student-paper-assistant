import client from './client';

// ─── 向后兼容的旧 API ─────────────────────────────────────────

export const generateOutline = (title: string, requirements: string = '', model?: string) =>
  client.post('/ai/outline', { title, requirements, model });

export const continueWriting = (context: string, instruction: string = '', model?: string) =>
  client.post('/ai/continue', { context, instruction, model });

export const polish = (text: string, style: string = '学术', model?: string, segmented?: boolean) =>
  client.post('/ai/polish', { text, style, model, segmented });

export const generateAbstract = (text: string, model?: string) =>
  client.post('/ai/abstract', { text, model });

// ─── 新增：文献分析 ──────────────────────────────────────────

export const analyzeText = (text: string, analysisType: 'critical' | 'hook' = 'critical', model?: string) =>
  client.post('/ai/analyze', { text, analysis_type: analysisType, model });

// ─── 新增：Skill 执行 ────────────────────────────────────────

export interface SkillInfo {
  name: string;
  steps: { name: string; description: string }[];
}

export interface SkillDetail {
  name: string;
  steps: { name: string; description: string; prompt_preview: string }[];
}

export interface SkillExecuteRequest {
  skill: string;
  paper_id?: number;
  title?: string;
  content?: string;
  outline?: string;
  extra?: string;
}

export interface SkillExecuteResult {
  success: boolean;
  skill: string;
  steps_completed: string[];
  output: string;
  estimated_cost_usd: number;
  estimated_tokens: number;
  warnings: string[];
}

export interface SkillStepResult {
  step: string;
  output: string;
  estimated_cost_usd: number;
  estimated_tokens: number;
}

export const listSkills = () =>
  client.get<{ skills: SkillInfo[] }>('/ai/skills');

export const getSkillDetail = (skillName: string) =>
  client.get<SkillDetail>(`/ai/skills/${skillName}`);

export const executeSkill = (data: SkillExecuteRequest) =>
  client.post<SkillExecuteResult>('/ai/skill/execute', data);

export const executeSkillStep = (data: {
  skill: string;
  step_name: string;
  title?: string;
  content?: string;
  outline?: string;
  extra?: string;
}) => client.post<SkillStepResult>('/ai/skill/step', data);

// ─── 新增：模型管理 ──────────────────────────────────────────

export interface ModelInfo {
  name: string;
  provider: string;
  tier: string;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  available: boolean;
  max_tokens: number;
}

export const listModels = () =>
  client.get<{ models: ModelInfo[] }>('/ai/models');

export const estimateTokens = (text: string, model: string = 'deepseek') =>
  client.post('/ai/estimate', { text, model });

// ─── 新增：多轮对话 ──────────────────────────────────────────

export const chat = (messages: { role: string; content: string }[], model?: string) =>
  client.post('/ai/chat', { messages, model });
