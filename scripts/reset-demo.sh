#!/usr/bin/env bash
set -euo pipefail

DEMO_PROCESS_NAME="${DEMO_PROCESS_NAME:-reservesit-demo}"
DB="${DB:-/home/reservesit/customers/demo/data/reservekit.db}"
TEMPLATE_DB="${TEMPLATE_DB:-/home/reservesit/customers/demo/data/reservekit-template.db}"
ALT_TEMPLATE_DB="${ALT_TEMPLATE_DB:-/home/reservesit/customers/demo/data/reservekit.template.db}"

if [ ! -f "$DB" ]; then
  echo "Demo database not found: $DB" >&2
  exit 1
fi

if [ ! -f "$TEMPLATE_DB" ] && [ -f "$ALT_TEMPLATE_DB" ]; then
  TEMPLATE_DB="$ALT_TEMPLATE_DB"
fi

if [ ! -f "$TEMPLATE_DB" ]; then
  cp "$DB" "$TEMPLATE_DB"
fi

pm2 stop "$DEMO_PROCESS_NAME" >/dev/null 2>&1 || true

cp "$TEMPLATE_DB" "$DB"
sqlite3 "$DB" "ALTER TABLE \"User\" ADD COLUMN \"permissions\" TEXT DEFAULT '';" 2>/dev/null || true

TODAY="$(date +%Y-%m-%d)"
TOMORROW="$(date -d "+1 day" +%Y-%m-%d)"
DAY_AFTER="$(date -d "+2 days" +%Y-%m-%d)"
NOW_TS="$(date '+%Y-%m-%d %H:%M:%S')"
NOW_ISO="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

OPEN_95="$(date -u -d '-95 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
OPEN_80="$(date -u -d '-80 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
OPEN_75="$(date -u -d '-75 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
OPEN_45="$(date -u -d '-45 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
OPEN_40="$(date -u -d '-40 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
OPEN_35="$(date -u -d '-35 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
OPEN_25="$(date -u -d '-25 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
OPEN_20="$(date -u -d '-20 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
OPEN_10="$(date -u -d '-10 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
OPEN_6="$(date -u -d '-6 minutes' '+%Y-%m-%dT%H:%M:%SZ')"
OPEN_5="$(date -u -d '-5 minutes' '+%Y-%m-%dT%H:%M:%SZ')"

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

sqlite3 "$DB" <<SQL
PRAGMA foreign_keys = ON;
BEGIN;

DELETE FROM "NotificationLog";
DELETE FROM "PreOrderItem";
DELETE FROM "PreOrder";
DELETE FROM "WaitlistEntry";
DELETE FROM "EventTicket";
DELETE FROM "ReservationPayment";
DELETE FROM "Reservation";
DELETE FROM "Setting" WHERE key LIKE 'pos_status_%' OR key IN ('spotonLastSync', 'spotonLastOpenChecks', 'spotonLastMenuSync');

INSERT INTO "Event" ("name","description","date","startTime","endTime","ticketPrice","maxTickets","soldTickets","isActive","imageUrl","slug","createdAt","updatedAt")
VALUES
  ('Wine and Cheese Pairing Night','An intimate tasting with curated regional wines and seasonal pairings.','$TOMORROW','19:00','21:00',7500,30,0,1,NULL,'wine-and-cheese-pairing-night',datetime('now'),datetime('now'))
ON CONFLICT("slug") DO UPDATE SET
  "name"=excluded."name",
  "description"=excluded."description",
  "date"=excluded."date",
  "startTime"=excluded."startTime",
  "endTime"=excluded."endTime",
  "ticketPrice"=excluded."ticketPrice",
  "maxTickets"=excluded."maxTickets",
  "soldTickets"=0,
  "isActive"=1,
  "updatedAt"=datetime('now');

INSERT INTO "Event" ("name","description","date","startTime","endTime","ticketPrice","maxTickets","soldTickets","isActive","imageUrl","slug","createdAt","updatedAt")
VALUES
  ('Live Jazz Brunch','Sunday brunch service with live trio set and prix-fixe menu.','$TOMORROW','11:00','13:00',4500,50,0,1,NULL,'live-jazz-brunch',datetime('now'),datetime('now'))
ON CONFLICT("slug") DO UPDATE SET
  "name"=excluded."name",
  "description"=excluded."description",
  "date"=excluded."date",
  "startTime"=excluded."startTime",
  "endTime"=excluded."endTime",
  "ticketPrice"=excluded."ticketPrice",
  "maxTickets"=excluded."maxTickets",
  "soldTickets"=0,
  "isActive"=1,
  "updatedAt"=datetime('now');

