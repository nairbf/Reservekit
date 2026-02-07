# ReserveKit Part 1

## Setup (5 minutes)

### 1. Create Next.js project
```bash
npx create-next-app@latest reservekit --typescript --tailwind --app --src-dir --no-eslint --no-turbopack --import-alias "@/*"
cd reservekit
```

### 2. Install dependencies
```bash
npm install @prisma/client@latest @prisma/adapter-better-sqlite3@latest better-sqlite3@latest bcryptjs jsonwebtoken nodemailer
npm install -D prisma@latest @types/bcryptjs @types/jsonwebtoken @types/nodemailer @types/better-sqlite3 tsx dotenv
```

### 3. Copy files from this zip into your reservekit folder (overwrite conflicts)

### 4. Generate + seed database
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 5. Run
```bash
npm run dev
```

### 6. Test
- Login: http://localhost:3000/login → admin@restaurant.com / admin123
- Dashboard: http://localhost:3000/dashboard
- Guest widget: http://localhost:3000/reserve/test
- Full flow: widget → submit reservation → dashboard inbox → approve → tonight tab → arrived → seat → complete
