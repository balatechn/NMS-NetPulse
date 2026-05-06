const bcrypt = require('bcryptjs');

module.exports = async function authRoutes(app) {
  // POST /api/auth/login
  app.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { username, password } = req.body;
    const { rows } = await app.db.query(
      'SELECT * FROM users WHERE username=$1 OR email=$1',
      [username]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const token = app.jwt.sign({ id: user.id, username: user.username, role: user.role });
    return { token, user: { id: user.id, username: user.username, role: user.role } };
  });

  // GET /api/auth/me
  app.get('/me', { preHandler: [app.auth] }, async (req) => {
    const { rows } = await app.db.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    return rows[0];
  });
};
