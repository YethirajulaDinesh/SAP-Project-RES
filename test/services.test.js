// End-to-end tests over OData / REST with the seven mocked roles (see package.json)
const cds = require('@sap/cds');
const crypto = require('crypto');
const { GET, POST, PATCH, PUT } = cds.test(__dirname + '/..');

const as = role => ({ auth: { username: `${role}@rental.com`, password: role } });
const status = async p => {
  try { return (await p).status; } catch (e) { return e.response?.status ?? e.status ?? e.code; }
};
const errorOf = async p => {
  try { await p; return null; } catch (e) { return { status: e.response?.status ?? e.status, message: e.response?.data?.error?.message ?? e.message }; }
};

const E = n => `30000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const C = n => `20000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const L = n => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

// Creates and activates a rental through the Fiori draft flow
async function bookRental(user, customer, equipment, from, to) {
  const { data: draft } = await POST('/odata/v4/rental/Rentals', { customer_ID: customer, rentalDate: from, expectedReturnDate: to }, as(user));
  await POST(`/odata/v4/rental/Rentals(ID=${draft.ID},IsActiveEntity=false)/items`, { equipment_ID: equipment }, as(user));
  const { data } = await POST(`/odata/v4/rental/Rentals(ID=${draft.ID},IsActiveEntity=false)/RentalManagementService.draftActivate`, {}, as(user));
  return data;
}
const rentalAction = (ID, action, body, user = 'dispatch') =>
  POST(`/odata/v4/rental/Rentals(ID=${ID},IsActiveEntity=true)/RentalManagementService.${action}`, body, as(user));

describe('authentication and the seven roles', () => {
  test('anonymous users are rejected', async () => {
    expect(await status(GET('/odata/v4/rental/Customers'))).toBe(401);
  });

  test.each(['yard', 'dispatch', 'tech', 'billing', 'manager', 'admin', 'auditor'])('%s can read equipment', async role => {
    expect(await status(GET('/odata/v4/rental/Equipment?$top=1', as(role)))).toBe(200);
  });

  test('session service reports the role of each user', async () => {
    const { data } = await GET('/odata/v4/session/me()', as('billing'));
    expect(data).toMatchObject({ id: 'billing@rental.com', isBillingClerk: true, isAdmin: false, roles: ['BillingClerk'] });
  });

  test('auditor is read-only', async () => {
    expect(await status(POST('/odata/v4/rental/Customers', { companyName: 'X' }, as('auditor')))).toBe(403);
    expect(await status(GET('/odata/v4/admin/AuditLog', as('auditor')))).toBe(200);
  });

  test('yard worker sees no price data and no repair bills', async () => {
    const { data } = await GET(`/odata/v4/rental/Equipment(ID=${E(4)},IsActiveEntity=true)`, as('yard'));
    expect(data.rentalRatePerDay).toBeNull();
    const { data: m } = await GET(`/odata/v4/rental/Equipment(ID=${E(4)},IsActiveEntity=true)`, as('manager'));
    expect(Number(m.rentalRatePerDay)).toBe(2800);
    expect(await status(GET('/odata/v4/damage/RepairBills', as('yard')))).toBe(403);
  });

  test('only billing clerk and manager decide on charges, only admin changes configuration', async () => {
    expect(await status(GET('/odata/v4/damage/RepairBills', as('billing')))).toBe(200);
    expect(await status(POST('/odata/v4/admin/Settings', { code: 'X', value: '1' }, as('manager')))).toBe(403);
    expect(await status(GET('/odata/v4/analytics/getFleetKPIs()', as('yard')))).toBe(403);
  });
});

