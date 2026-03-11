import { listOrdersRequest, createOrderRequest, updateOrderStatusRequest } from "./ordersApi.js";

// Placeholder API wrapper for mesa/comanda domain.
// Today mesas are mostly client-side state, while orders endpoints already exist.
export const tablesApi = {
  listOrdersRequest,
  createOrderRequest,
  updateOrderStatusRequest,
};
