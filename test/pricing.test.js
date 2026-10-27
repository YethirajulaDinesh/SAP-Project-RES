// Unit tests for the pricing engine and the status matrix (no server needed)
const { repairCharge, rentalTotal, lineAmount, withTax } = require('../srv/lib/pricing');
const { canTransition } = require('../srv/lib/status-matrix');
const { daysBetween } = require('../srv/lib/common');

describe('pricing engine', () => {
  test('rental days include the start day', () => {
    expect(daysBetween('2026-10-01', '2026-10-01')).toBe(1);
    expect(daysBetween('2026-10-01', '2026-10-10')).toBe(10);
  });

  test('line amount and rental total skip cancelled items', () => {
    expect(lineAmount({ dailyRentalRate: 1000, startDate: '2026-10-01', endDate: '2026-10-05' }))
      .toEqual({ rentalDays: 5, lineAmount: 5000 });
    expect(rentalTotal([
      { dailyRentalRate: 1000, startDate: '2026-10-01', endDate: '2026-10-05', itemStatus: 'Reserved' },
      { dailyRentalRate: 2500.5, startDate: '2026-10-01', endDate: '2026-10-02', itemStatus: 'Reserved' },
      { dailyRentalRate: 9999, startDate: '2026-10-01', endDate: '2026-10-30', itemStatus: 'Cancelled' }
    ])).toBe(10001);
  });

  test('repair estimate wins over the catalogue price', () => {
    const c = repairCharge({ repairEstimate: 4000, catalogueCost: 9000, severity: 'Major', dailyRate: 5000 },
      { taxRatePct: 18, autoApprovalLimit: 5000 });
    expect(c).toEqual({ repairAmount: 4000, taxAmount: 720, totalAmount: 4720, basis: 'estimate', autoApprove: true });
  });

  test('catalogue price is used when there is no estimate, and big totals need approval', () => {
    const c = repairCharge({ repairEstimate: null, catalogueCost: 15000, severity: 'Major' }, { taxRatePct: 18, autoApprovalLimit: 5000 });
    expect(c.basis).toBe('catalogue');
    expect(c.totalAmount).toBe(17700);
    expect(c.autoApprove).toBe(false);
  });

  test('severity factor x daily rate is the last fallback', () => {
    const c = repairCharge({ severity: 'Critical', dailyRate: 2000 }, { taxRatePct: 0, autoApprovalLimit: 0 });
    expect(c).toMatchObject({ repairAmount: 5000, basis: 'severity', autoApprove: false });
  });

  test('adjusted amounts are re-taxed and rounded', () => {
    expect(withTax(1234.567, 18)).toEqual({ repairAmount: 1234.57, taxAmount: 222.22, totalAmount: 1456.79 });
  });
});

describe('status matrix', () => {
  test.each([
    ['Rental', 'Booked', 'Checked Out', true],
    ['Rental', 'Booked', 'Returned', false],
    ['Rental', 'Closed', 'Booked', false],
    ['Damage', 'Reported', 'Confirmed', true],
    ['Damage', 'Waived', 'Confirmed', false],
    ['Bill', 'Pending Approval', 'Approved', true],
    ['Bill', 'Rejected', 'Approved', false],
    ['Equipment', 'Rented Out', 'Retired', false],
    ['Maintenance', 'Completed', 'In Progress', false]
  ])('%s: %s -> %s is %s', (kind, from, to, ok) => expect(canTransition(kind, from, to)).toBe(ok));
});
