import { createOrderRequest, listOrdersRequest, updateOrderStatusRequest } from "../api/ordersApi.js";

export function listOrders() {
  return listOrdersRequest();
}

export function createOrder(payload) {
  return createOrderRequest(payload);
}

export function updateOrderStatus(orderId, status) {
  return updateOrderStatusRequest(orderId, status);
}
