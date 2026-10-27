// Allowed status transitions (FR-008, FR-017 and the charge approval flow)
const MATRIX = {
  Rental: {
    'Booked': ['Checked Out', 'Cancelled'],
    'Checked Out': ['Returned'],
    'Returned': ['Closed'],
    'Closed': [],
    'Cancelled': []
  },
  Equipment: {
    'Available': ['Rented Out', 'Under Inspection', 'Damaged', 'In Maintenance', 'Quarantined', 'Retired'],
    'Rented Out': ['Under Inspection', 'Available'],
    'Under Inspection': ['Available', 'Damaged', 'Quarantined'],
    'Damaged': ['In Maintenance', 'Quarantined', 'Available', 'Retired'],
    'In Maintenance': ['Available', 'Quarantined', 'Damaged', 'Retired'],
    'Quarantined': ['Available', 'In Maintenance', 'Retired'],
    'Retired': []
  },
  Damage: {
    'Reported': ['Confirmed', 'Waived'],
    'Confirmed': ['Billed', 'In Repair', 'Waived'],
    'Billed': ['In Repair', 'Repaired', 'Closed'],
    'In Repair': ['Repaired'],
    'Repaired': ['Closed'],
    'Closed': [],
    'Waived': []
  },
  Bill: {
    'Pending Approval': ['Approved', 'Rejected', 'Disputed', 'Pending Approval'],
    'Approved': ['Posted', 'Disputed'],
    'Posted': ['Billed', 'Disputed'],
    'Billed': ['Disputed'],
    'Disputed': ['Approved', 'Posted', 'Rejected', 'Pending Approval'],
    'Rejected': []
  },
  Maintenance: {
    'Scheduled': ['In Progress', 'Completed', 'Cancelled'],
    'In Progress': ['Completed', 'Cancelled'],
    'Completed': [],
    'Cancelled': []
  }
};

function canTransition(kind, from, to) {
  return (MATRIX[kind]?.[from] || []).includes(to);
}

// Throws a 409 error with a readable message when the move is not allowed
function assertTransition(req, kind, from, to) {
  if (canTransition(kind, from, to)) return true;
  req.reject(409, `${kind} cannot move from "${from}" to "${to}"`);
}

module.exports = { MATRIX, canTransition, assertTransition };
