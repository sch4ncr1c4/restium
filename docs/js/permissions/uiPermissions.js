export function isAdminOrGerente(userOrRole) {
  const role =
    typeof userOrRole === "string"
      ? userOrRole
      : userOrRole && typeof userOrRole === "object"
        ? userOrRole.role
        : "";
  const normalized = String(role || "").toLowerCase();
  return normalized === "admin" || normalized === "gerente";
}

export function buildUiPermissions(user) {
  const role = String(user?.role || "").toLowerCase();
  const isMozo = role === "mozo";
  const isAdminGerente = isAdminOrGerente(role);
  return {
    restrictToMesas: isMozo,
    canViewMenuDelivery: !isMozo,
    canEditPlans: !isMozo,
    canManageCatalog: !isMozo,
    canManageStaff: !isMozo,
    canUseCash: !isMozo,
    canUseClock: isAdminGerente,
    canUseTerminalWaiter: isAdminGerente,
  };
}
