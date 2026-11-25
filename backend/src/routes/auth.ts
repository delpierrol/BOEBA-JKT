import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin, requireAuth, signAuthToken, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).optional(),
  password: z.string().min(6),
  role: z.enum(['admin', 'user']).default('user'),
  staff_role: z.enum(['none', 'hostess']).default('none'),
});

const updateUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'user']).optional(),
  staff_role: z.enum(['none', 'hostess']).optional(),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid email or password format' });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const authUser = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    staff_role: user.staff_role,
  };

  const token = signAuthToken(authUser);
  res.cookie('boeba_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ user: authUser, token });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('boeba_token');
  return res.json({ success: true });
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  return res.json(req.user);
});

router.get('/users', requireAuth, requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      staff_role: true,
      created_date: true,
      updated_date: true,
    },
    orderBy: { created_date: 'desc' },
  });
  return res.json(users);
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid user data', details: parsed.error.flatten() });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  const password_hash = await bcrypt.hash(parsed.data.password, 10);
  const created = await prisma.user.create({
    data: {
      email,
      full_name: parsed.data.full_name ?? null,
      password_hash,
      role: parsed.data.role,
      staff_role: parsed.data.staff_role,
    },
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      staff_role: true,
      created_date: true,
    },
  });
  return res.status(201).json(created);
});

router.patch('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid user update', details: parsed.error.flatten() });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.full_name !== undefined) data.full_name = parsed.data.full_name;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.staff_role !== undefined) data.staff_role = parsed.data.staff_role;
  if (parsed.data.password) {
    data.password_hash = await bcrypt.hash(parsed.data.password, 10);
  }

  const updated = await prisma.user.update({
    where: { id: String(req.params.id) },
    data,
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      staff_role: true,
      updated_date: true,
    },
  });
  return res.json(updated);
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const userId = String(req.params.id);
  if (req.user?.id === userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  await prisma.user.delete({ where: { id: userId } });
  return res.json({ success: true });
});

export default router;
