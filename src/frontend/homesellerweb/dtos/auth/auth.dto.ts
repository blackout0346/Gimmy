export interface ChangePasswordRequest {
  login: string;
  currentPassword: string;
  newPassword: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface LoginResponse {
  userId: string; 
  login: string;
  token: string;
}

export interface RegisterRequest {
  login: string;
  password: string;
}

export interface RegisterResponse {
  userId: string;
  login: string;
  token: string | null; 
}