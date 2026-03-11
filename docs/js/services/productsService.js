import {
  createProductRequest,
  deleteProductRequest,
  listProductsRequest,
  updateProductRequest,
} from "../api/productsApi.js";

export function listProducts() {
  return listProductsRequest();
}

export function createProduct(formData) {
  return createProductRequest(formData);
}

export function updateProduct(productId, formData) {
  return updateProductRequest(productId, formData);
}

export function deleteProduct(productId) {
  return deleteProductRequest(productId);
}
