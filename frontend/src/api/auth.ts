import client from './client';

export interface LoginForm { email: string; password: string; }
export interface SendCodePayload { email: string; }
export interface RegisterForm { email: string; password: string; code: string; }

export const register = (data: RegisterForm) => client.post('/auth/register', data);
export const login = (data: LoginForm) => client.post('/auth/login', data);
export const sendCode = (data: SendCodePayload) => client.post('/auth/send-code', data);
