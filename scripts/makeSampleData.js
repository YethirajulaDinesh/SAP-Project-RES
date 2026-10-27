// Writes demo data for every table. Usage: node scripts/makeSampleData.js
//   configuration (Settings, DamageCatalogue)  -> db/data   (deployed everywhere)
//   demo data (customers, rentals, ...)         -> test/data (development and tests only)
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const CONFIG = path.join(root, 'db/data'), DEMO = path.join(root, 'test/data');
[CONFIG, DEMO].forEach(d => fs.mkdirSync(d, { recursive: true }));

const id = (p, n) => `${p}-0000-0000-0000-${String(n).padStart(12, '0')}`;
const L = n => id('10000000', n), C = n => id('20000000', n), E = n => id('30000000', n), R = n => id('40000000', n);
const RI = n => id('41000000', n), RH = n => id('42000000', n), M = n => id('50000000', n), CL = n => id('60000000', n);
const D = n => id('61000000', n), P = n => id('62000000', n), B = n => id('70000000', n), BH = n => id('71000000', n);
const T = n => id('80000000', n), O = n => id('90000000', n), A = n => id('a0000000', n), CAT = n => id('c0000000', n);

const MANAGER = 'manager@rental.com', DISPATCH = 'dispatch@rental.com', YARD = 'yard@rental.com', TECH = 'tech@rental.com', BILLING = 'billing@rental.com';
const round2 = n => Math.round(n * 100) / 100;
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;

function writeCsv(dir, name, rows) {
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n';
  fs.writeFileSync(path.join(dir, `ret-${name}.csv`), csv);
}

// ---------- tiny PNG generator for demo damage photos ----------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function photo([r, g, b], seed) {         // 240x160 steel-grey surface with a coloured damage mark
  const w = 240, h = 160, raw = Buffer.alloc((w * 3 + 1) * h);
  const cx = 60 + (seed * 37) % 120, cy = 40 + (seed * 23) % 80;
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const base = 120 + Math.round(40 * Math.sin((x + seed * 13) / 17) * Math.cos(y / 23));
      const d = Math.hypot(x - cx, (y - cy) * 1.4);
      const mark = d < 26 + 6 * Math.sin(x / 3 + y / 5);
      raw[o] = mark ? r : base; raw[o + 1] = mark ? g : base + 4; raw[o + 2] = mark ? b : base + 10;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = ihdr[11] = ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ========== CONFIGURATION ==========
const settings = [
  { code: 'TAX_RATE_PCT', value: '18', description: 'GST rate applied to repair charges (%)' },
  { code: 'AUTO_APPROVAL_LIMIT', value: '5000', description: 'Charges up to this total (INR) are approved automatically' },
  { code: 'CURRENCY', value: 'INR', description: 'Currency of all amounts' },
  { code: 'MIN_DAMAGE_PHOTOS', value: '1', description: 'Photos needed before a damage can be confirmed' },
  { code: 'MAX_PHOTO_MB', value: '10', description: 'Largest photo that can be uploaded (MB)' }
];
const BASE = {
  'Scratch': 1500, 'Dent': 4000, 'Crack': 6000, 'Broken Part': 7000, 'Missing Part': 5000, 'Hydraulic Leak': 15000,
  'Oil Leak': 9000, 'Electrical Fault': 8000, 'Tyre Damage': 6500, 'Track Damage': 20000, 'Engine Fault': 30000, 'Glass Damage': 3500
};
const FACTOR = { Minor: 1, Moderate: 2, Major: 4, Critical: 8 };
let catN = 0;
const catalogue = Object.entries(BASE).flatMap(([damageType, base]) => Object.entries(FACTOR).map(([severity, f]) => ({
  ID: CAT(++catN), damageType, severity, standardCost: base * f,
  description: `${severity} ${damageType.toLowerCase()} - standard repair charge`, active: true
})));

