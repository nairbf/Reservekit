#!/usr/bin/env bash
set -euo pipefail

DEMO_PROCESS_NAME="${DEMO_PROCESS_NAME:-reservesit-demo}"
DB="${DB:-/home/reservesit/customers/demo/data/reservekit.db}"
TEMPLATE_DB="${TEMPLATE_DB:-/home/reservesit/customers/demo/data/reservekit.template.db}"

if [ ! -f "$DB" ]; then
  echo "Demo database not found: $DB" >&2
  exit 1
fi

pm2 stop "$DEMO_PROCESS_NAME" >/dev/null 2>&1 || true

cp "$DB" "$TEMPLATE_DB"
cp "$TEMPLATE_DB" "$DB"

TODAY="$(date +%Y-%m-%d)"
TOMORROW="$(date -d "+1 day" +%Y-%m-%d)"
DAY2="$(date -d "+2 days" +%Y-%m-%d)"
NOW_TS="$(date '+%Y-%m-%d %H:%M:%S')"
NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

sqlite3 "$DB" <<SQL
PRAGMA foreign_keys=ON;
BEGIN;

DELETE FROM "PreOrderItem";
DELETE FROM "PreOrder";
DELETE FROM "WaitlistEntry";
DELETE FROM "ReservationPayment"
WHERE reservationId IN (SELECT id FROM "Reservation" WHERE code NOT LIKE 'HIST-%');
DELETE FROM "Reservation" WHERE code NOT LIKE 'HIST-%';
DELETE FROM "Setting" WHERE key LIKE 'pos_status_%';

INSERT OR REPLACE INTO "Setting" ("key","value") VALUES
  ('license_plan','FULL_SUITE'),
  ('license_status','ACTIVE'),
  ('license_valid','true'),
  ('license_last_check','$NOW_ISO'),
  ('license_key','RS-DEMO-FULLSUITE'),
  ('license_expressdining','RS-XDN-DEMO2026'),
  ('feature_sms','true'),
  ('feature_floorplan','true'),
  ('feature_reporting','true'),
  ('feature_guest_history','true'),
  ('feature_event_ticketing','true'),
  ('expressDiningEnabled','true'),
  ('spotonUseMock','true'),
  ('lastSeatingBufferMin','60'),
  ('smartTurnTime','true'),
  ('smartNoShowRisk','true'),
  ('smartGuestIntel','true'),
  ('smartWaitlistEstimate','true'),
  ('smartDailyPrep','true'),
  ('smartPacingAlerts','true');

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","seatedAt")
SELECT
  'DEMO-F01',
  COALESCE(g.name,'Sarah Mitchell'),
  COALESCE(g.phone,'555-3001'),
  g.email,
  g.id,
  2,
  '$TODAY',
  '17:35',
  '19:05',
  90,
  'Window preferred',
  'widget',
  'seated',
  t.id,
  '$NOW_TS',
  '$NOW_TS',
  datetime('now','-105 minutes')
FROM "RestaurantTable" t
LEFT JOIN "Guest" g ON g.id = 1
WHERE t.id = 1 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","seatedAt")
SELECT
  'DEMO-F02',
  COALESCE(g.name,'James Rodriguez'),
  COALESCE(g.phone,'555-3002'),
  g.email,
  g.id,
  2,
  '$TODAY',
  '17:50',
  '19:20',
  90,
  'Booth preferred',
  'widget',
  'seated',
  t.id,
  '$NOW_TS',
  '$NOW_TS',
  datetime('now','-95 minutes')
FROM "RestaurantTable" t
LEFT JOIN "Guest" g ON g.id = 2
WHERE t.id = 2 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","seatedAt")
SELECT
  'DEMO-F03',
  COALESCE(g.name,'Emily Chen'),
  COALESCE(g.phone,'555-3003'),
  g.email,
  g.id,
  6,
  '$TODAY',
  '18:45',
  '20:15',
  90,
  'Celebration dinner',
  'phone',
  'seated',
  t.id,
  '$NOW_TS',
  '$NOW_TS',
  datetime('now','-45 minutes')
FROM "RestaurantTable" t
LEFT JOIN "Guest" g ON g.id = 3
WHERE t.id = 3 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","seatedAt")
SELECT
  'DEMO-F04',
  COALESCE(g.name,'Michael Brown'),
  COALESCE(g.phone,'555-3004'),
  g.email,
  g.id,
  2,
  '$TODAY',
  '18:50',
  '20:20',
  90,
  'Quiet corner',
  'widget',
  'seated',
  t.id,
  '$NOW_TS',
  '$NOW_TS',
  datetime('now','-40 minutes')
