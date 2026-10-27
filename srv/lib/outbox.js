// Outbox: every posting to S/4HANA is stored first and sent by the worker,
// so postings survive outages and are sent exactly once (idempotency key).
const cds = require('@sap/cds');
const s4 = require('./s4-client');
const { nowISO, audit, addBillHistory } = require('./common');
const LOG = cds.log('outbox');

const MAX_ATTEMPTS = 5;
const MASK = /("(?:email|phone|contactPerson|address|CustomerName|EmailAddress)"\s*:\s*")[^"]*(")/gi;

const maskPayload = payload => String(payload || '').replace(MASK, '$1***$2').slice(0, 1000);

async function enqueue({ messageType, interfaceId, targetEntity, targetKey, payload }) {
  const { OutboxMessages } = cds.entities('ret');
  const idempotencyKey = `${messageType}:${targetKey}`;
  const existing = await SELECT.one.from(OutboxMessages).columns('ID').where({ idempotencyKey });
  if (existing) return existing.ID;          // already queued: never post twice
  const ID = cds.utils.uuid();
  await INSERT.into(OutboxMessages).entries({
    ID, messageType, interfaceId, destination: s4.destination(), targetEntity, targetKey,
    idempotencyKey, payload: JSON.stringify(payload), status: 'Pending', attempts: 0
  });
  return ID;
}

// After a successful send, write the result back to the business object
async function applyResult(msg, ref) {
  const { RepairBills, DamageRecords } = cds.entities('ret');
  if (msg.messageType === 'DEBIT_MEMO_REQUEST') {
    const bill = await SELECT.one.from(RepairBills).where({ ID: msg.targetKey });
    if (bill && bill.billingStatus === 'Approved') {
      await UPDATE(RepairBills).set({ billingStatus: 'Posted', s4BillingDocumentId: ref }).where({ ID: bill.ID });
      await addBillHistory(bill.ID, 'Approved', 'Posted', bill.totalAmount, { id: 'system' }, `Debit memo request ${ref} created in S/4HANA`);
      if (bill.damage_ID) await UPDATE(DamageRecords).set({ damageStatus: 'Billed' })
        .where({ ID: bill.damage_ID, damageStatus: 'Confirmed' });
    }
  }
}

async function processOne(msg) {
  const { OutboxMessages } = cds.entities('ret');
  try {
    const { ref } = await s4.send(msg.messageType, JSON.parse(msg.payload || '{}'), msg.idempotencyKey);
    await UPDATE(OutboxMessages).set({
      status: 'Sent', attempts: msg.attempts + 1, responseRef: ref, lastError: null, processedAt: nowISO()
    }).where({ ID: msg.ID });
    await applyResult(msg, ref);
    return true;
  } catch (e) {
    LOG.warn(`posting ${msg.messageType} ${msg.targetKey} failed: ${e.message}`);
    await UPDATE(OutboxMessages).set({
      status: 'Failed', attempts: msg.attempts + 1, lastError: String(e.message).slice(0, 1000), processedAt: nowISO()
    }).where({ ID: msg.ID });
    return false;
  }
}

// Sends pending messages and retries failed ones (up to MAX_ATTEMPTS)
async function processPending(limit = 50) {
  const { OutboxMessages } = cds.entities('ret');
  const due = await SELECT.from(OutboxMessages)
    .where({ status: { in: ['Pending', 'Failed'] }, attempts: { '<': MAX_ATTEMPTS } })
    .orderBy('createdAt').limit(limit);
  let sent = 0;
  for (const msg of due) if (await processOne(msg)) sent++;
  return { processed: due.length, sent, failed: due.length - sent };
}

async function retry(ID, user) {
  const { OutboxMessages } = cds.entities('ret');
  const msg = await SELECT.one.from(OutboxMessages).where({ ID });
  if (!msg) return null;
  if (msg.status === 'Sent') return msg;
  await processOne(msg);
  await audit('OutboxMessages', ID, 'RETRY', user);
  return SELECT.one.from(OutboxMessages).where({ ID });
}

module.exports = { enqueue, processPending, retry, maskPayload, MAX_ATTEMPTS };