INSERT OR REPLACE INTO "Setting" ("key", "value") VALUES
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
  ('smartPacingAlerts','true'),
  ('setupWizardCompleted','true'),
  ('setupWizardCompletedAt','$NOW_ISO'),
  ('setupWizardStep','5'),
  ('demoDate','$TODAY');

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt","arrivedAt","seatedAt")
VALUES
  ('DEMO-F01','Sarah Mitchell','555-0101','sarah@example.com',1,2,'$TODAY','17:30','19:00',90,'Window preferred','widget','seated',1,datetime('now','-8 hours'),datetime('now'),datetime('now','-100 minutes'),datetime('now','-95 minutes')),
  ('DEMO-F02','James Rodriguez','555-0102','james@example.com',2,2,'$TODAY','17:45','19:15',90,'Booth preferred','widget','seated',2,datetime('now','-8 hours'),datetime('now'),datetime('now','-85 minutes'),datetime('now','-80 minutes')),
  ('DEMO-F03','Emily Chen','555-0103','emily@example.com',3,6,'$TODAY','18:30','20:00',90,'First visit celebration','widget','seated',3,datetime('now','-6 hours'),datetime('now'),datetime('now','-50 minutes'),datetime('now','-45 minutes')),
  ('DEMO-F04','Michael Brown','555-0104','michael@example.com',4,2,'$TODAY','18:45','20:15',90,'Quiet corner','widget','seated',4,datetime('now','-6 hours'),datetime('now'),datetime('now','-45 minutes'),datetime('now','-40 minutes')),
  ('DEMO-F05','Lisa Wang','555-0105','lisa@example.com',5,4,'$TODAY','18:50','20:20',90,'Shellfish allergy noted','widget','seated',5,datetime('now','-6 hours'),datetime('now'),datetime('now','-40 minutes'),datetime('now','-35 minutes')),
  ('DEMO-F06','David Thompson','555-0106','david@example.com',6,2,'$TODAY','19:00','20:30',90,'Near host stand','widget','seated',6,datetime('now','-5 hours'),datetime('now'),datetime('now','-30 minutes'),datetime('now','-25 minutes')),
  ('DEMO-F07','Anna Kowalski','555-0107','anna@example.com',7,4,'$TODAY','19:05','20:35',90,'Birthday dessert request','widget','seated',8,datetime('now','-5 hours'),datetime('now'),datetime('now','-25 minutes'),datetime('now','-20 minutes')),
  ('DEMO-F08','Robert Kim','555-0108','robert@example.com',8,4,'$TODAY','19:15','20:45',90,'Nut allergy','widget','seated',9,datetime('now','-5 hours'),datetime('now'),datetime('now','-15 minutes'),datetime('now','-10 minutes')),
  ('DEMO-F09','Jessica Davis','555-0109','jessica@example.com',9,3,'$TODAY','19:25','20:55',90,'VIP guest','widget','arrived',10,datetime('now','-4 hours'),datetime('now'),datetime('now','-6 minutes'),NULL),
  ('DEMO-F10','Thomas Mueller','555-0110','thomas@example.com',10,2,'$TODAY',strftime('%H:%M','now','localtime','+20 minutes'),strftime('%H:%M','now','localtime','+110 minutes'),90,'Date night','widget','confirmed',12,datetime('now','-3 hours'),datetime('now'),NULL,NULL),
  ('DEMO-F11','Sofia Alvarez','555-0111','sofia@example.com',NULL,2,'$TODAY',strftime('%H:%M','now','localtime','+50 minutes'),strftime('%H:%M','now','localtime','+140 minutes'),90,'Booth if possible','widget','confirmed',15,datetime('now','-2 hours'),datetime('now'),NULL,NULL),
  ('DEMO-F12','Ethan Brooks','555-0112','ethan@example.com',NULL,2,'$TODAY','19:20','20:35',75,'Walk-in table','walkin','seated',14,datetime('now','-2 hours'),datetime('now'),datetime('now','-8 minutes'),datetime('now','-5 minutes')),
  ('DEMO-F13','Corporate Dinner','555-0113','events@example.com',NULL,10,'$TODAY','17:45','19:45',120,'Corporate tasting menu','staff','seated',16,datetime('now','-9 hours'),datetime('now'),datetime('now','-80 minutes'),datetime('now','-75 minutes'));

