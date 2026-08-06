export interface RegisterRequest {
  username: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface UpdateMeRequest {
  avatarUrl?: string;
  phone?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminAuthTokens {
  accessToken: string;
}
