module.exports = async function alertRoutes(app) {
  // GET /api/alerts?resolved=false&limit=50
  app.get('/', { preHandler: [app.auth] }, async (req) => {
    const resolved = req.query.resolved === 'true';
    const limit = parseInt(req.query.limit || '50');
    const { rows } = await app.db.query(
      `SELECT a.*, d.name AS device_name, d.ip_address
       FROM alerts a
       JOIN devices d ON d.id = a.device_id
       WHERE a.resolved=$1
       ORDER BY a.created_at DESC LIMIT $2`,
      [resolved, limit]
    );
    return rows;
  });

  // PUT /api/alerts/:id/resolve
  app.put('/:id/resolve', { preHandler: [app.auth] }, async (req, reply) => {
    const { rows } = await app.db.query(
      `UPDATE alerts SET resolved=true, resolved_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  // DELETE /api/alerts/:id
  app.delete('/:id', { preHandler: [app.auth] }, async (req, reply) => {
    await app.db.query('DELETE FROM alerts WHERE id=$1', [req.params.id]);
    return reply.code(204).send();
  });
};
