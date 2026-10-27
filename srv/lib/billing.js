// Damage confirmation and automated repair billing (FR-007, FR-016, FR-017, INT-04, INT-06)
const cds = require('@sap/cds');
const pricing = require('./pricing');
const outbox = require('./outbox');
const { today, nowISO, audit, addBillHistory, getSetting } = require('./common');
const { assertTransition } = require('./status-matrix');

async function loadDamage(ID) {
  const { DamageRecords, ConditionLogs } = cds.entities('ret');
  const damage = await SELECT.one.from(DamageRecords).where({ ID });
  if (!damage) return {};
  const log = damage.conditionLog_ID ? await SELECT.one.from(ConditionLogs).where({ ID: damage.conditionLog_ID }) : null;
  return { damage, log };
}

async function pricingSettings() {
  return {
    taxRatePct: await getSetting('TAX_RATE_PCT', 18),
    autoApprovalLimit: await getSetting('AUTO_APPROVAL_LIMIT', 5000)
  };
}

// Price preview for one damage (used by the "calculate charge" function and by createBill)
async function preview(damage, log) {
  const { DamageCatalogue, RentalItems, Equipment } = cds.entities('ret');
  const cat = await SELECT.one.from(DamageCatalogue).columns('standardCost')
    .where({ damageType: damage.damageType, severity: damage.severity, active: true });
  let dailyRate = null;
  if (log?.rental_ID) {
    const item = await SELECT.one.from(RentalItems).columns('dailyRentalRate').where({ rental_ID: log.rental_ID, equipment_ID: log.equipment_ID });
    dailyRate = item?.dailyRentalRate;
  }
  if (dailyRate == null && log?.equipment_ID) {
    const eq = await SELECT.one.from(Equipment).columns('rentalRatePerDay').where({ ID: log.equipment_ID });
    dailyRate = eq?.rentalRatePerDay;
  }
  return pricing.repairCharge({
    repairEstimate: damage.repairEstimate, catalogueCost: cat?.standardCost, severity: damage.severity, dailyRate
  }, await pricingSettings());
}

async function postBill(bill) {
  const { Customers } = cds.entities('ret');
  const customer = bill.customer_ID ? await SELECT.one.from(Customers).where({ ID: bill.customer_ID }) : {};
  return outbox.enqueue({
    messageType: 'DEBIT_MEMO_REQUEST', interfaceId: 'INT-06', targetEntity: 'RepairBills', targetKey: bill.ID,
    payload: {
      DebitMemoRequestType: 'L2', SoldToParty: customer?.s4CustomerId, CustomerName: customer?.companyName,
      PurchaseOrderByCustomer: `RENTAL ${bill.rental_ID}`, DebitMemoRequestDate: bill.billDate,
      to_Item: [{ Material: 'DAMAGE-CHARGE', RequestedQuantity: '1', NetAmount: String(bill.repairAmount), TaxAmount: String(bill.taxAmount) }]
    }
  });
}

async function createBill(req, damageID) {
  const { RepairBills, Rentals } = cds.entities('ret');
  const { damage, log } = await loadDamage(damageID);
  if (!damage) return req.reject(404, 'Damage record not found');
  if (!damage.customerLiable) return req.reject(409, 'The customer is not liable for this damage, so it cannot be billed');
  if (!['Confirmed', 'In Repair', 'Repaired'].includes(damage.damageStatus))
    return req.reject(409, 'Only confirmed damages can be billed');
  if (!log?.rental_ID) return req.reject(409, 'This damage is not linked to a rental');
  const existing = await SELECT.one.from(RepairBills).columns('ID').where({ damage_ID: damageID });
  if (existing) return req.reject(409, 'A repair bill already exists for this damage');

  const rental = await SELECT.one.from(Rentals).columns('customer_ID').where({ ID: log.rental_ID });
  const charge = await preview(damage, log);
  const ID = cds.utils.uuid();
  const bill = {
    ID, rental_ID: log.rental_ID, customer_ID: rental?.customer_ID, damage_ID: damageID, billDate: today(),
    repairAmount: charge.repairAmount, taxAmount: charge.taxAmount, totalAmount: charge.totalAmount,
    billingStatus: charge.autoApprove ? 'Approved' : 'Pending Approval',
    autoApproved: charge.autoApprove,
    decisionBy: charge.autoApprove ? 'system' : null,
    decisionAt: charge.autoApprove ? nowISO() : null,
    decisionReason: charge.autoApprove ? 'Auto-approved: total is within the approval limit' : null
  };
  await INSERT.into(RepairBills).entries(bill);
  await addBillHistory(ID, null, 'Pending Approval', bill.totalAmount, req.user, `Charge calculated from ${charge.basis}`);
  if (charge.autoApprove) {
    await addBillHistory(ID, 'Pending Approval', 'Approved', bill.totalAmount, { id: 'system' }, bill.decisionReason);
    await postBill(bill);
  }
  await audit('RepairBills', ID, 'CREATE', req.user, { damage: damageID, total: bill.totalAmount, status: bill.billingStatus });
  return bill;
}

async function confirmDamage(req, damageID) {
  const { DamageRecords, DamagePhotos, Equipment, MaintenanceRecords } = cds.entities('ret');
  const { damage, log } = await loadDamage(damageID);
  if (!damage) return req.reject(404, 'Damage record not found');
  assertTransition(req, 'Damage', damage.damageStatus, 'Confirmed');

  const minPhotos = await getSetting('MIN_DAMAGE_PHOTOS', 1);
  const [{ n }] = await SELECT.from(DamagePhotos).columns('count(*) as n').where({ damage_ID: damageID });
  if (n < minPhotos) return req.reject(409, `Photo evidence is mandatory: add at least ${minPhotos} photo(s) before confirming`);

  await UPDATE(DamageRecords).set({ damageStatus: 'Confirmed' }).where({ ID: damageID });

  // Repair job for the workshop and maintenance notification for S/4HANA (INT-04)
  if (log?.equipment_ID) {
    const eq = await SELECT.one.from(Equipment).columns('currentStatus').where({ ID: log.equipment_ID });
    if (['Available', 'Under Inspection'].includes(eq?.currentStatus))
      await UPDATE(Equipment).set({ currentStatus: 'Damaged' }).where({ ID: log.equipment_ID });
    const jobID = cds.utils.uuid();
    await INSERT.into(MaintenanceRecords).entries({
      ID: jobID, equipment_ID: log.equipment_ID, maintenanceType: 'Repair', maintenanceDate: today(),
      description: `Repair ${damage.damageType} (${damage.severity}): ${damage.damageDescription || ''}`.slice(0, 500),
      cost: 0, status: 'Scheduled'
    });
    await outbox.enqueue({
      messageType: 'MAINT_NOTIFICATION', interfaceId: 'INT-04', targetEntity: 'DamageRecords', targetKey: damageID,
      payload: {
        NotificationType: 'M2', TechnicalObject: log.equipment_ID, NotificationText: `${damage.damageType} - ${damage.severity}`.slice(0, 40),
        MaintNotifLongText: damage.damageDescription, MaintPriority: { Critical: '1', Major: '2', Moderate: '3', Minor: '4' }[damage.severity]
      }
    });
  }
  await audit('DamageRecords', damageID, 'CONFIRM', req.user);

  let bill = null;
  if (damage.customerLiable && log?.rental_ID) bill = await createBill(req, damageID);
  return { damageID, bill };
}

module.exports = { preview, createBill, confirmDamage, postBill, pricingSettings, loadDamage };
