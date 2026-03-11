import { cashSummaryRequest } from "../api/cashApi.js";

export function getCashSummary() {
  return cashSummaryRequest();
}
