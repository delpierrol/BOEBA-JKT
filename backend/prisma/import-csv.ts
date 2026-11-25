import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function readCsvIfExists(filePath: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) {
    console.log(`[Skip] File not found: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content) {
    console.log(`[Skip] Empty file: ${filePath}`);
    return [];
  }
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function findFirstExisting(dir: string, candidates: string[]): string | null {
  for (const name of candidates) {
    const full = path.join(dir, name);
    if (fs.existsSync(full) && fs.statSync(full).size > 0) {
      return full;
    }
  }
  return null;
}

function toDateOrNow(val?: string): Date {
  if (!val) return new Date();
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

async function main() {
  const backupDir = process.argv[2] || process.env.CSV_BACKUP_DIR || path.resolve(process.cwd(), '../..');
  console.log(`Importing Base44 CSV backups from: ${backupDir}`);

  // 1. Settings
  const settingsFile = findFirstExisting(backupDir, [
    'Settings_export_241026.csv',
    'Booking_export_setting_250826.csv',
    'Settings_export210226.csv',
    'Settings_export.csv',
  ]);
  if (settingsFile) {
    const rows = readCsvIfExists(settingsFile);
    let count = 0;
    for (const r of rows) {
      if (!r.setting_key) continue;
      await prisma.settings.upsert({
        where: { setting_key: r.setting_key },
        update: {
          setting_value: r.setting_value ?? '',
          description: r.description || null,
        },
        create: {
          setting_key: r.setting_key,
          setting_value: r.setting_value ?? '',
          description: r.description || null,
          created_date: toDateOrNow(r.created_date),
        },
      });
      count++;
    }
    console.log(`[Settings] Imported/updated ${count} rows from ${path.basename(settingsFile)}`);
  }

  // 2. DateCapacity
  const dateCapFile = findFirstExisting(backupDir, [
    'DateCapacity_expor_241026.csv',
    'Booking_export_date_250826.csv',
    'DateCapacity_export210226.csv',
    'DateCapacity_export.csv',
  ]);
  if (dateCapFile) {
    const rows = readCsvIfExists(dateCapFile);
    let count = 0;
    for (const r of rows) {
      if (!r.date) continue;
      const totalCapacity = Number.parseInt(r.total_capacity || '50', 10);
      const sundayReserved =
        r.sunday_reserved_slots !== undefined && r.sunday_reserved_slots !== ''
          ? Number.parseInt(r.sunday_reserved_slots, 10)
          : null;
      await prisma.dateCapacity.upsert({
        where: { date: r.date },
        update: {
          total_capacity: Number.isNaN(totalCapacity) ? 50 : totalCapacity,
          sunday_reserved_slots: Number.isNaN(sundayReserved as number) ? null : sundayReserved,
          notes: r.notes || null,
        },
        create: {
          date: r.date,
          total_capacity: Number.isNaN(totalCapacity) ? 50 : totalCapacity,
          sunday_reserved_slots: Number.isNaN(sundayReserved as number) ? null : sundayReserved,
          notes: r.notes || null,
          created_date: toDateOrNow(r.created_date),
        },
      });
      count++;
    }
    console.log(`[DateCapacity] Imported/updated ${count} rows from ${path.basename(dateCapFile)}`);
  }

  // 3. SessionCapacity
  const sessionCapFile = findFirstExisting(backupDir, [
    'SessionCapacity_export_241026.csv',
    'Booking_export_session_250826.csv',
    'SessionCapacity_export210226.csv',
    'SessionCapacity_export.csv',
  ]);
  if (sessionCapFile) {
    const rows = readCsvIfExists(sessionCapFile);
    let count = 0;
    for (const r of rows) {
      if (!r.date || !r.time_slot) continue;
      const capacity = Number.parseInt(r.capacity || '50', 10);
      await prisma.sessionCapacity.upsert({
        where: { date_time_slot: { date: r.date, time_slot: r.time_slot } },
        update: {
          capacity: Number.isNaN(capacity) ? 50 : capacity,
          notes: r.notes || null,
        },
        create: {
          date: r.date,
          time_slot: r.time_slot,
          capacity: Number.isNaN(capacity) ? 50 : capacity,
          notes: r.notes || null,
          created_date: toDateOrNow(r.created_date),
        },
      });
      count++;
    }
    console.log(`[SessionCapacity] Imported/updated ${count} rows from ${path.basename(sessionCapFile)}`);
  }

  // 4. Booking
  const bookingFile = findFirstExisting(backupDir, [
    'Booking_export_241026.csv',
    'Booking_export_book_250826.csv',
    'Booking_export_210226.csv',
    'Booking_export.csv',
  ]);
  if (bookingFile) {
    const rows = readCsvIfExists(bookingFile);
    let count = 0;
    for (const r of rows) {
      if (!r.booking_code || !r.customer_name || !r.booking_date || !r.time_slot) continue;
      const partySize = Number.parseInt(r.party_size || '1', 10);
      const status = ['confirmed', 'cancelled', 'completed'].includes(r.status)
        ? r.status
        : 'confirmed';
      await prisma.booking.upsert({
        where: { booking_code: r.booking_code },
        update: {
          customer_name: r.customer_name,
          customer_email: r.customer_email || null,
          whatsapp_number: r.whatsapp_number || '',
          booking_date: r.booking_date,
          time_slot: r.time_slot,
          party_size: Number.isNaN(partySize) ? 1 : partySize,
          status,
          reminder_sent: r.reminder_sent === 'true',
          notes: r.notes || null,
        },
        create: {
          booking_code: r.booking_code,
          customer_name: r.customer_name,
          customer_email: r.customer_email || null,
          whatsapp_number: r.whatsapp_number || '',
          booking_date: r.booking_date,
          time_slot: r.time_slot,
          party_size: Number.isNaN(partySize) ? 1 : partySize,
          status,
          reminder_sent: r.reminder_sent === 'true',
          notes: r.notes || null,
          created_date: toDateOrNow(r.created_date),
        },
      });
      count++;
    }
    console.log(`[Booking] Imported/updated ${count} rows from ${path.basename(bookingFile)}`);
  }

  // 5. WaitingList
  const waitlistFile = findFirstExisting(backupDir, [
    'WaitingList_export_291225.csv',
    'WaitingList_export210226.csv',
    'WaitingList_export_)091225.csv',
    'WaitingList_export_130225.csv',
  ]);
  if (waitlistFile) {
    const existingCount = await prisma.waitingList.count();
    if (existingCount === 0) {
      const rows = readCsvIfExists(waitlistFile);
      let count = 0;
      for (const r of rows) {
        if (!r.customer_name || !r.booking_date || !r.time_slot) continue;
        const partySize = Number.parseInt(r.party_size || '1', 10);
        const status = ['waiting', 'contacted', 'booked', 'cancelled'].includes(r.status)
          ? r.status
          : 'waiting';
        await prisma.waitingList.create({
          data: {
            customer_name: r.customer_name,
            whatsapp_number: r.whatsapp_number || '',
            booking_date: r.booking_date,
            time_slot: r.time_slot,
            party_size: Number.isNaN(partySize) ? 1 : partySize,
            status,
            notes: r.notes || null,
            created_date: toDateOrNow(r.created_date),
          },
        });
        count++;
      }
      console.log(`[WaitingList] Imported ${count} rows from ${path.basename(waitlistFile)}`);
    } else {
      console.log(`[WaitingList] Skipped (${existingCount} rows already exist)`);
    }
  }

  console.log('CSV import finished.');
}

main()
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
