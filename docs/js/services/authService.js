import { loginRequest, logoutRequest, meRequest, registerRequest } from "../api/authApi.js";

const LOGIN_BASE_URLS = ["http://localhost:3000/api", "http://127.0.0.1:3000/api"];

function saveSession(payload) {
  localStorage.setItem("accessToken", payload.accessToken);
  localStorage.setItem("refreshToken", payload.refreshToken);
  localStorage.setItem("authUser", JSON.stringify(payload.user));
}

export function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("authUser");
}

export function readStoredUser() {
  const raw = localStorage.getItem("authUser");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export async function loginWithFallback(payload) {
  let lastError = null;
  for (const baseUrl of LOGIN_BASE_URLS) {
    localStorage.setItem("apiBaseUrl", baseUrl);
    try {
      const response = await loginRequest(payload);
      saveSession(response);
      return response;
    } catch (error) {
      lastError = error;
      if (error?.status && error.status < 500) {
        throw error;
      }
    }
  }
  throw lastError || new Error("login failed");
}

export async function registerAccount(payload) {
  const response = await registerRequest(payload);
  saveSession(response);
  return response;
}

export async function logoutCurrentSession() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return;
  try {
    await logoutRequest(refreshToken);
  } catch (_error) {
    // local logout still applies
  }
}

export async function fetchCurrentUser() {
  return meRequest();
}
