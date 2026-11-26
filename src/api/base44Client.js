const API_BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'boeba_token';

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function createEntityClient(entityName) {
  return {
    list: (sort) => {
      const qs = sort ? `?sort=${encodeURIComponent(sort)}` : '';
      return request(`/api/entities/${entityName}${qs}`);
    },
    filter: (params = {}) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          search.set(k, String(v));
        }
      });
      return request(`/api/entities/${entityName}/filter?${search.toString()}`);
    },
    create: (data) =>
      request(`/api/entities/${entityName}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      request(`/api/entities/${entityName}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      request(`/api/entities/${entityName}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
  };
}

export const base44 = {
  auth: {
    me: () => request('/api/auth/me'),
    login: async (email, password) => {
      const result = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (result?.token) {
        localStorage.setItem(TOKEN_KEY, result.token);
      }
      return result;
    },
    logout: async (redirectUrl) => {
      localStorage.removeItem(TOKEN_KEY);
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } catch {
        // Ignore network errors on logout
      }
      if (redirectUrl) {
        window.location.href = '/login';
      }
    },
    redirectToLogin: (fromUrl) => {
      const target = fromUrl || `${window.location.pathname}${window.location.search}`;
      window.location.href = `/login?redirect=${encodeURIComponent(target)}`;
    },
    isAuthenticated: async () => {
      try {
        await request('/api/auth/me');
        return true;
      } catch {
        return false;
      }
    },
  },
  entities: {
    Booking: createEntityClient('Booking'),
    DateCapacity: createEntityClient('DateCapacity'),
    SessionCapacity: createEntityClient('SessionCapacity'),
    Settings: createEntityClient('Settings'),
    WaitingList: createEntityClient('WaitingList'),
  },
  functions: {
    invoke: async (name, payload) => {
      const data = await request(`/api/functions/${encodeURIComponent(name)}`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      });
      return { data };
    },
  },
  integrations: {
    Core: {
      SendEmail: (payload) =>
        request('/api/functions/sendEmail', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
    },
  },
  whatsapp: {
    status: () => request('/api/functions/whatsapp/status'),
    start: () => request('/api/functions/whatsapp/start', { method: 'POST' }),
    logout: () => request('/api/functions/whatsapp/logout', { method: 'POST' }),
    sendTest: (phoneNumber, message) =>
      request('/api/functions/sendWhatsAppMessage', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber, message }),
      }),
  },
  appLogs: {
    logUserInApp: async () => {},
  },
};