const LISTS = {
  RentalStatus: ['Booked', 'Checked Out', 'Returned', 'Closed', 'Cancelled'],
  ItemStatus: ['Reserved', 'Checked Out', 'Returned', 'Cancelled'],
  EquipmentStatus: ['Available', 'Rented Out', 'Under Inspection', 'Damaged', 'In Maintenance', 'Quarantined', 'Retired'],
  EquipmentType: ['Excavator', 'Forklift', 'Crane', 'Generator', 'Compressor', 'Aerial Lift', 'Roller', 'Concrete Mixer',
    'Welding', 'Loader', 'Dumper', 'Lighting', 'Pump', 'Telehandler'],
  LocationType: ['Yard', 'Depot', 'Warehouse', 'Workshop', 'Customer Site'],
  MaintenanceType: ['Preventive', 'Corrective', 'Repair', 'Inspection', 'Calibration'],
  MaintenanceStatus: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'],
  InspectionType: ['Check-Out', 'Check-In', 'Periodic', 'Post-Repair'],
  ConditionGrade: ['A', 'B', 'C', 'D'],
  Severity: ['Minor', 'Moderate', 'Major', 'Critical'],
  DamageType: Object.keys(BASE),
  DamageStatus: ['Reported', 'Confirmed', 'Billed', 'In Repair', 'Repaired', 'Closed', 'Waived'],
  BillingStatus: ['Pending Approval', 'Approved', 'Posted', 'Billed', 'Disputed', 'Rejected'],
  OutboxStatus: ['Pending', 'Sent', 'Failed']
};
const codeLists = Object.entries(LISTS).flatMap(([list, codes]) => codes.map((code, i) => ({ list, code, sortOrder: i + 1 })));

// ========== MASTER DATA ==========
const locations = [
  [1, 'Hyderabad Central Yard', 'Yard', 'Plot 14, IDA Uppal', 'Hyderabad', 17.400600, 78.559000],
  [2, 'Bengaluru Depot', 'Depot', 'KIADB Industrial Area, Peenya', 'Bengaluru', 13.028500, 77.519700],
  [3, 'Chennai Workshop', 'Workshop', 'SIDCO Estate, Guindy', 'Chennai', 13.010000, 80.212000],
  [4, 'Pune Warehouse', 'Warehouse', 'Chakan MIDC Phase II', 'Pune', 18.759700, 73.861000],
  [5, 'Mumbai Port Yard', 'Yard', 'JNPT Road, Nhava Sheva', 'Navi Mumbai', 18.949900, 72.951200]
].map(([n, locationName, locationType, address, city, latitude, longitude]) =>
  ({ ID: L(n), locationName, locationType, address, city, latitude, longitude }));

const customers = [
  [1, 'Skyline Infra Pvt Ltd', 'Ravi Kumar', 'ravi.kumar@skylineinfra.in', '+91 98480 11111', 'Plot 21, Hitech City, Hyderabad 500081'],
  [2, 'Deccan Builders', 'Priya Reddy', 'priya@deccanbuilders.in', '+91 98490 22222', 'Road No. 12, Banjara Hills, Hyderabad 500034'],
  [3, 'Coastal Logistics LLP', 'Arjun Nair', 'arjun.nair@coastallogistics.in', '+91 94440 33333', 'Ennore Port Road, Chennai 600057'],
  [4, 'GreenField Agro Industries', 'Meera Patil', 'meera@greenfieldagro.in', '+91 98220 44444', 'Hinjewadi Phase 1, Pune 411057'],
  [5, 'Metro Rail Contractors', 'Sandeep Rao', 'sandeep.rao@metrorailcon.in', '+91 99000 55555', 'Outer Ring Road, Bengaluru 560103'],
  [6, 'Sunrise Events & Staging', 'Kavya Iyer', 'kavya@sunriseevents.in', '+91 98190 66666', 'Andheri East, Mumbai 400069'],
  [7, 'BlueStone Mining Co', 'Imran Shaikh', 'imran@bluestonemining.in', '+91 94220 77777', 'Navi Mumbai MIDC, Mumbai 400710'],
  [8, 'Urban Roadworks Ltd', 'Anil Deshmukh', 'anil@urbanroadworks.in', '+91 98600 88888', 'Shivajinagar, Pune 411005']
].map(([n, companyName, contactPerson, email, phone, address]) =>
  ({ ID: C(n), companyName, contactPerson, email, phone, address, s4CustomerId: String(1000100 + n) }));

