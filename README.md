# NetPulse NMS

Modern Network Management System built with Next.js 14 + Fastify + PostgreSQL.

## Features
- Real-time device status (ping + SNMP polling)
- Latency charts & bandwidth metrics
- Alert management with auto-resolve
- WebSocket live updates
- Dark-mode dashboard

## Default Login
- **Username:** admin
- **Password:** Admin@123

## SNMP Config
- Protocol: UDP
- Port: 161
- Community: NATIONAL852

## Quick Start (Docker)
```bash
cp .env.example .env
docker compose up -d --build
```

Open `http://localhost:9090`
