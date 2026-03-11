const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "dev-secret-change-me";

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      message: "missing bearer token",
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      ok: false,
      message: "invalid token",
    });
  }

  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    const userResult = await pool.query(
      "SELECT id, email, role, business_id FROM users WHERE id = $1 LIMIT 1",
      [payload.id]
    );

    if (!userResult.rowCount) {
      return res.status(401).json({
        ok: false,
        message: "user no longer exists",
      });
    }

    req.user = userResult.rows[0];
    return next();
  } catch (_error) {
    return res.status(401).json({
      ok: false,
      message: "token expired or invalid",
    });
  }
}

module.exports = authMiddleware;
