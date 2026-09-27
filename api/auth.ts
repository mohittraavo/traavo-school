import { apiJson, setAuthToken } from './client';

export type SchoolAuthUser = {
  userId: number;
  schoolId: number;
  fullName: string;
  email: string;
  role: string;
  school: string;
};

export type SchoolAuthResponse = {
  token: string;
  user: SchoolAuthUser;
};

export async function schoolLogin(email: string, password: string): Promise<SchoolAuthResponse> {
  const response = await apiJson<SchoolAuthResponse>('/school/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(response.token);
  return response;
}

export async function schoolSession(): Promise<SchoolAuthResponse> {
  return apiJson<SchoolAuthResponse>('/school/auth/session');
}

export async function schoolLogout(): Promise<void> {
  try {
    await apiJson<void>('/school/auth/logout', { method: 'POST' });
  } finally {
    setAuthToken(null);
  }
}