const eqRows = [
  [1, 1, 'Backhoe Loader 3DX', 'Excavator', 'JCB', '3DX Super', 'JCB3DX-24-0012', '2023-02-10', 6500, 'Available'],
  [2, 1, 'Hydraulic Excavator 320', 'Excavator', 'Caterpillar', '320 GC', 'CAT320-22-0451', '2022-07-18', 14500, 'Available'],
  [3, 2, 'Diesel Forklift 2.5T', 'Forklift', 'Toyota', '8FD25', 'TOY8FD-23-1180', '2023-05-04', 3200, 'Damaged'],
  [4, 2, 'Electric Forklift 1.8T', 'Forklift', 'Godrej', 'GX 300E', 'GDJ300E-24-0077', '2024-01-22', 2800, 'Available'],
  [5, 1, 'Mobile Crane 14T', 'Crane', 'Escorts', 'Hydra 14', 'ESC-H14-21-0310', '2021-11-30', 18000, 'Rented Out'],
  [6, 5, 'Crawler Crane 50T', 'Crane', 'Tata Hitachi', 'TCC 500', 'TH-TCC500-20-0042', '2020-09-15', 42000, 'Available'],
  [7, 4, 'Diesel Generator 125 kVA', 'Generator', 'Kirloskar', 'KG1-125AS', 'KOEL125-23-5521', '2023-03-12', 4500, 'Available'],
  [8, 4, 'Silent Generator 62.5 kVA', 'Generator', 'Cummins', 'C62.5D5P', 'CUM62-24-1093', '2024-04-02', 3000, 'Rented Out'],
  [9, 2, 'Air Compressor 400 CFM', 'Compressor', 'Atlas Copco', 'XAS 400', 'AC-XAS400-22-0789', '2022-08-08', 3800, 'Damaged'],
  [10, 1, 'Articulating Boom Lift 60ft', 'Aerial Lift', 'JLG', '600AJ', 'JLG600AJ-23-0331', '2023-06-19', 9500, 'Rented Out'],
  [11, 2, 'Scissor Lift 19ft', 'Aerial Lift', 'Genie', 'GS-1930', 'GEN1930-24-2210', '2024-02-27', 2600, 'Rented Out'],
  [12, 3, 'Vibratory Road Roller', 'Roller', 'Volvo', 'SD110', 'VOL-SD110-21-0154', '2021-04-05', 11000, 'Available'],
  [13, 4, 'Self-Loading Concrete Mixer', 'Concrete Mixer', 'Ajax Fiori', 'ARGO 4000', 'AJX4000-23-0610', '2023-09-14', 8500, 'Rented Out'],
  [14, 3, 'Inverter Welding Machine', 'Welding', 'ESAB', 'Warrior 500i', 'ESAB500-24-3381', '2024-03-20', 1200, 'Available'],
  [15, 1, 'Skid Steer Loader', 'Loader', 'Bobcat', 'S650', 'BOB650-22-0921', '2022-10-11', 5500, 'Available'],
  [16, 5, 'Articulated Dump Truck', 'Dumper', 'Volvo', 'A30G', 'VOL-A30G-21-0088', '2021-12-01', 21000, 'Available'],
  [17, 4, 'LED Light Tower', 'Lighting', 'Generac', 'MLT6S', 'GEN-MLT6-24-0471', '2024-05-16', 1500, 'Rented Out'],
  [18, 3, 'Dewatering Pump 6 inch', 'Pump', 'Kirloskar', 'DV-6', 'KBL-DV6-23-0219', '2023-07-07', 1800, 'Quarantined'],
  [19, 5, 'Telehandler 17m', 'Telehandler', 'Manitou', 'MT 1740', 'MAN1740-22-0517', '2022-03-23', 12500, 'Available'],
  [20, 2, 'Mini Excavator 3.5T', 'Excavator', 'Kubota', 'KX040-4', 'KUB040-23-0705', '2023-11-29', 5200, 'In Maintenance']
];
const equipment = eqRows.map(([n, loc, equipmentName, equipmentType, manufacturer, model, serialNumber, purchaseDate, rentalRatePerDay, currentStatus]) =>
  ({ ID: E(n), location_ID: L(loc), equipmentName, equipmentType, manufacturer, model, serialNumber, purchaseDate, rentalRatePerDay, currentStatus }));
const rate = n => eqRows[n - 1][8];

