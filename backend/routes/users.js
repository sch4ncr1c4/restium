const { Router } = require("express");
const {
  clockUserByPin,
  createUser,
  deleteUser,
  listActiveClockUsers,
  listUsers,
  resolveWaiterByPin,
  updateUser,
  updateUserRole,
} = require("../controllers/usersController");
const authMiddleware = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/requireRoles");
const { ROLES } = require("../constants/roles");

const router = Router();

router.use(authMiddleware);

router.post("/clock", requireRoles(ROLES.ADMIN, ROLES.GERENTE), clockUserByPin);
router.post("/resolve-pin", resolveWaiterByPin);
router.get(
  "/clock/active",
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  listActiveClockUsers
);
router.post("/", requireRoles(ROLES.ADMIN, ROLES.GERENTE), createUser);
router.get("/", requireRoles(ROLES.ADMIN, ROLES.GERENTE), listUsers);
router.patch("/:id", requireRoles(ROLES.ADMIN, ROLES.GERENTE), updateUser);
router.patch("/:id/role", requireRoles(ROLES.ADMIN, ROLES.GERENTE), updateUserRole);
router.delete("/:id", requireRoles(ROLES.ADMIN, ROLES.GERENTE), deleteUser);

module.exports = router;
