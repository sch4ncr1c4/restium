const { ROLES } = require("../constants/roles");

const VALID_ORDER_STATUSES = new Set([
  "pending",
  "preparing",
  "ready",
  "served",
  "paid",
  "cancelled",
]);

function canChangeOrderStatus(role, nextStatus) {
  if ([ROLES.ADMIN, ROLES.GERENTE].includes(role)) {
    return true;
  }

  const statusRoleMap = {
    preparing: [ROLES.COCINA],
    ready: [ROLES.COCINA],
    served: [ROLES.MOZO],
    paid: [ROLES.CAJERO],
    cancelled: [],
    pending: [],
  };

  return statusRoleMap[nextStatus]?.includes(role) || false;
}

module.exports = {
  VALID_ORDER_STATUSES,
  canChangeOrderStatus,
};