// ========== RENTALS ==========
// [n, customer, rentalDate, expected, actual, status, items: [equipment, itemStatus, endDate override]]
const rentalDefs = [
  [1, 1, '2026-08-03', '2026-08-17', '2026-08-17', 'Closed', [[1, 'Returned'], [15, 'Returned']]],
  [2, 2, '2026-08-20', '2026-09-05', '2026-09-07', 'Closed', [[7, 'Returned', '2026-09-07']]],
  [3, 3, '2026-09-28', '2026-10-20', '2026-10-22', 'Returned', [[3, 'Returned', '2026-10-22'], [9, 'Returned', '2026-10-22']]],
  [4, 4, '2026-10-05', '2026-11-05', null, 'Checked Out', [[13, 'Checked Out'], [17, 'Checked Out']]],
  [5, 5, '2026-09-15', '2026-10-15', null, 'Checked Out', [[5, 'Checked Out'], [10, 'Checked Out']]],
  [6, 6, '2026-10-20', '2026-10-30', null, 'Checked Out', [[8, 'Checked Out'], [11, 'Checked Out']]],
  [7, 7, '2026-11-02', '2026-11-20', null, 'Booked', [[2, 'Reserved'], [16, 'Reserved']]],
  [8, 8, '2026-10-29', '2026-11-12', null, 'Booked', [[12, 'Reserved']]],
  [9, 1, '2026-09-10', '2026-09-15', null, 'Cancelled', [[19, 'Cancelled']]],
  [10, 3, '2026-07-01', '2026-07-25', '2026-07-25', 'Closed', [[6, 'Returned']]]
];
const rentals = [], rentalItems = [], rentalHistory = [];
let riN = 0, rhN = 0;
const hist = (rental, fromStatus, toStatus, changedBy, changedAt, remarks) =>
  rentalHistory.push({ ID: RH(++rhN), rental_ID: R(rental), fromStatus, toStatus, changedBy, changedAt, remarks });
for (const [n, cust, rentalDate, expectedReturnDate, actualReturnDate, rentalStatus, items] of rentalDefs) {
  let total = 0;
  for (const [eq, itemStatus, endOverride] of items) {
    const endDate = endOverride || expectedReturnDate;
    if (itemStatus !== 'Cancelled') total += rate(eq) * days(rentalDate, endDate);
    rentalItems.push({ ID: RI(++riN), rental_ID: R(n), equipment_ID: E(eq), dailyRentalRate: rate(eq), startDate: rentalDate, endDate, itemStatus });
  }
  rentals.push({ ID: R(n), customer_ID: C(cust), rentalDate, expectedReturnDate, actualReturnDate, rentalStatus, totalRentalAmount: round2(total) });
  const t = h => `${rentalDate}T${h}:00Z`;
  hist(n, null, 'Booked', DISPATCH, `${new Date(new Date(rentalDate) - 3 * 86400000).toISOString().slice(0, 10)}T10:00:00Z`, 'Rental created');
  if (rentalStatus === 'Cancelled') { hist(n, 'Booked', 'Cancelled', DISPATCH, t('09:00'), 'Customer postponed the project'); continue; }
  if (rentalStatus === 'Booked') continue;
  hist(n, 'Booked', 'Checked Out', DISPATCH, t('09:30'), 'All items inspected and handed over');
  if (!actualReturnDate) continue;
  const late = days(expectedReturnDate, actualReturnDate) - 1;
  hist(n, 'Checked Out', 'Returned', DISPATCH, `${actualReturnDate}T15:30:00Z`, late > 0 ? `Returned ${late} day(s) late` : 'Returned on time');
  if (rentalStatus === 'Closed') hist(n, 'Returned', 'Closed', DISPATCH, `${actualReturnDate}T18:00:00Z`, 'Rental closed');
}
rentals.find(r => r.ID === R(9)).totalRentalAmount = 0;

