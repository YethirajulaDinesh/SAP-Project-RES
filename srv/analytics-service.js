const cds = require('@sap/cds');
const { today, round2, daysBetween } = require('./lib/common');

const pct = (a, b) => (b ? round2((a / b) * 100) : 0);
const sum = (rows, f) => round2(rows.reduce((t, r) => t + (Number(r[f]) || 0), 0));
const addDays = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
const monthsBack = n => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - n + 1); return d.toISOString().slice(0, 10); };

module.exports = class AnalyticsService extends cds.ApplicationService {
  async init() {
    const { Equipment, Rentals, RentalItems, RepairBills, DamageRecords, MaintenanceRecords, ConditionLogs } = cds.entities('ret');

    const overdueRentals = async () => {
      const now = today();
      const rows = await SELECT.from(Rentals, r => {
        r.ID, r.rentalDate, r.expectedReturnDate, r.totalRentalAmount, r.customer(c => { c.companyName; });
      }).where({ rentalStatus: 'Checked Out', expectedReturnDate: { '<': now } }).orderBy('expectedReturnDate');
      const items = rows.length ? await SELECT.from(RentalItems).columns('rental_ID', 'count(*) as n')
        .where({ rental_ID: { in: rows.map(r => r.ID) } }).groupBy('rental_ID') : [];
      return rows.map(r => ({
        rentalID: r.ID, customer: r.customer?.companyName, rentalDate: r.rentalDate, expectedReturnDate: r.expectedReturnDate,
        overdueDays: daysBetween(r.expectedReturnDate, now) - 1, items: items.find(i => i.rental_ID === r.ID)?.n || 0,
        totalRentalAmount: r.totalRentalAmount
      }));
    };

    const utilization = async (days = 90) => {
      const to = today(); const from = addDays(to, -(days - 1));
      const eq = await SELECT.from(Equipment).columns('ID', 'equipmentType', 'currentStatus', 'purchaseDate');
      const items = await SELECT.from(RentalItems).columns('equipment_ID', 'startDate', 'endDate', 'dailyRentalRate')
        .where({ itemStatus: { in: ['Checked Out', 'Returned'] }, startDate: { '<=': to }, endDate: { '>=': from } });
      const byType = {};
      for (const e of eq.filter(x => x.currentStatus !== 'Retired')) {
        const t = byType[e.equipmentType] ||= { equipmentType: e.equipmentType, units: 0, rentedDays: 0, availableDays: 0, revenue: 0 };
        t.units++; t.availableDays += days;
        for (const it of items.filter(i => i.equipment_ID === e.ID)) {
          const s = it.startDate > from ? it.startDate : from;
          const en = it.endDate < to ? it.endDate : to;
          const d = daysBetween(s, en);
          t.rentedDays += d; t.revenue += d * (Number(it.dailyRentalRate) || 0);
        }
      }
      return Object.values(byType).map(t => ({ ...t, revenue: round2(t.revenue), utilizationPct: pct(t.rentedDays, t.availableDays) }))
        .sort((a, b) => b.utilizationPct - a.utilizationPct);
    };

    this.on('getFleetKPIs', async () => {
      const byStatus = await SELECT.from(Equipment).columns('currentStatus', 'count(*) as n').groupBy('currentStatus');
      const c = s => byStatus.find(r => r.currentStatus === s)?.n || 0;
      const total = byStatus.reduce((t, r) => t + r.n, 0);
      const [{ n: openRentals }] = await SELECT.from(Rentals).columns('count(*) as n').where({ rentalStatus: { in: ['Booked', 'Checked Out'] } });
      const util = await utilization(90);
      const pending = await SELECT.from(RepairBills).columns('totalAmount').where({ billingStatus: 'Pending Approval' });

      // inspection compliance: returned items that have a check-in inspection
      const returned = await SELECT.from(RentalItems).columns('rental_ID', 'equipment_ID').where({ itemStatus: 'Returned' });
      const checkins = await SELECT.from(ConditionLogs).columns('rental_ID', 'equipment_ID').where({ inspectionType: 'Check-In' });
      const inspected = returned.filter(r => checkins.some(l => l.rental_ID === r.rental_ID && l.equipment_ID === r.equipment_ID)).length;

      return {
        totalEquipment: total, available: c('Available'), rentedOut: c('Rented Out'),
        overdue: (await overdueRentals()).length, damaged: c('Damaged') + c('Under Inspection'),
        inMaintenance: c('In Maintenance'), quarantined: c('Quarantined'), openRentals,
        utilizationPct: pct(util.reduce((t, r) => t + r.rentedDays, 0), util.reduce((t, r) => t + r.availableDays, 0)),
        inspectionCompliancePct: returned.length ? pct(inspected, returned.length) : 100,
        pendingCharges: pending.length, pendingChargeAmount: sum(pending, 'totalAmount')
      };
    });

    this.on('getEquipmentStatusDistribution', async () => {
      const rows = await SELECT.from(Equipment).columns('currentStatus', 'count(*) as n').groupBy('currentStatus');
      return ['Available', 'Rented Out', 'Under Inspection', 'Damaged', 'In Maintenance', 'Quarantined', 'Retired']
        .map(status => ({ status, count: rows.find(r => r.currentStatus === status)?.n || 0 }));
    });

    this.on('getUtilization', req => utilization(req.data.days || 90));

    this.on('getRentalTrend', async req => {
      const rows = await SELECT.from(Rentals).columns('rentalDate', 'totalRentalAmount')
        .where({ rentalDate: { '>=': monthsBack(req.data.months || 12) }, rentalStatus: { '!=': 'Cancelled' } });
      const buckets = {};
      for (const r of rows) {
        const b = buckets[r.rentalDate.slice(0, 7)] ||= { rentals: 0, revenue: 0 };
        b.rentals++; b.revenue += Number(r.totalRentalAmount) || 0;
      }
      return Object.keys(buckets).sort().map(period => ({ period, rentals: buckets[period].rentals, revenue: round2(buckets[period].revenue) }));
    });

    // FR-024: maintenance cost by period and equipment
    this.on('getMaintenanceCosts', async req => {
      const rows = await SELECT.from(MaintenanceRecords, m => {
        m.maintenanceDate, m.maintenanceType, m.cost, m.equipment(e => { e.equipmentName, e.serialNumber; });
      }).where({ status: 'Completed', maintenanceDate: { '>=': monthsBack(req.data.months || 12) } });
      const buckets = {};
      for (const r of rows) {
        const k = r.maintenanceDate.slice(0, 7) + '|' + r.maintenanceType;
        const b = buckets[k] ||= { period: r.maintenanceDate.slice(0, 7), maintenanceType: r.maintenanceType, jobs: 0, cost: 0 };
        b.jobs++; b.cost += Number(r.cost) || 0;
      }
      return Object.values(buckets).map(b => ({ ...b, cost: round2(b.cost) })).sort((a, b) => a.period.localeCompare(b.period));
    });

    this.on('getMaintenanceCostByEquipment', async () => {
      const rows = await SELECT.from(MaintenanceRecords, m => {
        m.cost, m.equipment(e => { e.equipmentName, e.serialNumber; });
      }).where({ status: 'Completed' });
      const by = {};
      for (const r of rows) {
        const k = r.equipment?.serialNumber;
        const b = by[k] ||= { equipmentName: r.equipment?.equipmentName, serialNumber: k, jobs: 0, cost: 0 };
        b.jobs++; b.cost += Number(r.cost) || 0;
      }
      return Object.values(by).map(b => ({ ...b, cost: round2(b.cost) })).sort((a, b) => b.cost - a.cost);
    });

    // FR-025: billing and damage charge reporting
    this.on('getChargesByStatus', async () => {
      const rows = await SELECT.from(RepairBills).columns('billingStatus', 'count(*) as n', 'sum(totalAmount) as amount').groupBy('billingStatus');
      return ['Pending Approval', 'Approved', 'Posted', 'Billed', 'Disputed', 'Rejected']
        .map(status => { const r = rows.find(x => x.billingStatus === status); return { status, count: r?.n || 0, amount: round2(r?.amount || 0) }; });
    });

    this.on('getBillingSummary', async () => {
      const bills = await SELECT.from(RepairBills).columns('billingStatus', 'repairAmount', 'autoApproved', 'damage_ID');
      const liable = await SELECT.from(DamageRecords).columns('ID', 'repairEstimate', 'damageStatus')
        .where({ customerLiable: true, damageStatus: { in: ['Confirmed', 'Billed', 'In Repair', 'Repaired', 'Closed'] } });
      const billedIDs = new Set(bills.map(b => b.damage_ID));
      const leaks = liable.filter(d => !billedIDs.has(d.ID));
      const by = s => bills.filter(b => [].concat(s).includes(b.billingStatus));
      return {
        estimatedTotal: sum(liable, 'repairEstimate'),
        chargedTotal: sum(by(['Pending Approval', 'Approved', 'Posted', 'Billed', 'Disputed']), 'repairAmount'),
        postedTotal: sum(by(['Posted', 'Billed']), 'repairAmount'),
        pendingTotal: sum(by('Pending Approval'), 'repairAmount'),
        disputedTotal: sum(by('Disputed'), 'repairAmount'),
        rejectedTotal: sum(by('Rejected'), 'repairAmount'),
        leakageCount: leaks.length, leakageAmount: sum(leaks, 'repairEstimate'),
        autoApproved: bills.filter(b => b.autoApproved).length,
        manualApproved: bills.filter(b => !b.autoApproved && ['Approved', 'Posted', 'Billed'].includes(b.billingStatus)).length
      };
    });

    this.on('getTopDamageCategories', async req => {
      const rows = await SELECT.from(DamageRecords).columns('damageType', 'count(*) as n', 'sum(repairEstimate) as estimated').groupBy('damageType');
      return rows.map(r => ({ damageType: r.damageType, count: r.n, estimated: round2(r.estimated || 0) }))
        .sort((a, b) => b.count - a.count || b.estimated - a.estimated).slice(0, req.data.top || 5);
    });

    this.on('getOverdueRentals', () => overdueRentals());

    this.on('getServiceSchedule', async req => {
      const now = today(); const to = addDays(now, req.data.days || 30);
      const rows = await SELECT.from(MaintenanceRecords, m => {
        m.ID, m.equipment_ID, m.maintenanceType, m.maintenanceDate, m.nextMaintenanceDate, m.status,
        m.equipment(e => { e.equipmentName, e.serialNumber; });
      }).where({ status: { in: ['Scheduled', 'In Progress', 'Completed'] } });
      const openJobs = new Set(rows.filter(r => r.status !== 'Completed').map(r => r.equipment_ID));
      const lastDone = {};
      for (const r of rows.filter(x => x.status === 'Completed'))
        if (!lastDone[r.equipment_ID] || r.maintenanceDate > lastDone[r.equipment_ID].maintenanceDate) lastDone[r.equipment_ID] = r;
      return rows
        // a planned job replaces the "next service" date; only the latest completed job counts
        .filter(r => r.status !== 'Completed' || (!openJobs.has(r.equipment_ID) && lastDone[r.equipment_ID] === r))
        .map(r => {
          const dueDate = r.status === 'Completed' ? r.nextMaintenanceDate : r.maintenanceDate;
          return {
            maintenanceID: r.ID, equipmentName: r.equipment?.equipmentName, serialNumber: r.equipment?.serialNumber,
            maintenanceType: r.maintenanceType, dueDate, status: r.status === 'Completed' ? 'Next service' : r.status,
            overdue: !!dueDate && dueDate < now
          };
        })
        .filter(r => r.dueDate && r.dueDate <= to)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    });

    return super.init();
  }
};
