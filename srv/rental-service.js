const cds = require('@sap/cds');
const { idOf, today, daysBetween, withSource, afterRead, audit, addRentalHistory } = require('./lib/common');
const { assertTransition } = require('./lib/status-matrix');
const { lineAmount, rentalTotal } = require('./lib/pricing');
const equipmentLib = require('./lib/equipment');

module.exports = class RentalManagementService extends cds.ApplicationService {
  async init() {
    const db = cds.entities('ret');
    const { Rentals, RentalItems, Equipment, Locations, Customers, ConditionLogs, MaintenanceRecords, DamageRecords } = db;
    const S = this.entities;
    const reload = (entity, ID) => this.run(SELECT.one.from(entity).where({ ID }));

    // ========== CUSTOMERS (FR-001) ==========
    this.before('DELETE', 'Customers', async req => {
      const [{ n }] = await SELECT.from(Rentals).columns('count(*) as n').where({ customer_ID: req.data.ID });
      if (n) return req.reject(409, 'This customer has rentals that must be retained. The customer cannot be deleted.');
    });

    // ========== LOCATIONS (FR-010) ==========
    this.before('DELETE', 'Locations', async req => {
      const [{ n }] = await SELECT.from(Equipment).columns('count(*) as n').where({ location_ID: req.data.ID });
      if (n) return req.reject(409, 'Equipment is still assigned to this location. Transfer it first.');
    });

    // ========== EQUIPMENT (FR-004, FR-010, FR-011, FR-013) ==========
    this.before(['CREATE', 'UPDATE'], 'Equipment', async req => {
      const d = req.data;
      if (d.rentalRatePerDay != null && d.rentalRatePerDay < 0) req.error(400, 'Rental rate cannot be negative', 'rentalRatePerDay');
      if (d.purchaseDate && d.purchaseDate > today()) req.error(400, 'Purchase date cannot be in the future', 'purchaseDate');
      if (d.location_ID && !(await SELECT.one.from(Locations).columns('ID').where({ ID: d.location_ID })))
        req.error(400, 'Location does not exist', 'location_ID');
      if (d.serialNumber) {
        const dup = await SELECT.one.from(Equipment).columns('ID').where({ serialNumber: d.serialNumber, ID: { '!=': d.ID || '' } });
        if (dup) req.error(409, `Serial number ${d.serialNumber} is already registered`, 'serialNumber');
      }
    });
    this.before('DELETE', 'Equipment', async req => {
      const [{ n }] = await SELECT.from(RentalItems).columns('count(*) as n').where({ equipment_ID: req.data.ID });
      if (n) return req.reject(409, 'This equipment has rental history that must be retained. Retire it instead of deleting it.');
    });

    // action results are read through the service, so price data stays hidden from YardWorker
    this.on('transferLocation', 'Equipment', async req => {
      const ID = idOf(req.params[0]);
      await equipmentLib.transfer(req, ID, req.data.toLocation, req.data.reason);
      return reload(S.Equipment, ID);
    });

    this.on('quarantine', 'Equipment', async req => {
      const ID = idOf(req.params[0]);
      if (!req.data.reason) return req.reject(400, 'Please give a reason for the quarantine');
      await equipmentLib.changeStatus(req, ID, 'Quarantined', req.data.reason);
      return reload(S.Equipment, ID);
    });

    this.on('releaseQuarantine', 'Equipment', async req => {          // Technician: release after repair
      const ID = idOf(req.params[0]);
      const [{ n: open }] = await SELECT.from(DamageRecords).columns('count(*) as n')
        .where({ 'conditionLog.equipment_ID': ID, damageStatus: { in: ['Reported', 'Confirmed', 'Billed', 'In Repair'] } });
      if (open) return req.reject(409, `This equipment still has ${open} open damage(s). Complete the repair job first.`);
      const [{ n: jobs }] = await SELECT.from(MaintenanceRecords).columns('count(*) as n')
        .where({ equipment_ID: ID, status: 'In Progress' });
      if (jobs) return req.reject(409, 'A maintenance job is still in progress for this equipment');
      await equipmentLib.changeStatus(req, ID, 'Available', req.data.remarks);
      return reload(S.Equipment, ID);
    });

    this.on('retireEquipment', 'Equipment', async req => {
      const ID = idOf(req.params[0]);
      if (!req.data.reason) return req.reject(400, 'Please give a reason for retiring the equipment');
      await equipmentLib.changeStatus(req, ID, 'Retired', req.data.reason);
      return reload(S.Equipment, ID);
    });

    // ========== RENTALS (FR-002, FR-003, FR-008, FR-009) ==========
    this.before('NEW', S.Rentals.drafts, req => {
      req.data.rentalDate ??= today();
      req.data.rentalStatus = 'Booked';
    });

    // Rental items: default rate and dates when the equipment is chosen in the draft
    this.before('PATCH', S.RentalItems.drafts, async req => {
      if (!req.data.equipment_ID) return;
      const eq = await SELECT.one.from(Equipment).columns('rentalRatePerDay').where({ ID: req.data.equipment_ID });
      if (eq) req.data.dailyRentalRate = eq.rentalRatePerDay;
    });
    this.before('NEW', S.RentalItems.drafts, async req => {
      const parentID = req.data.rental_ID;
      if (!parentID) return;
      const parent = await SELECT.one.from(S.Rentals.drafts).columns('rentalDate', 'expectedReturnDate').where({ ID: parentID });
      if (parent) { req.data.startDate ??= parent.rentalDate; req.data.endDate ??= parent.expectedReturnDate; }
      req.data.itemStatus = 'Reserved';
    });

    this.before(['CREATE', 'UPDATE'], 'Rentals', async req => {
      const d = req.data;
      if (req.event === 'CREATE') d.rentalStatus = 'Booked';
      if (d.rentalDate && d.expectedReturnDate && d.expectedReturnDate < d.rentalDate)
        return req.reject(400, 'Expected return date cannot be before the rental date', 'expectedReturnDate');
      if (d.customer_ID && !(await SELECT.one.from(Customers).columns('ID').where({ ID: d.customer_ID })))
        return req.reject(400, 'Customer does not exist', 'customer_ID');
      if (!d.items) return;
      if (req.event === 'CREATE' && !d.items.length) return req.reject(400, 'Add at least one equipment item to the rental');

      const seen = new Set();
      for (const [i, item] of d.items.entries()) {
        const target = `items[${i}]`;
        if (!item.equipment_ID) return req.reject(400, 'Choose the equipment for every item', `${target}/equipment_ID`);
        if (seen.has(item.equipment_ID)) return req.reject(400, 'The same equipment is added twice', `${target}/equipment_ID`);
        seen.add(item.equipment_ID);
        const eq = await SELECT.one.from(Equipment).where({ ID: item.equipment_ID });
        if (!eq) return req.reject(400, 'Equipment does not exist', `${target}/equipment_ID`);
        if (eq.currentStatus === 'Retired') return req.reject(409, `${eq.equipmentName} is retired`, `${target}/equipment_ID`);
        item.dailyRentalRate ??= eq.rentalRatePerDay;
        item.startDate ||= d.rentalDate;
        item.endDate ||= d.expectedReturnDate;
        item.itemStatus ||= 'Reserved';
        if (item.dailyRentalRate < 0) return req.reject(400, 'Daily rate cannot be negative', `${target}/dailyRentalRate`);
        if (item.endDate < item.startDate) return req.reject(400, 'Item end date cannot be before its start date', `${target}/endDate`);
        if (item.itemStatus === 'Cancelled') continue;
        const clash = await SELECT.one.from(RentalItems).columns('rental_ID')
          .where({
            equipment_ID: item.equipment_ID, itemStatus: { in: ['Reserved', 'Checked Out'] }, rental_ID: { '!=': d.ID || '' },
            startDate: { '<=': item.endDate }, endDate: { '>=': item.startDate }
          });
        if (clash) return req.reject(409, `${eq.equipmentName} is already booked for this period`, `${target}/equipment_ID`);
      }
      d.totalRentalAmount = rentalTotal(d.items);
    });

    // (the result of a draft activation is not the row itself, so the key is taken from req.data)
    this.after('CREATE', 'Rentals', async (_, req) => {
      await addRentalHistory(req.data.ID, null, 'Booked', req.user, 'Rental created');
      await audit('Rentals', req.data.ID, 'CREATE', req.user, { total: req.data.totalRentalAmount });
    });
    this.after('UPDATE', 'Rentals', async (_, req) => {
      if (req.data.ID) await audit('Rentals', req.data.ID, 'UPDATE', req.user, { fields: Object.keys(req.data) });
    });

    const loadRental = async req => {
      const ID = idOf(req.params[0]);
      const rental = await SELECT.one.from(Rentals).where({ ID });
      if (!rental) return req.reject(404, 'Rental not found');
      const items = await SELECT.from(RentalItems).where({ rental_ID: ID });
      return { ID, rental, items };
    };

    this.on('checkOut', 'Rentals', async req => {
      const { ID, rental, items } = await loadRental(req);
      assertTransition(req, 'Rental', rental.rentalStatus, 'Checked Out');
      const active = items.filter(i => i.itemStatus !== 'Cancelled');
      if (!active.length) return req.reject(409, 'The rental has no items to check out');
      const missing = [];
      for (const it of active) {
        const eq = await SELECT.one.from(Equipment).columns('equipmentName', 'currentStatus').where({ ID: it.equipment_ID });
        if (eq.currentStatus !== 'Available') return req.reject(409, `${eq.equipmentName} is not available (${eq.currentStatus})`);
        const log = await SELECT.one.from(ConditionLogs).columns('ID')
          .where({ rental_ID: ID, equipment_ID: it.equipment_ID, inspectionType: 'Check-Out' });
        if (!log) missing.push(eq.equipmentName);
      }
      const reason = (req.data.overrideReason || '').trim();
      if (missing.length && !reason)
        return req.reject(409, `Check-out inspection missing for: ${missing.join(', ')}. Record the inspection or give an override reason.`);
      for (const it of active) {
        await UPDATE(RentalItems).set({ itemStatus: 'Checked Out' }).where({ ID: it.ID });
        await UPDATE(Equipment).set({ currentStatus: 'Rented Out' }).where({ ID: it.equipment_ID });
      }
      await UPDATE(Rentals).set({ rentalStatus: 'Checked Out' }).where({ ID });
      await addRentalHistory(ID, rental.rentalStatus, 'Checked Out', req.user,
        missing.length ? `Override without inspection (${missing.join(', ')}): ${reason}` : 'All items inspected and handed over');
      await audit('Rentals', ID, 'CHECK_OUT', req.user, { overrideReason: reason || undefined });
      return reload(S.Rentals, ID);
    });

    this.on('returnRental', 'Rentals', async req => {
      const { ID, rental, items } = await loadRental(req);
      assertTransition(req, 'Rental', rental.rentalStatus, 'Returned');
      const returned = req.data.actualReturnDate || today();
      if (returned < rental.rentalDate) return req.reject(400, 'Return date cannot be before the rental date');
      const out = items.filter(i => i.itemStatus === 'Checked Out');
      for (const it of out) {
        const endDate = returned > it.endDate ? returned : it.endDate;       // late days are charged
        await UPDATE(RentalItems).set({ itemStatus: 'Returned', endDate }).where({ ID: it.ID });
        await UPDATE(Equipment).set({ currentStatus: 'Under Inspection' }).where({ ID: it.equipment_ID });
        it.endDate = endDate;
      }
      const total = rentalTotal(items.map(i => (out.includes(i) ? { ...i, itemStatus: 'Returned' } : i)));
      await UPDATE(Rentals).set({ rentalStatus: 'Returned', actualReturnDate: returned, totalRentalAmount: total }).where({ ID });
      const late = returned > rental.expectedReturnDate ? daysBetween(rental.expectedReturnDate, returned) - 1 : 0;
      await addRentalHistory(ID, rental.rentalStatus, 'Returned', req.user,
        late ? `Returned ${late} day(s) late` : 'Returned on time');
      await audit('Rentals', ID, 'RETURN', req.user, { actualReturnDate: returned, lateDays: late });
      return reload(S.Rentals, ID);
    });

    this.on('closeRental', 'Rentals', async req => {
      const { ID, rental, items } = await loadRental(req);
      assertTransition(req, 'Rental', rental.rentalStatus, 'Closed');
      for (const it of items.filter(i => i.itemStatus === 'Returned')) {
        const log = await SELECT.one.from(ConditionLogs).columns('ID')
          .where({ rental_ID: ID, equipment_ID: it.equipment_ID, inspectionType: 'Check-In' });
        if (!log) {
          const eq = await SELECT.one.from(Equipment).columns('equipmentName').where({ ID: it.equipment_ID });
          return req.reject(409, `Check-in inspection missing for ${eq.equipmentName}`);
        }
      }
      await UPDATE(Rentals).set({ rentalStatus: 'Closed' }).where({ ID });
      await addRentalHistory(ID, rental.rentalStatus, 'Closed', req.user, 'Rental closed');
      await audit('Rentals', ID, 'CLOSE', req.user);
      return reload(S.Rentals, ID);
    });

    this.on('cancelRental', 'Rentals', async req => {
      const { ID, rental } = await loadRental(req);
      const reason = (req.data.reason || '').trim();
      if (!reason) return req.reject(400, 'A cancellation reason is mandatory');
      assertTransition(req, 'Rental', rental.rentalStatus, 'Cancelled');
      await UPDATE(RentalItems).set({ itemStatus: 'Cancelled' }).where({ rental_ID: ID });
      await UPDATE(Rentals).set({ rentalStatus: 'Cancelled', totalRentalAmount: 0 }).where({ ID });
      await addRentalHistory(ID, rental.rentalStatus, 'Cancelled', req.user, reason);
      await audit('Rentals', ID, 'CANCEL', req.user, { reason });
      return reload(S.Rentals, ID);
    });

    this.on('checkAvailability', async req => {
      const { equipment, fromDate, toDate } = req.data;
      if (!equipment || !fromDate || !toDate) return req.reject(400, 'Equipment, from date and to date are required');
      const eq = await SELECT.one.from(Equipment).columns('currentStatus').where({ ID: equipment });
      if (!eq || eq.currentStatus === 'Retired') return false;
      const clash = await SELECT.one.from(RentalItems).columns('ID').where({
        equipment_ID: equipment, itemStatus: { in: ['Reserved', 'Checked Out'] },
        startDate: { '<=': toDate }, endDate: { '>=': fromDate }
      });
      return !clash;
    });

    // ---- Audit: master data changes ----
    for (const name of ['Customers', 'Equipment', 'Locations']) {
      this.after(['CREATE', 'UPDATE', 'DELETE'], name, async (_, req) => {
        const key = req.data?.ID;
        if (key) await audit(name, key, req.event, req.user, { fields: Object.keys(req.data || {}) });
      });
    }

    // ---- Computed fields, criticality and price hiding (YardWorker) ----
    afterRead(this, {
      Locations: async rows => {
        const list = [].concat(rows).filter(r => r?.ID);
        if (!list.length) return;
        const counts = await SELECT.from(Equipment).columns('location_ID', 'count(*) as n')
          .where({ location_ID: { in: list.map(r => r.ID) } }).groupBy('location_ID');
        for (const r of list) r.equipmentCount = counts.find(c => c.location_ID === r.ID)?.n || 0;
      },

      Equipment: async rows => {
        const pairs = await withSource(rows, Equipment, ['location_ID']);
        if (!pairs.length) return;
        const ids = pairs.map(([r]) => r.ID);
        const recs = await SELECT.from(MaintenanceRecords)
          .columns('equipment_ID', 'status', 'maintenanceDate', 'nextMaintenanceDate')
          .where({ equipment_ID: { in: ids }, status: { in: ['Scheduled', 'In Progress', 'Completed'] } });
        // custodian: the customer who has the equipment, otherwise the location
        const out = await SELECT.from(RentalItems, i => { i.equipment_ID, i.rental(r => { r.customer(c => { c.companyName; }); }); })
          .where({ equipment_ID: { in: ids }, itemStatus: 'Checked Out' });
        const locs = await SELECT.from(Locations).columns('ID', 'locationName')
          .where({ ID: { in: pairs.map(([, src]) => src.location_ID).filter(Boolean) } });
        for (const [r, src] of pairs) {
          r.custodian = out.find(o => o.equipment_ID === r.ID)?.rental?.customer?.companyName
            || locs.find(l => l.ID === src.location_ID)?.locationName || null;
          const mine = recs.filter(m => m.equipment_ID === r.ID);
          const open = mine.filter(m => m.status !== 'Completed').map(m => m.maintenanceDate).sort();
          const next = mine.filter(m => m.status === 'Completed' && m.nextMaintenanceDate).map(m => m.nextMaintenanceDate).sort();
          r.nextServiceDate = open[0] || next[next.length - 1] || null;
        }
      },

      Rentals: async rows => {                                              // FR-009: delayed returns
        const now = today();
        for (const [r, src] of await withSource(rows, Rentals, ['rentalStatus', 'expectedReturnDate', 'actualReturnDate'])) {
          if (!src.rentalStatus || !src.expectedReturnDate) continue;
          const end = src.actualReturnDate || (src.rentalStatus === 'Checked Out' ? now : null);
          const late = end && end > src.expectedReturnDate ? daysBetween(src.expectedReturnDate, end) - 1 : 0;
          r.isOverdue = src.rentalStatus === 'Checked Out' && late > 0;
          r.overdueDays = late;
        }
      },

      RentalItems: async rows => {
        for (const [r, src] of await withSource(rows, RentalItems, ['startDate', 'endDate', 'dailyRentalRate']))
          if (src.startDate && src.endDate) Object.assign(r, lineAmount(src));
      }
    });

    return super.init();
  }
};
