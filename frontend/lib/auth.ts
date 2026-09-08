import apiRequest from "./api";
import type {
  AuthResponse,
  LoginData,
  RegisterData,
} from "@/types/auth";

export const registerUser = async (
  data: RegisterData,
): Promise<AuthResponse> => {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: data,
  });
};

export const loginUser = async (
  data: LoginData,
): Promise<AuthResponse> => {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: data,
  });
};

// Get authentication token
export const getToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("token");
};

// Save authentication token
export const setToken = (token: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem("token", token);
};

// Remove authentication token
export const removeToken = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem("token");
};