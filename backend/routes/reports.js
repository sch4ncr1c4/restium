const { Router } = require("express");
const { getDailySalesReport } = require("../controllers/reportsController");
const authMiddleware = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/requireRoles");
const { ROLES } = require("../constants/roles");

const router = Router();

router.get(
  "/sales/daily",
  authMiddleware,
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  getDailySalesReport
);

module.exports = router;
