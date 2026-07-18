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

export const estimateAigcRewrite = (data: Omit<AigcRewriteRequest, 'urgent'>) =>
  client.post<CoreEstimateResult>('/core/aigc/estimate', data);

export const aigcRewrite = (data: AigcRewriteRequest) =>
  client.post<{ type: string; target: string; platform: string; original_length: number; result: string }>('/core/aigc', data);

export const estimatePreSubmissionReview = (data: Omit<PreSubmissionReviewRequest, 'urgent'>) =>
  client.post<CoreEstimateResult>('/core/review/estimate', data);

export const preSubmissionReview = (data: PreSubmissionReviewRequest) =>
  client.post<{ type: string; venue: string; venue_type: string; original_length: number; result: string }>('/core/review', data);

export const estimatePaperRevision = (data: Omit<PaperRevisionRequest, 'urgent'>) =>
  client.post<CoreEstimateResult>('/core/revision/estimate', data);

export const paperRevision = (data: PaperRevisionRequest) =>
  client.post<{ type: string; style: string; original_length: number; feedback_length: number; result: string }>('/core/revision', data);

export const estimateCoreCost = (data: CoreEstimateRequest) =>
  client.post<CoreEstimateResult>('/me/estimate', data);

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