INSERT INTO "Reservation"
("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","specialRequests","source","status","tableId","createdAt","updatedAt")
VALUES
  ('DEMO-P01','Nicole Patel','555-4001','nicole.patel@example.com',NULL,4,'$TOMORROW','19:00','20:30',90,'Business dinner, need projector access','widget','pending',NULL,datetime('now','-2 hours'),datetime('now','-2 hours')),
  ('DEMO-P02','Chris Johnson','555-4002','chris.johnson@example.com',NULL,6,'$TOMORROW','19:30','21:00',90,'Birthday celebration - can we get a cake?','widget','pending',NULL,datetime('now','-2 hours'),datetime('now','-2 hours')),
  ('DEMO-P03','Maria Garcia','555-4003','maria.garcia@example.com',NULL,2,'$DAY_AFTER','20:00','21:30',90,'Anniversary dinner, window table please','widget','pending',NULL,datetime('now','-2 hours'),datetime('now','-2 hours')),
  ('DEMO-P04','Daniel Lee','555-4004','daniel.lee@example.com',NULL,3,'$TOMORROW','20:00','21:30',90,'First time visiting, any recommendations?','widget','pending',NULL,datetime('now','-2 hours'),datetime('now','-2 hours')),
  ('DEMO-P05','Amanda Torres','555-4005','amanda.torres@example.com',NULL,8,'$DAY_AFTER','18:30','20:00',90,'Large group, 2 vegetarians, 1 gluten free','phone','pending',NULL,datetime('now','-2 hours'),datetime('now','-2 hours')),
  ('DEMO-T01','Anna Kowalski','555-0107','anna@example.com',7,2,'$TOMORROW','18:30','20:00',90,'Follow-up visit','widget','confirmed',NULL,datetime('now','-2 hours'),datetime('now','-2 hours')),
  ('DEMO-T02','Thomas Mueller','555-0110','thomas@example.com',10,4,'$TOMORROW','19:00','20:30',90,'Client dinner','widget','confirmed',NULL,datetime('now','-2 hours'),datetime('now','-2 hours')),
  ('DEMO-T03','Jessica Davis','555-0109','jessica@example.com',9,2,'$TOMORROW','20:00','21:30',90,'Post-show booking','widget','confirmed',NULL,datetime('now','-2 hours'),datetime('now','-2 hours'));

INSERT INTO "WaitlistEntry"
("guestName","guestPhone","guestEmail","partySize","estimatedWait","status","position","quotedAt","notifiedAt","notes","guestId","createdAt","updatedAt")
VALUES
  ('Nora Patel','555-5001','nora.patel@example.com',2,15,'waiting',1,datetime('now','-16 minutes'),NULL,'Prefers patio',NULL,datetime('now','-16 minutes'),datetime('now')),
  ('Liam Brooks','555-5002','liam.brooks@example.com',4,25,'waiting',2,datetime('now','-14 minutes'),NULL,'Birthday dessert request',NULL,datetime('now','-14 minutes'),datetime('now')),
  ('Zoe Martinez','555-5003','zoe.martinez@example.com',2,35,'notified',3,datetime('now','-12 minutes'),datetime('now','-2 minutes'),'Waiting at bar',NULL,datetime('now','-12 minutes'),datetime('now')),
  ('Farah Khan','555-5004','farah.khan@example.com',5,45,'waiting',4,datetime('now','-10 minutes'),NULL,'Shellfish allergy',NULL,datetime('now','-10 minutes'),datetime('now')),
  ('Noah Wilson','555-5005','noah.wilson@example.com',3,55,'waiting',5,datetime('now','-8 minutes'),NULL,'Needs stroller space',NULL,datetime('now','-8 minutes'),datetime('now'));

INSERT INTO "PreOrder" ("reservationId","status","specialNotes","subtotal","isPaid","createdAt","updatedAt")
SELECT id,'submitted','Kitchen pacing requested',0,false,datetime('now','-40 minutes'),datetime('now') FROM "Reservation" WHERE code='DEMO-F04';

INSERT INTO "PreOrder" ("reservationId","status","specialNotes","subtotal","isPaid","createdAt","updatedAt")
SELECT id,'submitted','Send starters first',0,false,datetime('now','-28 minutes'),datetime('now') FROM "Reservation" WHERE code='DEMO-F07';

INSERT INTO "PreOrder" ("reservationId","status","specialNotes","subtotal","isPaid","createdAt","updatedAt")
SELECT id,'submitted','Preordered beverages and first course',0,false,datetime('now','-12 minutes'),datetime('now') FROM "Reservation" WHERE code='DEMO-F10';

