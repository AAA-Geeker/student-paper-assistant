import client from './client';

export interface Paper {
  id: number; title: string; content: string; outline: string;
  created_at: string; updated_at: string;
}
export interface PaperCreate { title: string; content?: string; outline?: string; }

export const listPapers = () => client.get<Paper[]>('/papers');
export const getPaper = (id: number) => client.get<Paper>(`/papers/${id}`);
export const createPaper = (data: PaperCreate) => client.post<Paper>('/papers', data);
export const updatePaper = (id: number, data: Partial<PaperCreate>) => client.put<Paper>(`/papers/${id}`, data);
export const deletePaper = (id: number) => client.delete(`/papers/${id}`);
export const exportPaper = (id: number, fmt: string) =>
  client.get(`/papers/${id}/export/${fmt}`, { responseType: 'blob' });
