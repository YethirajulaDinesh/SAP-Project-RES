const cds = require('@sap/cds');
const inspection = require('./lib/inspection');
const photos = require('./lib/photos');
const equipmentLib = require('./lib/equipment');
const { audit } = require('./lib/common');

module.exports = class MobileService extends cds.ApplicationService {
  async init() {
    const { Equipment, Locations, RentalItems, Rentals, Customers, ConditionLogs, DamageRecords, DamagePhotos } = cds.entities('ret');

    const scan = async (req, code) => {
      const c = String(code || '').trim();
      if (!c) return req.reject(400, 'Scan or type a serial number');
      const eq = await SELECT.one.from(Equipment).where({ serialNumber: c })
        || (/^[0-9a-f-]{36}$/i.test(c) && await SELECT.one.from(Equipment).where({ ID: c }));
      if (!eq) return req.reject(404, `No equipment found for "${c}"`);
      const loc = await SELECT.one.from(Locations).columns('locationName').where({ ID: eq.location_ID });
      const item = await SELECT.one.from(RentalItems).columns('rental_ID')
        .where({ equipment_ID: eq.ID, itemStatus: { in: ['Reserved', 'Checked Out', 'Returned'] } }).orderBy('startDate desc');
      const rental = item && await SELECT.one.from(Rentals).where({ ID: item.rental_ID, rentalStatus: { in: ['Booked', 'Checked Out', 'Returned'] } });
      const customer = rental && await SELECT.one.from(Customers).columns('companyName').where({ ID: rental.customer_ID });
      const [last] = await SELECT.from(ConditionLogs).where({ equipment_ID: eq.ID }).orderBy('inspectionDate desc').limit(1);
      const [{ n: openDamages }] = await SELECT.from(DamageRecords).columns('count(*) as n')
        .where({ 'conditionLog.equipment_ID': eq.ID, damageStatus: { in: ['Reported', 'Confirmed', 'Billed', 'In Repair'] } });
      return {
        equipmentID: eq.ID, equipmentName: eq.equipmentName, equipmentType: eq.equipmentType, model: eq.model,
        serialNumber: eq.serialNumber, currentStatus: eq.currentStatus, locationName: loc?.locationName,
        rentalID: rental?.ID || null, customer: customer?.companyName || null, rentalStatus: rental?.rentalStatus || null,
        expectedReturnDate: rental?.expectedReturnDate || null,
        lastGrade: last?.conditionGrade || null, lastMeterReading: last?.meterReading ?? null,
        lastInspectionDate: last?.inspectionDate || null, openDamages
      };
    };

    this.on('scanEquipment', req => scan(req, req.data.code));

    // Offline-first: the same clientRef is only saved once, so a repeated sync creates no duplicates
    this.on('submitInspection', async req => {
      const p = req.data;
      if (p.clientRef) {
        const existing = await SELECT.one.from(ConditionLogs).columns('ID', 'equipment_ID').where({ clientRef: p.clientRef });
        if (existing) {
          const dmg = await SELECT.from(DamageRecords).columns('ID').where({ conditionLog_ID: existing.ID }).orderBy('createdAt');
          const eq = await SELECT.one.from(Equipment).columns('currentStatus').where({ ID: existing.equipment_ID });
          return { conditionLogID: existing.ID, damageIDs: dmg.map(d => d.ID), duplicate: true, equipmentStatus: eq?.currentStatus };
        }
      }
      const ID = cds.utils.uuid();
      const log = {
        ID, equipment_ID: p.equipmentID, rental_ID: p.rentalID || null, inspectionType: p.inspectionType,
        conditionGrade: p.conditionGrade, meterReading: p.meterReading, notes: p.notes, clientRef: p.clientRef || null,
        damages: (p.damages || []).map(d => ({
          ID: cds.utils.uuid(), damageType: d.damageType, damageDescription: d.damageDescription, severity: d.severity
        }))
      };
      await inspection.prepare(req, log);
      await INSERT.into(ConditionLogs).entries(log);
      await inspection.apply(log, req.user);
      const eq = await SELECT.one.from(Equipment).columns('currentStatus').where({ ID: p.equipmentID });
      return { conditionLogID: ID, damageIDs: log.damages.map(d => d.ID), duplicate: false, equipmentStatus: eq?.currentStatus };
    });

    this.on('uploadPhoto', async req => {
      const { damageID, fileName, mediaType, content, sha256 } = req.data;
      if (!content) return req.reject(400, 'The photo content is missing');
      const dmg = await SELECT.one.from(DamageRecords).columns('damageStatus').where({ ID: damageID });
      if (!dmg) return req.reject(404, 'Damage record not found');
      if (['Closed', 'Waived'].includes(dmg.damageStatus)) return req.reject(409, `Photos cannot be added to a ${dmg.damageStatus} damage`);
      const data = { damage_ID: damageID, fileName: fileName || 'photo.jpg', mediaType: mediaType || 'image/jpeg', photoContent: content, sha256Hash: sha256 };
      await photos.check({ data, headers: {}, reject: (...a) => req.reject(...a) });
      const dup = await SELECT.one.from(DamagePhotos).columns('ID').where({ damage_ID: damageID, sha256Hash: data.sha256Hash });
      if (dup) return { photoID: dup.ID, sha256: data.sha256Hash, duplicate: true };
      const ID = cds.utils.uuid();
      await INSERT.into(DamagePhotos).entries({ ID, ...data });
      await audit('DamagePhotos', ID, 'UPLOAD', req.user, { damageID, fileName: data.fileName, sha256: data.sha256Hash });
      return { photoID: ID, sha256: data.sha256Hash, duplicate: false };
    });

    this.on('transferEquipment', async req => {
      const { equipmentID, toLocationID, reason } = req.data;
      const eq = await equipmentLib.transfer(req, equipmentID, toLocationID, reason);
      return scan(req, eq.serialNumber);
    });

    return super.init();
  }
};
