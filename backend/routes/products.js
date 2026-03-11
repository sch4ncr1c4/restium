const { Router } = require("express");
const {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productsController");
const authMiddleware = require("../middleware/authMiddleware");
const requireRoles = require("../middleware/requireRoles");
const { ROLES } = require("../constants/roles");
const { uploadProductImage } = require("../middleware/uploadMiddleware");

const router = Router();

router.get("/", authMiddleware, getProducts);
router.post(
  "/",
  authMiddleware,
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  uploadProductImage.single("imageFile"),
  createProduct
);
router.patch(
  "/:id",
  authMiddleware,
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  uploadProductImage.single("imageFile"),
  updateProduct
);
router.delete(
  "/:id",
  authMiddleware,
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  deleteProduct
);

module.exports = router;
