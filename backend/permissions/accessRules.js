const { ROLES } = require("../constants/roles");

const ROLE_GROUPS = Object.freeze({
  ADMIN_ONLY: Object.freeze([ROLES.ADMIN]),
  ADMIN_MANAGER: Object.freeze([ROLES.ADMIN, ROLES.GERENTE]),
  CASH_ACCESS: Object.freeze([ROLES.ADMIN, ROLES.GERENTE, ROLES.CAJERO]),
  ORDER_ACCESS: Object.freeze([ROLES.ADMIN, ROLES.GERENTE, ROLES.MOZO]),
  CLOCK_ACCESS: Object.freeze([ROLES.ADMIN, ROLES.GERENTE]),
});

function hasAnyRole(userOrRole, allowedRoles = []) {
  const role =
    typeof userOrRole === "string"
      ? userOrRole
      : userOrRole && typeof userOrRole === "object"
        ? userOrRole.role
        : null;
  if (!role) return false;
  return allowedRoles.includes(role);
}

function canManageUsers(userOrRole) {
  return hasAnyRole(userOrRole, ROLE_GROUPS.ADMIN_MANAGER);
}

function canUseClockModule(userOrRole) {
  return hasAnyRole(userOrRole, ROLE_GROUPS.CLOCK_ACCESS);
}

module.exports = {
  ROLE_GROUPS,
  hasAnyRole,
  canManageUsers,
  canUseClockModule,
};
