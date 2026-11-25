import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  staff_role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

export const signAuthToken = (user: AuthUser): string => {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      staff_role: user.staff_role,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
};

export const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.cookies?.boeba_token) {
    return req.cookies.boeba_token;
  }
  return null;
};

/**
 * Attaches req.user if a valid JWT is present, but does not reject unauthenticated requests.
 */
export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return next();
  }
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, full_name: true, role: true, staff_role: true },
    });
    if (user) {
      req.user = user;
    }
  } catch {
    // Ignore invalid/expired token for optional auth
  }
  return next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, full_name: true, role: true, staff_role: true },
    });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireStaff = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'admin' && req.user.staff_role !== 'hostess') {
    return res.status(403).json({ error: 'Staff access required' });
  }
  return next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
};
