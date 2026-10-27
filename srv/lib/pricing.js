// Pricing engine: rental amounts and repair charges (FR-007, FR-021)
const { round2, daysBetween } = require('./common');

// Severity factor used when no repair estimate or catalogue price exists
const SEVERITY_FACTOR = { Minor: 0.02, Moderate: 0.05, Major: 0.12, Critical: 0.25 };

function lineAmount(item) {
  const days = daysBetween(item.startDate, item.endDate);
  return { rentalDays: days, lineAmount: round2((Number(item.dailyRentalRate) || 0) * days) };
}

function rentalTotal(items) {
  return round2((items || []).filter(i => i.itemStatus !== 'Cancelled')
    .reduce((sum, i) => sum + lineAmount(i).lineAmount, 0));
}

/**
 * Repair charge for one damage.
 * Order of preference: manual repair estimate, damage catalogue price,
 * severity factor x daily rental rate x 10 (fallback).
 */
function repairCharge({ repairEstimate, catalogueCost, severity, dailyRate }, { taxRatePct = 18, autoApprovalLimit = 5000 } = {}) {
  let repairAmount;
  let basis;
  if (repairEstimate != null && Number(repairEstimate) > 0) {
    repairAmount = Number(repairEstimate); basis = 'estimate';
  } else if (catalogueCost != null && Number(catalogueCost) > 0) {
    repairAmount = Number(catalogueCost); basis = 'catalogue';
  } else {
    repairAmount = (SEVERITY_FACTOR[severity] || 0.05) * (Number(dailyRate) || 0) * 10; basis = 'severity';
  }
  repairAmount = round2(repairAmount);
  const taxAmount = round2(repairAmount * Number(taxRatePct) / 100);
  const totalAmount = round2(repairAmount + taxAmount);
  return { repairAmount, taxAmount, totalAmount, basis, autoApprove: totalAmount <= Number(autoApprovalLimit) };
}

// Re-price an existing bill after an adjustment
function withTax(repairAmount, taxRatePct = 18) {
  const amount = round2(repairAmount);
  const taxAmount = round2(amount * Number(taxRatePct) / 100);
  return { repairAmount: amount, taxAmount, totalAmount: round2(amount + taxAmount) };
}

module.exports = { SEVERITY_FACTOR, lineAmount, rentalTotal, repairCharge, withTax };
