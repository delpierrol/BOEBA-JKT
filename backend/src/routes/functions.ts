import { Router } from 'express';
import { z } from 'zod';
import {
  getWhatsAppStatus,
  logoutWhatsAppSession,
  sendWhatsAppMessage,
  startWhatsAppSession,
} from '../services/whatsapp.js';
import { verifyRecaptchaToken } from '../services/recaptcha.js';
import { sendEmail } from '../services/email.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

const whatsappSchema = z.object({
  phoneNumber: z.string().min(1),
  message: z.string().min(1),
});

const recaptchaSchema = z.object({
  token: z.string().min(1),
});

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  from_name: z.string().optional(),
});

router.post('/sendWhatsAppMessage', async (req, res) => {
  const parsed = whatsappSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: phoneNumber and message',
    });
  }

  try {
    const data = await sendWhatsAppMessage(parsed.data.phoneNumber, parsed.data.message);
    return res.json({
      success: true,
      message: 'WhatsApp message sent successfully',
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send WhatsApp message';
    console.error('[WhatsApp] Error:', message);
    return res.status(500).json({
      success: false,
      error: 'Failed to send WhatsApp message',
      details: message,
    });
  }
});

router.post('/verifyRecaptcha', async (req, res) => {
  const parsed = recaptchaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'reCAPTCHA token is required',
    });
  }

  try {
    const result = await verifyRecaptchaToken(parsed.data.token);
    if (result.success) {
      return res.json({
        success: true,
        message: 'reCAPTCHA verified successfully',
      });
    }
    return res.status(400).json({
      success: false,
      error: 'reCAPTCHA verification failed',
      details: result.errorCodes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'reCAPTCHA verification error';
    console.error('[reCAPTCHA] Error:', message);
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
});

router.post('/sendEmail', async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email payload',
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await sendEmail(parsed.data);
    return res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    console.error('[Email] Error:', message);
    return res.status(500).json({
      success: false,
      error: message,
    });
  }
});

router.get('/whatsapp/status', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const status = await getWhatsAppStatus();
    return res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check WhatsApp status';
    console.error('[WhatsApp Status] Error:', message);
    return res.status(500).json({ error: message });
  }
});

router.post('/whatsapp/start', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await startWhatsAppSession();
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start WhatsApp session';
    console.error('[WhatsApp Start] Error:', message);
    return res.status(500).json({ error: message });
  }
});

router.post('/whatsapp/logout', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await logoutWhatsAppSession();
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to disconnect WhatsApp session';
    console.error('[WhatsApp Logout] Error:', message);
    return res.status(500).json({ error: message });
  }
});

export default router;
