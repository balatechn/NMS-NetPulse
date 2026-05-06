-- NMS Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  ip_address INET NOT NULL,
  type VARCHAR(50) DEFAULT 'router',
  location VARCHAR(200),
  snmp_community VARCHAR(100) DEFAULT 'NATIONAL852',
  snmp_version VARCHAR(10) DEFAULT '2c',
  snmp_port INT DEFAULT 161,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_status (
  id SERIAL PRIMARY KEY,
  device_id INT REFERENCES devices(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'unknown',
  latency_ms FLOAT,
  uptime_ticks BIGINT,
  sys_descr TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_metrics (
  id SERIAL PRIMARY KEY,
  device_id INT REFERENCES devices(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  metric_value FLOAT,
  unit VARCHAR(50),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  device_id INT REFERENCES devices(id) ON DELETE CASCADE,
  severity VARCHAR(20) DEFAULT 'warning',
  message TEXT NOT NULL,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_device_status_device_id ON device_status(device_id);
CREATE INDEX IF NOT EXISTS idx_device_status_checked_at ON device_status(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_metrics_device_id ON device_metrics(device_id);
CREATE INDEX IF NOT EXISTS idx_device_metrics_recorded_at ON device_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
