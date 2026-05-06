module.exports = async function deviceRoutes(app) {
  // GET /api/devices
  app.get('/', { preHandler: [app.auth] }, async (req) => {
    const { rows } = await app.db.query(`
      SELECT d.*,
        ds.status, ds.latency_ms, ds.uptime_ticks, ds.checked_at,
        (SELECT COUNT(*) FROM alerts a WHERE a.device_id=d.id AND a.resolved=false) AS active_alerts
      FROM devices d
      LEFT JOIN LATERAL (
        SELECT * FROM device_status WHERE device_id=d.id ORDER BY checked_at DESC LIMIT 1
      ) ds ON true
      ORDER BY d.name ASC
    `);
    return rows;
  });

  // GET /api/devices/:id
  app.get('/:id', { preHandler: [app.auth] }, async (req, reply) => {
    const { rows } = await app.db.query(
      `SELECT d.*,
        ds.status, ds.latency_ms, ds.uptime_ticks, ds.sys_descr, ds.checked_at
       FROM devices d
       LEFT JOIN LATERAL (
         SELECT * FROM device_status WHERE device_id=d.id ORDER BY checked_at DESC LIMIT 1
       ) ds ON true
       WHERE d.id=$1`,
      [req.params.id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  // POST /api/devices
  app.post('/', { preHandler: [app.auth] }, async (req, reply) => {
    const { name, ip_address, type, location, snmp_community, snmp_version, snmp_port } = req.body;
    const { rows } = await app.db.query(
      `INSERT INTO devices (name, ip_address, type, location, snmp_community, snmp_version, snmp_port)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, ip_address, type || 'router', location, snmp_community || 'NATIONAL852', snmp_version || '2c', snmp_port || 161]
    );
    return reply.code(201).send(rows[0]);
  });

  // PUT /api/devices/:id
  app.put('/:id', { preHandler: [app.auth] }, async (req, reply) => {
    const { name, ip_address, type, location, snmp_community, snmp_version, snmp_port, enabled } = req.body;
    const { rows } = await app.db.query(
      `UPDATE devices SET name=$1, ip_address=$2, type=$3, location=$4,
        snmp_community=$5, snmp_version=$6, snmp_port=$7, enabled=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, ip_address, type, location, snmp_community, snmp_version, snmp_port, enabled, req.params.id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  // DELETE /api/devices/:id
  app.delete('/:id', { preHandler: [app.auth] }, async (req, reply) => {
    await app.db.query('DELETE FROM devices WHERE id=$1', [req.params.id]);
    return reply.code(204).send();
  });

  // POST /api/devices/:id/poll - manual poll
  app.post('/:id/poll', { preHandler: [app.auth] }, async (req, reply) => {
    const { rows } = await app.db.query('SELECT * FROM devices WHERE id=$1', [req.params.id]);
    if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
    const { pollDevice } = require('../poller');
    const result = await pollDevice(app.db, rows[0]);
    return result;
  });
};
