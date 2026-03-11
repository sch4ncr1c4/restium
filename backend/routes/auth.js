const { Router } = require("express");
const {
  login,
  register,
  refresh,
  logout,
  me,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authMiddleware, me);

module.exports = router;
