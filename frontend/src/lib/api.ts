const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('nms_token') || '';
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('nms_token');
    window.location.href = '/';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => apiFetch('/auth/me'),

  // Devices
  getDevices: () => apiFetch('/devices'),
  getDevice: (id: number) => apiFetch(`/devices/${id}`),
  createDevice: (data: any) => apiFetch('/devices', { method: 'POST', body: JSON.stringify(data) }),
  updateDevice: (id: number, data: any) => apiFetch(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDevice: (id: number) => apiFetch(`/devices/${id}`, { method: 'DELETE' }),
  pollDevice: (id: number) => apiFetch(`/devices/${id}/poll`, { method: 'POST' }),

  // Metrics
  getMetrics: (deviceId: number, hours = 24) => apiFetch(`/metrics/${deviceId}?hours=${hours}`),
  getLatestMetrics: (deviceId: number) => apiFetch(`/metrics/${deviceId}/latest`),
  getSummary: () => apiFetch('/metrics/summary/all'),

  // Alerts
  getAlerts: (resolved = false) => apiFetch(`/alerts?resolved=${resolved}`),
  resolveAlert: (id: number) => apiFetch(`/alerts/${id}/resolve`, { method: 'PUT' }),
  deleteAlert: (id: number) => apiFetch(`/alerts/${id}`, { method: 'DELETE' }),
};
