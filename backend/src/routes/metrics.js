module.exports = async function metricsRoutes(app) {
  // GET /api/metrics/:deviceId?hours=24
  app.get('/:deviceId', { preHandler: [app.auth] }, async (req) => {
    const hours = parseInt(req.query.hours || '24');
    const { rows } = await app.db.query(
      `SELECT metric_name, metric_value, unit, recorded_at
       FROM device_metrics
       WHERE device_id=$1 AND recorded_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY recorded_at ASC`,
      [req.params.deviceId]
    );
    // Group by metric_name
    const grouped = {};
    for (const r of rows) {
      if (!grouped[r.metric_name]) grouped[r.metric_name] = [];
      grouped[r.metric_name].push({ value: r.metric_value, unit: r.unit, t: r.recorded_at });
    }
    return grouped;
  });

  // GET /api/metrics/:deviceId/latest
  app.get('/:deviceId/latest', { preHandler: [app.auth] }, async (req) => {
    const { rows } = await app.db.query(
      `SELECT DISTINCT ON (metric_name) metric_name, metric_value, unit, recorded_at
       FROM device_metrics WHERE device_id=$1
       ORDER BY metric_name, recorded_at DESC`,
      [req.params.deviceId]
    );
    return rows;
  });

  // GET /api/metrics/summary/all - dashboard summary
  app.get('/summary/all', { preHandler: [app.auth] }, async () => {
    const { rows } = await app.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE d.enabled) AS total_devices,
        COUNT(*) FILTER (WHERE ds.status='up') AS devices_up,
        COUNT(*) FILTER (WHERE ds.status='down') AS devices_down,
        COUNT(*) FILTER (WHERE ds.status='unknown' OR ds.status IS NULL) AS devices_unknown,
        AVG(ds.latency_ms) FILTER (WHERE ds.latency_ms IS NOT NULL) AS avg_latency,
        (SELECT COUNT(*) FROM alerts WHERE resolved=false) AS active_alerts
      FROM devices d
      LEFT JOIN LATERAL (
        SELECT * FROM device_status WHERE device_id=d.id ORDER BY checked_at DESC LIMIT 1
      ) ds ON true
    `);
    return rows[0];
  });
};