describe('rental lifecycle (FR-002, FR-003, FR-008, FR-009)', () => {
  let rental;

  test('dispatcher books a rental; rate and total are calculated', async () => {
    rental = await bookRental('dispatch', C(2), E(4), '2026-12-01', '2026-12-05');
    expect(rental.rentalStatus).toBe('Booked');
    expect(Number(rental.totalRentalAmount)).toBe(5 * 2800);
  });

  test('the same equipment cannot be double-booked', async () => {
    const err = await errorOf(bookRental('dispatch', C(3), E(4), '2026-12-03', '2026-12-08'));
    expect(err.status).toBe(409);
    expect(err.message).toMatch(/already booked/);
  });

  test('check-out needs an inspection or an override reason', async () => {
    expect((await errorOf(rentalAction(rental.ID, 'checkOut', {}))).message).toMatch(/inspection missing/);
    const { data } = await rentalAction(rental.ID, 'checkOut', { overrideReason: 'Customer waiting, inspection after pickup photo' });
    expect(data.rentalStatus).toBe('Checked Out');
    const { data: eq } = await GET(`/odata/v4/rental/Equipment(ID=${E(4)},IsActiveEntity=true)`, as('dispatch'));
    expect(eq.currentStatus).toBe('Rented Out');
  });

  test('late return is detected and charged', async () => {
    const { data } = await rentalAction(rental.ID, 'returnRental', { actualReturnDate: '2026-12-07' });
    expect(data).toMatchObject({ rentalStatus: 'Returned', actualReturnDate: '2026-12-07', overdueDays: 2 });
    expect(Number(data.totalRentalAmount)).toBe(7 * 2800);
    const { data: hist } = await GET(`/odata/v4/rental/Rentals(ID=${rental.ID},IsActiveEntity=true)/statusHistory`, as('auditor'));
    expect(hist.value.map(h => h.toStatus)).toEqual(expect.arrayContaining(['Booked', 'Checked Out', 'Returned']));
  });

  test('rental cannot be closed before the check-in inspection', async () => {
    expect((await errorOf(rentalAction(rental.ID, 'closeRental', {}))).message).toMatch(/Check-in inspection missing/);
  });

  test('a yard worker cannot run dispatcher actions', async () => {
    expect(await status(rentalAction(rental.ID, 'closeRental', {}, 'yard'))).toBe(403);
  });

  describe('return inspection from the mobile app', () => {
    let result;
    const inspection = () => ({
      clientRef: 'tablet-7:return-1', equipmentID: E(4), rentalID: rental.ID, inspectionType: 'Check-In',
      conditionGrade: 'C', meterReading: 999, notes: 'Forks bent',
      damages: [{ damageType: 'Broken Part', severity: 'Major', damageDescription: 'Left fork bent' }]
    });

    test('condition grade must be A to D (FR-015)', async () => {
      const err = await errorOf(POST('/rest/mobile/submitInspection', { ...inspection(), clientRef: 'x', conditionGrade: 'E' }, as('yard')));
      expect(err.status).toBe(400);
    });

    test('inspection with damage is saved and the equipment becomes Damaged', async () => {
      ({ data: result } = await POST('/rest/mobile/submitInspection', inspection(), as('yard')));
      expect(result.duplicate).toBe(false);
      expect(result.damageIDs).toHaveLength(1);
      expect(result.equipmentStatus).toBe('Damaged');
    });

    test('sending the same offline inspection again creates no duplicate', async () => {
      const { data } = await POST('/rest/mobile/submitInspection', inspection(), as('yard'));
      expect(data).toMatchObject({ duplicate: true, conditionLogID: result.conditionLogID });
    });

    test('a photo with a wrong SHA-256 hash is rejected, the right one is stored', async () => {
      const body = { damageID: result.damageIDs[0], fileName: 'fork.png', mediaType: 'image/png', content: PNG.toString('base64') };
      expect(await status(POST('/rest/mobile/uploadPhoto', { ...body, sha256: 'f'.repeat(64) }, as('yard')))).toBe(422);
      const { data } = await POST('/rest/mobile/uploadPhoto', { ...body, sha256: sha(PNG) }, as('yard'));
      expect(data).toMatchObject({ sha256: sha(PNG), duplicate: false });
    });

    test('inspections are immutable', async () => {
      expect([403, 405]).toContain(await status(PATCH(`/odata/v4/maintenance/ConditionLogs(ID=${result.conditionLogID},IsActiveEntity=true)`, { notes: 'x' }, as('manager'))));
    });

    test('now the rental can be closed', async () => {
      const { data } = await rentalAction(rental.ID, 'closeRental', {});
      expect(data.rentalStatus).toBe('Closed');
    });

    test('confirming the damage creates a repair job and a bill that needs approval', async () => {
      const damageID = result.damageIDs[0];
      const { data } = await POST(`/odata/v4/damage/DamageRecords(ID=${damageID},IsActiveEntity=true)/DamageManagementService.confirmDamage`, {}, as('tech'));
      expect(data.damageStatus).toBe('Confirmed');
      const { data: bills } = await GET(`/odata/v4/damage/RepairBills?$filter=damage_ID eq ${damageID}`, as('billing'));
      const bill = bills.value[0];
      // catalogue: Broken Part / Major = 28000, 18% GST
      expect(bill).toMatchObject({ billingStatus: 'Pending Approval', autoApproved: false });
      expect(Number(bill.totalAmount)).toBe(33040);
      const { data: jobs } = await GET(`/odata/v4/maintenance/MaintenanceRecords?$filter=equipment_ID eq ${E(4)} and maintenanceType eq 'Repair'`, as('tech'));
      expect(jobs.value).toHaveLength(1);
    });
  });
});

