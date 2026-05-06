require('dotenv').config();
const Fastify = require('fastify');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = parseInt(process.env.PORT || '3001');
const DB_URL = process.env.DATABASE_URL;

// ── DB Pool ──────────────────────────────────────────────────────────────────
const db = new Pool({ connectionString: DB_URL, max: 10 });

// ── Startup probe server (returns 503 until Fastify is ready) ────────────────
let probeReady = false;
const probe = http.createServer((req, res) => {
  if (probeReady) { res.writeHead(200); res.end('ok'); return; }
  res.writeHead(503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'starting' }));
});
probe.listen(PORT, '0.0.0.0');

// ── Migrate ──────────────────────────────────────────────────────────────────
async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/001_init.sql'), 'utf8');
  await db.query(sql);
  console.log('[DB] Migration complete');
}

// ── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  const { rows } = await db.query('SELECT COUNT(*) FROM users');
  if (parseInt(rows[0].count) > 0) return;

  const hash = await bcrypt.hash('Admin@123', 10);
  await db.query(
    `INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,$4)`,
    ['admin', 'admin@nms.local', hash, 'admin']
  );

  const sampleDevices = [
    { name: 'Core-Router-01', ip: '192.168.1.1', type: 'router', location: 'DC-Main' },
    { name: 'Distribution-SW-01', ip: '192.168.1.2', type: 'switch', location: 'DC-Main' },
    { name: 'Edge-FW-01', ip: '192.168.1.254', type: 'firewall', location: 'DC-Edge' },
    { name: 'Access-SW-01', ip: '192.168.2.1', type: 'switch', location: 'Floor-1' },
    { name: 'AP-01', ip: '192.168.3.1', type: 'access-point', location: 'Floor-2' },
  ];

  for (const d of sampleDevices) {
    await db.query(
      `INSERT INTO devices (name, ip_address, type, location, snmp_community) VALUES ($1,$2,$3,$4,$5)`,
      [d.name, d.ip, d.type, d.location, process.env.SNMP_DEFAULT_COMMUNITY || 'NATIONAL852']
    );
  }
  console.log('[DB] Seeded admin + 5 devices');
}

// ── Build Fastify ─────────────────────────────────────────────────────────────
async function buildApp() {
  const app = Fastify({ logger: { level: 'warn' }, trustProxy: true });

  await app.register(require('@fastify/cors'), {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  });

  await app.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'nms_jwt_secret_change_me',
    sign: { expiresIn: '24h' },
  });

  await app.register(require('@fastify/websocket'));

  // Decorate auth
  app.decorate('auth', async (req, reply) => {
    try { await req.jwtVerify(); }
    catch { reply.code(401).send({ error: 'Unauthorized' }); }
  });

  // Attach db
  app.decorate('db', db);

  // Routes
  await app.register(require('./routes/auth'), { prefix: '/api/auth' });
  await app.register(require('./routes/devices'), { prefix: '/api/devices' });
  await app.register(require('./routes/metrics'), { prefix: '/api/metrics' });
  await app.register(require('./routes/alerts'), { prefix: '/api/alerts' });
  await app.register(require('./routes/ws'), { prefix: '/ws' });

  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  return app;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  process.on('uncaughtException', (err) => { console.error('[FATAL]', err.stack); process.exit(1); });
  process.on('unhandledRejection', (reason) => { console.error('[WARN]', reason); });

  // Wait for DB
  for (let i = 0; i < 30; i++) {
    try { await db.query('SELECT 1'); break; }
    catch (e) { console.log(`[DB] Waiting... (${i+1}/30)`); await new Promise(r => setTimeout(r, 2000)); }
  }

  await migrate();
  await seed();

  const app = await buildApp();

  // Start polling scheduler
  const { startPoller } = require('./poller');
  startPoller(db, app);

  // Swap probe → real server
  probe.close(() => {
    app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
      if (err) { console.error(err); process.exit(1); }
      probeReady = true;
      console.log(`[NMS] Backend ready on :${PORT}`);
    });
  });
}

main();
