import client from './client';

export interface LoginForm { email: string; password: string; }
export const register = (data: LoginForm) => client.post('/auth/register', data);
export const login = (data: LoginForm) => client.post('/auth/login', data);
