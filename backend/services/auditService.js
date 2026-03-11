const { pool } = require("../db");

async function logAudit({
  businessId,
  actorUserId = null,
  action,
  entity,
  entityId = null,
  metadata = null,
  db = pool,
}) {
  if (!action || !entity) {
    return;
  }

  await db.query(
    `
      INSERT INTO audit_logs (business_id, actor_user_id, action, entity, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [businessId, actorUserId, action, entity, entityId, metadata]
  );
}

module.exports = {
  logAudit,
};
