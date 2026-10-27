const cds = require('@sap/cds');
const { idOf, nowISO, afterRead, isYardWorkerOnly, audit, addBillHistory, getSetting } = require('./lib/common');
const { assertTransition } = require('./lib/status-matrix');
const { withTax } = require('./lib/pricing');
const billing = require('./lib/billing');
const photos = require('./lib/photos');

const OUTCOMES = { Upheld: 'Charge upheld', Cancelled: 'Charge cancelled', Reassess: 'Re-assess the charge' };

module.exports = class DamageManagementService extends cds.ApplicationService {
  async init() {
    const { DamageRecords, DamagePhotos, ConditionLogs, DamageCatalogue, RepairBills } = cds.entities('ret');
    const S = this.entities;
    const reload = (entity, ID) => this.run(SELECT.one.from(entity).where({ ID }));

    // ========== DAMAGE RECORDS (FR-006, FR-016, FR-017, FR-021) ==========
    this.before('NEW', S.DamageRecords.drafts, req => {
      req.data.damageStatus = 'Reported';
      req.data.customerLiable ??= true;
    });
    this.before('EDIT', S.DamageRecords, async req => {
      const dmg = await SELECT.one.from(DamageRecords).columns('damageStatus').where({ ID: idOf(req.params[0]) });
      if (['Billed', 'Closed', 'Waived'].includes(dmg?.damageStatus))
        return req.reject(409, `A damage in status ${dmg.damageStatus} cannot be changed`);
      if (isYardWorkerOnly(req.user) && dmg?.damageStatus !== 'Reported')
        return req.reject(403, 'Yard workers can only change damages that are still reported');
    });
    this.before(['CREATE', 'UPDATE'], 'DamageRecords', async req => {
      const d = req.data;
      if (req.event === 'CREATE') {
        d.damageStatus = 'Reported';
        if (!d.conditionLog_ID) return req.reject(400, 'Choose the inspection (condition log) this damage belongs to', 'conditionLog_ID');
        if (!(await SELECT.one.from(ConditionLogs).columns('ID').where({ ID: d.conditionLog_ID })))
          return req.reject(400, 'Inspection does not exist', 'conditionLog_ID');
      }
      if (d.repairEstimate != null && d.repairEstimate < 0) req.error(400, 'Repair estimate cannot be negative', 'repairEstimate');
      if (d.repairEstimate == null && d.damageType && d.severity) {                // default from the damage catalogue
        const cat = await SELECT.one.from(DamageCatalogue).columns('standardCost')
          .where({ damageType: d.damageType, severity: d.severity, active: true });
        if (cat) d.repairEstimate = cat.standardCost;
      }
    });
    this.after(['CREATE', 'UPDATE'], 'DamageRecords', async (_, req) => {
      if (req.data.ID) await audit('DamageRecords', req.data.ID, req.event, req.user, { fields: Object.keys(req.data) });
    });
    this.on('confirmDamage', 'DamageRecords', async req => {
      const ID = idOf(req.params[0]);
      await billing.confirmDamage(req, ID);
      return reload(S.DamageRecords, ID);
    });

    this.on('waiveDamage', 'DamageRecords', async req => {         // Manager: not charged to the customer
      const ID = idOf(req.params[0]);
      const reason = (req.data.reason || '').trim();
      if (!reason) return req.reject(400, 'A reason is mandatory when a damage is waived');
      const dmg = await SELECT.one.from(DamageRecords).where({ ID });
      assertTransition(req, 'Damage', dmg.damageStatus, 'Waived');
      await UPDATE(DamageRecords).set({ damageStatus: 'Waived', customerLiable: false, liabilityNote: reason.slice(0, 255) }).where({ ID });
      const bill = await SELECT.one.from(RepairBills).where({ damage_ID: ID, billingStatus: { in: ['Pending Approval', 'Disputed'] } });
      if (bill) {
        await UPDATE(RepairBills).set({ billingStatus: 'Rejected', decisionBy: req.user.id, decisionAt: nowISO(), decisionReason: `Damage waived: ${reason}` }).where({ ID: bill.ID });
        await addBillHistory(bill.ID, bill.billingStatus, 'Rejected', bill.totalAmount, req.user, `Damage waived: ${reason}`);
      }
      await audit('DamageRecords', ID, 'WAIVE', req.user, { reason });
      return reload(S.DamageRecords, ID);
    });

    this.on('closeDamage', 'DamageRecords', async req => {
      const ID = idOf(req.params[0]);
      const dmg = await SELECT.one.from(DamageRecords).where({ ID });
      assertTransition(req, 'Damage', dmg.damageStatus, 'Closed');
      await UPDATE(DamageRecords).set({ damageStatus: 'Closed' }).where({ ID });
      await audit('DamageRecords', ID, 'CLOSE', req.user);
      return reload(S.DamageRecords, ID);
    });

    this.on('generateBill', 'DamageRecords', async req => {
      const bill = await billing.createBill(req, idOf(req.params[0]));
      return reload(S.RepairBills, bill.ID);
    });

    this.on('calculateCharge', async req => {
      const { damage, log } = await billing.loadDamage(req.data.damage);
      if (!damage) return req.reject(404, 'Damage record not found');
      return billing.preview(damage, log);
    });

    this.on('getDamageHistory', req =>
      SELECT.from(S.DamageRecords).where({ 'conditionLog.equipment_ID': req.data.equipment }).orderBy('createdAt desc'));

    // ========== DAMAGE PHOTOS (FR-018, FR-019) ==========
    photos.register(this, S.DamagePhotos);
    this.before('CREATE', 'DamagePhotos', async req => {
      if (!req.data.damage_ID) return req.reject(400, 'A photo must belong to a damage record');
      const dmg = await SELECT.one.from(DamageRecords).columns('damageStatus').where({ ID: req.data.damage_ID });
      if (!dmg) return req.reject(400, 'Damage record does not exist');
      if (['Closed', 'Waived'].includes(dmg.damageStatus)) return req.reject(409, `Photos cannot be added to a ${dmg.damageStatus} damage`);
    });
    this.before('DELETE', 'DamagePhotos', async req => {
      const photo = await SELECT.one.from(DamagePhotos).columns('damage_ID').where({ ID: req.data.ID });
      const dmg = photo && await SELECT.one.from(DamageRecords).columns('damageStatus').where({ ID: photo.damage_ID });
      if (dmg && dmg.damageStatus !== 'Reported') return req.reject(409, 'Photo evidence of a confirmed damage cannot be deleted');
    });
    this.after(['CREATE', 'UPDATE', 'DELETE'], 'DamagePhotos', async (_, req) => {
      const { ID, fileName, sha256Hash } = req.data || {};
      if (ID) await audit('DamagePhotos', ID, req.event, req.user, { fileName, sha256: sha256Hash });
    });

    // ========== REPAIR BILLS: Damage Charge Approval (FR-007, FR-025) ==========
    const loadBill = async req => {
      const ID = idOf(req.params[0]);
      const bill = await SELECT.one.from(RepairBills).where({ ID });
      if (!bill) return req.reject(404, 'Repair bill not found');
      return { ID, bill };
    };
    const decide = async (req, bill, to, reason, extra = {}) => {
      assertTransition(req, 'Bill', bill.billingStatus, to);
      await UPDATE(RepairBills).set({ billingStatus: to, decisionBy: req.user.id, decisionAt: nowISO(), decisionReason: reason, ...extra })
        .where({ ID: bill.ID });
      await addBillHistory(bill.ID, bill.billingStatus, to, extra.totalAmount ?? bill.totalAmount, req.user, reason);
      await audit('RepairBills', bill.ID, `STATUS_${to.toUpperCase().replace(/ /g, '_')}`, req.user, { reason, ...extra });
      return SELECT.one.from(RepairBills).where({ ID: bill.ID });
    };
    const mandatory = (req, text, what) => {
      const v = (text || '').trim();
      if (!v) req.reject(400, `A reason is mandatory to ${what} a charge`);
      return v;
    };

    this.on('approveCharge', 'RepairBills', async req => {
      const { bill } = await loadBill(req);
      const updated = await decide(req, bill, 'Approved', (req.data.remarks || 'Approved').trim());
      await billing.postBill(updated);                                  // INT-06 via outbox
      return reload(S.RepairBills, bill.ID);
    });

    this.on('adjustCharge', 'RepairBills', async req => {
      const { bill } = await loadBill(req);
      const reason = mandatory(req, req.data.reason, 'adjust');
      const amount = Number(req.data.newRepairAmount);
      if (!(amount > 0)) return req.reject(400, 'The new repair amount must be greater than zero');
      if (!['Pending Approval', 'Disputed'].includes(bill.billingStatus))
        return req.reject(409, `A ${bill.billingStatus} charge cannot be adjusted`);
      const amounts = withTax(amount, await getSetting('TAX_RATE_PCT', 18));
      await decide(req, bill, 'Pending Approval', `Adjusted from ${bill.repairAmount} to ${amounts.repairAmount}: ${reason}`, amounts);
      return reload(S.RepairBills, bill.ID);
    });

    this.on('rejectCharge', 'RepairBills', async req => {
      const { bill } = await loadBill(req);
      const reason = mandatory(req, req.data.reason, 'reject');
      await decide(req, bill, 'Rejected', reason);
      return reload(S.RepairBills, bill.ID);
    });

    this.on('disputeCharge', 'RepairBills', async req => {
      const { bill } = await loadBill(req);
      const reason = mandatory(req, req.data.reason, 'dispute');
      await decide(req, bill, 'Disputed', reason);
      return reload(S.RepairBills, bill.ID);
    });

    this.on('resolveDispute', 'RepairBills', async req => {
      const { bill } = await loadBill(req);
      const { outcome } = req.data;
      if (!OUTCOMES[outcome]) return req.reject(400, `Outcome must be one of ${Object.keys(OUTCOMES).join(', ')}`);
      if (bill.billingStatus !== 'Disputed') return req.reject(409, 'Only disputed charges can be resolved');
      const reason = `${OUTCOMES[outcome]}${req.data.remarks ? ': ' + req.data.remarks : ''}`;
      if (outcome === 'Cancelled') await decide(req, bill, 'Rejected', reason);
      else if (outcome === 'Reassess') await decide(req, bill, 'Pending Approval', reason);
      else {
        const updated = await decide(req, bill, bill.s4BillingDocumentId ? 'Posted' : 'Approved', reason);
        if (!bill.s4BillingDocumentId) await billing.postBill(updated);
      }
      return reload(S.RepairBills, bill.ID);
    });

    this.on('READ', 'DisputeOutcomes', () => Object.keys(OUTCOMES).map(code => ({ code })));

    // ---- Price data hidden from YardWorker ----
    afterRead(this, {
      DamageRecords: async rows => {
        const list = [].concat(rows).filter(r => r?.ID);
        if (!list.length) return;
        const counts = await SELECT.from(DamagePhotos).columns('damage_ID', 'count(*) as n')
          .where({ damage_ID: { in: list.map(r => r.ID) } }).groupBy('damage_ID');
        for (const r of list) r.photoCount = counts.find(c => c.damage_ID === r.ID)?.n || 0;
      }
    });

    return super.init();
  }
};
