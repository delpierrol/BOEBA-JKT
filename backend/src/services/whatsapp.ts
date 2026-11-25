export async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  const apiUrl = process.env.WPPCONNECT_API_URL;
  const sessionName = process.env.WPPCONNECT_SESSION_NAME;
  const secretKey = process.env.WPPCONNECT_SECRET_KEY;

  if (!apiUrl || !sessionName || !secretKey) {
    throw new Error(
      'WPPConnect configuration missing. Please set WPPCONNECT_API_URL, WPPCONNECT_SESSION_NAME, and WPPCONNECT_SECRET_KEY'
    );
  }

  let formattedPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
  if (!formattedPhone.startsWith('62') && formattedPhone.startsWith('0')) {
    formattedPhone = '62' + formattedPhone.substring(1);
  }

  const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;

  const tokenUrl = `${baseUrl}/api/${sessionName}/${secretKey}/generate-token`;
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

  const sendMessageUrl = `${baseUrl}/api/${sessionName}/send-message`;
  const messageResponse = await fetch(sendMessageUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.token}`,
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
