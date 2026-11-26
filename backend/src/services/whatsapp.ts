function getWppConfig() {
  const apiUrl = process.env.WPPCONNECT_API_URL;
  const sessionName = process.env.WPPCONNECT_SESSION_NAME;
  const secretKey = process.env.WPPCONNECT_SECRET_KEY;

  if (!apiUrl || !sessionName || !secretKey) {
    throw new Error(
      'WPPConnect configuration missing. Please set WPPCONNECT_API_URL, WPPCONNECT_SESSION_NAME, and WPPCONNECT_SECRET_KEY'
    );
  }

  return {
    baseUrl: apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl,
    sessionName,
    secretKey,
  };
}

async function generateWppToken(): Promise<{ baseUrl: string; sessionName: string; token: string }> {
  const { baseUrl, sessionName, secretKey } = getWppConfig();
  const tokenUrl = `${baseUrl}/api/${encodeURIComponent(sessionName)}/${encodeURIComponent(secretKey)}/generate-token`;

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const tokenText = await tokenResponse.text();
  if (!tokenResponse.ok) {
    throw new Error(`Failed to generate WPPConnect token (${tokenResponse.status}): ${tokenText}`);
  }

  const tokenData = JSON.parse(tokenText) as { token?: string };
  if (!tokenData.token) {
    throw new Error('WPPConnect token not found in response');
  }

  return { baseUrl, sessionName, token: tokenData.token };
}

function normalizeQrCode(qr?: string | null): string | null {
  if (!qr || typeof qr !== 'string') return null;
  if (qr.startsWith('data:image')) return qr;
  return `data:image/png;base64,${qr}`;
}

export async function getWhatsAppStatus() {
  const { baseUrl, sessionName, token } = await generateWppToken();
  const res = await fetch(`${baseUrl}/api/${encodeURIComponent(sessionName)}/status-session`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  const status = String(data.status || 'DISCONNECTED').toUpperCase();
  let qrcode = status === 'QRCODE' ? normalizeQrCode(typeof data.qrcode === 'string' ? data.qrcode : null) : null;

  // Fetch fresh QR image if status is QRCODE and status-session didn't include it
  if (status === 'QRCODE' && !qrcode) {
    try {
      const qrRes = await fetch(`${baseUrl}/api/${encodeURIComponent(sessionName)}/qrcode-session`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (qrRes.ok) {
        const contentType = qrRes.headers.get('content-type') || '';
        if (contentType.includes('image/')) {
          const buf = Buffer.from(await qrRes.arrayBuffer());
          qrcode = `data:${contentType};base64,${buf.toString('base64')}`;
        } else {
          const qrJson = (await qrRes.json()) as { qrcode?: string };
          qrcode = normalizeQrCode(qrJson.qrcode);
        }
      }
    } catch {
      // Ignore fallback QR fetch error
    }
  }

  return {
    session: sessionName,
    status,
    connected: status === 'CONNECTED',
    qrcode,
    message: typeof data.message === 'string' ? data.message : undefined,
  };
}

export async function startWhatsAppSession() {
  const { baseUrl, sessionName, token } = await generateWppToken();
  const res = await fetch(`${baseUrl}/api/${encodeURIComponent(sessionName)}/start-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      webhook: '',
      waitQrCode: true,
    }),
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`WPPConnect start-session error (${res.status}): ${text}`);
  }

  const status = String(data.status || 'INITIALIZING').toUpperCase();
  return {
    session: sessionName,
    status,
    connected: status === 'CONNECTED',
    qrcode: normalizeQrCode(typeof data.qrcode === 'string' ? data.qrcode : null),
  };
}

export async function logoutWhatsAppSession() {
  const { baseUrl, sessionName, token } = await generateWppToken();
  const res = await fetch(`${baseUrl}/api/${encodeURIComponent(sessionName)}/logout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`WPPConnect logout-session error (${res.status}): ${text}`);
  }

  return { success: true, session: sessionName, data };
}

export async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  const { baseUrl, sessionName, token } = await generateWppToken();

  let formattedPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
  if (!formattedPhone.startsWith('62') && formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.substring(1);
  }

  const sendMessageUrl = `${baseUrl}/api/${encodeURIComponent(sessionName)}/send-message`;
  const messageResponse = await fetch(sendMessageUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      phone: formattedPhone,
      message,
      isGroup: false,
    }),
  });

  const messageText = await messageResponse.text();
  if (!messageResponse.ok) {
    throw new Error(`WPPConnect API error (${messageResponse.status}): ${messageText}`);
  }

  try {
    return JSON.parse(messageText);
  } catch {
    return { raw: messageText };
  }
}