// ========== INSPECTIONS AND DAMAGES ==========
// [n, equipment, rental, date, type, grade, meter, inspector, notes]
const conditionLogs = [
  [1, 1, 1, '2026-08-03T08:30:00Z', 'Check-Out', 'A', 1240, YARD, 'Clean, all lights working'],
  [2, 15, 1, '2026-08-03T08:45:00Z', 'Check-Out', 'A', 860, YARD, 'Bucket teeth new'],
  [3, 1, 1, '2026-08-17T16:10:00Z', 'Check-In', 'C', 1338, YARD, 'Bucket dented, paint scratched on boom'],
  [4, 15, 1, '2026-08-17T16:30:00Z', 'Check-In', 'B', 921, YARD, 'Normal wear'],
  [5, 7, 2, '2026-08-20T09:00:00Z', 'Check-Out', 'A', 3110, YARD, 'Serviced last month'],
  [6, 7, 2, '2026-09-07T17:00:00Z', 'Check-In', 'C', 3302, YARD, 'Oil on the base frame'],
  [7, 3, 3, '2026-09-28T08:15:00Z', 'Check-Out', 'B', 5520, YARD, 'Small paint chips on mast'],
  [8, 9, 3, '2026-09-28T08:30:00Z', 'Check-Out', 'A', 2210, YARD, 'All gauges OK'],
  [9, 3, 3, '2026-10-22T16:00:00Z', 'Check-In', 'B', 5688, YARD, 'New scratch on counterweight'],
  [10, 9, 3, '2026-10-22T16:20:00Z', 'Check-In', 'C', 2390, YARD, 'Control panel cracked'],
  [11, 13, 4, '2026-10-05T08:00:00Z', 'Check-Out', 'B', 780, YARD, 'Old scratch on drum documented'],
  [12, 17, 4, '2026-10-05T08:20:00Z', 'Check-Out', 'A', 410, YARD, 'All 4 lamps OK'],
  [13, 5, 5, '2026-09-15T07:45:00Z', 'Check-Out', 'A', 6020, YARD, 'Load test certificate valid'],
  [14, 10, 5, '2026-09-15T08:05:00Z', 'Check-Out', 'A', 1450, YARD, 'Platform clean'],
  [15, 8, 6, '2026-10-20T09:10:00Z', 'Check-Out', 'A', 980, YARD, 'Full tank'],
  [16, 11, 6, '2026-10-20T09:25:00Z', 'Check-Out', 'A', 300, YARD, 'Battery charged'],
  [17, 6, 10, '2026-07-01T07:30:00Z', 'Check-Out', 'A', 8800, YARD, 'Pre-use checklist complete'],
  [18, 6, 10, '2026-07-25T17:30:00Z', 'Check-In', 'D', 9150, YARD, 'Heavy hydraulic leak from boom cylinder, machine isolated'],
  [19, 20, null, '2026-10-20T11:00:00Z', 'Periodic', 'C', 1205, TECH, 'Left track links damaged'],
  [20, 7, null, '2026-09-12T10:00:00Z', 'Post-Repair', 'A', 3302, TECH, 'Leak fixed, test run 2 hours'],
  [21, 6, null, '2026-08-02T10:00:00Z', 'Post-Repair', 'B', 9150, TECH, 'Cylinder resealed, load test passed'],
  [22, 18, null, '2026-10-25T09:30:00Z', 'Periodic', 'D', 2214, TECH, 'Impeller noise, pump isolated pending workshop check']
].map(([n, eq, rental, inspectionDate, inspectionType, conditionGrade, meterReading, inspectorName, notes]) =>
  ({ ID: CL(n), equipment_ID: E(eq), rental_ID: rental ? R(rental) : null, inspectionDate, inspectionType, conditionGrade, meterReading, inspectorName, notes }));

// [n, log, type, description, severity, estimate, liable, note, status]
const damageRecords = [
  [1, 3, 'Dent', 'Front bucket dented near the cutting edge', 'Moderate', 12000, true, null, 'Closed'],
  [2, 6, 'Oil Leak', 'Engine oil leaking from sump gasket', 'Major', 18000, true, null, 'Repaired'],
  [3, 9, 'Scratch', 'Deep scratch on rear counterweight', 'Minor', 1500, true, null, 'Reported'],
  [4, 18, 'Hydraulic Leak', 'Boom cylinder seal failure, hydraulic oil loss', 'Critical', 65000, true, null, 'Closed'],
  [5, 11, 'Scratch', 'Old scratch on mixer drum', 'Minor', 1500, false, 'Recorded at check-out (pre-existing)', 'Waived'],
  [6, 19, 'Track Damage', 'Two track links bent on left side', 'Major', 80000, false, 'Found outside a rental (internal)', 'In Repair'],
  [8, 10, 'Broken Part', 'Control panel cover cracked, gauge glass broken', 'Moderate', 7000, true, null, 'Confirmed'],
  [9, 3, 'Scratch', 'Paint scratched along the boom', 'Minor', 1800, true, null, 'Repaired']
].map(([n, log, damageType, damageDescription, severity, repairEstimate, customerLiable, liabilityNote, damageStatus]) =>
  ({ ID: D(n), conditionLog_ID: CL(log), damageType, damageDescription, severity, repairEstimate, customerLiable, liabilityNote, damageStatus }));

const colours = [[178, 34, 34], [196, 120, 20], [140, 30, 140], [30, 90, 170], [200, 60, 40], [40, 140, 80], [170, 40, 70], [90, 60, 30]];
const photoDefs = [[1, 1, '2026-08-17T16:12:00Z'], [2, 2, '2026-09-07T17:05:00Z'], [3, 2, '2026-09-07T17:06:00Z'], [4, 3, '2026-10-22T16:03:00Z'],
  [5, 4, '2026-07-25T17:35:00Z'], [6, 8, '2026-10-22T16:24:00Z'], [7, 6, '2026-10-20T11:05:00Z'], [8, 9, '2026-08-17T16:14:00Z']];
