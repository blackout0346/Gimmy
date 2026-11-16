import { apiFetch, tokenStorage } from '@/lib/http';
import {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '../DTOs/auth/route';

const BASE_URL = `${process.env.NEXT_PUBLIC_AUTH_API_URL}/api/auth`;

export const authService = {
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const res = await apiFetch<RegisterResponse>(`${BASE_URL}/register`, {
      method: 'POST',
      auth: false,
      body: JSON.stringify(data),
    });
    if (res.token) {
      tokenStorage.set(res.token);
    }
    return res;
  },

  async login(data: LoginRequest): Promise<LoginResponse> {
    const res = await apiFetch<LoginResponse>(`${BASE_URL}/login`, {
      method: 'POST',
      auth: false,
      body: JSON.stringify(data),
    });
    if (res.token) {
      tokenStorage.set(res.token);
    }
    return res;
  },

  async changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`${BASE_URL}/ChangePassword`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteUser(userId: string): Promise<{ message: string }> {
    const res = await apiFetch<{ message: string }>(`${BASE_URL}/DeleteUser/${userId}`, {
      method: 'DELETE',
    });
    tokenStorage.clear();
    return res;
  },

  logout(): void {
    tokenStorage.clear();
  },
};