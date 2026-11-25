import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@boeba.id').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'BoebaAdmin123!';
  const adminName = process.env.ADMIN_NAME || 'Boeba Admin';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Admin user already exists: ${adminEmail}`);
    return;
  }

  const password_hash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.create({
    data: {
      email: adminEmail,
      full_name: adminName,
      password_hash,
      role: 'admin',
      staff_role: 'none',
    },
  });

  console.log(`Created initial admin user: ${adminEmail}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
