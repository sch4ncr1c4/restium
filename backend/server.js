const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const { pool } = require("./db");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const userRoutes = require("./routes/users");
const cashRoutes = require("./routes/cash");
const reportRoutes = require("./routes/reports");

dotenv.config({ quiet: true });

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "backend running" });
});

app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS server_time");
    return res.json({
      ok: true,
      db: "connected",
      serverTime: result.rows[0].server_time,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      db: "disconnected",
      error: error.message,
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cash", cashRoutes);
app.use("/api/reports", reportRoutes);

const server = app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

// Keep the event loop alive even if another lib unrefs handles.
if (typeof server.ref === "function") {
  server.ref();
}
