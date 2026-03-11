import { apiRequest } from "../services/apiClient.js";

export function loginRequest(payload) {
  return apiRequest("/auth/login", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export function registerRequest(payload) {
  return apiRequest("/auth/register", {
    method: "POST",
    auth: false,
    body: payload,
  });
}

export function logoutRequest(refreshToken) {
  return apiRequest("/auth/logout", {
    method: "POST",
    auth: false,
    body: { refreshToken },
  });
}

export function meRequest() {
  return apiRequest("/auth/me", { auth: true });
}