const damagePhotos = photoDefs.map(([n, dmg, uploadedAt]) => {
  const buf = photo(colours[n - 1], n);
  return {
    ID: P(n), damage_ID: D(dmg), fileName: `damage-${dmg}-${n}.png`, mediaType: 'image/png', photoContent: buf.toString('base64'),
    uploadedAt, uploadedBy: dmg === 6 ? TECH : YARD, sha256Hash: crypto.createHash('sha256').update(buf).digest('hex')
  };
});

// ========== REPAIR BILLS ==========
const bill = (n, rental, cust, dmg, billDate, repairAmount, billingStatus, s4, autoApproved, decisionBy, decisionAt, decisionReason) => {
  const taxAmount = round2(repairAmount * 0.18);
  return {
    ID: B(n), rental_ID: R(rental), customer_ID: C(cust), damage_ID: D(dmg), billDate, repairAmount, taxAmount,
    totalAmount: round2(repairAmount + taxAmount), billingStatus, s4BillingDocumentId: s4, autoApproved, decisionBy, decisionAt, decisionReason
  };
};
const repairBills = [
  bill(1, 1, 1, 1, '2026-08-18', 12000, 'Billed', '9010000451', false, BILLING, '2026-08-18T11:00:00Z', 'Photos confirm new dent'),
  bill(2, 2, 2, 2, '2026-09-08', 18000, 'Disputed', '9000000318', false, MANAGER, '2026-09-15T10:20:00Z', 'Customer claims the leak existed before the rental'),
  bill(3, 10, 3, 4, '2026-07-26', 65000, 'Posted', '9000000102', false, MANAGER, '2026-07-27T09:40:00Z', 'Critical damage, workshop report attached'),
  bill(4, 3, 3, 8, '2026-10-23', 7000, 'Pending Approval', null, false, null, null, null),
  bill(5, 1, 1, 9, '2026-08-18', 1800, 'Approved', null, true, 'system', '2026-08-18T10:05:00Z', 'Auto-approved: total is within the approval limit')
];
let bhN = 0;
const billHistory = [];
const bh = (b, fromStatus, toStatus, changedBy, changedAt, remarks) =>
  billHistory.push({ ID: BH(++bhN), repairBill_ID: B(b), fromStatus, toStatus, amount: repairBills[b - 1].totalAmount, changedBy, changedAt, remarks });
bh(1, null, 'Pending Approval', TECH, '2026-08-18T10:00:00Z', 'Charge calculated from estimate');
bh(1, 'Pending Approval', 'Approved', BILLING, '2026-08-18T11:00:00Z', 'Photos confirm new dent');
bh(1, 'Approved', 'Posted', 'system', '2026-08-18T11:01:00Z', 'Debit memo request 9000000245 created in S/4HANA');
bh(1, 'Posted', 'Billed', 'system', '2026-08-19T06:00:00Z', 'Billing document 9010000451 created in S/4HANA');
bh(2, null, 'Pending Approval', TECH, '2026-09-08T09:00:00Z', 'Charge calculated from estimate');
bh(2, 'Pending Approval', 'Approved', BILLING, '2026-09-08T12:30:00Z', 'Approved');
bh(2, 'Approved', 'Posted', 'system', '2026-09-08T12:31:00Z', 'Debit memo request 9000000318 created in S/4HANA');
bh(2, 'Posted', 'Disputed', MANAGER, '2026-09-15T10:20:00Z', 'Customer claims the leak existed before the rental');
bh(3, null, 'Pending Approval', TECH, '2026-07-26T09:00:00Z', 'Charge calculated from estimate');
bh(3, 'Pending Approval', 'Approved', MANAGER, '2026-07-27T09:40:00Z', 'Critical damage, workshop report attached');
bh(3, 'Approved', 'Posted', 'system', '2026-07-27T09:41:00Z', 'Debit memo request 9000000102 created in S/4HANA');
bh(4, null, 'Pending Approval', TECH, '2026-10-23T09:15:00Z', 'Charge calculated from estimate');
bh(5, null, 'Pending Approval', TECH, '2026-08-18T10:05:00Z', 'Charge calculated from estimate');
bh(5, 'Pending Approval', 'Approved', 'system', '2026-08-18T10:05:00Z', 'Auto-approved: total is within the approval limit');

