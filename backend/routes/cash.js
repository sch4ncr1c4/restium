const { Router } = require("express");
const { getCashSummary, closeCashShift } = require("../controllers/cashController");
const authMiddleware = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/requireRoles");
const { ROLES } = require("../constants/roles");

const router = Router();

router.get(
  "/summary",
  authMiddleware,
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.CAJERO),
  getCashSummary
);
router.post(
  "/close",
  authMiddleware,
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.CAJERO),
  closeCashShift
);

module.exports = router;
