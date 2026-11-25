# Boeba JKT - Table Reservation System (Self-Hosted)

Sistem reservasi meja **Boeba Restaurant Jakarta** yang telah dimigrasi dari Base44 menjadi aplikasi **full-stack containerized** (React + Vite, Node.js + Express + Prisma, PostgreSQL 16, dan Caddy Reverse Proxy).

## Arsitektur
- **Frontend**: React 18, Vite, Tailwind CSS, TanStack React Query, Radix UI (`Dockerfile.frontend` -> Nginx Alpine)
- **Backend**: Node.js 22, Express, TypeScript, Prisma ORM, JWT Auth, Nodemailer, WPPConnect client (`backend/Dockerfile`)
- **Database**: PostgreSQL 16 (`postgres:16-alpine`)
- **Reverse Proxy & SSL**: Caddy 2 (`Caddyfile`)

---

## Deployment ke VPS (Docker Compose)

### 1. Clone Repository & Siapkan `.env`
```bash
git clone https://github.com/delpierrol/BOEBA-JKT.git
cd BOEBA-JKT
cp .env.example .env
nano .env
```
Isi variabel di `.env` (`DOMAIN`, `CORS_ORIGIN`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `RECAPTCHA_SECRET_KEY`, `WPPCONNECT_*`, `SMTP_*`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).

### 2. Jalankan Container
```bash
docker compose up -d --build
```

### 3. Seed Admin Awal
```bash
docker compose exec backend npm run seed
```

### 4. Import Data Backup CSV dari Base44
Letakkan file `.csv` hasil export Base44 ke folder `./backups/` di VPS (folder ini sudah ter-mount ke `/data/backups` di container `backend`), lalu jalankan:
```bash
docker compose exec backend npm run import:csv /data/backups
```

### 5. Akses Aplikasi
- **Public Booking**: `https://<DOMAIN>/`
- **Staff / Admin Login**: `https://<DOMAIN>/login`
- **Dashboard Admin**: `https://<DOMAIN>/Dashboard`
- **Check-In & QR Scanner**: `https://<DOMAIN>/CheckIn` dan `https://<DOMAIN>/QRScanner`

---

## Auto-Deploy dengan GitHub Actions

Workflow CI/CD tersedia di `.github/workflows/deploy.yml`. Setiap kali ada `push` ke branch `main`, GitHub Actions akan:
1. Menjalankan build check frontend & backend (`ci` job).
2. SSH ke VPS, pull kode terbaru, dan menjalankan `docker compose up -d --build --remove-orphans` (`deploy` job).

### Setup GitHub Secrets
Di repository `delpierrol/BOEBA-JKT` → **Settings → Secrets and variables → Actions**, tambahkan:

| Secret | Contoh / Keterangan |
| :--- | :--- |
| `VPS_HOST` | IP publik atau domain VPS |
| `VPS_USER` | Username SSH (mis. `root` atau `ubuntu`) |
| `VPS_SSH_KEY` | Private key SSH (`~/.ssh/id_ed25519`) |
| `VPS_PORT` | *(Opsional)* Port SSH, default `22` |
| `VPS_APP_DIR` | *(Opsional)* Lokasi folder project di VPS, default `/opt/boeba-jkt` |
