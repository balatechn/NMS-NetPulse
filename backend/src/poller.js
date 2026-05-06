const snmp = require('net-snmp');
const ping = require('ping');
const { broadcast } = require('./routes/ws');

// OIDs
const OID_SYSUPTIME = '1.3.6.1.2.1.1.3.0';
const OID_SYSDESCR = '1.3.6.1.2.1.1.1.0';
const OID_IFINOCTETS = '1.3.6.1.2.1.2.2.1.10';   // ifInOctets table
const OID_IFOUTOCTETS = '1.3.6.1.2.1.2.2.1.16';  // ifOutOctets table

async function pingDevice(ip) {
  const res = await ping.promise.probe(ip, { timeout: 5, extra: ['-c', '3'] });
  return {
    alive: res.alive,
    latency: res.avg !== 'unknown' ? parseFloat(res.avg) : null,
  };
}

function snmpGet(session, oids) {
  return new Promise((resolve) => {
    session.get(oids, (err, varbinds) => {
      if (err) return resolve({});
      const result = {};
      for (const vb of varbinds) {
        if (!snmp.isVarbindError(vb)) {
          result[vb.oid] = vb.value;
        }
      }
      resolve(result);
    });
  });
}

function createSession(device) {
  const ver = device.snmp_version === '3' ? snmp.Version3
    : device.snmp_version === '1' ? snmp.Version1
    : snmp.Version2c;
  return snmp.createSession(device.ip_address, device.snmp_community || 'NATIONAL852', {
    port: device.snmp_port || 161,
    timeout: 5000,
    retries: 1,
    version: ver,
  });
}

async function pollDevice(db, device) {
  const startTime = Date.now();
  let status = 'unknown';
  let latency = null;
  let uptime = null;
  let sysDescr = null;

  // Ping first
  const pingResult = await pingDevice(device.ip_address).catch(() => ({ alive: false, latency: null }));
  latency = pingResult.latency;

  if (pingResult.alive) {
    status = 'up';

    // SNMP get
    const session = createSession(device);
    try {
      const data = await snmpGet(session, [OID_SYSUPTIME, OID_SYSDESCR]);
      uptime = data[OID_SYSUPTIME] ? parseInt(data[OID_SYSUPTIME]) : null;
      sysDescr = data[OID_SYSDESCR] ? data[OID_SYSDESCR].toString() : null;
    } catch (e) {
      // SNMP unavailable but device is up
    } finally {
      session.close();
    }
  } else {
    status = 'down';
  }

  // Store status
  await db.query(
    `INSERT INTO device_status (device_id, status, latency_ms, uptime_ticks, sys_descr)
     VALUES ($1,$2,$3,$4,$5)`,
    [device.id, status, latency, uptime, sysDescr]
  );

  // Keep only last 1000 rows per device
  await db.query(
    `DELETE FROM device_status WHERE device_id=$1 AND id NOT IN (
       SELECT id FROM device_status WHERE device_id=$1 ORDER BY checked_at DESC LIMIT 1000
     )`,
    [device.id]
  );

  // Store latency metric
  if (latency !== null) {
    await db.query(
      `INSERT INTO device_metrics (device_id, metric_name, metric_value, unit) VALUES ($1,'latency',$2,'ms')`,
      [device.id, latency]
    );
  }

  // Keep only last 2000 metric rows per device per metric
  await db.query(
    `DELETE FROM device_metrics WHERE device_id=$1 AND metric_name='latency'
     AND id NOT IN (
       SELECT id FROM device_metrics WHERE device_id=$1 AND metric_name='latency'
       ORDER BY recorded_at DESC LIMIT 2000
     )`,
    [device.id]
  );

  // Alert if down
  if (status === 'down') {
    // Check if there's already an open alert
    const { rows } = await db.query(
      `SELECT id FROM alerts WHERE device_id=$1 AND resolved=false AND message LIKE 'Device unreachable%' LIMIT 1`,
      [device.id]
    );
    if (rows.length === 0) {
      await db.query(
        `INSERT INTO alerts (device_id, severity, message) VALUES ($1,'critical','Device unreachable - ping failed')`,
        [device.id]
      );
    }
  } else {
    // Auto-resolve down alerts
    await db.query(
      `UPDATE alerts SET resolved=true, resolved_at=NOW()
       WHERE device_id=$1 AND resolved=false AND message LIKE 'Device unreachable%'`,
      [device.id]
    );
  }

  const result = { device_id: device.id, ip: device.ip_address, status, latency, uptime, sysDescr };

  // Broadcast to WebSocket clients
  broadcast({ type: 'status_update', data: result, time: new Date().toISOString() });

  return result;
}

async function pollAll(db) {
  const { rows: devices } = await db.query('SELECT * FROM devices WHERE enabled=true');
  const results = await Promise.allSettled(devices.map((d) => pollDevice(db, d)));
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`[Poller] Polled ${devices.length} devices (${ok} ok)`);
}

function startPoller(db) {
  // Poll every 60 seconds
  const interval = parseInt(process.env.POLL_INTERVAL_SECONDS || '60');
  console.log(`[Poller] Starting — every ${interval}s`);

  // Initial poll after 10s
  setTimeout(() => pollAll(db), 10000);

  setInterval(() => pollAll(db), interval * 1000);
}

module.exports = { startPoller, pollDevice };
