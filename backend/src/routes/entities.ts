import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { optionalAuth, requireAuth, requireStaff, type AuthRequest } from '../middleware/auth.js';

const router = Router();

function parseSort(sortParam: unknown, allowedFields: string[]): Record<string, 'asc' | 'desc'> {
  if (typeof sortParam !== 'string' || !sortParam.trim()) {
    return { created_date: 'desc' };
  }
  const desc = sortParam.startsWith('-');
  const field = desc ? sortParam.slice(1) : sortParam;
  if (!allowedFields.includes(field)) {
    return { created_date: 'desc' };
  }
  return { [field]: desc ? 'desc' : 'asc' };
}

function isStaffUser(req: AuthRequest): boolean {
  return Boolean(req.user);
}

// ---------------- BOOKING ----------------
const bookingCreateSchema = z.object({
  booking_code: z.string().min(1),
  customer_name: z.string().min(1),
  customer_email: z.string().email().nullable().optional().or(z.literal('')),
  whatsapp_number: z.string().min(1),
  booking_date: z.string().min(1),
  time_slot: z.string().min(1),
  party_size: z.coerce.number().int().positive(),
  status: z.enum(['confirmed', 'cancelled', 'completed']).default('confirmed'),
  reminder_sent: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

const bookingUpdateSchema = bookingCreateSchema.partial();

router.get('/Booking', optionalAuth, async (req: AuthRequest, res) => {
  const orderBy = parseSort(req.query.sort, ['created_date', 'booking_date', 'customer_name', 'status']);
  if (isStaffUser(req)) {
    const rows = await prisma.booking.findMany({ orderBy });
    return res.json(rows);
  }
  // Public callers only receive capacity-relevant fields (no PII)
  const rows = await prisma.booking.findMany({
    select: {
      id: true,
      booking_date: true,
      time_slot: true,
      party_size: true,
      status: true,
      created_date: true,
    },
    orderBy,
  });
  return res.json(rows);
});

router.get('/Booking/filter', optionalAuth, async (req: AuthRequest, res) => {
  const { booking_code, booking_date, status } = req.query;
  const where: Record<string, unknown> = {};
  if (typeof booking_code === 'string' && booking_code.trim()) {
    where.booking_code = booking_code.trim();
  }
  if (typeof booking_date === 'string' && booking_date.trim()) {
    where.booking_date = booking_date.trim();
  }
  if (typeof status === 'string' && status.trim()) {
    where.status = status.trim();
  }

  // Require either staff auth or an explicit booking_code lookup
  if (!isStaffUser(req) && !where.booking_code) {
    return res.status(403).json({ error: 'booking_code is required for public lookup' });
  }

  const rows = await prisma.booking.findMany({ where });
  return res.json(rows);
});

router.post('/Booking', async (req, res) => {
  const parsed = bookingCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid booking payload', details: parsed.error.flatten() });
  }

  const data = parsed.data;
  const created = await prisma.booking.create({
    data: {
      ...data,
      customer_email: data.customer_email || null,
      notes: data.notes ?? null,
    },
  });
  return res.status(201).json(created);
});

router.patch('/Booking/:id', async (req, res) => {
  const parsed = bookingUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid booking update', details: parsed.error.flatten() });
  }

  const updated = await prisma.booking.update({
    where: { id: String(req.params.id) },
    data: {
      ...parsed.data,
      ...(parsed.data.customer_email === '' ? { customer_email: null } : {}),
    },
  });
  return res.json(updated);
});

router.delete('/Booking/:id', requireAuth, requireStaff, async (req, res) => {
  await prisma.booking.delete({ where: { id: String(req.params.id) } });
  return res.json({ success: true });
});

// ---------------- DATE CAPACITY ----------------
const dateCapacitySchema = z.object({
  date: z.string().min(1),
  total_capacity: z.coerce.number().int().min(0).default(50),
  sunday_reserved_slots: z.coerce.number().int().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.get('/DateCapacity', async (req, res) => {
  const orderBy = parseSort(req.query.sort, ['date', 'created_date']);
  const rows = await prisma.dateCapacity.findMany({ orderBy });
  return res.json(rows);
});

router.post('/DateCapacity', requireAuth, requireStaff, async (req, res) => {
  const parsed = dateCapacitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid date capacity', details: parsed.error.flatten() });
  }
  const created = await prisma.dateCapacity.create({ data: parsed.data });
  return res.status(201).json(created);
});

router.patch('/DateCapacity/:id', requireAuth, requireStaff, async (req, res) => {
  const parsed = dateCapacitySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid date capacity update', details: parsed.error.flatten() });
  }
  const updated = await prisma.dateCapacity.update({
    where: { id: String(req.params.id) },
    data: parsed.data,
  });
  return res.json(updated);
});

