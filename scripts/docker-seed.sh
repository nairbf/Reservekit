#!/bin/sh
cd /app
npx prisma db push --accept-data-loss
node -e "
const { PrismaClient } = require('./src/generated/prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const bcrypt = require('bcryptjs');
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./data/reservekit.db' });
const prisma = new PrismaClient({ adapter });
(async () => {
  const exists = await prisma.user.findFirst();
  if (exists) { console.log('DB already seeded'); process.exit(0); }
  const hash = await bcrypt.hash('admin123', 12);
  await prisma.user.create({ data: { email: 'admin@restaurant.com', passwordHash: hash, name: 'Admin', role: 'admin' } });
  const defaults = { restaurantName: 'My Restaurant', timezone: 'America/New_York', openTime: '17:00', closeTime: '22:00', slotInterval: '30', maxCoversPerSlot: '40', maxPartySize: '8', diningDurations: JSON.stringify({1:60,2:75,3:90,4:90,5:105,6:120,7:120,8:120}) };
  for (const [key, value] of Object.entries(defaults)) { await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } }); }
  console.log('Seeded successfully');
})();
"
