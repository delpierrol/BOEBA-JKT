import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import functionRoutes from './routes/functions.js';
import { prisma } from './lib/prisma.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    return res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/functions', functionRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Boeba API server listening on port ${PORT}`);
});
