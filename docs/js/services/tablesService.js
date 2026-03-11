import { tablesApi } from "../api/tablesApi.js";

export function listTableOrders() {
  return tablesApi.listOrdersRequest();
}

export function createTableOrder(payload) {
  return tablesApi.createOrderRequest(payload);
}

export function changeTableOrderStatus(orderId, status) {
  return tablesApi.updateOrderStatusRequest(orderId, status);
}
