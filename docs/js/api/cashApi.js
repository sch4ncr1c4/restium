import { apiRequest } from "../services/apiClient.js";

export function cashSummaryRequest() {
  return apiRequest("/cash/summary", { auth: true });
}
