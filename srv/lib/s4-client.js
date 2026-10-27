// Calls to the SAP S/4HANA backend through the SAP Destination service (INT-04, INT-06, INT-07).
// While "simulate" is true (default for local development) the calls are answered locally,
// so the whole flow can be tested without a backend system.
const cds = require('@sap/cds');
const crypto = require('crypto');
const LOG = cds.log('s4');

const API = {
  MAINT_NOTIFICATION: { method: 'POST', path: '/API_MAINTNOTIFICATION/MaintenanceNotification', ref: 'MaintenanceNotification', prefix: '1' },
  DEBIT_MEMO_REQUEST: { method: 'POST', path: '/API_DEBIT_MEMO_REQUEST_SRV/A_DebitMemoRequest', ref: 'DebitMemoRequest', prefix: '9' }
};

const config = () => cds.env.requires.HANA_S4 || { simulate: true };
const destination = () => config().credentials?.destination || 'HANA_DEV';

function simulatedNumber(prefix, key) {
  const digits = parseInt(crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 8), 16) % 1e8;
  return prefix + String(digits).padStart(9, '0');
}

async function send(messageType, payload, idempotencyKey) {
  const api = API[messageType];
  if (!api) throw new Error(`Unknown message type ${messageType}`);
  if (config().simulate !== false) {
    if (process.env.S4_SIMULATE_OUTAGE === 'true') throw new Error(`Destination ${destination()} is not reachable (simulated outage)`);
    const ref = simulatedNumber(api.prefix, idempotencyKey);
    LOG.info(`simulated ${messageType} -> ${ref}`);
    return { ref, simulated: true };
  }
  const s4 = await cds.connect.to('HANA_S4');
  const res = await s4.send({ method: api.method, path: api.path, data: payload, headers: { 'Content-Type': 'application/json' } });
  const body = res?.d || res || {};
  return { ref: body[api.ref] || body.ID || null, simulated: false };
}

// INT-07: read the billing document status for posted debit memo requests
async function billingStatus(debitMemoRequest) {
  if (config().simulate !== false) {
    return { billingDocument: simulatedNumber('90', debitMemoRequest), status: 'Billed', simulated: true };
  }
  const s4 = await cds.connect.to('HANA_S4');
  const res = await s4.send({
    method: 'GET',
    path: `/API_BILLING_DOCUMENT_SRV/A_BillingDocumentItem?$filter=ReferenceSDDocument eq '${encodeURIComponent(debitMemoRequest)}'&$top=1`
  });
  const row = (res?.d?.results || res?.value || [])[0];
  return row ? { billingDocument: row.BillingDocument, status: 'Billed' } : { billingDocument: null, status: 'Posted' };
}

module.exports = { send, billingStatus, destination };