// ========== MAINTENANCE ==========
// [n, equipment, type, date, description, provider, cost, next, status]
const maintenanceRecords = [
  [1, 2, 'Preventive', '2026-01-15', '500-hour service, filters and hydraulic oil', 'CAT Service Centre Hyderabad', 8500, '2026-07-15', 'Completed'],
  [2, 5, 'Preventive', '2026-02-10', 'Annual service and load test', 'Escorts Service Bengaluru', 12000, '2026-08-10', 'Completed'],
  [3, 6, 'Repair', '2026-07-28', 'Repair Hydraulic Leak (Critical): boom cylinder resealed', 'Tata Hitachi Workshop', 58000, '2027-01-28', 'Completed'],
  [4, 7, 'Repair', '2026-09-10', 'Repair Oil Leak (Major): sump gasket replaced', 'Kirloskar Authorised Service', 15500, '2027-03-10', 'Completed'],
  [5, 1, 'Repair', '2026-08-20', 'Repair Dent (Moderate) and boom paint', 'JCB Care Hyderabad', 10800, '2027-02-20', 'Completed'],
  [6, 12, 'Preventive', '2026-03-18', 'Drum bearing grease and engine service', 'Volvo CE Chennai', 9500, '2026-09-18', 'Completed'],
  [7, 16, 'Preventive', '2026-04-22', '1000-hour service', 'Volvo CE Mumbai', 14000, '2026-10-22', 'Completed'],
  [8, 10, 'Calibration', '2026-05-05', 'Load sensor and tilt alarm calibration', 'JLG Service India', 3500, '2026-11-05', 'Completed'],
  [9, 3, 'Preventive', '2026-06-12', 'Engine oil, filters, brake check', 'Toyota Material Handling', 2400, '2026-12-12', 'Completed'],
  [10, 19, 'Preventive', '2026-08-08', 'Annual service', 'Manitou Service Pune', 6500, '2027-02-08', 'Completed'],
  [11, 2, 'Preventive', '2026-11-03', '1000-hour service', 'CAT Service Centre Hyderabad', 0, null, 'Scheduled'],
  [12, 20, 'Repair', '2026-10-21', 'Repair Track Damage (Major): replace two track links', 'In-house workshop - Suresh', 0, null, 'In Progress'],
  [13, 9, 'Repair', '2026-10-23', 'Repair Broken Part (Moderate): control panel cover and gauge glass', null, 0, null, 'Scheduled'],
  [14, 14, 'Inspection', '2026-10-18', 'Electrical safety inspection', 'ESAB Service Chennai', 0, null, 'Scheduled'],
  [15, 18, 'Corrective', '2026-10-28', 'Check impeller and bearings', 'Kirloskar Authorised Service', 0, null, 'Scheduled']
].map(([n, eq, maintenanceType, maintenanceDate, description, serviceProvider, cost, nextMaintenanceDate, status]) =>
  ({ ID: M(n), equipment_ID: E(eq), maintenanceType, maintenanceDate, description, serviceProvider, cost, nextMaintenanceDate, status }));

const transfers = [
  [1, 3, 1, 2, '2026-05-02T10:00:00Z', 'Higher forklift demand in Bengaluru'],
  [2, 14, 2, 3, '2026-06-15T09:00:00Z', 'Needed for workshop fabrication'],
  [3, 19, 1, 5, '2026-09-20T08:00:00Z', 'Port expansion project']
].map(([n, eq, from, to, transferDate, reason]) =>
  ({ ID: T(n), equipment_ID: E(eq), fromLocation_ID: L(from), toLocation_ID: L(to), transferDate, transferredBy: DISPATCH, reason }));

