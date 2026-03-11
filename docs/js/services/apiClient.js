const DEFAULT_API_BASE_URL = "http://localhost:3000/api";

function getApiBaseUrl() {
  return localStorage.getItem("apiBaseUrl") || DEFAULT_API_BASE_URL;
}

function getStoredTokens() {
  return {
    accessToken: localStorage.getItem("accessToken"),
    refreshToken: localStorage.getItem("refreshToken"),
  };
}

function saveTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
}

function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("authUser");
}

async function refreshAccessToken(refreshToken) {
  const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.accessToken || !payload.refreshToken) {
    throw new Error(payload.message || "session refresh failed");
  }

  saveTokens(payload.accessToken, payload.refreshToken);
  return payload.accessToken;
}

export async function apiRequest(path, options = {}) {
  const { method = "GET", body, auth = true, retry = true, accessTokenOverride } = options;
  const { accessToken, refreshToken } = getStoredTokens();
  const headers = {
    "Content-Type": "application/json",
  };
  const tokenToUse = accessTokenOverride || accessToken;

  if (auth && tokenToUse) {
    headers.Authorization = `Bearer ${tokenToUse}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401 && auth && retry && refreshToken) {
    try {
      const newAccessToken = await refreshAccessToken(refreshToken);
      return apiRequest(path, {
        ...options,
        retry: false,
        accessTokenOverride: newAccessToken,
      });
    } catch (_error) {
      clearSession();
      throw { status: 401, message: "session expired" };
    }
  }

  if (!response.ok) {
    throw {
      status: response.status,
      message: payload.message || "request failed",
      payload,
    };
  }

  return payload;
}

export function saveAuthUser(user) {
  localStorage.setItem("authUser", JSON.stringify(user));
}