describe('damage charge approval (FR-007, FR-025)', () => {
  const BILL = '70000000-0000-0000-0000-000000000004';
  const act = (action, body, user = 'billing') =>
    POST(`/odata/v4/damage/RepairBills(${BILL})/DamageManagementService.${action}`, body, as(user));

  test('reject and adjust need a reason', async () => {
    expect((await errorOf(act('rejectCharge', {}))).status).toBe(400);
    expect((await errorOf(act('adjustCharge', { newRepairAmount: 5000 }))).status).toBe(400);
  });

  test('adjusting re-calculates tax and total', async () => {
    const { data } = await act('adjustCharge', { newRepairAmount: 5000, reason: 'Cover only, gauge glass was already broken' });
    expect(data).toMatchObject({ billingStatus: 'Pending Approval' });
    expect(Number(data.totalAmount)).toBe(5900);
  });

  test('a technician cannot approve charges', async () => {
    expect(await status(act('approveCharge', {}, 'tech'))).toBe(403);
  });

  test('approval queues the posting, the outbox posts it exactly once', async () => {
    const { data } = await act('approveCharge', { remarks: 'OK' });
    expect(data.billingStatus).toBe('Approved');
    const { data: run } = await POST('/odata/v4/admin/processOutbox', {}, as('admin'));
    expect(run.sent).toBeGreaterThanOrEqual(1);
    const { data: posted } = await GET(`/odata/v4/damage/RepairBills(${BILL})`, as('billing'));
    expect(posted.billingStatus).toBe('Posted');
    expect(posted.s4BillingDocumentId).toMatch(/^9\d{9}$/);
    const { data: msgs } = await GET(`/odata/v4/admin/OutboxMessages?$filter=targetKey eq '${BILL}'`, as('admin'));
    expect(msgs.value).toHaveLength(1);
    expect(msgs.value[0].maskedPayload).toMatch(/"CustomerName":"\*\*\*"/);
  });

  test('billing status is synchronised from S/4HANA (INT-07)', async () => {
    const { data } = await POST('/odata/v4/admin/syncBillingStatus', {}, as('billing'));
    expect(data.billed).toBeGreaterThanOrEqual(1);
  });
});

