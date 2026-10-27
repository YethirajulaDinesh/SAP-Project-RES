const cds = require('@sap/cds');
const outbox = require('./lib/outbox');
const s4 = require('./lib/s4-client');
const { idOf, audit, addBillHistory, afterRead } = require('./lib/common');

module.exports = class AdminService extends cds.ApplicationService {
  async init() {
    const { RepairBills, DamageRecords, OutboxMessages } = cds.entities('ret');

    // ========== CONFIGURATION ==========
    this.before(['CREATE', 'UPDATE'], 'DamageCatalogue', req => {
      if (req.data.standardCost != null && req.data.standardCost < 0) req.error(400, 'Standard cost cannot be negative', 'standardCost');
    });
    const NUMERIC = ['TAX_RATE_PCT', 'AUTO_APPROVAL_LIMIT', 'MIN_DAMAGE_PHOTOS', 'MAX_PHOTO_MB'];
    this.before(['CREATE', 'UPDATE'], 'Settings', req => {
      const { code, value } = req.data;
      if (code && NUMERIC.includes(code) && value != null && (Number.isNaN(Number(value)) || Number(value) < 0))
        req.error(400, `${code} must be a number that is zero or more`, 'value');
    });
    for (const name of ['DamageCatalogue', 'Settings']) {
      this.after(['CREATE', 'UPDATE', 'DELETE'], name, async (_, req) => {
        const key = req.data?.ID || req.data?.code;
        if (key) await audit(name, key, req.event, req.user, req.data);
      });
    }

    // ========== INTEGRATION MONITOR ==========
    this.on('retry', 'OutboxMessages', async req => {
      const ID = idOf(req.params[0]);
      if (!(await outbox.retry(ID, req.user))) return req.reject(404, 'Message not found');
      return this.run(SELECT.one.from(this.entities.OutboxMessages).where({ ID }));
    });

    this.on('processOutbox', async req => {
      const result = await outbox.processPending();
      await audit('OutboxMessages', '-', 'PROCESS', req.user, result);
      return result;
    });

    this.on('syncBillingStatus', async req => {
      const posted = await SELECT.from(RepairBills).where({ billingStatus: 'Posted', s4BillingDocumentId: { '!=': null } });
      let billed = 0;
      for (const bill of posted) {
        const res = await s4.billingStatus(bill.s4BillingDocumentId);
        if (res.status !== 'Billed') continue;
        await UPDATE(RepairBills).set({ billingStatus: 'Billed', s4BillingDocumentId: res.billingDocument || bill.s4BillingDocumentId })
          .where({ ID: bill.ID });
        await addBillHistory(bill.ID, 'Posted', 'Billed', bill.totalAmount, { id: 'system' }, `Billing document ${res.billingDocument} created in S/4HANA`);
        if (bill.damage_ID) await UPDATE(DamageRecords).set({ damageStatus: 'Billed' }).where({ ID: bill.damage_ID, damageStatus: 'Confirmed' });
        billed++;
      }
      await audit('RepairBills', '-', 'SYNC_BILLING_STATUS', req.user, { checked: posted.length, billed });
      return { checked: posted.length, billed };
    });

    afterRead(this, {
      OutboxMessages: async rows => {                                    // Integration Monitor: masked payload
        const list = [].concat(rows).filter(r => r?.ID);
        if (!list.length) return;
        const payloads = await SELECT.from(OutboxMessages).columns('ID', 'payload').where({ ID: { in: list.map(r => r.ID) } });
        for (const r of list) r.maskedPayload = outbox.maskPayload(payloads.find(p => p.ID === r.ID)?.payload);
      }
    });

    return super.init();
  }
};
