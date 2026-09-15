import axios from "axios";
import { Platform } from "react-native";

function defaultApiUrl(): string {
  if (Platform.OS === "android") return "http://10.0.2.2:4000/api";
  return "http://localhost:4000/api";
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl();

export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: unknown } | undefined;
    if (typeof data?.error === "string") return data.error;
    if (error.message) return error.message;
  }
  return fallback;
}
