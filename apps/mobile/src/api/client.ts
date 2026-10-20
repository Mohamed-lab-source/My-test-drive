import axios, { type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import { getCurrentLocale } from "../i18n/LocaleContext";
import { reportCatalogSource, reportConnectivity } from "../utils/connectivity";
import { answerLocally } from "./localCatalog";

function defaultApiUrl(): string {
  if (Platform.OS === "android") return "http://10.0.2.2:4000/api";
  return "http://localhost:4000/api";
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl();

/** After the server fails, catalog reads skip it for this long instead of waiting on it every time. */
const SERVER_RETRY_MS = 60_000;
/** Catalog reads give up on a slow server sooner, since the bundled copy can answer instantly. */
const CATALOG_TIMEOUT_MS = 6_000;

let serverDownUntil = 0;

/**
 * True when the failure means "the server isn't there" rather than a real
 * answer: no response at all, a 5xx, or a non-JSON 404 (a hosting provider's
 * "app not found" page -- our API always answers 404s with JSON).
 */
function isServerUnavailable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const res = error.response;
  if (!res) return true;
  if (res.status >= 500) return true;
  return res.status === 404 && (typeof res.data !== "object" || res.data === null);
}

function localResponse(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: "OK (bundled catalog)", headers: {}, config, request: null };
}

const networkAdapter = axios.getAdapter(axios.defaults.adapter);

/**
 * Serves catalog requests (recipes, cuisines, ingredients, pantry matching,
 * shopping lists) from the recipes bundled in the app whenever the server
 * can't answer, so browsing and cooking never depend on it. Everything else
 * (accounts, ratings, synced lists) goes to the server as usual.
 */
const catalogFallbackAdapter: AxiosAdapter = async (config) => {
  const answer = () => answerLocally(config.method ?? "get", config.url ?? "", config.params ?? {}, config.data);
  const canAnswerLocally = answer() !== undefined;
  if (!canAnswerLocally) return networkAdapter(config);

  if (Date.now() < serverDownUntil) {
    reportCatalogSource("bundle");
    return localResponse(config, answer());
  }
  try {
    const response = await networkAdapter({ ...config, timeout: Math.min(config.timeout || CATALOG_TIMEOUT_MS, CATALOG_TIMEOUT_MS) });
    reportCatalogSource("server");
    return response;
  } catch (error) {
    if (!isServerUnavailable(error)) throw error;
    serverDownUntil = Date.now() + SERVER_RETRY_MS;
    if (axios.isAxiosError(error)) reportConnectivity(!!error.response);
    reportCatalogSource("bundle");
    return localResponse(config, answer());
  }
};

export const api = axios.create({ baseURL: API_URL, timeout: 15000, adapter: catalogFallbackAdapter });

/** Lets "retry" actions try the real server again right away. */
export function retryServerNow() {
  serverDownUntil = 0;
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  config.params = { ...(config.params ?? {}), lang: getCurrentLocale() };
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Bundled answers say nothing about the network; only real responses do.
    if (response.request !== null) reportConnectivity(true);
    return response;
  },
  (error) => {
    // A server reply (even 4xx/5xx) proves the network works; only a missing response means offline.
    if (axios.isAxiosError(error)) reportConnectivity(!!error.response);
    return Promise.reject(error);
  }
);

export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: unknown } | undefined;
    if (typeof data?.error === "string") return data.error;
    if (error.message) return error.message;
  }
  return fallback;
}
