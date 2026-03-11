import { apiRequest, apiFormRequest } from "../services/apiClient.js";

export function listProductsRequest() {
  return apiRequest("/products", { auth: true });
}

export function createProductRequest(formData) {
  return apiFormRequest("/products", {
    method: "POST",
    auth: true,
    formData,
  });
}

export function updateProductRequest(productId, formData) {
  return apiFormRequest(`/products/${productId}`, {
    method: "PATCH",
    auth: true,
    formData,
  });
}

export function deleteProductRequest(productId) {
  return apiRequest(`/products/${productId}`, {
    method: "DELETE",
    auth: true,
  });
}
