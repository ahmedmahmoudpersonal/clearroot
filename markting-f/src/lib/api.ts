import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string[];
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Auth API functions
export const authApi = {
  register: async (data: RegisterData): Promise<{ message: string }> => {
    const response = await api.post("/auth/register", data);
    return response.data as { message: string };
  },

  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const response = await api.get(`/auth/verify-email?token=${token}`);
    return response.data as { message: string };
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post("/auth/login", data);
    return response.data as AuthResponse;
  },

  forgotPassword: async (
    data: ForgotPasswordData
  ): Promise<{ message: string }> => {
    const response = await api.post("/auth/forgot-password", data);
    return response.data as { message: string };
  },

  resetPassword: async (
    data: ResetPasswordData
  ): Promise<{ message: string }> => {
    const response = await api.post("/auth/reset-password", data);
    return response.data as { message: string };
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get("/auth/profile");
    return response.data as User;
  },
};

export default api;
