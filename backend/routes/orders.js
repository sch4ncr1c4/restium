const { Router } = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/requireRoles");
const { ROLES } = require("../constants/roles");
const {
  listOrders,
  createOrder,
  updateOrderStatus,
} = require("../controllers/ordersController");

const router = Router();

router.get("/", authMiddleware, listOrders);
router.post(
  "/",
  authMiddleware,
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.MOZO),
  createOrder
);
router.patch("/:id/status", authMiddleware, updateOrderStatus);

module.exports = router;
