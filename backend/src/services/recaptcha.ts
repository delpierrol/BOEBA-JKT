export async function verifyRecaptchaToken(token: string) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    throw new Error('RECAPTCHA_SECRET_KEY not configured on server');
  }

  const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
  const body = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  const response = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await response.json()) as {
    success: boolean;
    'error-codes'?: string[];
  };

  return {
    success: Boolean(data.success),
    errorCodes: data['error-codes'] || [],
  };
}
