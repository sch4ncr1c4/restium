const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { pool } = require("../db");
const { ROLES } = require("../constants/roles");

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "dev-secret-change-me";
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "dev-refresh-secret-change-me";
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";

function normalizeUsername(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (!/^[a-z0-9._-]{3,40}$/.test(raw)) return "";
  return raw;
}

function normalizePinCode(value) {
  const raw = String(value || "").trim();
  if (!/^\d{4}$/.test(raw)) return "";
  return raw;
}

function hashPinCode(pinCode) {
  return crypto.createHash("sha256").update(String(pinCode)).digest("hex");
}

function normalizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 110);
}

async function buildUniqueBusinessSlug(baseValue, dbClient) {
  const base = normalizeSlug(baseValue) || `bar-${crypto.randomUUID().slice(0, 8)}`;
  let candidate = base;
  let counter = 2;

  while (true) {
    const exists = await dbClient.query(
      "SELECT 1 FROM businesses WHERE slug = $1 LIMIT 1",
      [candidate]
    );
    if (!exists.rowCount) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

function generateTokenIds() {
  return {
    jti: crypto.randomUUID(),
    familyId: crypto.randomUUID(),
  };
}

function buildAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.business_id,
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function buildRefreshToken(user, jti, familyId) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      businessId: user.business_id,
      familyId,
      type: "refresh",
    },
    REFRESH_TOKEN_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      jwtid: jti,
    }
  );
}

