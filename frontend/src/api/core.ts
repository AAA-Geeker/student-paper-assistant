import client from './client';

export interface AigcRewriteRequest {
  text: string;
  target?: 'plagiarism' | 'aigc' | 'both';
  platform?: string;
  urgent?: boolean;
  model?: string;
}

export interface PreSubmissionReviewRequest {
  text: string;
  venue: string;
  venue_type?: 'conference' | 'journal';
  urgent?: boolean;
  model?: string;
}

export interface PaperRevisionRequest {
  text: string;
  feedback: string;
  style?: 'minimal' | 'standard' | 'deep';
  urgent?: boolean;
  model?: string;
}

export interface CoreEstimateRequest {
  scene: 'aigc_rewrite' | 'pre_submission_review' | 'paper_revision';
  text_length: number;
  urgent?: boolean;
}

export interface CoreEstimateResult {
  scene: string;
  scene_name: string;
  points: number;
  is_free: boolean;
  discount: number;
  urgent: boolean;
}

// 工作流响应类型
export interface WorkflowNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface Workflow {
  type: string;
  title: string;
  description: string;
  nodes: WorkflowNode[];
}

export interface ComparisonSegment {
  original: string;
  revised: string;
  status: 'unchanged' | 'modified' | 'added' | 'deleted';
  similarity: number;
}

export interface ComparisonStats {
  original_chars: number;
  revised_chars: number;
  char_change: number;
  char_change_percent: number;
  total_segments: number;
  unchanged_segments: number;
  modified_segments: number;
  added_segments: number;
  deleted_segments: number;
  modification_rate: number;
}

export interface ComparisonResult {
  original_length: number;
  revised_length: number;
  segments: ComparisonSegment[];
  stats: ComparisonStats;
}

export interface WorkflowResponse {
  workflow: Workflow;
  original_text: string;
  revised_text: string;
  comparison: ComparisonResult;
  result: string;
  // 向下兼容字段
  type?: string;
  target?: string;
  platform?: string;
  venue?: string;
  style?: string;
  original_length?: number;
  // 审稿人修改（reviewer_revision）结构化结果
  response_letter?: string;
  revised_paper?: string;
  compare_items?: string[];
  // 投稿前审查（pre_submission_review）结构化结果
  overall?: string;
  issues_multiline?: string;
  strengths?: string;
  suggestions?: string;
  major_issues?: { severity: 'critical' | 'major' | 'minor'; text: string }[];
}

export const estimateAigcRewrite = (data: Omit<AigcRewriteRequest, 'urgent'>) =>
  client.post<CoreEstimateResult>('/core/aigc/estimate', data);

export const aigcRewrite = (data: AigcRewriteRequest) =>
  client.post<WorkflowResponse>('/core/aigc', data);

export const estimatePreSubmissionReview = (data: Omit<PreSubmissionReviewRequest, 'urgent'>) =>
  client.post<CoreEstimateResult>('/core/review/estimate', data);

export const preSubmissionReview = (data: PreSubmissionReviewRequest) =>
  client.post<WorkflowResponse>('/core/review', data);

export const estimatePaperRevision = (data: Omit<PaperRevisionRequest, 'urgent'>) =>
  client.post<CoreEstimateResult>('/core/revision/estimate', data);

export const paperRevision = (data: PaperRevisionRequest) =>
  client.post<WorkflowResponse>('/core/revision', data);

export const estimateCoreCost = (data: CoreEstimateRequest) =>
  client.post<CoreEstimateResult>('/me/estimate', data);

// 导师批注修改
export interface AdvisorRevisionRequest {
  original_text: string;
  annotations: string;
  model?: string;
}

export const advisorRevision = (data: AdvisorRevisionRequest) =>
  client.post<WorkflowResponse>('/core/advisor-revision', data);

export const uploadAdvisorPDF = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return client.post<WorkflowResponse>('/core/advisor-revision/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// 通用文件文本提取（Word/PDF/TXT → 文本）
export const extractText = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return client.post<{ text: string; filename: string; chars: number }>(
    '/core/extract-text',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
};

// 审稿人修改
export interface ReviewerRevisionRequest {
  original_text: string;
  reviewer_comments: string;
  model?: string;
}

export const reviewerRevision = (data: ReviewerRevisionRequest) =>
  client.post<WorkflowResponse>('/core/reviewer-revision', data);

export const compareTexts = (original: string, revised: string) =>
  client.post<ComparisonResult>('/core/compare', { original, revised });

// 用户资产
export interface UserProfile {
  id: number;
  email: string;
  credits: number;
  credits_used: number;
  subscription_plan: string;
  is_premium: boolean;
  subscription_expires_at?: string;
}

export interface CreditTransaction {
  id: number;
  type: string;
  scene: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface CreditsInfo {
  credits: number;
  credits_used: number;
  transactions: CreditTransaction[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthly_price_rmb: number;
  yearly_price_rmb: number;
  monthly_discount_label: string;
  daily_free_core: number;
  discount_percent: number;
  description: string;
}

export interface TopUpPackage {
  id: string;
  name: string;
  credits: number;
  bonus: number;
  total_credits: number;
  price_rmb: number;
}

export const getProfile = () => client.get<UserProfile>('/me/profile');
export const getCredits = () => client.get<CreditsInfo>('/me/credits');
export const getSubscription = () => client.get('/me/subscription');
export const getTopUpPackages = () => client.get<{ packages: TopUpPackage[] }>('/me/top-up-packages');
export const topUp = (package_id: string) => client.post('/me/top-up', { package_id });
export const getSubscriptionPlans = () => client.get<{ plans: SubscriptionPlan[] }>('/me/subscription-plans');
export const subscribe = (plan: string) => client.post('/me/subscribe', { plan });

// 辅助功能
export const defenseSimulation = (data: { text: string; model?: string }) =>
  client.post<{ type: string; original_length: number; result: string }>('/core/defense-simulation', data);

export const formatCheck = (data: { text: string; venue?: string; model?: string }) =>
  client.post<{ type: string; venue: string; original_length: number; result: string }>('/core/format-check', data);

export const revisionReview = (data: { original_text: string; revised_text: string; feedback: string; model?: string }) =>
  client.post<{ type: string; original_length: number; revised_length: number; result: string }>('/core/revision-review', data);

export const literatureReview = (data: { references: string; topic?: string; model?: string }) =>
  client.post<{ type: string; topic: string; reference_count: number; result: string }>('/core/literature-review', data);

export const cnToEn = (data: { text: string; model?: string }) =>
  client.post<{ type: string; original_length: number; result: string }>('/core/cn-to-en', data);
