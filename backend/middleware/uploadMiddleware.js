const multer = require("multer");

function fileFilter(_req, file, cb) {
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    cb(new Error("only png, jpg and webp images are allowed"));
    return;
  }
  cb(null, true);
}

const uploadProductImage = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});

module.exports = {
  uploadProductImage,
};