async function persistRefreshToken({
  userId,
  jti,
  familyId,
  token,
  expiresAt,
  createdByIp,
  userAgent,
}) {
  const tokenHash = await bcrypt.hash(token, 10);
  await pool.query(
    `
      INSERT INTO refresh_tokens
      (user_id, token_jti, family_id, token_hash, expires_at, created_by_ip, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [userId, jti, familyId, tokenHash, expiresAt, createdByIp || null, userAgent || null]
  );
}

function getRequestMetadata(req) {
  return {
    createdByIp: req.ip,
    userAgent: req.headers["user-agent"] || null,
  };
}

async function issueAuthSession(user, req, existingFamilyId = null) {
  const { jti, familyId } = generateTokenIds();
  const finalFamilyId = existingFamilyId || familyId;

  const accessToken = buildAccessToken(user);
  const refreshToken = buildRefreshToken(user, jti, finalFamilyId);
  const refreshPayload = jwt.decode(refreshToken);

  await persistRefreshToken({
    userId: user.id,
    jti,
    familyId: finalFamilyId,
    token: refreshToken,
    expiresAt: new Date(refreshPayload.exp * 1000),
    ...getRequestMetadata(req),
  });

  return {
    accessToken,
    refreshToken,
  };
}

async function register(req, res) {
  const { email, password, name, businessName, businessUsername } = req.body || {};
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const ownerName = String(name || "").trim();
  const desiredBusinessName = String(businessName || businessUsername || "").trim();

  if (!normalizedEmail || !password || !desiredBusinessName) {
    return res.status(400).json({
      ok: false,
      message: "email, password and businessName are required",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      ok: false,
      message: "password must be at least 6 characters",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const slug = await buildUniqueBusinessSlug(desiredBusinessName, client);
    const businessResult = await client.query(
      "INSERT INTO businesses (slug, name) VALUES ($1, $2) RETURNING id, slug, name",
      [slug, desiredBusinessName]
    );
    const business = businessResult.rows[0];

    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `
        INSERT INTO users (email, password_hash, name, role, business_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, name, role, business_id, created_at
      `,
      [normalizedEmail, hashedPassword, ownerName || null, ROLES.ADMIN, business.id]
    );
    const user = userResult.rows[0];

    await client.query("UPDATE businesses SET owner_user_id = $1 WHERE id = $2", [
      user.id,
      business.id,
    ]);

    await client.query("COMMIT");

    const session = await issueAuthSession(user, req);
    return res.status(201).json({
      ok: true,
      user: {
        ...user,
        business,
      },
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({
        ok: false,
        message: "email or business already exists",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "could not register business account",
      error: error.message,
    });
  } finally {
    client.release();
  }
}

async function login(req, res) {
  const { email, password, username, pinCode } = req.body || {};
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const normalizedUsername = normalizeUsername(username);
  const normalizedPinCode = normalizePinCode(pinCode);

  const usePinLogin = Boolean(normalizedUsername || normalizedPinCode);

  if (usePinLogin) {
    if (!normalizedUsername || !normalizedPinCode) {
      return res.status(400).json({
        ok: false,
        message: "username and pinCode are required",
      });
    }

    try {
      const incomingHash = hashPinCode(normalizedPinCode);
      let result = await pool.query(
        `
          SELECT
            u.id,
            u.email,
            u.username,
            u.name,
            u.role,
            u.business_id,
            u.pin_code,
            u.pin_code_hash,
            b.slug AS business_slug,
            b.name AS business_name
          FROM users u
          JOIN businesses b ON b.id = u.business_id
          WHERE LOWER(u.username) = $1
            AND u.pin_code_hash = $2
          LIMIT 2
        `,
        [normalizedUsername, incomingHash]
      );

      let usedLegacyPin = false;
      if (!result.rowCount) {
        result = await pool.query(
          `
            SELECT
              u.id,
              u.email,
              u.username,
              u.name,
              u.role,
              u.business_id,
              u.pin_code,
              u.pin_code_hash,
              b.slug AS business_slug,
              b.name AS business_name
            FROM users u
            JOIN businesses b ON b.id = u.business_id
            WHERE LOWER(u.username) = $1
              AND u.pin_code = $2
            LIMIT 2
          `,
          [normalizedUsername, normalizedPinCode]
        );
        usedLegacyPin = result.rowCount > 0;
      }

      if (!result.rowCount) {
        return res.status(401).json({
          ok: false,
          message: "invalid credentials",
        });
      }

      if (result.rowCount > 1) {
        return res.status(409).json({
          ok: false,
          message: "multiple users match this username and pin",
        });
      }

      const user = result.rows[0];
      if (usedLegacyPin && !user.pin_code_hash) {
        await pool.query("UPDATE users SET pin_code_hash = $1 WHERE id = $2", [incomingHash, user.id]);
      }

      const session = await issueAuthSession(user, req);

      return res.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          business_id: user.business_id,
          business: {
            id: user.business_id,
            name: user.business_name,
            slug: user.business_slug,
          },
        },
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: "could not login",
        error: error.message,
      });
    }
  }

  if (!normalizedEmail || !password) {
    return res.status(400).json({
      ok: false,
      message: "email and password are required",
    });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          u.id,
          u.email,
          u.name,
          u.role,
          u.business_id,
          u.password_hash,
          b.slug AS business_slug,
          b.name AS business_name
        FROM users u
        JOIN businesses b ON b.id = u.business_id
        WHERE u.email = $1
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (!result.rowCount) {
      return res.status(401).json({
        ok: false,
        message: "invalid credentials",
      });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        ok: false,
        message: "invalid credentials",
      });
    }

    const session = await issueAuthSession(user, req);

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        business_id: user.business_id,
        business: {
          id: user.business_id,
          name: user.business_name,
          slug: user.business_slug,
        },
      },
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not login",
      error: error.message,
    });
  }
}

async function refresh(req, res) {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({
      ok: false,
      message: "refreshToken is required",
    });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    if (payload.type !== "refresh") throw new Error("invalid token type");
  } catch (_error) {
    return res.status(401).json({
      ok: false,
      message: "invalid refresh token",
    });
  }

  try {
    const stored = await pool.query(
      `
        SELECT id, user_id, token_hash, revoked_at, expires_at, family_id
        FROM refresh_tokens
        WHERE token_jti = $1
        LIMIT 1
      `,
      [payload.jti]
    );

    if (!stored.rowCount) {
      return res.status(401).json({
        ok: false,
        message: "refresh token not recognized",
      });
    }

    const dbToken = stored.rows[0];
    if (dbToken.revoked_at) {
      await pool.query(
        "UPDATE refresh_tokens SET revoked_at = NOW(), revoke_reason = 'token reuse detected' WHERE family_id = $1 AND revoked_at IS NULL",
        [dbToken.family_id]
      );
      return res.status(401).json({
        ok: false,
        message: "refresh token already used",
      });
    }

    if (new Date(dbToken.expires_at) <= new Date()) {
      return res.status(401).json({
        ok: false,
        message: "refresh token expired",
      });
    }

    const tokenMatches = await bcrypt.compare(refreshToken, dbToken.token_hash);
    if (!tokenMatches) {
      await pool.query(
        "UPDATE refresh_tokens SET revoked_at = NOW(), revoke_reason = 'token mismatch detected' WHERE family_id = $1 AND revoked_at IS NULL",
        [dbToken.family_id]
      );
      return res.status(401).json({
        ok: false,
        message: "refresh token invalid",
      });
    }

    const userResult = await pool.query(
      "SELECT id, email, name, role, business_id FROM users WHERE id = $1 LIMIT 1",
      [dbToken.user_id]
    );

    if (!userResult.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "user not found",
      });
    }

    const user = userResult.rows[0];
    const newSession = await issueAuthSession(user, req, dbToken.family_id);
    const newPayload = jwt.decode(newSession.refreshToken);

    await pool.query(
      `
        UPDATE refresh_tokens
        SET revoked_at = NOW(),
            revoke_reason = 'rotated',
            replaced_by_jti = $1
        WHERE id = $2
      `,
      [newPayload.jti, dbToken.id]
    );

    return res.json({
      ok: true,
      accessToken: newSession.accessToken,
      refreshToken: newSession.refreshToken,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not refresh session",
      error: error.message,
    });
  }
}

async function logout(req, res) {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({
      ok: false,
      message: "refreshToken is required",
    });
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    await pool.query(
      `
        UPDATE refresh_tokens
        SET revoked_at = NOW(),
            revoke_reason = 'logout'
        WHERE token_jti = $1 AND revoked_at IS NULL
      `,
      [payload.jti]
    );
    return res.json({
      ok: true,
      message: "session closed",
    });
  } catch (_error) {
    return res.status(401).json({
      ok: false,
      message: "invalid refresh token",
    });
  }
}

async function me(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          u.id,
          u.email,
          u.name,
          u.role,
          u.business_id,
          u.created_at,
          b.slug AS business_slug,
          b.name AS business_name
        FROM users u
        JOIN businesses b ON b.id = u.business_id
        WHERE u.id = $1
        LIMIT 1
      `,
      [req.user.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "user not found",
      });
    }

    const user = result.rows[0];
    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        business_id: user.business_id,
        created_at: user.created_at,
        business: {
          id: user.business_id,
          name: user.business_name,
          slug: user.business_slug,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not fetch user",
      error: error.message,
    });
  }
}

module.exports = {
  login,
  register,
  refresh,
  logout,
  me,
};
