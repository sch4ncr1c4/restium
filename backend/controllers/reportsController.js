const { pool } = require("../db");

async function getDailySalesReport(_req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        created_at::date AS day,
        COUNT(*)::int AS orders_count,
        COALESCE(SUM(total), 0)::numeric(10,2) AS total_sales
      FROM orders
      WHERE business_id = $1
      GROUP BY created_at::date
      ORDER BY day DESC
      LIMIT 30
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
      message: "could not fetch sales report",
      error: error.message,
    });
  }
}

module.exports = {
  getDailySalesReport,
};