FROM "RestaurantTable" t
LEFT JOIN "Guest" g ON g.id = 4
WHERE t.id = 4 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","seatedAt")
SELECT
  'DEMO-F05',
  COALESCE(g.name,'Lisa Wang'),
  COALESCE(g.phone,'555-3005'),
  g.email,
  g.id,
  4,
  '$TODAY',
  '18:55',
  '20:25',
  90,
  'No shellfish',
  'widget',
  'seated',
  t.id,
  '$NOW_TS',
  '$NOW_TS',
  datetime('now','-35 minutes')
FROM "RestaurantTable" t
LEFT JOIN "Guest" g ON g.id = 5
WHERE t.id = 5 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","seatedAt")
SELECT
  'DEMO-F06',
  COALESCE(g.name,'David Thompson'),
  COALESCE(g.phone,'555-3006'),
  g.email,
  g.id,
  2,
  '$TODAY',
  '19:05',
  '20:35',
  90,
  'Near host stand',
  'widget',
  'seated',
  t.id,
  '$NOW_TS',
  '$NOW_TS',
  datetime('now','-25 minutes')
FROM "RestaurantTable" t
LEFT JOIN "Guest" g ON g.id = 6
WHERE t.id = 6 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","seatedAt")
SELECT
  'DEMO-F08',
  COALESCE(g.name,'Anna Kowalski'),
  COALESCE(g.phone,'555-3007'),
  g.email,
  g.id,
  4,
  '$TODAY',
  '19:10',
  '20:40',
  90,
  'Birthday dessert',
  'widget',
  'seated',
  t.id,
  '$NOW_TS',
  '$NOW_TS',
  datetime('now','-20 minutes')
FROM "RestaurantTable" t
LEFT JOIN "Guest" g ON g.id = 7
WHERE t.id = 8 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","seatedAt")
SELECT
  'DEMO-F09',
  COALESCE(g.name,'Robert Kim'),
  COALESCE(g.phone,'555-3008'),
  g.email,
  g.id,
  4,
  '$TODAY',
  '19:20',
  '20:50',
  90,
  'Anniversary',
  'widget',
  'seated',
  t.id,
  '$NOW_TS',
  '$NOW_TS',
  datetime('now','-10 minutes')
FROM "RestaurantTable" t
LEFT JOIN "Guest" g ON g.id = 8
WHERE t.id = 9 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","arrivedAt")
SELECT
  'DEMO-F10',
  COALESCE(g.name,'Jessica Davis'),
  COALESCE(g.phone,'555-3009'),
  g.email,
  g.id,
  3,
  '$TODAY',
  '19:25',
  '20:55',
  90,
  'VIP note',
  'widget',
  'arrived',
  t.id,
  '$NOW_TS',
  '$NOW_TS',
  datetime('now','-5 minutes')
FROM "RestaurantTable" t
LEFT JOIN "Guest" g ON g.id = 9
WHERE t.id = 10 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt")
SELECT
  'DEMO-F12',
  COALESCE(g.name,'Thomas Mueller'),
  COALESCE(g.phone,'555-3010'),
  g.email,
  g.id,
  2,
  '$TODAY',
  substr(time('now','+20 minutes'),1,5),
  substr(time('now','+110 minutes'),1,5),
  90,
  'Date night',
  'widget',
  'confirmed',
  t.id,
  '$NOW_TS',
  '$NOW_TS'
FROM "RestaurantTable" t
LEFT JOIN "Guest" g ON g.id = 10
WHERE t.id = 12 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","seatedAt")
SELECT
  'DEMO-F14',
  'Ethan Brooks',
  '555-3014',
  'ethan.brooks@example.com',
  NULL,
  2,
  '$TODAY',
  '19:25',
  '20:40',
  75,
  'Walk in guest',
  'walkin',
  'seated',
  t.id,
  '$NOW_TS',
  '$NOW_TS',
  datetime('now','-5 minutes')
FROM "RestaurantTable" t
WHERE t.id = 14 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt")
SELECT
  'DEMO-F15',
  'Sofia Alvarez',
  '555-3015',
  'sofia.alvarez@example.com',
  NULL,
  2,
  '$TODAY',
  substr(time('now','+50 minutes'),1,5),
  substr(time('now','+140 minutes'),1,5),
  90,
  'High top requested',
  'widget',
  'approved',
  t.id,
  '$NOW_TS',
  '$NOW_TS'