// ========== INTEGRATION OUTBOX ==========
const msg = (n, messageType, interfaceId, targetEntity, targetKey, payload, status, attempts, responseRef, processedAt, lastError) => ({
  ID: O(n), messageType, interfaceId, destination: 'HANA_DEV', targetEntity, targetKey, idempotencyKey: `${messageType}:${targetKey}`,
  payload: JSON.stringify(payload), status, attempts, responseRef, processedAt, lastError
});
const debitMemo = (b, cust) => ({
  DebitMemoRequestType: 'L2', SoldToParty: String(1000100 + cust), CustomerName: customers[cust - 1].companyName,
  PurchaseOrderByCustomer: `RENTAL ${repairBills[b - 1].rental_ID}`, DebitMemoRequestDate: repairBills[b - 1].billDate,
  to_Item: [{ Material: 'DAMAGE-CHARGE', RequestedQuantity: '1', NetAmount: String(repairBills[b - 1].repairAmount), TaxAmount: String(repairBills[b - 1].taxAmount) }]
});
const notif = (dmg, eq, text, prio) => ({ NotificationType: 'M2', TechnicalObject: E(eq), NotificationText: text, MaintPriority: prio });
const outbox = [
  msg(1, 'MAINT_NOTIFICATION', 'INT-04', 'DamageRecords', D(1), notif(1, 1, 'Dent - Moderate', '3'), 'Sent', 1, '100000501', '2026-08-18T10:01:00Z'),
  msg(2, 'DEBIT_MEMO_REQUEST', 'INT-06', 'RepairBills', B(1), debitMemo(1, 1), 'Sent', 1, '9000000245', '2026-08-18T11:01:00Z'),
  msg(3, 'DEBIT_MEMO_REQUEST', 'INT-06', 'RepairBills', B(3), debitMemo(3, 3), 'Sent', 2, '9000000102', '2026-07-27T09:41:00Z'),
  msg(4, 'DEBIT_MEMO_REQUEST', 'INT-06', 'RepairBills', B(2), debitMemo(2, 2), 'Sent', 1, '9000000318', '2026-09-08T12:31:00Z'),
  msg(5, 'DEBIT_MEMO_REQUEST', 'INT-06', 'RepairBills', B(5), debitMemo(5, 1), 'Failed', 1, null, '2026-08-18T10:06:00Z', 'Destination HANA_DEV is not reachable (timeout after 30 s)'),
  msg(6, 'MAINT_NOTIFICATION', 'INT-04', 'DamageRecords', D(8), notif(8, 9, 'Broken Part - Moderate', '3'), 'Pending', 0, null, null),
  msg(7, 'MAINT_NOTIFICATION', 'INT-04', 'DamageRecords', D(6), notif(6, 20, 'Track Damage - Major', '2'), 'Sent', 1, '100000777', '2026-10-20T11:10:00Z')
];

const auditLog = [
  [1, 'Rentals', R(3), 'RETURN', DISPATCH, '2026-10-22T15:30:00Z', '{"lateDays":2}'],
  [2, 'ConditionLogs', CL(10), 'INSPECTION', YARD, '2026-10-22T16:20:00Z', '{"type":"Check-In","grade":"C","damages":1}'],
  [3, 'DamageRecords', D(8), 'CONFIRM', TECH, '2026-10-23T09:15:00Z', '{}'],
  [4, 'RepairBills', B(2), 'STATUS_DISPUTED', MANAGER, '2026-09-15T10:20:00Z', '{"reason":"Customer claims the leak existed before the rental"}'],
  [5, 'Equipment', E(19), 'TRANSFER', DISPATCH, '2026-09-20T08:00:00Z', '{"reason":"Port expansion project"}']
].map(([n, entity, entityKey, action, userId, timestamp, details]) => ({ ID: A(n), entity, entityKey, action, userId, timestamp, details }));

// ========== WRITE ==========
writeCsv(CONFIG, 'Settings', settings);
writeCsv(CONFIG, 'DamageCatalogue', catalogue);
writeCsv(CONFIG, 'CodeLists', codeLists);
writeCsv(DEMO, 'Locations', locations);
writeCsv(DEMO, 'Customers', customers);
writeCsv(DEMO, 'Equipment', equipment);
writeCsv(DEMO, 'Rentals', rentals);
writeCsv(DEMO, 'RentalItems', rentalItems);
writeCsv(DEMO, 'RentalStatusHistory', rentalHistory);
writeCsv(DEMO, 'ConditionLogs', conditionLogs);
writeCsv(DEMO, 'DamageRecords', damageRecords);
writeCsv(DEMO, 'DamagePhotos', damagePhotos);
writeCsv(DEMO, 'RepairBills', repairBills);
writeCsv(DEMO, 'RepairBillHistory', billHistory);
writeCsv(DEMO, 'MaintenanceRecords', maintenanceRecords);
writeCsv(DEMO, 'LocationTransfers', transfers);
writeCsv(DEMO, 'OutboxMessages', outbox);
writeCsv(DEMO, 'AuditLog', auditLog);
// eslint-disable-next-line no-console
console.log(`Sample data written to ${path.relative(root, CONFIG)} and ${path.relative(root, DEMO)}`);
