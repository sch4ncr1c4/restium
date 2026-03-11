import {
  clockByPinRequest,
  createUserRequest,
  deleteUserRequest,
  listActiveClockedUsersRequest,
  listUsersRequest,
  resolveWaiterByPinRequest,
  updateUserRequest,
} from "../api/waitersApi.js";

export function listStaffUsers() {
  return listUsersRequest();
}

export function saveStaffUser(payload, selectedStaffId = null) {
  if (selectedStaffId) {
    return updateUserRequest(selectedStaffId, payload);
  }
  return createUserRequest(payload);
}

export function removeStaffUser(userId) {
  return deleteUserRequest(userId);
}

export function resolveWaiterByPin(pinCode) {
  return resolveWaiterByPinRequest(pinCode);
}

export function clockStaffByPin(pinCode) {
  return clockByPinRequest(pinCode);
}

export function listActiveClockedUsers() {
  return listActiveClockedUsersRequest();
}