FROM "RestaurantTable" t
WHERE t.id = 15 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","seatedAt")
SELECT
  'DEMO-F16',
  'Corporate Dinner Group',
  '555-3016',
  'events@example.com',
  NULL,
  10,
  '$TODAY',
  '17:45',
  '19:45',
  120,
  'Corporate tasting menu',
  'staff',
  'seated',
  t.id,
  '$NOW_TS',
  '$NOW_TS',
  datetime('now','-100 minutes')
FROM "RestaurantTable" t
WHERE t.id = 16 AND t.isActive = 1;

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt")
VALUES
('DEMO-P01','Nicole Patel','555-4001','nicole.patel@example.com',NULL,4,'$TOMORROW','19:00','20:30',90,'Business dinner, need projector access','widget','pending',NULL,'$NOW_TS','$NOW_TS'),
('DEMO-P02','Chris Johnson','555-4002','chris.johnson@example.com',NULL,6,'$TOMORROW','19:30','21:00',90,'Birthday celebration','widget','pending',NULL,'$NOW_TS','$NOW_TS'),
('DEMO-P03','Maria Garcia','555-4003','maria.garcia@example.com',NULL,2,'$DAY2','20:00','21:30',90,'Anniversary dinner','widget','pending',NULL,'$NOW_TS','$NOW_TS'),
('DEMO-N01','Olivia Turner','555-4004','olivia.turner@example.com',NULL,2,'$TOMORROW','18:30','20:00',90,'Gluten free options','widget','confirmed',NULL,'$NOW_TS','$NOW_TS'),
('DEMO-N02','Benjamin Lee','555-4005','benjamin.lee@example.com',NULL,5,'$TOMORROW','20:15','21:45',90,'Family dinner','widget','confirmed',NULL,'$NOW_TS','$NOW_TS');

INSERT INTO "WaitlistEntry"
("guestName","guestPhone","guestEmail","partySize","estimatedWait","status","position","quotedAt","notes","guestId","createdAt","updatedAt")
VALUES
('Nora Patel','555-5001','nora.patel@example.com',2,15,'waiting',1,datetime('now','-14 minutes'),'Prefers patio',NULL,datetime('now','-14 minutes'),datetime('now')),
('Liam Brooks','555-5002','liam.brooks@example.com',4,25,'waiting',2,datetime('now','-12 minutes'),'Birthday dessert request',NULL,datetime('now','-12 minutes'),datetime('now')),
('Zoe Martinez','555-5003','zoe.martinez@example.com',2,35,'notified',3,datetime('now','-10 minutes'),'Waiting at bar',NULL,datetime('now','-10 minutes'),datetime('now')),
('Farah Khan','555-5004','farah.khan@example.com',5,45,'waiting',4,datetime('now','-8 minutes'),'Shellfish allergy',NULL,datetime('now','-8 minutes'),datetime('now')),
('Noah Wilson','555-5005','noah.wilson@example.com',3,55,'waiting',5,datetime('now','-6 minutes'),'Needs stroller space',NULL,datetime('now','-6 minutes'),datetime('now'));

INSERT INTO "PreOrder"
("reservationId","status","specialNotes","subtotal","isPaid","createdAt","updatedAt")
SELECT id,'submitted','Kitchen pacing requested',0,false,datetime('now','-40 minutes'),datetime('now')
FROM "Reservation" WHERE code='DEMO-F04';

INSERT INTO "PreOrder"
("reservationId","status","specialNotes","subtotal","isPaid","createdAt","updatedAt")
SELECT id,'submitted','Send starters first',0,false,datetime('now','-25 minutes'),datetime('now')
FROM "Reservation" WHERE code='DEMO-F08';