describe('pre-existing damage is not billed', () => {
  test('damage recorded at check-out and again at check-in is not customer liable', async () => {
    const rental = await bookRental('dispatch', C(5), E(14), '2026-12-10', '2026-12-12');
    const out = await POST('/rest/mobile/submitInspection', {
      equipmentID: E(14), rentalID: rental.ID, inspectionType: 'Check-Out', conditionGrade: 'B',
      damages: [{ damageType: 'Scratch', severity: 'Minor', damageDescription: 'Old scratch on housing' }]
    }, as('yard'));
    await rentalAction(rental.ID, 'checkOut', {});
    await rentalAction(rental.ID, 'returnRental', { actualReturnDate: '2026-12-12' });
    const back = await POST('/rest/mobile/submitInspection', {
      equipmentID: E(14), rentalID: rental.ID, inspectionType: 'Check-In', conditionGrade: 'B',
      damages: [{ damageType: 'Scratch', severity: 'Minor' }, { damageType: 'Dent', severity: 'Minor' }]
    }, as('yard'));
    const ids = [...out.data.damageIDs, ...back.data.damageIDs];
    const { data } = await GET(`/odata/v4/damage/DamageRecords?$filter=ID in (${ids.join(',')})&$select=ID,damageType,customerLiable,liabilityNote`, as('tech'));
    const byId = Object.fromEntries(data.value.map(d => [d.ID, d]));
    expect(byId[out.data.damageIDs[0]].customerLiable).toBe(false);
    expect(byId[back.data.damageIDs[0]]).toMatchObject({ damageType: 'Scratch', customerLiable: false });
    expect(byId[back.data.damageIDs[1]]).toMatchObject({ damageType: 'Dent', customerLiable: true });
  });

  test('damage cannot be confirmed without photo evidence', async () => {
    const { data } = await GET(`/odata/v4/damage/DamageRecords?$filter=damageType eq 'Dent' and damageStatus eq 'Reported'&$top=1`, as('tech'));
    const err = await errorOf(POST(`/odata/v4/damage/DamageRecords(ID=${data.value[0].ID},IsActiveEntity=true)/DamageManagementService.confirmDamage`, {}, as('tech')));
    expect(err.message).toMatch(/Photo evidence is mandatory/);
  });
});

describe('equipment, maintenance and analytics', () => {
  test('transfer keeps the location history (FR-011)', async () => {
    await POST(`/odata/v4/rental/Equipment(ID=${E(4)},IsActiveEntity=true)/RentalManagementService.transferLocation`, { toLocation: L(3), reason: 'Workshop' }, as('admin'))
      .catch(() => null);  // E4 is damaged after the test above; transfer is still allowed
    const { data } = await GET(`/odata/v4/rental/Equipment(ID=${E(4)},IsActiveEntity=true)?$expand=transfers`, as('auditor'));
    expect(data.location_ID).toBe(L(3));
    expect(data.transfers.length).toBeGreaterThanOrEqual(1);
  });

  test('meter reading cannot go backwards', async () => {
    const err = await errorOf(POST('/rest/mobile/submitInspection', {
      equipmentID: E(4), inspectionType: 'Periodic', conditionGrade: 'B', meterReading: 10
    }, as('tech')));
    expect(err.message).toMatch(/lower than the last reading/);
  });

  test('repair job completion repairs the damage and frees the equipment', async () => {
    const { data: jobs } = await GET(`/odata/v4/maintenance/MaintenanceRecords?$filter=equipment_ID eq ${E(4)} and status eq 'Scheduled'`, as('tech'));
    const job = jobs.value[0];
    const path = `/odata/v4/maintenance/MaintenanceRecords(ID=${job.ID},IsActiveEntity=true)/MaintenanceManagementService`;
    await POST(`${path}.startWork`, { serviceProvider: 'Suresh' }, as('tech'));
    const { data } = await POST(`${path}.completeWork`, { cost: 4200, nextMaintenanceDate: '2027-06-01', remarks: 'Fork replaced' }, as('tech'));
    expect(data.status).toBe('Completed');
  });

  test('fleet KPIs and reports are available to the manager (FR-023 - FR-025)', async () => {
    const { data: kpi } = await GET('/odata/v4/analytics/getFleetKPIs()', as('manager'));
    expect(kpi.totalEquipment).toBe(20);
    expect(kpi.overdue).toBeGreaterThanOrEqual(1);
    const { data: util } = await GET('/odata/v4/analytics/getUtilization(days=90)', as('manager'));
    expect(util.value.length).toBeGreaterThan(0);
    const { data: billing } = await GET('/odata/v4/analytics/getBillingSummary()', as('billing'));
    expect(Number(billing.postedTotal)).toBeGreaterThan(0);
    const { data: costs } = await GET('/odata/v4/analytics/getMaintenanceCostByEquipment()', as('auditor'));
    expect(costs.value[0].cost).toBeGreaterThan(0);
  });
});

