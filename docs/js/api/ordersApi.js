import { apiRequest } from "../services/apiClient.js";

export function listOrdersRequest() {
  return apiRequest("/orders", { auth: true });
}

export function createOrderRequest(payload) {
  return apiRequest("/orders", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

export function updateOrderStatusRequest(orderId, status) {
  return apiRequest(`/orders/${orderId}/status`, {
    method: "PATCH",
    auth: true,
    body: { status },
  });
}
