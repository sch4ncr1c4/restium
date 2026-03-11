const ROLES = Object.freeze({
  ADMIN: "admin",
  GERENTE: "gerente",
  CAJERO: "cajero",
  MOZO: "mozo",
  COCINA: "cocina",
});

const VALID_ROLES = Object.freeze([
  ROLES.ADMIN,
  ROLES.GERENTE,
  ROLES.CAJERO,
  ROLES.MOZO,
  ROLES.COCINA,
]);

const DEFAULT_ROLE = ROLES.MOZO;

module.exports = {
  ROLES,
  VALID_ROLES,
  DEFAULT_ROLE,
};