INSERT OR REPLACE INTO "Setting" ("key","value") VALUES
  ('pos_status_1','{"orderId":"SPOT-7201","checkTotal":"118.40","balanceDue":"24.00","serverName":"Maya","openedAt":"$OPEN_95","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_2','{"orderId":"SPOT-7202","checkTotal":"156.80","balanceDue":"31.20","serverName":"Eli","openedAt":"$OPEN_80","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_3','{"orderId":"SPOT-7203","checkTotal":"243.60","balanceDue":"48.60","serverName":"Nora","openedAt":"$OPEN_45","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_4','{"orderId":"SPOT-7204","checkTotal":"84.50","balanceDue":"21.10","serverName":"Leo","openedAt":"$OPEN_40","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_5','{"orderId":"SPOT-7205","checkTotal":"72.50","balanceDue":"18.25","serverName":"Ivy","openedAt":"$OPEN_35","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_6','{"orderId":"SPOT-7206","checkTotal":"62.75","balanceDue":"15.50","serverName":"Sam","openedAt":"$OPEN_25","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_7','{"orderId":"SPOT-7207","checkTotal":"45.00","balanceDue":"45.00","serverName":"Ari","openedAt":"$OPEN_35","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_8','{"orderId":"SPOT-7208","checkTotal":"38.90","balanceDue":"10.40","serverName":"Jules","openedAt":"$OPEN_20","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_9','{"orderId":"SPOT-7209","checkTotal":"24.50","balanceDue":"6.00","serverName":"Rey","openedAt":"$OPEN_10","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_13','{"orderId":"SPOT-7213","checkTotal":"22.50","balanceDue":"22.50","serverName":"Kai","openedAt":"$OPEN_20","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_14','{"orderId":"SPOT-7214","checkTotal":"16.00","balanceDue":"8.00","serverName":"Mina","openedAt":"$OPEN_5","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('pos_status_16','{"orderId":"SPOT-7216","checkTotal":"487.60","balanceDue":"115.40","serverName":"Drew","openedAt":"$OPEN_75","closedAt":null,"isOpen":true,"syncedAt":"$NOW_ISO"}'),
  ('spotonLastSync','$NOW_ISO'),
  ('spotonLastOpenChecks','12'),
  ('spotonLastMenuSync','$NOW_ISO');

COMMIT;
SQL

add_preorder_item() {
  local reservation_code="$1"
  local menu_name="$2"
  local quantity="$3"
  local special_instructions="$4"
  local guest_label="$5"
  local created_offset="$6"

  local menu_name_sql
  local instructions_sql
  local guest_label_sql
  menu_name_sql="$(sql_escape "$menu_name")"
  instructions_sql="$(sql_escape "$special_instructions")"
  guest_label_sql="$(sql_escape "$guest_label")"

  sqlite3 "$DB" "
    INSERT INTO \"PreOrderItem\" (\"preOrderId\",\"menuItemId\",\"guestLabel\",\"quantity\",\"specialInstructions\",\"price\",\"createdAt\")
    SELECT po.id,
           COALESCE((SELECT id FROM \"MenuItem\" WHERE name='${menu_name_sql}' LIMIT 1),(SELECT id FROM \"MenuItem\" ORDER BY id LIMIT 1)),
           '${guest_label_sql}',
           ${quantity},
           '${instructions_sql}',
           COALESCE((SELECT price FROM \"MenuItem\" WHERE name='${menu_name_sql}' LIMIT 1),(SELECT price FROM \"MenuItem\" ORDER BY id LIMIT 1),0),
           datetime('now','${created_offset}')
    FROM \"PreOrder\" po
    JOIN \"Reservation\" r ON r.id = po.reservationId
    WHERE r.code='${reservation_code}';"
}

add_preorder_item "DEMO-F04" "Crispy Calamari" 1 "Share plate" "Crispy Calamari" "-39 minutes"
add_preorder_item "DEMO-F04" "Garden Bistro Salad" 1 "Dressing on side" "Garden Bistro Salad" "-38 minutes"
add_preorder_item "DEMO-F04" "Grilled NY Strip" 1 "Medium rare" "Grilled NY Strip" "-37 minutes"
add_preorder_item "DEMO-F04" "Pan-Seared Salmon" 1 "No dill" "Pan-Seared Salmon" "-36 minutes"

add_preorder_item "DEMO-F07" "Bruschetta Trio" 2 "Extra basil" "Bruschetta Trio" "-27 minutes"
add_preorder_item "DEMO-F07" "Tuna Tartare" 1 "No onions" "Tuna Tartare" "-26 minutes"
add_preorder_item "DEMO-F07" "Mushroom Risotto" 1 "Extra truffle" "Mushroom Risotto" "-25 minutes"
add_preorder_item "DEMO-F07" "Herb-Crusted Lamb" 1 "Well done" "Herb-Crusted Lamb" "-24 minutes"
add_preorder_item "DEMO-F07" "Truffle Fries" 1 "For table" "Truffle Fries" "-23 minutes"
add_preorder_item "DEMO-F07" "Garden Spritz" 1 "No ice" "Garden Spritz" "-22 minutes"

add_preorder_item "DEMO-F10" "Garden Spritz" 1 "No ice" "Garden Spritz" "-11 minutes"
add_preorder_item "DEMO-F10" "Smoky Old Fashioned" 1 "Orange peel garnish" "Smoky Old Fashioned" "-10 minutes"
add_preorder_item "DEMO-F10" "Beet and Goat Cheese" 1 "Share plate" "Beet and Goat Cheese" "-9 minutes"
add_preorder_item "DEMO-F10" "Lobster Ravioli" 1 "Extra sauce" "Lobster Ravioli" "-8 minutes"

sqlite3 "$DB" <<SQL
BEGIN;
UPDATE "PreOrder"
SET "subtotal" = COALESCE((SELECT SUM(price * quantity) FROM "PreOrderItem" poi WHERE poi.preOrderId = "PreOrder".id),0),
    "updatedAt" = datetime('now')
WHERE reservationId IN (SELECT id FROM "Reservation" WHERE code IN ('DEMO-F04','DEMO-F07','DEMO-F10'));
COMMIT;
SQL

sqlite3 "$DB" <<SQL
BEGIN;
INSERT INTO "EventTicket" ("eventId","guestName","guestEmail","guestPhone","quantity","totalPaid","status","code","createdAt","updatedAt")
SELECT e.id,'Rachel Green','rachel.g@email.com','(555) 301-0001',2,e.ticketPrice * 2,'confirmed','DEMO-WC-001',datetime('now','-2 days'),datetime('now','-2 days')
FROM "Event" e WHERE e.slug='wine-and-cheese-pairing-night' LIMIT 1;
INSERT INTO "EventTicket" ("eventId","guestName","guestEmail","guestPhone","quantity","totalPaid","status","code","createdAt","updatedAt")
SELECT e.id,'Monica Geller','monica.g@email.com','(555) 301-0002',2,e.ticketPrice * 2,'confirmed','DEMO-WC-002',datetime('now','-2 days'),datetime('now','-2 days')
FROM "Event" e WHERE e.slug='wine-and-cheese-pairing-night' LIMIT 1;
INSERT INTO "EventTicket" ("eventId","guestName","guestEmail","guestPhone","quantity","totalPaid","status","code","createdAt","updatedAt")
SELECT e.id,'Ross Geller','ross.g@email.com','(555) 301-0003',2,e.ticketPrice * 2,'confirmed','DEMO-WC-003',datetime('now','-2 days'),datetime('now','-2 days')
FROM "Event" e WHERE e.slug='wine-and-cheese-pairing-night' LIMIT 1;
INSERT INTO "EventTicket" ("eventId","guestName","guestEmail","guestPhone","quantity","totalPaid","status","code","createdAt","updatedAt")
SELECT e.id,'Chandler Bing','chandler.b@email.com','(555) 301-0004',2,e.ticketPrice * 2,'confirmed','DEMO-WC-004',datetime('now','-2 days'),datetime('now','-2 days')
FROM "Event" e WHERE e.slug='wine-and-cheese-pairing-night' LIMIT 1;
INSERT INTO "EventTicket" ("eventId","guestName","guestEmail","guestPhone","quantity","totalPaid","status","code","createdAt","updatedAt")
SELECT e.id,'Joey Tribbiani','joey.t@email.com','(555) 301-0005',2,e.ticketPrice * 2,'confirmed','DEMO-WC-005',datetime('now','-2 days'),datetime('now','-2 days')
FROM "Event" e WHERE e.slug='wine-and-cheese-pairing-night' LIMIT 1;
INSERT INTO "EventTicket" ("eventId","guestName","guestEmail","guestPhone","quantity","totalPaid","status","code","createdAt","updatedAt")
SELECT e.id,'Phoebe Buffay','phoebe.b@email.com','(555) 301-0006',2,e.ticketPrice * 2,'confirmed','DEMO-WC-006',datetime('now','-2 days'),datetime('now','-2 days')
FROM "Event" e WHERE e.slug='wine-and-cheese-pairing-night' LIMIT 1;

INSERT INTO "EventTicket" ("eventId","guestName","guestEmail","guestPhone","quantity","totalPaid","status","code","createdAt","updatedAt")
SELECT e.id,'Jim Halpert','jim.h@email.com','(555) 302-0001',2,e.ticketPrice * 2,'confirmed','DEMO-JB-001',datetime('now','-1 day'),datetime('now','-1 day')
FROM "Event" e WHERE e.slug='live-jazz-brunch' LIMIT 1;
INSERT INTO "EventTicket" ("eventId","guestName","guestEmail","guestPhone","quantity","totalPaid","status","code","createdAt","updatedAt")
SELECT e.id,'Pam Beesly','pam.b@email.com','(555) 302-0002',2,e.ticketPrice * 2,'confirmed','DEMO-JB-002',datetime('now','-1 day'),datetime('now','-1 day')
FROM "Event" e WHERE e.slug='live-jazz-brunch' LIMIT 1;
INSERT INTO "EventTicket" ("eventId","guestName","guestEmail","guestPhone","quantity","totalPaid","status","code","createdAt","updatedAt")
SELECT e.id,'Dwight Schrute','dwight.s@email.com','(555) 302-0003',2,e.ticketPrice * 2,'confirmed','DEMO-JB-003',datetime('now','-1 day'),datetime('now','-1 day')
FROM "Event" e WHERE e.slug='live-jazz-brunch' LIMIT 1;
INSERT INTO "EventTicket" ("eventId","guestName","guestEmail","guestPhone","quantity","totalPaid","status","code","createdAt","updatedAt")
SELECT e.id,'Michael Scott','michael.s@email.com','(555) 302-0004',2,e.ticketPrice * 2,'confirmed','DEMO-JB-004',datetime('now','-1 day'),datetime('now','-1 day')
FROM "Event" e WHERE e.slug='live-jazz-brunch' LIMIT 1;

UPDATE "Event"
SET soldTickets = (
  SELECT COALESCE(SUM(quantity), 0)
  FROM "EventTicket"
  WHERE "EventTicket".eventId = "Event".id
    AND "EventTicket".status IN ('confirmed','checked_in')
),
updatedAt = datetime('now')
WHERE slug IN ('wine-and-cheese-pairing-night','live-jazz-brunch');
COMMIT;
SQL

TABLE_IDS=(1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16)
NAMES=(
  "Alex Johnson" "Sam Williams" "Jordan Brown" "Casey Davis" "Morgan Wilson"
  "Taylor Anderson" "Riley Thomas" "Jamie Jackson" "Quinn White" "Drew Harris"
  "Cameron Martin" "Avery Thompson" "Blake Garcia" "Dakota Martinez" "Emerson Robinson"
  "Finley Clark" "Harley Lewis" "Kendall Lee" "Logan Walker" "Parker Hall"
)
GUEST_POOL=(
  "Sarah Mitchell" "James Rodriguez" "Emily Chen" "Michael Brown" "Lisa Wang"
  "David Thompson" "Anna Kowalski" "Robert Kim" "Jessica Davis" "Thomas Mueller"
)

sqlite3 "$DB" "BEGIN;"
for i in $(seq 1 90); do
  HIST_DATE="$(date -d "-$i days" +%Y-%m-%d)"
  DOW="$(date -d "-$i days" +%u)"

  case "$DOW" in
    1|2|3|4) COUNT=$(( (RANDOM % 5) + 8 )) ;;
    5|6) COUNT=$(( (RANDOM % 6) + 15 )) ;;
    7) COUNT=$(( (RANDOM % 5) + 10 )) ;;
  esac

  for j in $(seq 1 "$COUNT"); do
    HOUR=$(( (RANDOM % 5) + 17 ))
    MIN=$(( (RANDOM % 4) * 15 ))
    TIME=$(printf "%02d:%02d" "$HOUR" "$MIN")

    PS_RAND=$(( RANDOM % 10 ))
    if [ "$PS_RAND" -lt 3 ]; then
      PSIZE=2
    elif [ "$PS_RAND" -lt 6 ]; then
      PSIZE=4
    elif [ "$PS_RAND" -lt 8 ]; then
      PSIZE=3
    elif [ "$PS_RAND" -lt 9 ]; then
      PSIZE=6
    else
      PSIZE=1
    fi

    S_RAND=$(( RANDOM % 20 ))
    if [ "$S_RAND" -lt 16 ]; then
      STATUS="completed"
    elif [ "$S_RAND" -lt 18 ]; then
      STATUS="no_show"
    elif [ "$S_RAND" -lt 19 ]; then
      STATUS="cancelled"
    else
      STATUS="confirmed"
    fi

    SRC_RAND=$(( RANDOM % 10 ))
    if [ "$SRC_RAND" -lt 5 ]; then
      SOURCE="widget"
    elif [ "$SRC_RAND" -lt 8 ]; then
      SOURCE="phone"
    else
      SOURCE="walkin"
    fi

    DURATION=$(( (RANDOM % 4 + 5) * 15 ))
    END_TOTAL=$(( HOUR * 60 + MIN + DURATION ))
    END_HOUR=$(( END_TOTAL / 60 ))
    END_MIN=$(( END_TOTAL % 60 ))
    if [ "$END_HOUR" -gt 23 ]; then
      END_HOUR=23
      END_MIN=59
    fi
    ENDTIME=$(printf "%02d:%02d" "$END_HOUR" "$END_MIN")

    TABLE_INDEX=$(( RANDOM % ${#TABLE_IDS[@]} ))
    TABLE_ID=${TABLE_IDS[$TABLE_INDEX]}

    NAME_INDEX=$(( RANDOM % ${#NAMES[@]} ))
    NAME="${NAMES[$NAME_INDEX]}"
    PHONE="555$(printf "%07d" $((RANDOM % 10000000)))"
    EMAIL_LOCAL=$(printf "%s" "$NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '.')
    EMAIL="${EMAIL_LOCAL}@email.com"
    GUEST_ID_SQL="NULL"

    if [ $(( RANDOM % 100 )) -lt 45 ]; then
      GUEST_ID=$(( (RANDOM % 10) + 1 ))
      GUEST_NAME="${GUEST_POOL[$((GUEST_ID - 1))]}"
      NAME="$GUEST_NAME"
      PHONE="555$(printf "%07d" $((1000000 + GUEST_ID * 713)))"
      EMAIL_LOCAL=$(printf "%s" "$NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '.')
      EMAIL="${EMAIL_LOCAL}@example.com"
      GUEST_ID_SQL="$GUEST_ID"
    fi

    CODE="HIST-${i}-${j}"
    NAME_SQL="$(sql_escape "$NAME")"
    PHONE_SQL="$(sql_escape "$PHONE")"
    EMAIL_SQL="$(sql_escape "$EMAIL")"

    if [ "$STATUS" = "completed" ]; then
      WAIT_MIN=$(( (RANDOM % 10) + 1 ))
      TABLE_MIN=$(( (RANDOM % 40) + 60 ))
      sqlite3 "$DB" "
        INSERT INTO \"Reservation\"
        (\"code\",\"guestName\",\"guestPhone\",\"guestEmail\",\"guestId\",\"partySize\",\"date\",\"time\",\"endTime\",\"durationMin\",\"source\",\"status\",\"tableId\",\"arrivedAt\",\"seatedAt\",\"completedAt\",\"createdAt\",\"updatedAt\")
        VALUES
        ('${CODE}','${NAME_SQL}','${PHONE_SQL}','${EMAIL_SQL}',${GUEST_ID_SQL},${PSIZE},'${HIST_DATE}','${TIME}','${ENDTIME}',${DURATION},'${SOURCE}','${STATUS}',${TABLE_ID},datetime('${HIST_DATE} ${TIME}','-${WAIT_MIN} minutes'),datetime('${HIST_DATE} ${TIME}'),datetime('${HIST_DATE} ${TIME}','+${TABLE_MIN} minutes'),datetime('${HIST_DATE} ${TIME}','-1 hour'),datetime('${HIST_DATE} ${TIME}','+${TABLE_MIN} minutes'));"
    else
      sqlite3 "$DB" "
        INSERT INTO \"Reservation\"
        (\"code\",\"guestName\",\"guestPhone\",\"guestEmail\",\"guestId\",\"partySize\",\"date\",\"time\",\"endTime\",\"durationMin\",\"source\",\"status\",\"tableId\",\"createdAt\",\"updatedAt\")
        VALUES
        ('${CODE}','${NAME_SQL}','${PHONE_SQL}','${EMAIL_SQL}',${GUEST_ID_SQL},${PSIZE},'${HIST_DATE}','${TIME}','${ENDTIME}',${DURATION},'${SOURCE}','${STATUS}',${TABLE_ID},datetime('${HIST_DATE} ${TIME}','-1 hour'),datetime('${HIST_DATE} ${TIME}'));"
    fi
  done
done
sqlite3 "$DB" "COMMIT;"

sqlite3 "$DB" <<SQL
BEGIN;
INSERT INTO "Reservation" ("code","guestName","guestPhone","guestEmail","guestId","partySize","date","time","endTime","durationMin","source","status","tableId","createdAt","updatedAt")
VALUES
  ('HIST-RISK-MB-1','Michael Brown','555-0104','michael@example.com',4,3,date('now','-40 days'),'19:00','20:30',90,'widget','no_show',4,datetime('now','-41 days'),datetime('now','-40 days')),
  ('HIST-RISK-MB-2','Michael Brown','555-0104','michael@example.com',4,2,date('now','-25 days'),'19:30','21:00',90,'widget','no_show',4,datetime('now','-26 days'),datetime('now','-25 days')),
  ('HIST-RISK-MB-3','Michael Brown','555-0104','michael@example.com',4,3,date('now','-15 days'),'20:00','21:30',90,'widget','completed',4,datetime('now','-16 days'),datetime('now','-15 days')),
  ('HIST-RISK-DT-1','David Thompson','555-0106','david@example.com',6,4,date('now','-65 days'),'18:30','20:00',90,'phone','no_show',6,datetime('now','-66 days'),datetime('now','-65 days'));

UPDATE "Reservation"
SET arrivedAt = datetime(date || ' ' || time, '-6 minutes'),
    seatedAt = datetime(date || ' ' || time),
    completedAt = datetime(date || ' ' || time, '+95 minutes')
WHERE code = 'HIST-RISK-MB-3';
COMMIT;
SQL

sqlite3 "$DB" "BEGIN;"
for i in $(seq 1 30); do
  WL_DATE="$(date -d "-$i days" +%Y-%m-%d)"
  WL_TIME=$(printf "%02d:%02d:00" $((17 + RANDOM % 4)) $(( (RANDOM % 4) * 15 )))
  EST_WAIT=$(( (RANDOM % 36) + 10 ))
  POSITION=$((800 + i))

  if [ "$i" -le 4 ]; then
    WL_STATUS="seated"
  elif [ $(( i % 2 )) -eq 0 ]; then
    WL_STATUS="left"
  else
    WL_STATUS="cancelled"
  fi

  if [ "$WL_STATUS" = "seated" ]; then
    SEATED_SQL="datetime('${WL_DATE} ${WL_TIME}','+${EST_WAIT} minutes')"
  else
    SEATED_SQL="NULL"
  fi

  sqlite3 "$DB" "
    INSERT INTO \"WaitlistEntry\"
    (\"guestName\",\"guestPhone\",\"guestEmail\",\"partySize\",\"estimatedWait\",\"status\",\"position\",\"quotedAt\",\"seatedAt\",\"notes\",\"guestId\",\"createdAt\",\"updatedAt\")
    VALUES
    ('History Guest ${i}','555$(printf '%07d' $((6000000 + i)))','history${i}@example.com',$(( (RANDOM % 5) + 2 )),${EST_WAIT},'${WL_STATUS}',${POSITION},datetime('${WL_DATE} ${WL_TIME}'),${SEATED_SQL},'Historical waitlist sample',NULL,datetime('${WL_DATE} ${WL_TIME}'),datetime('${WL_DATE} ${WL_TIME}','+2 hours'));"
done
sqlite3 "$DB" "COMMIT;"

sqlite3 "$DB" <<SQL
BEGIN;
INSERT INTO "ReservationPayment" ("reservationId","type","amount","currency","status","capturedAt","createdAt","updatedAt")
SELECT id,'deposit',2500,'usd','captured',datetime('now','-12 days'),datetime('now','-12 days'),datetime('now','-12 days')
FROM "Reservation"
WHERE code LIKE 'HIST-%' AND status = 'completed'
ORDER BY date DESC, time DESC
LIMIT 1 OFFSET 0;

INSERT INTO "ReservationPayment" ("reservationId","type","amount","currency","status","capturedAt","createdAt","updatedAt")
SELECT id,'deposit',1800,'usd','captured',datetime('now','-20 days'),datetime('now','-20 days'),datetime('now','-20 days')
FROM "Reservation"
WHERE code LIKE 'HIST-%' AND status = 'completed'
ORDER BY date DESC, time DESC
LIMIT 1 OFFSET 1;

INSERT INTO "ReservationPayment" ("reservationId","type","amount","currency","status","capturedAt","createdAt","updatedAt")
SELECT id,'deposit',3200,'usd','captured',datetime('now','-28 days'),datetime('now','-28 days'),datetime('now','-28 days')
FROM "Reservation"
WHERE code LIKE 'HIST-%' AND status = 'completed'
ORDER BY date DESC, time DESC
LIMIT 1 OFFSET 2;

UPDATE "Guest"
SET
  totalVisits = COALESCE((SELECT COUNT(*) FROM "Reservation" r WHERE r.guestId = "Guest".id AND r.status = 'completed'), 0),
  totalNoShows = COALESCE((SELECT COUNT(*) FROM "Reservation" r WHERE r.guestId = "Guest".id AND r.status = 'no_show'), 0),
  totalCovers = COALESCE((SELECT SUM(r.partySize) FROM "Reservation" r WHERE r.guestId = "Guest".id AND r.status IN ('seated','completed')), 0),
  firstVisitDate = COALESCE((SELECT MIN(r.date) FROM "Reservation" r WHERE r.guestId = "Guest".id AND r.status = 'completed'), firstVisitDate),
  lastVisitDate = COALESCE((SELECT MAX(r.date) FROM "Reservation" r WHERE r.guestId = "Guest".id AND r.status = 'completed'), lastVisitDate),
  vipStatus = CASE
    WHEN id IN (1, 9) THEN 'vip'
    WHEN COALESCE((SELECT COUNT(*) FROM "Reservation" r WHERE r.guestId = "Guest".id AND r.status = 'completed'), 0) >= 10 THEN 'vip'
    ELSE 'regular'
  END,
  updatedAt = datetime('now');

UPDATE "Guest" SET allergyNotes = COALESCE(NULLIF(allergyNotes,''), 'Shellfish allergy') WHERE id = 5;
UPDATE "Guest" SET allergyNotes = COALESCE(NULLIF(allergyNotes,''), 'Tree nut allergy') WHERE id = 8;

UPDATE "Event"
SET soldTickets = (
  SELECT COALESCE(SUM(quantity), 0)
  FROM "EventTicket"
  WHERE "EventTicket".eventId = "Event".id
    AND "EventTicket".status IN ('confirmed','checked_in')
),
updatedAt = datetime('now')
WHERE slug IN ('wine-and-cheese-pairing-night','live-jazz-brunch');

COMMIT;
SQL

pm2 restart "$DEMO_PROCESS_NAME" --update-env >/dev/null

echo "Demo reset complete: $DB"
