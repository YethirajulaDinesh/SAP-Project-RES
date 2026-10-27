const cds = require('@sap/cds');
const { idOf, today, withSource, afterRead, audit } = require('./lib/common');
const { assertTransition } = require('./lib/status-matrix');
const inspection = require('./lib/inspection');
const photos = require('./lib/photos');

module.exports = class MaintenanceManagementService extends cds.ApplicationService {
  async init() {
    const { MaintenanceRecords, Equipment, DamageRecords } = cds.entities('ret');
    const S = this.entities;
    const reload = (entity, ID) => this.run(SELECT.one.from(entity).where({ ID }));

    // ========== MAINTENANCE RECORDS (FR-012, FR-013) ==========
    this.before('NEW', S.MaintenanceRecords.drafts, req => {
      req.data.maintenanceDate ??= today();
      req.data.status = 'Scheduled';
    });
    this.before(['CREATE', 'UPDATE'], 'MaintenanceRecords', async req => {
      const d = req.data;
      if (req.event === 'CREATE') d.status = 'Scheduled';
      if (d.cost != null && d.cost < 0) req.error(400, 'Cost cannot be negative', 'cost');
      if (d.nextMaintenanceDate && d.maintenanceDate && d.nextMaintenanceDate < d.maintenanceDate)
        req.error(400, 'Next maintenance date cannot be before the maintenance date', 'nextMaintenanceDate');
      if (d.equipment_ID && !(await SELECT.one.from(Equipment).columns('ID').where({ ID: d.equipment_ID })))
        req.error(400, 'Equipment does not exist', 'equipment_ID');
    });
    this.after(['CREATE', 'UPDATE'], 'MaintenanceRecords', async (_, req) => {
      if (req.data.ID) await audit('MaintenanceRecords', req.data.ID, req.event, req.user, { fields: Object.keys(req.data) });
    });
    const loadJob = async req => {
      const ID = idOf(req.params[0]);
      const job = await SELECT.one.from(MaintenanceRecords).where({ ID });
      if (!job) return req.reject(404, 'Maintenance record not found');
      return { ID, job };
    };
    const openDamageFilter = (equipmentID, statuses) =>
      ({ 'conditionLog.equipment_ID': equipmentID, damageStatus: { in: statuses } });

    this.on('startWork', 'MaintenanceRecords', async req => {         // Repair Jobs: assign technician
      const { ID, job } = await loadJob(req);
      assertTransition(req, 'Maintenance', job.status, 'In Progress');
      const eq = await SELECT.one.from(Equipment).columns('currentStatus').where({ ID: job.equipment_ID });
      if (eq.currentStatus === 'Rented Out') return req.reject(409, 'The equipment is rented out. Work can start after its return.');
      await UPDATE(MaintenanceRecords).set({ status: 'In Progress', serviceProvider: req.data.serviceProvider || job.serviceProvider }).where({ ID });
      if (eq.currentStatus !== 'Retired') await UPDATE(Equipment).set({ currentStatus: 'In Maintenance' }).where({ ID: job.equipment_ID });
      if (job.maintenanceType === 'Repair')
        await UPDATE(DamageRecords).set({ damageStatus: 'In Repair' }).where(openDamageFilter(job.equipment_ID, ['Confirmed', 'Billed']));
      await audit('MaintenanceRecords', ID, 'START', req.user, req.data);
      return reload(S.MaintenanceRecords, ID);
    });

    this.on('completeWork', 'MaintenanceRecords', async req => {
      const { ID, job } = await loadJob(req);
      assertTransition(req, 'Maintenance', job.status, 'Completed');
      const { cost, nextMaintenanceDate, remarks } = req.data;
      if (cost != null && cost < 0) return req.reject(400, 'Cost cannot be negative');
      if (nextMaintenanceDate && nextMaintenanceDate < job.maintenanceDate)
        return req.reject(400, 'Next maintenance date cannot be before the maintenance date');
      await UPDATE(MaintenanceRecords).set({
        status: 'Completed', cost: cost ?? job.cost, nextMaintenanceDate: nextMaintenanceDate || job.nextMaintenanceDate,
        description: remarks ? `${job.description || ''} | Done: ${remarks}`.slice(0, 500) : job.description
      }).where({ ID });
      if (job.maintenanceType === 'Repair')
        await UPDATE(DamageRecords).set({ damageStatus: 'Repaired' }).where(openDamageFilter(job.equipment_ID, ['Confirmed', 'Billed', 'In Repair']));
      const [{ n: openJobs }] = await SELECT.from(MaintenanceRecords).columns('count(*) as n')
        .where({ equipment_ID: job.equipment_ID, status: 'In Progress', ID: { '!=': ID } });
      const [{ n: openDamages }] = await SELECT.from(DamageRecords).columns('count(*) as n')
        .where(openDamageFilter(job.equipment_ID, ['Reported', 'Confirmed', 'Billed', 'In Repair']));
      const eq = await SELECT.one.from(Equipment).columns('currentStatus').where({ ID: job.equipment_ID });
      if (!openJobs && !openDamages && ['In Maintenance', 'Damaged'].includes(eq.currentStatus))
        await UPDATE(Equipment).set({ currentStatus: 'Available' }).where({ ID: job.equipment_ID });
      await audit('MaintenanceRecords', ID, 'COMPLETE', req.user, req.data);
      return reload(S.MaintenanceRecords, ID);
    });

    this.on('cancelWork', 'MaintenanceRecords', async req => {
      const { ID, job } = await loadJob(req);
      if (!req.data.reason) return req.reject(400, 'A reason is mandatory');
      assertTransition(req, 'Maintenance', job.status, 'Cancelled');
      await UPDATE(MaintenanceRecords).set({ status: 'Cancelled', description: `${job.description || ''} | Cancelled: ${req.data.reason}`.slice(0, 500) }).where({ ID });
      await audit('MaintenanceRecords', ID, 'CANCEL', req.user, req.data);
      return reload(S.MaintenanceRecords, ID);
    });

    this.on('getUpcomingMaintenance', async req => {
      const from = today();
      const to = new Date(Date.now() + (req.data.days || 30) * 86400000).toISOString().slice(0, 10);
      const rows = await SELECT.from(S.MaintenanceRecords).where(
        `(status in ('Scheduled','In Progress') and maintenanceDate >= '${from}' and maintenanceDate <= '${to}')
         or (status = 'Completed' and nextMaintenanceDate >= '${from}' and nextMaintenanceDate <= '${to}')`);
      return rows.sort((a, b) => (a.nextMaintenanceDate || a.maintenanceDate).localeCompare(b.nextMaintenanceDate || b.maintenanceDate));
    });
    this.on('getOverdueMaintenance', async () => {
      const now = today();
      return SELECT.from(S.MaintenanceRecords)
        .where({ status: { in: ['Scheduled', 'In Progress'] }, maintenanceDate: { '<': now } }).orderBy('maintenanceDate');
    });
    this.on('getInspectionHistory', async req =>
      SELECT.from(S.ConditionLogs).where({ equipment_ID: req.data.equipment }).orderBy('inspectionDate desc'));

    // ========== CONDITION LOGS (FR-005, FR-014, FR-015) ==========
    this.before('NEW', S.ConditionLogs.drafts, req => {
      req.data.inspectionDate ??= new Date().toISOString();
      req.data.inspectorName ??= req.user.id;
    });
    this.before('CREATE', 'ConditionLogs', req => inspection.prepare(req, req.data));
    this.after('CREATE', 'ConditionLogs', (_, req) => inspection.apply(req.data, req.user));
    this.before(['UPDATE', 'DELETE'], 'ConditionLogs', req =>
      req.reject(403, 'Inspections cannot be changed once saved (evidence integrity)'));

    // Damage photo evidence (inside the inspection draft)
    photos.register(this, S.DamagePhotos);

    // ---- Price data hidden from YardWorker ----
    afterRead(this, {
      MaintenanceRecords: async rows => {
        const now = today();
        for (const [r, src] of await withSource(rows, MaintenanceRecords, ['status', 'maintenanceDate']))
          if (src.status && src.maintenanceDate) r.isOverdue = ['Scheduled', 'In Progress'].includes(src.status) && src.maintenanceDate < now;
      }
    });

    return super.init();
  }
};