INSERT INTO "PreOrder"
("reservationId","status","specialNotes","subtotal","isPaid","createdAt","updatedAt")
SELECT id,'submitted','Preordered cocktails',0,false,datetime('now','-8 minutes'),datetime('now')
FROM "Reservation" WHERE code='DEMO-F12';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Crispy Calamari' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Crispy Calamari',1,'Share plate',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Crispy Calamari' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-39 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F04';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Garden Bistro Salad' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Garden Bistro Salad',1,'Dressing on side',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Garden Bistro Salad' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-38 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F04';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Grilled NY Strip' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 2),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Grilled NY Strip',1,'Medium rare',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Grilled NY Strip' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 2),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-37 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F04';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Pan-Seared Salmon' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 3),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Pan-Seared Salmon',1,'No dill',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Pan-Seared Salmon' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 3),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-36 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F04';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Bruschetta Trio' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Bruschetta Trio',2,'Extra basil',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Bruschetta Trio' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-24 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F08';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Tuna Tartare' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 2),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Tuna Tartare',1,'No onions',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Tuna Tartare' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 2),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-23 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F08';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Mushroom Risotto' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 3),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Mushroom Risotto',1,'Extra truffle',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Mushroom Risotto' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 3),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-22 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F08';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Herb-Crusted Lamb' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 4),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Herb-Crusted Lamb',1,'Well done',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Herb-Crusted Lamb' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 4),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-21 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F08';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Truffle Fries' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 5),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Truffle Fries',1,'For table',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Truffle Fries' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 5),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-20 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F08';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Garden Spritz' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Garden Spritz',1,'No ice',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Garden Spritz' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-7 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F12';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Smoky Old Fashioned' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 2),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Smoky Old Fashioned',1,'Orange peel garnish',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Smoky Old Fashioned' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 2),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-6 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F12';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Beet and Goat Cheese' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 3),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Beet and Goat Cheese',1,'Share plate',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Beet and Goat Cheese' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 3),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-5 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F12';

INSERT INTO "PreOrderItem"
("preOrderId","menuItemId","guestLabel","quantity","specialInstructions","price","createdAt")
SELECT po.id,
       COALESCE((SELECT id FROM "MenuItem" WHERE name='Lobster Ravioli' LIMIT 1),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 4),(SELECT id FROM "MenuItem" ORDER BY id LIMIT 1)),
       'Lobster Ravioli',1,'Extra sauce',
       COALESCE((SELECT price FROM "MenuItem" WHERE name='Lobster Ravioli' LIMIT 1),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1 OFFSET 4),(SELECT price FROM "MenuItem" ORDER BY id LIMIT 1),0),
       datetime('now','-4 minutes')
FROM "PreOrder" po JOIN "Reservation" r ON r.id=po.reservationId WHERE r.code='DEMO-F12';

UPDATE "PreOrder"
SET subtotal = COALESCE((SELECT SUM(price * quantity) FROM "PreOrderItem" poi WHERE poi.preOrderId = "PreOrder".id),0),
    updatedAt = datetime('now')
WHERE reservationId IN (SELECT id FROM "Reservation" WHERE code IN ('DEMO-F04','DEMO-F08','DEMO-F12'));

INSERT OR REPLACE INTO "Setting" ("key","value") VALUES
  ('pos_status_1','{"orderId":"SPOT-9001","checkTotal":"118.40","balanceDue":"24.00","serverName":"Maya","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_2','{"orderId":"SPOT-9002","checkTotal":"156.80","balanceDue":"31.20","serverName":"Eli","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_3','{"orderId":"SPOT-9003","checkTotal":"243.60","balanceDue":"48.60","serverName":"Nora","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_4','{"orderId":"SPOT-9004","checkTotal":"84.50","balanceDue":"21.10","serverName":"Leo","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_5','{"orderId":"SPOT-9005","checkTotal":"72.50","balanceDue":"18.25","serverName":"Ivy","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_6','{"orderId":"SPOT-9006","checkTotal":"62.75","balanceDue":"15.50","serverName":"Sam","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_7','{"orderId":"SPOT-9007","checkTotal":"45.00","balanceDue":"45.00","serverName":"Ari","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_8','{"orderId":"SPOT-9008","checkTotal":"38.90","balanceDue":"10.40","serverName":"Jules","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_9','{"orderId":"SPOT-9009","checkTotal":"24.50","balanceDue":"6.00","serverName":"Rey","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_13','{"orderId":"SPOT-9013","checkTotal":"22.50","balanceDue":"22.50","serverName":"Kai","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_14','{"orderId":"SPOT-9014","checkTotal":"16.00","balanceDue":"8.00","serverName":"Mina","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_16','{"orderId":"SPOT-9016","checkTotal":"487.60","balanceDue":"115.40","serverName":"Drew","openedAt":"$NOW_ISO","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}');

INSERT OR REPLACE INTO "Setting" ("key","value") VALUES
  ('spotonLastSync','$NOW_ISO'),
  ('spotonLastOpenChecks','12');

COMMIT;
SQL

pm2 restart "$DEMO_PROCESS_NAME" --update-env
