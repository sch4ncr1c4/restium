const { pool } = require("../db");
const { ROLES } = require("../constants/roles");
const { logAudit } = require("../services/auditService");

const VALID_ORDER_STATUSES = new Set([
  "pending",
  "preparing",
  "ready",
  "served",
  "paid",
  "cancelled",
]);

function canChangeStatus(role, nextStatus) {
  if ([ROLES.ADMIN, ROLES.GERENTE].includes(role)) {
    return true;
  }

  const statusRoleMap = {
    preparing: [ROLES.COCINA],
    ready: [ROLES.COCINA],
    served: [ROLES.MOZO],
    paid: [ROLES.CAJERO],
    cancelled: [],
    pending: [],
  };

  return statusRoleMap[nextStatus]?.includes(role) || false;
}

async function listOrders(_req, res) {
  try {
    const result = await pool.query(
      "SELECT id, business_id, status, total, created_at FROM orders WHERE business_id = $1 ORDER BY created_at DESC",
      [_req.user.business_id]
    );
    return res.json({
      ok: true,
      data: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not fetch orders",
      error: error.message,
    });
  }
}

async function createOrder(req, res) {
  const { total } = req.body || {};

  if (total === undefined) {
    return res.status(400).json({
      ok: false,
      message: "total is required",
    });
  }

  try {
    const result = await pool.query(
      "INSERT INTO orders (business_id, status, total) VALUES ($1, $2, $3) RETURNING id, business_id, status, total, created_at",
      [req.user.business_id, "pending", total]
    );

    return res.status(201).json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not create order",
      error: error.message,
    });
  }
}

async function updateOrderStatus(req, res) {
  const orderId = Number(req.params.id);
  const { status } = req.body || {};

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "invalid order id",
    });
  }

  if (!VALID_ORDER_STATUSES.has(status)) {
    return res.status(400).json({
      ok: false,
      message: "invalid order status",
    });
  }

  if (!canChangeStatus(req.user.role, status)) {
    return res.status(403).json({
      ok: false,
      message: "forbidden for this role",
    });
  }

  try {
    const current = await pool.query(
      "SELECT id, status FROM orders WHERE id = $1 AND business_id = $2 LIMIT 1",
      [orderId, req.user.business_id]
    );

    if (!current.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "order not found",
      });
    }

    const previousStatus = current.rows[0].status;
    const updated = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 AND business_id = $3 RETURNING id, business_id, status, total, created_at",
      [status, orderId, req.user.business_id]
    );

    await logAudit({
      businessId: req.user.business_id,
      actorUserId: req.user.id,
      action: "ORDER_STATUS_UPDATED",
      entity: "orders",
      entityId: String(orderId),
      metadata: {
        previousStatus,
        newStatus: status,
      },
    });

    return res.json({
      ok: true,
      data: updated.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not update order status",
      error: error.message,
    });
  }
}

module.exports = {
  listOrders,
  createOrder,
  updateOrderStatus,
};
