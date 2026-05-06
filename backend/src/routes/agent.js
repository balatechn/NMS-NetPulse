module.exports = async function agentRoutes(app) {
  // GET /api/agent/events?limit=50
  app.get('/events', { preHandler: [app.auth] }, async (req) => {
    const limit = parseInt(req.query.limit || '50');
    const { rows } = await app.db.query(
      `SELECT ae.*, d.name AS device_name
       FROM agent_events ae
       LEFT JOIN devices d ON d.id = ae.device_id
       ORDER BY ae.received_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  });

  // GET /api/agent/status - connected agent sessions count
  app.get('/status', { preHandler: [app.auth] }, async () => {
    const { rows } = await app.db.query(
      `SELECT COUNT(*) AS total_events,
              COUNT(DISTINCT device_id) AS unique_devices,
              MAX(received_at) AS last_event
       FROM agent_events WHERE received_at > NOW() - INTERVAL '1 hour'`
    );
    return rows[0];
  });
};
