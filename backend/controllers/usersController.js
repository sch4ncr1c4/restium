const { pool } = require("../db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { VALID_ROLES, DEFAULT_ROLE } = require("../constants/roles");
const { logAudit } = require("../services/auditService");

function sanitizeText(value, maxLength = 255) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function validatePhone(value) {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  const normalized = String(value).trim();
  if (!/^[+\d()\-.\s]{6,25}$/.test(normalized)) {
    return { ok: false, message: "invalid phone format" };
  }
  return { ok: true, value: normalized };
}

function validatePinCode(value) {
  const normalized = sanitizeText(value, 4);
  if (!normalized || !/^\d{4}$/.test(normalized)) {
    return { ok: false, message: "pinCode must be exactly 4 digits" };
  }
  return { ok: true, value: normalized };
}

function normalizeUsername(value) {
  const raw = sanitizeText(value, 40);
  if (!raw) return { ok: false, message: "username is required" };
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(raw)) {
    return {
      ok: false,
      message: "username must be 3-40 chars and only letters, numbers, dot, underscore or dash",
    };
  }
  return { ok: true, value: raw.toLowerCase() };
}

function hashPinCode(pinCode) {
  return crypto.createHash("sha256").update(String(pinCode)).digest("hex");
}

async function listUsers(_req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          email,
          username,
          name,
          last_name,
          address,
          phone,
          emergency_phone,
          role,
          business_id,
          created_at
        FROM users
        WHERE business_id = $1
        ORDER BY id ASC
      `,
      [_req.user.business_id]
    );

    return res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not list users",
      error: error.message,
    });
  }
}

async function updateUserRole(req, res) {
  const userId = Number(req.params.id);
  const { role } = req.body || {};

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "invalid user id",
    });
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({
      ok: false,
      message: `invalid role. valid roles: ${VALID_ROLES.join(", ")}`,
    });
  }

  try {
    const beforeResult = await pool.query(
      "SELECT id, role, business_id FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );

    if (!beforeResult.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "user not found",
      });
    }

    if (beforeResult.rows[0].business_id !== req.user.business_id) {
      return res.status(403).json({
        ok: false,
        message: "cannot manage users from another business",
      });
    }

    const previousRole = beforeResult.rows[0].role;

    const result = await pool.query(
      `
        UPDATE users
        SET role = $1
        WHERE id = $2 AND business_id = $3
        RETURNING
          id, email, username, name, last_name, address, phone, emergency_phone, role, business_id, created_at
      `,
      [role, userId, req.user.business_id]
    );

    await logAudit({
      businessId: req.user.business_id,
      actorUserId: req.user.id,
      action: "USER_ROLE_UPDATED",
      entity: "users",
      entityId: String(userId),
      metadata: {
        previousRole,
        newRole: role,
      },
    });

    return res.json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not update user role",
      error: error.message,
    });
  }
}

async function createUser(req, res) {
  const {
    email,
    password,
    name,
    lastName,
    address,
    phone,
    emergencyPhone,
    username,
    pinCode,
    role,
  } = req.body || {};

  const desiredRole = role || DEFAULT_ROLE;
  const normalizedName = sanitizeText(name, 120);
  const normalizedLastName = sanitizeText(lastName, 120);
  const normalizedAddress = sanitizeText(address, 220);
  const normalizedUsername = normalizeUsername(username);
  const normalizedPinCode = validatePinCode(pinCode);
  const normalizedPhone = validatePhone(phone);
  const normalizedEmergencyPhone = validatePhone(emergencyPhone);

  if (!normalizedName) {
    return res.status(400).json({
      ok: false,
      message: "name is required",
    });
  }

  if (!normalizedLastName) {
    return res.status(400).json({
      ok: false,
      message: "lastName is required",
    });
  }

  if (!normalizedUsername.ok) {
    return res.status(400).json({
      ok: false,
      message: normalizedUsername.message,
    });
  }

  if (!normalizedPinCode.ok) {
    return res.status(400).json({
      ok: false,
      message: normalizedPinCode.message,
    });
  }

  if (!normalizedPhone.ok) {
    return res.status(400).json({
      ok: false,
      message: normalizedPhone.message,
    });
  }

  if (!normalizedEmergencyPhone.ok) {
    return res.status(400).json({
      ok: false,
      message: normalizedEmergencyPhone.message,
    });
  }

  if (!VALID_ROLES.includes(desiredRole)) {
    return res.status(400).json({
      ok: false,
      message: `invalid role. valid roles: ${VALID_ROLES.join(", ")}`,
    });
  }

  const normalizedEmail = sanitizeText(email, 180)
    ? sanitizeText(email, 180).toLowerCase()
    : `${normalizedUsername.value}.${req.user.business_id}@staff.local`;

  const rawPassword = sanitizeText(password, 200) || crypto.randomUUID();
  if (rawPassword.length < 6) {
    return res.status(400).json({
      ok: false,
      message: "password must be at least 6 characters",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const result = await pool.query(
      `
        INSERT INTO users
          (email, password_hash, username, name, last_name, address, phone, emergency_phone, pin_code, pin_code_hash, role, business_id)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING
          id, email, username, name, last_name, address, phone, emergency_phone, role, business_id, created_at
      `,
      [
        normalizedEmail,
        hashedPassword,
        normalizedUsername.value,
        normalizedName,
        normalizedLastName,
        normalizedAddress,
        normalizedPhone.value,
        normalizedEmergencyPhone.value,
        normalizedPinCode.value,
        hashPinCode(normalizedPinCode.value),
        desiredRole,
        req.user.business_id,
      ]
    );

    await logAudit({
      businessId: req.user.business_id,
      actorUserId: req.user.id,
      action: "USER_CREATED",
      entity: "users",
      entityId: String(result.rows[0].id),
      metadata: {
        email: normalizedEmail,
        role: desiredRole,
        username: normalizedUsername.value,
      },
    });

    return res.status(201).json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      const detail = String(error.detail || "").toLowerCase();
      const message = detail.includes("username")
        ? "username already exists"
        : "email already exists";
      return res.status(409).json({
        ok: false,
        message,
      });
    }

    return res.status(500).json({
      ok: false,
      message: "could not create user",
      error: error.message,
    });
  }
}

async function updateUser(req, res) {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "invalid user id",
    });
  }

  const {
    name,
    lastName,
    address,
    phone,
    emergencyPhone,
    username,
    pinCode,
    role,
  } = req.body || {};

  const normalizedName = sanitizeText(name, 120);
  const normalizedLastName = sanitizeText(lastName, 120);
  const normalizedAddress = sanitizeText(address, 220);
  const normalizedUsername = normalizeUsername(username);
  const normalizedPinCode = validatePinCode(pinCode);
  const normalizedPhone = validatePhone(phone);
  const normalizedEmergencyPhone = validatePhone(emergencyPhone);

  if (!normalizedName || !normalizedLastName) {
    return res.status(400).json({
      ok: false,
      message: "name and lastName are required",
    });
  }
  if (!normalizedUsername.ok) {
    return res.status(400).json({
      ok: false,
      message: normalizedUsername.message,
    });
  }
  if (!normalizedPinCode.ok) {
    return res.status(400).json({
      ok: false,
      message: normalizedPinCode.message,
    });
  }
  if (!normalizedPhone.ok) {
    return res.status(400).json({
      ok: false,
      message: normalizedPhone.message,
    });
  }
  if (!normalizedEmergencyPhone.ok) {
    return res.status(400).json({
      ok: false,
      message: normalizedEmergencyPhone.message,
    });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({
      ok: false,
      message: `invalid role. valid roles: ${VALID_ROLES.join(", ")}`,
    });
  }

  try {
    const beforeResult = await pool.query(
      "SELECT id, business_id, role FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    if (!beforeResult.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "user not found",
      });
    }
    if (beforeResult.rows[0].business_id !== req.user.business_id) {
      return res.status(403).json({
        ok: false,
        message: "cannot manage users from another business",
      });
    }

    const result = await pool.query(
      `
        UPDATE users
        SET
          username = $1,
          name = $2,
          last_name = $3,
          address = $4,
          phone = $5,
          emergency_phone = $6,
          pin_code = $7,
          pin_code_hash = $8,
          role = $9
        WHERE id = $10
          AND business_id = $11
        RETURNING
          id, email, username, name, last_name, address, phone, emergency_phone, role, business_id, created_at
      `,
      [
        normalizedUsername.value,
        normalizedName,
        normalizedLastName,
        normalizedAddress,
        normalizedPhone.value,
        normalizedEmergencyPhone.value,
        normalizedPinCode.value,
        hashPinCode(normalizedPinCode.value),
        role,
        userId,
        req.user.business_id,
      ]
    );

    await logAudit({
      businessId: req.user.business_id,
      actorUserId: req.user.id,
      action: "USER_UPDATED",
      entity: "users",
      entityId: String(userId),
      metadata: {
        role,
      },
    });

    return res.json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        ok: false,
        message: "username already exists",
      });
    }
    return res.status(500).json({
      ok: false,
      message: "could not update user",
      error: error.message,
    });
  }
}

async function deleteUser(req, res) {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "invalid user id",
    });
  }

  if (userId === req.user.id) {
    return res.status(400).json({
      ok: false,
      message: "cannot delete your own account",
    });
  }

  try {
    const result = await pool.query(
      `
        DELETE FROM users
        WHERE id = $1
          AND business_id = $2
        RETURNING id, username, name, last_name, role, business_id
      `,
      [userId, req.user.business_id]
    );
    if (!result.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "user not found",
      });
    }

    await logAudit({
      businessId: req.user.business_id,
      actorUserId: req.user.id,
      action: "USER_DELETED",
      entity: "users",
      entityId: String(userId),
      metadata: {
        role: result.rows[0].role,
        username: result.rows[0].username,
      },
    });

    return res.json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not delete user",
      error: error.message,
    });
  }
}

async function clockUserByPin(req, res) {
  const { pinCode, action } = req.body || {};
  const normalizedPinCode = validatePinCode(pinCode);
  const normalizedAction = sanitizeText(action, 10)?.toLowerCase() || null;

  if (!normalizedPinCode.ok) {
    return res.status(400).json({
      ok: false,
      message: normalizedPinCode.message,
    });
  }
  if (normalizedAction && !["in", "out"].includes(normalizedAction)) {
    return res.status(400).json({
      ok: false,
      message: "invalid action. valid values: in, out",
    });
  }

  try {
    const incomingHash = hashPinCode(normalizedPinCode.value);
    let userResult = await pool.query(
      `
        SELECT id, username, name, last_name, role, pin_code, pin_code_hash
        FROM users
        WHERE business_id = $1
          AND pin_code_hash = $2
      `,
      [req.user.business_id, incomingHash]
    );

    if (!userResult.rowCount) {
      // Legacy fallback for users still stored only in plain pin_code.
      userResult = await pool.query(
        `
          SELECT id, username, name, last_name, role, pin_code, pin_code_hash
          FROM users
          WHERE business_id = $1
            AND pin_code = $2
        `,
        [req.user.business_id, normalizedPinCode.value]
      );
    }

    if (!userResult.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "user not found",
      });
    }
    if (userResult.rowCount > 1) {
      return res.status(409).json({
        ok: false,
        message: "pin is not unique in this business",
      });
    }

    const targetUser = userResult.rows[0];
    const isHashValid = targetUser.pin_code_hash && targetUser.pin_code_hash === incomingHash;
    const isLegacyPinValid = targetUser.pin_code && targetUser.pin_code === normalizedPinCode.value;
    if (!isHashValid && !isLegacyPinValid) {
      return res.status(401).json({
        ok: false,
        message: "invalid pin",
      });
    }

    let eventType = normalizedAction;
    if (!eventType) {
      const lastEventResult = await pool.query(
        `
          SELECT event_type
          FROM user_clock_logs
          WHERE business_id = $1
            AND user_id = $2
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        `,
        [req.user.business_id, targetUser.id]
      );

      const lastEventType = lastEventResult.rowCount ? lastEventResult.rows[0].event_type : null;
      eventType = lastEventType === "in" ? "out" : "in";
    }

    let entryAt = null;
    let sessionMinutes = null;
    if (eventType === "out") {
      const entryResult = await pool.query(
        `
          SELECT created_at
          FROM user_clock_logs
          WHERE business_id = $1
            AND user_id = $2
            AND event_type = 'in'
          ORDER BY created_at DESC, id DESC
          LIMIT 1
        `,
        [req.user.business_id, targetUser.id]
      );
      if (entryResult.rowCount) {
        entryAt = entryResult.rows[0].created_at;
      }
    }

    const insertResult = await pool.query(
      `
        INSERT INTO user_clock_logs (business_id, user_id, event_type, source, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, business_id, user_id, event_type, source, metadata, created_at
      `,
      [
        req.user.business_id,
        targetUser.id,
        eventType,
        "dashboard",
        { byUserId: req.user.id, username: targetUser.username, mode: "pin_only" },
      ]
    );
    const eventAt = insertResult.rows[0].created_at;
    if (eventType === "in") {
      entryAt = eventAt;
    }
    if (entryAt) {
      const startMs = new Date(entryAt).getTime();
      const endMs = new Date(eventAt).getTime();
      sessionMinutes = Math.max(0, Math.floor((endMs - startMs) / 60000));
    }

    const displayName = `${targetUser.name || ""} ${targetUser.last_name || ""}`.trim() || targetUser.username;
    return res.json({
      ok: true,
      data: {
        ...insertResult.rows[0],
        user: {
          id: targetUser.id,
          username: targetUser.username,
          name: displayName,
          role: targetUser.role,
        },
        entry_at: entryAt,
        event_at: eventAt,
        session_minutes: sessionMinutes,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not register clock event",
      error: error.message,
    });
  }
}

async function listActiveClockUsers(req, res) {
  try {
    const result = await pool.query(
      `
        WITH latest AS (
          SELECT DISTINCT ON (l.user_id)
            l.user_id,
            l.event_type,
            l.created_at
          FROM user_clock_logs l
          WHERE l.business_id = $1
          ORDER BY l.user_id, l.created_at DESC, l.id DESC
        )
        SELECT
          u.id,
          u.username,
          u.name,
          u.last_name,
          u.role,
          latest.created_at AS entry_at
        FROM latest
        JOIN users u
          ON u.id = latest.user_id
         AND u.business_id = $1
        WHERE latest.event_type = 'in'
        ORDER BY latest.created_at DESC
      `,
      [req.user.business_id]
    );

    const items = result.rows.map((row) => {
      const displayName = `${row.name || ""} ${row.last_name || ""}`.trim() || row.username;
      const elapsedMinutes = Math.max(
        0,
        Math.floor((Date.now() - new Date(row.entry_at).getTime()) / 60000)
      );
      return {
        id: row.id,
        username: row.username,
        name: displayName,
        role: row.role,
        entry_at: row.entry_at,
        elapsed_minutes: elapsedMinutes,
      };
    });

    return res.json({
      ok: true,
      data: items,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not fetch active clock users",
      error: error.message,
    });
  }
}

async function resolveWaiterByPin(req, res) {
  const { pinCode } = req.body || {};
  const normalizedPinCode = validatePinCode(pinCode);
  if (!normalizedPinCode.ok) {
    return res.status(400).json({
      ok: false,
      message: normalizedPinCode.message,
    });
  }

  try {
    const incomingHash = hashPinCode(normalizedPinCode.value);
    let userResult = await pool.query(
      `
        SELECT id, username, name, last_name, role, pin_code, pin_code_hash
        FROM users
        WHERE business_id = $1
          AND role = 'mozo'
          AND pin_code_hash = $2
      `,
      [req.user.business_id, incomingHash]
    );

    if (!userResult.rowCount) {
      userResult = await pool.query(
        `
          SELECT id, username, name, last_name, role, pin_code, pin_code_hash
          FROM users
          WHERE business_id = $1
            AND role = 'mozo'
            AND pin_code = $2
        `,
        [req.user.business_id, normalizedPinCode.value]
      );
    }

    if (!userResult.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "mozo not found",
      });
    }
    if (userResult.rowCount > 1) {
      return res.status(409).json({
        ok: false,
        message: "pin is not unique for mozos in this business",
      });
    }

    const waiter = userResult.rows[0];
    const displayName = `${waiter.name || ""} ${waiter.last_name || ""}`.trim() || waiter.username;
    return res.json({
      ok: true,
      data: {
        id: waiter.id,
        username: waiter.username,
        role: waiter.role,
        name: displayName,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not resolve waiter by pin",
      error: error.message,
    });
  }
}

module.exports = {
  clockUserByPin,
  createUser,
  deleteUser,
  listActiveClockUsers,
  listUsers,
  resolveWaiterByPin,
  updateUser,
  updateUserRole,
};