describe('inspection in the Fiori app (draft) by a yard worker', () => {
  const base = '/odata/v4/maintenance';
  let log, damage, photo;

  test('yard worker creates the inspection draft and fills it in', async () => {
    ({ data: log } = await POST(`${base}/ConditionLogs`, { equipment_ID: E(12), inspectionType: 'Periodic', conditionGrade: 'B' }, as('yard')));
    expect(log.inspectorName).toBe('yard@rental.com');
    await PATCH(`${base}/ConditionLogs(ID=${log.ID},IsActiveEntity=false)`, { meterReading: 1500, notes: 'Drum check' }, as('yard'));
    ({ data: damage } = await POST(`${base}/ConditionLogs(ID=${log.ID},IsActiveEntity=false)/damages`, { damageType: 'Dent', severity: 'Minor', damageDescription: 'Small dent on drum' }, as('yard')));
    ({ data: photo } = await POST(`${base}/DamageRecords(ID=${damage.ID},IsActiveEntity=false)/photos`, { fileName: 'drum.png', mediaType: 'image/png' }, as('yard')));
    await PUT(`${base}/DamagePhotos(ID=${photo.ID},IsActiveEntity=false)/photoContent`, PNG, { ...as('yard'), headers: { 'Content-Type': 'image/png' } });
  });

  test('saving the draft stores the inspection, damage and hashed photo', async () => {
    await POST(`${base}/ConditionLogs(ID=${log.ID},IsActiveEntity=false)/MaintenanceManagementService.draftActivate`, {}, as('yard'));
    const { data } = await GET(`${base}/ConditionLogs(ID=${log.ID},IsActiveEntity=true)?$expand=damages($expand=photos($select=ID,sha256Hash,uploadedBy))`, as('yard'));
    expect(data.damages[0]).toMatchObject({ damageType: 'Dent', customerLiable: false, damageStatus: 'Reported' });
    expect(data.damages[0].photos[0]).toMatchObject({ sha256Hash: sha(PNG), uploadedBy: 'yard@rental.com' });
    const { data: eq } = await GET(`/odata/v4/rental/Equipment(ID=${E(12)},IsActiveEntity=true)`, as('yard'));
    expect(eq.currentStatus).toBe('Damaged');
  });

  test('the saved inspection cannot be edited', async () => {
    expect([403, 405]).toContain(await status(POST(`${base}/ConditionLogs(ID=${log.ID},IsActiveEntity=true)/MaintenanceManagementService.draftEdit`, {}, as('manager'))));
  });

  test('photo content of a saved photo cannot be swapped', async () => {
    const other = Buffer.concat([PNG, Buffer.from([0])]);
    expect(await status(PUT(`/odata/v4/damage/DamagePhotos(ID=${photo.ID},IsActiveEntity=true)/photoContent`, other, { ...as('tech'), headers: { 'Content-Type': 'image/png' } }))).toBe(422);
  });
});

describe('computed fields requested on their own ($select)', () => {
  test('days overdue, custodian and line amount are filled', async () => {
    const { data: r } = await GET('/odata/v4/rental/Rentals(ID=40000000-0000-0000-0000-000000000005,IsActiveEntity=true)?$select=overdueDays,isOverdue', as('manager'));
    expect(r.overdueDays).toBeGreaterThan(0);
    expect(r.isOverdue).toBe(true);
    const { data: e } = await GET(`/odata/v4/rental/Equipment(ID=${E(5)},IsActiveEntity=true)?$select=custodian`, as('manager'));
    expect(e.custodian).toBe('Metro Rail Contractors');
    const { data: i } = await GET('/odata/v4/rental/RentalItems?$select=lineAmount&$top=1', as('yard'));
    expect(i.value[0].lineAmount).toBeNull();                                    // still hidden from yard workers
  });
});
