// Equipment location and status changes shared by the Fiori app and the mobile app (FR-010, FR-011)
const cds = require('@sap/cds');
const { nowISO, audit } = require('./common');
const { assertTransition } = require('./status-matrix');

async function transfer(req, equipmentID, toLocationID, reason) {
  const { Equipment, Locations, LocationTransfers } = cds.entities('ret');
  const eq = await SELECT.one.from(Equipment).where({ ID: equipmentID });
  if (!eq) return req.reject(404, 'Equipment not found');
  if (!toLocationID) return req.reject(400, 'Please choose the target location');
  if (['Rented Out', 'Retired'].includes(eq.currentStatus))
    return req.reject(409, `Equipment that is ${eq.currentStatus} cannot be transferred`);
  const to = await SELECT.one.from(Locations).columns('ID').where({ ID: toLocationID });
  if (!to) return req.reject(400, 'Target location does not exist');
  if (eq.location_ID === toLocationID) return req.reject(409, 'Equipment is already at this location');

  await UPDATE(Equipment).set({ location_ID: toLocationID }).where({ ID: equipmentID });
  await INSERT.into(LocationTransfers).entries({
    equipment_ID: equipmentID, fromLocation_ID: eq.location_ID, toLocation_ID: toLocationID,
    transferDate: nowISO(), transferredBy: req.user.id, reason
  });
  await audit('Equipment', equipmentID, 'TRANSFER', req.user, { from: eq.location_ID, to: toLocationID, reason });
  return { ...eq, location_ID: toLocationID };
}

async function changeStatus(req, equipmentID, to, remarks) {
  const { Equipment } = cds.entities('ret');
  const eq = await SELECT.one.from(Equipment).columns('ID', 'currentStatus').where({ ID: equipmentID });
  if (!eq) return req.reject(404, 'Equipment not found');
  assertTransition(req, 'Equipment', eq.currentStatus, to);
  await UPDATE(Equipment).set({ currentStatus: to }).where({ ID: equipmentID });
  await audit('Equipment', equipmentID, 'STATUS_CHANGE', req.user, { from: eq.currentStatus, to, remarks });
  return { ...eq, currentStatus: to };
}

module.exports = { transfer, changeStatus };
