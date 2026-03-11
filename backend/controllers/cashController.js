const { pool } = require("../db");
const { logAudit } = require("../services/auditService");

async function getCashSummary(_req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        COUNT(*)::int AS orders_count,
        COALESCE(SUM(total), 0)::numeric(10,2) AS total_sales
      FROM orders
      WHERE created_at::date = CURRENT_DATE
      AND business_id = $1
      `,
      [_req.user.business_id]
    );

    return res.json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not fetch cash summary",
      error: error.message,
    });
  }
}

async function closeCashShift(req, res) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const summary = await client.query(
      `
      SELECT
        COUNT(*)::int AS orders_count,
        COALESCE(SUM(total), 0)::numeric(10,2) AS total_sales
      FROM orders
      WHERE created_at::date = CURRENT_DATE
      AND status = 'paid'
      AND business_id = $1
      `,
      [req.user.business_id]
    );

    const cashSnapshot = summary.rows[0];
    const closeResult = await client.query(
      `
      INSERT INTO cash_closures (business_id, closed_by_user_id, orders_count, total_sales)
      VALUES ($1, $2, $3, $4)
      RETURNING id, business_id, closed_by_user_id, closed_at, orders_count, total_sales
      `,
      [req.user.business_id, req.user.id, cashSnapshot.orders_count, cashSnapshot.total_sales]
    );

    await logAudit({
      businessId: req.user.business_id,
      actorUserId: req.user.id,
      action: "CASH_CLOSED",
      entity: "cash_closures",
      entityId: String(closeResult.rows[0].id),
      metadata: {
        ordersCount: cashSnapshot.orders_count,
        totalSales: cashSnapshot.total_sales,
      },
      db: client,
    });

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      data: closeResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      ok: false,
      message: "could not close cash shift",
      error: error.message,
    });
  } finally {
    client.release();
  }
}

module.exports = {
  getCashSummary,
  closeCashShift,
};
