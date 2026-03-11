import { apiRequest } from "../services/apiClient.js";

export function listUsersRequest() {
  return apiRequest("/users", { auth: true });
}

export function createUserRequest(payload) {
  return apiRequest("/users", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

export function updateUserRequest(userId, payload) {
  return apiRequest(`/users/${userId}`, {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

export function deleteUserRequest(userId) {
  return apiRequest(`/users/${userId}`, {
    method: "DELETE",
    auth: true,
  });
}

export function resolveWaiterByPinRequest(pinCode) {
  return apiRequest("/users/resolve-pin", {
    method: "POST",
    auth: true,
    body: { pinCode },
  });
}

export function clockByPinRequest(pinCode) {
  return apiRequest("/users/clock", {
    method: "POST",
    auth: true,
    body: { pinCode },
  });
}

export function listActiveClockedUsersRequest() {
  return apiRequest("/users/clock/active", { auth: true });
}