router.delete('/DateCapacity/:id', requireAuth, requireStaff, async (req, res) => {
  await prisma.dateCapacity.delete({ where: { id: String(req.params.id) } });
  return res.json({ success: true });
});

// ---------------- SESSION CAPACITY ----------------
const sessionCapacitySchema = z.object({
  date: z.string().min(1),
  time_slot: z.string().min(1),
  capacity: z.coerce.number().int().min(0).default(50),
  notes: z.string().nullable().optional(),
});

router.get('/SessionCapacity', async (req, res) => {
  const orderBy = parseSort(req.query.sort, ['date', 'time_slot', 'created_date']);
  const rows = await prisma.sessionCapacity.findMany({ orderBy });
  return res.json(rows);
});

router.post('/SessionCapacity', requireAuth, requireStaff, async (req, res) => {
  const parsed = sessionCapacitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid session capacity', details: parsed.error.flatten() });
  }
  const created = await prisma.sessionCapacity.create({ data: parsed.data });
  return res.status(201).json(created);
});

router.patch('/SessionCapacity/:id', requireAuth, requireStaff, async (req, res) => {
  const parsed = sessionCapacitySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid session capacity update', details: parsed.error.flatten() });
  }
  const updated = await prisma.sessionCapacity.update({
    where: { id: String(req.params.id) },
    data: parsed.data,
  });
  return res.json(updated);
});

router.delete('/SessionCapacity/:id', requireAuth, requireStaff, async (req, res) => {
  await prisma.sessionCapacity.delete({ where: { id: String(req.params.id) } });
  return res.json({ success: true });
});

// ---------------- SETTINGS ----------------
const settingsSchema = z.object({
  setting_key: z.string().min(1),
  setting_value: z.string(),
  description: z.string().nullable().optional(),
});

router.get('/Settings', async (_req, res) => {
  const rows = await prisma.settings.findMany({ orderBy: { setting_key: 'asc' } });
  return res.json(rows);
});

router.post('/Settings', requireAuth, requireStaff, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid setting', details: parsed.error.flatten() });
  }
  const created = await prisma.settings.create({ data: parsed.data });
  return res.status(201).json(created);
});

router.patch('/Settings/:id', requireAuth, requireStaff, async (req, res) => {
  const parsed = settingsSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid setting update', details: parsed.error.flatten() });
  }
  const updated = await prisma.settings.update({
    where: { id: String(req.params.id) },
    data: parsed.data,
  });
  return res.json(updated);
});

// ---------------- WAITING LIST ----------------
const waitingListSchema = z.object({
  customer_name: z.string().min(1),
  whatsapp_number: z.string().min(1),
  booking_date: z.string().min(1),
  time_slot: z.string().min(1),
  party_size: z.coerce.number().int().positive(),
  status: z.enum(['waiting', 'contacted', 'booked', 'cancelled']).default('waiting'),
  notes: z.string().nullable().optional(),
});

router.get('/WaitingList', requireAuth, requireStaff, async (req, res) => {
  const orderBy = parseSort(req.query.sort, ['created_date', 'booking_date', 'status']);
  const rows = await prisma.waitingList.findMany({ orderBy });
  return res.json(rows);
});

router.post('/WaitingList', async (req, res) => {
  const parsed = waitingListSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid waiting list payload', details: parsed.error.flatten() });
  }
  const created = await prisma.waitingList.create({ data: parsed.data });
  return res.status(201).json(created);
});

router.patch('/WaitingList/:id', requireAuth, requireStaff, async (req, res) => {
  const parsed = waitingListSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid waiting list update', details: parsed.error.flatten() });
  }
  const updated = await prisma.waitingList.update({
    where: { id: String(req.params.id) },
    data: parsed.data,
  });
  return res.json(updated);
});

router.delete('/WaitingList/:id', requireAuth, requireStaff, async (req, res) => {
  await prisma.waitingList.delete({ where: { id: String(req.params.id) } });
  return res.json({ success: true });
});

export default router;
