// Inspection (condition log) rules shared by the Fiori app and the mobile app (FR-005, FR-014, FR-015)
const cds = require('@sap/cds');
const { nowISO, audit } = require('./common');

const GRADES = ['A', 'B', 'C', 'D'];
const TYPES = ['Check-Out', 'Check-In', 'Periodic', 'Post-Repair'];
const SEVERITIES = ['Minor', 'Moderate', 'Major', 'Critical'];

// Validates and completes a new condition log (with its damages) before it is saved
async function prepare(req, d) {
  const { Equipment, Rentals, RentalItems, ConditionLogs, DamageRecords } = cds.entities('ret');
  if (!TYPES.includes(d.inspectionType)) return req.reject(400, `Inspection type must be one of ${TYPES.join(', ')}`, 'inspectionType');
  if (!GRADES.includes(d.conditionGrade)) return req.reject(400, 'Condition grade must be A, B, C or D', 'conditionGrade');

  const eq = await SELECT.one.from(Equipment).where({ ID: d.equipment_ID });
  if (!eq) return req.reject(400, 'Equipment does not exist', 'equipment_ID');
  if (eq.currentStatus === 'Retired') return req.reject(409, 'Retired equipment cannot be inspected', 'equipment_ID');

  if (['Check-Out', 'Check-In'].includes(d.inspectionType)) {
    if (!d.rental_ID) return req.reject(400, `A ${d.inspectionType} inspection needs a rental`, 'rental_ID');
    const rental = await SELECT.one.from(Rentals).where({ ID: d.rental_ID });
    if (!rental) return req.reject(400, 'Rental does not exist', 'rental_ID');
    const item = await SELECT.one.from(RentalItems).where({ rental_ID: d.rental_ID, equipment_ID: d.equipment_ID });
    if (!item) return req.reject(400, 'This equipment is not part of the selected rental', 'equipment_ID');
    if (d.inspectionType === 'Check-Out' && rental.rentalStatus !== 'Booked')
      return req.reject(409, 'Check-out inspections are only possible for booked rentals', 'rental_ID');
    if (d.inspectionType === 'Check-In' && !['Checked Out', 'Returned'].includes(rental.rentalStatus))
      return req.reject(409, 'Check-in inspections are only possible for rentals that are out or returned', 'rental_ID');
  }

  if (d.meterReading != null) {
    if (d.meterReading < 0) return req.reject(400, 'Meter reading cannot be negative', 'meterReading');
    const [last] = await SELECT.from(ConditionLogs).columns('meterReading')
      .where({ equipment_ID: d.equipment_ID, meterReading: { '!=': null } }).orderBy('inspectionDate desc').limit(1);
    if (last && Number(d.meterReading) < Number(last.meterReading))
      return req.reject(400, `Meter reading cannot be lower than the last reading (${last.meterReading})`, 'meterReading');
  }

  d.inspectionDate ??= nowISO();
  d.inspectorName ||= req.user.id;

  // Damages: validate, and decide liability (new damage is billed, pre-existing damage is not)
  let preExisting = [];
  if (d.inspectionType === 'Check-In' && d.rental_ID) {
    preExisting = (await SELECT.from(DamageRecords).columns('damageType')
      .where({ 'conditionLog.rental_ID': d.rental_ID, 'conditionLog.equipment_ID': d.equipment_ID, 'conditionLog.inspectionType': 'Check-Out' }))
      .map(r => r.damageType);
  }
  for (const dmg of d.damages || []) {
    if (!dmg.damageType) return req.reject(400, 'Every damage needs a damage type');
    if (!SEVERITIES.includes(dmg.severity)) return req.reject(400, `Severity must be one of ${SEVERITIES.join(', ')}`);
    if (dmg.repairEstimate != null && dmg.repairEstimate < 0) return req.reject(400, 'Repair estimate cannot be negative');
    dmg.damageStatus = 'Reported';
    if (d.inspectionType === 'Check-Out') {
      dmg.customerLiable = false; dmg.liabilityNote = 'Recorded at check-out (pre-existing)';
    } else if (preExisting.includes(dmg.damageType)) {
      dmg.customerLiable = false; dmg.liabilityNote = 'Same damage was recorded at check-out (pre-existing)';
    } else if (!d.rental_ID) {
      dmg.customerLiable = false; dmg.liabilityNote ||= 'Found outside a rental (internal)';
    } else {
      dmg.customerLiable ??= true;
    }
  }
  return eq;
}

// Equipment status follows the inspection result
async function apply(log, user) {
  const { Equipment } = cds.entities('ret');
  const eq = await SELECT.one.from(Equipment).columns('ID', 'currentStatus').where({ ID: log.equipment_ID });
  if (!eq) return;
  const damaged = (log.damages || []).length > 0;
  let next = null;
  if (log.inspectionType === 'Check-In' && ['Rented Out', 'Under Inspection'].includes(eq.currentStatus))
    next = log.conditionGrade === 'D' ? 'Quarantined' : damaged ? 'Damaged' : 'Available';
  else if (log.inspectionType === 'Post-Repair' && ['In Maintenance', 'Damaged', 'Quarantined'].includes(eq.currentStatus))
    next = damaged || log.conditionGrade === 'D' ? 'Damaged' : 'Available';
  else if (log.inspectionType === 'Periodic' && damaged && eq.currentStatus === 'Available')
    next = 'Damaged';
  if (next && next !== eq.currentStatus) await UPDATE(Equipment).set({ currentStatus: next }).where({ ID: eq.ID });
  await audit('ConditionLogs', log.ID, 'INSPECTION', user, {
    type: log.inspectionType, grade: log.conditionGrade, damages: (log.damages || []).length, equipmentStatus: next || eq.currentStatus
  });
}

module.exports = { GRADES, TYPES, SEVERITIES, prepare, apply };
