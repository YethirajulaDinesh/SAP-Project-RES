const cds = require('@sap/cds');

// The seven business roles of the FRD (Security & Authorization)
const ROLES = ['YardWorker', 'Dispatcher', 'Technician', 'BillingClerk', 'Manager', 'Admin', 'Auditor'];

// Fields hidden from YardWorker ("price data hidden from YardWorker")
const PRICE_FIELDS = ['rentalRatePerDay', 'dailyRentalRate', 'totalRentalAmount', 'lineAmount',
  'repairEstimate', 'cost', 'standardCost', 'repairAmount', 'taxAmount', 'totalAmount', 'billedAmount'];

const idOf = p => (typeof p === 'object' ? p.ID : p);
const today = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function daysBetween(from, to) {          // whole days, inclusive of the start day
  if (!from || !to) return 0;
  const ms = new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z');
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

// true when the user's only business role is YardWorker
function isYardWorkerOnly(user) {
  return user.is('YardWorker') && !ROLES.filter(r => r !== 'YardWorker').some(r => user.is(r));
}

function hidePrices(rows, req) {
  if (!rows || !isYardWorkerOnly(req.user)) return;
  const strip = row => {
    if (!row || typeof row !== 'object') return;
    for (const k of Object.keys(row)) {
      if (PRICE_FIELDS.includes(k)) row[k] = null;
      else if (row[k] && typeof row[k] === 'object') Array.isArray(row[k]) ? row[k].forEach(strip) : strip(row[k]);
    }
  };
  (Array.isArray(rows) ? rows : [rows]).forEach(strip);
}

// Fiori criticality: 0 neutral, 1 negative, 2 critical, 3 positive, 5 information
const CRITICALITY = {
  'Booked': 5, 'Checked Out': 2, 'Returned': 2, 'Closed': 3, 'Cancelled': 0, 'Reserved': 5,
  'Available': 3, 'Rented Out': 5, 'Under Inspection': 2, 'Damaged': 1, 'In Maintenance': 2, 'Quarantined': 1, 'Retired': 0,
  'Reported': 2, 'Confirmed': 2, 'Billed': 3, 'In Repair': 2, 'Repaired': 3, 'Waived': 0,
  'Pending Approval': 2, 'Approved': 3, 'Posted': 3, 'Disputed': 1, 'Rejected': 0,
  'Scheduled': 5, 'In Progress': 2, 'Completed': 3, 'Pending': 2, 'Sent': 3, 'Failed': 1
};
const GRADE_CRITICALITY = { A: 3, B: 3, C: 2, D: 1 };
const STATUS_FIELDS = ['rentalStatus', 'itemStatus', 'currentStatus', 'damageStatus', 'billingStatus', 'status'];

// Fills the virtual statusCriticality / gradeCriticality elements, also inside $expand results
function addCriticality(rows, entity) {
  if (!rows || !entity?.elements) return;
  for (const row of [].concat(rows)) {
    if (!row || typeof row !== 'object') continue;
    if (entity.elements.statusCriticality) {
      const status = row[STATUS_FIELDS.find(f => row[f] != null)];
      if (status) row.statusCriticality = row.isOverdue ? 1 : CRITICALITY[status] ?? 0;
    }
    if (entity.elements.gradeCriticality && row.conditionGrade) row.gradeCriticality = GRADE_CRITICALITY[row.conditionGrade] ?? 0;
    for (const [k, v] of Object.entries(row)) {
      const el = entity.elements[k];
      if (v && typeof v === 'object' && el?.isAssociation) addCriticality(v, el._target);
    }
  }
}

// Virtual fields can be requested without the columns they are computed from ($select):
// returns [row, source] pairs where source also has those columns, read from the table if needed
async function withSource(rows, entity, columns) {
  const list = [].concat(rows || []).filter(r => r && r.ID);
  const need = list.filter(r => columns.some(c => r[c] === undefined));
  const extra = need.length ? await SELECT.from(entity).columns('ID', ...columns).where({ ID: { in: need.map(r => r.ID) } }) : [];
  return list.map(r => [r, { ...extra.find(e => e.ID === r.ID), ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) }]);
}

// One after-READ step per service: computed fields first, then criticality, then price hiding (in this order)
function afterRead(srv, computed) {
  srv.after('READ', '*', async (rows, req) => {
    const name = req.target?.name?.replace(/\.drafts$/, '').split('.').pop();
    if (rows && computed[name]) await computed[name](rows, req);
    addCriticality(rows, req.target);
    hidePrices(rows, req);
  });
}

async function getSetting(code, fallback) {
  const { Settings } = cds.entities('ret');
  const row = await SELECT.one.from(Settings).columns('value').where({ code });
  if (!row) return fallback;
  const n = Number(row.value);
  return typeof fallback === 'number' && !Number.isNaN(n) ? n : row.value;
}

async function audit(entity, key, action, user, details) {
  const { AuditLog } = cds.entities('ret');
  await INSERT.into(AuditLog).entries({
    entity, entityKey: key, action, userId: user?.id,
    timestamp: nowISO(), details: JSON.stringify(details || {})
  });
}

async function addRentalHistory(rentalID, from, to, user, remarks) {
  const { RentalStatusHistory } = cds.entities('ret');
  await INSERT.into(RentalStatusHistory).entries({
    rental_ID: rentalID, fromStatus: from, toStatus: to,
    changedBy: user?.id, changedAt: nowISO(), remarks
  });
}

async function addBillHistory(billID, from, to, amount, user, remarks) {
  const { RepairBillHistory } = cds.entities('ret');
  await INSERT.into(RepairBillHistory).entries({
    repairBill_ID: billID, fromStatus: from, toStatus: to, amount,
    changedBy: user?.id, changedAt: nowISO(), remarks
  });
}

module.exports = {
  ROLES, PRICE_FIELDS, CRITICALITY, idOf, today, nowISO, round2, daysBetween,
  isYardWorkerOnly, hidePrices, addCriticality, withSource, afterRead, getSetting, audit, addRentalHistory, addBillHistory
};
