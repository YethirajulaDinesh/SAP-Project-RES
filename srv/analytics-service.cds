using ret from '../db/schema';

// Fleet Overview and Management Dashboard (FR-023 - FR-025)
@path    : '/odata/v4/analytics'
@requires: [
  'Dispatcher',
  'BillingClerk',
  'Manager',
  'Admin',
  'Auditor'
]
service AnalyticsService {

  type FleetKPI {
    totalEquipment          : Integer;
    available               : Integer;
    rentedOut               : Integer;
    overdue                 : Integer;
    damaged                 : Integer;
    inMaintenance           : Integer;
    quarantined             : Integer;
    openRentals             : Integer;
    utilizationPct          : Decimal(5, 2);
    inspectionCompliancePct : Decimal(5, 2);
    pendingCharges          : Integer;
    pendingChargeAmount     : Decimal(12, 2);
  }

  type StatusCount {
    status : String;
    count  : Integer;
    amount : Decimal(12, 2);
  }

  type UtilizationRow {
    equipmentType  : String;
    units          : Integer;
    rentedDays     : Integer;
    availableDays  : Integer;
    utilizationPct : Decimal(5, 2);
    revenue        : Decimal(12, 2);
  }

  type TrendPoint {
    period  : String;
    rentals : Integer;
    revenue : Decimal(12, 2);
  }

  type CostRow {
    period          : String;
    equipmentName   : String;
    serialNumber    : String;
    maintenanceType : String;
    jobs            : Integer;
    cost            : Decimal(12, 2);
  }

  // amounts are net of tax, so estimate and charge can be compared
  type BillingSummary {
    estimatedTotal : Decimal(12, 2);
    chargedTotal   : Decimal(12, 2);
    postedTotal    : Decimal(12, 2);
    pendingTotal   : Decimal(12, 2);
    disputedTotal  : Decimal(12, 2);
    rejectedTotal  : Decimal(12, 2);
    leakageCount   : Integer;
    leakageAmount  : Decimal(12, 2);
    autoApproved   : Integer;
    manualApproved : Integer;
  }

  type DamageCategory {
    damageType : String;
    count      : Integer;
    estimated  : Decimal(12, 2);
  }

  type OverdueRental {
    rentalID           : UUID;
    customer           : String;
    rentalDate         : Date;
    expectedReturnDate : Date;
    overdueDays        : Integer;
    items              : Integer;
    totalRentalAmount  : Decimal(12, 2);
  }

  type ServiceDue {
    maintenanceID   : UUID;
    equipmentName   : String;
    serialNumber    : String;
    maintenanceType : String;
    dueDate         : Date;
    status          : String;
    overdue         : Boolean;
  }

  function getFleetKPIs()                              returns FleetKPI;
  function getEquipmentStatusDistribution()            returns array of StatusCount;
  function getUtilization(days: Integer)               returns array of UtilizationRow;
  function getRentalTrend(months: Integer)             returns array of TrendPoint;
  function getMaintenanceCosts(months: Integer)        returns array of CostRow;
  function getMaintenanceCostByEquipment()             returns array of CostRow;
  function getChargesByStatus()                        returns array of StatusCount;
  function getBillingSummary()                         returns BillingSummary;
  function getTopDamageCategories(top: Integer)        returns array of DamageCategory;
  function getOverdueRentals()                         returns array of OverdueRental;
  function getServiceSchedule(days: Integer)           returns array of ServiceDue;
}
