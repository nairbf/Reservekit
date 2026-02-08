# ReserveKit — Complete Project

Everything in one zip. Delete your old reservekit folder and start fresh.

## Setup (5 minutes)

### 1. Create Next.js project
```bash
npx create-next-app@latest reservekit --typescript --tailwind --app --src-dir --no-eslint --no-turbopack --import-alias "@/*"
cd reservekit
```

### 2. Install dependencies
```bash
npm install @prisma/client@latest @prisma/adapter-better-sqlite3@latest better-sqlite3@latest bcryptjs jsonwebtoken nodemailer stripe
npm install -D prisma@latest @types/bcryptjs @types/jsonwebtoken @types/nodemailer @types/better-sqlite3 tsx dotenv
```

### 3. Copy ALL files from this zip into your reservekit folder (overwrite everything)

### 4. Generate + seed database
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

You should see: ✅ Seeded: settings + admin user

### 5. Run
```bash
npm run dev
```

## Test Everything

| Page | URL |
|------|-----|
| Landing page | http://localhost:3000 |
| Login | http://localhost:3000/login |
| Dashboard (Inbox) | http://localhost:3000/dashboard |
| Tonight | http://localhost:3000/dashboard/tonight |
| Tables | http://localhost:3000/dashboard/tables |
| Schedule | http://localhost:3000/dashboard/schedule |
| Reports | http://localhost:3000/dashboard/reports |
| Settings | http://localhost:3000/dashboard/settings |
| Guest widget | http://localhost:3000/reserve/test |

**Login:** admin@restaurant.com / admin123

**Full test flow:**
1. Go to Tables → add a few tables
2. Open Guest Widget → pick date/time → submit reservation
3. Go to Inbox → see pending request → approve it
4. Go to Tonight → see it in timeline → mark arrived → seat → complete
5. Go to Reports → see the data

## What's Included

**Core:**
- Guest reservation widget (public)
- Staff dashboard (inbox, tonight, tables)
- Auth (JWT cookies)
- Availability engine (prevents overbooking)
- Email notifications via SMTP
- Walk-in + phone reservations
- SQLite database (zero setup)

**Add-ons:**
- SMS (Twilio, license-key gated) — enter RK-SMS-TEST1234 in Settings
- Schedule overrides (close dates, holiday hours)
- Reporting dashboard
- Settings UI (restaurant details, SMTP, SMS config)
- Landing page with pricing + Stripe checkout
- Embeddable widget script
