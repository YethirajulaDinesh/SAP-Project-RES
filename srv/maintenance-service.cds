using ret from '../db/schema';

// Maintenance records and condition logs (FR-005, FR-012 - FR-015)
@path    : '/odata/v4/maintenance'
@requires: [
  'YardWorker',
  'Dispatcher',
  'Technician',
  'BillingClerk',
  'Manager',
  'Admin',
  'Auditor'
]
service MaintenanceManagementService {

  @restrict: [
    {
      grant: 'READ',
      to   : [
        'Dispatcher',
        'Technician',
        'Manager',
        'Admin',
        'Auditor'
      ]
    },
    {
      grant: [
        'CREATE',
        'UPDATE',
        'startWork',
        'completeWork',
        'cancelWork'
      ],
      to   : [
        'Technician',
        'Manager',
        'Admin'
      ]
    },
    {
      grant: 'DELETE',
      to   : 'Admin'
    }
  ]
  @cds.search: {
    equipment.equipmentName,
    equipment.serialNumber,
    maintenanceType,
    serviceProvider,
    description
  }
  entity MaintenanceRecords as projection on ret.MaintenanceRecords {
    *,
    virtual null as statusCriticality : Integer
  }
    actions {
      action startWork(serviceProvider: String @title: '{i18n>assignTechnician}' ) returns MaintenanceRecords;
      action completeWork(cost: Decimal(12, 2) @title: '{i18n>actualCost}',
                          nextMaintenanceDate: Date @title: '{i18n>nextMaintenanceDate}',
                          remarks: String @title: '{i18n>remarks}' )               returns MaintenanceRecords;
      action cancelWork(reason: String @title: '{i18n>reason}' )                    returns MaintenanceRecords;
    };

  // Inspections are immutable once saved (evidence integrity): no UPDATE / DELETE grants
  @restrict: [
    {
      grant: 'READ',
      to   : [
        'YardWorker',
        'Dispatcher',
        'Technician',
        'BillingClerk',
        'Manager',
        'Admin',
        'Auditor'
      ]
    },
    {
      grant: 'CREATE',
      to   : [
        'YardWorker',
        'Dispatcher',
        'Technician',
        'Manager'
      ]
    }
  ]
  @cds.search: {
    equipment.equipmentName,
    equipment.serialNumber,
    inspectorName,
    inspectionType,
    notes
  }
  entity ConditionLogs      as projection on ret.ConditionLogs {
    *,
    virtual null as gradeCriticality : Integer
  };

  @restrict: [
    {
      grant: 'READ',
      to   : [
        'YardWorker',
        'Dispatcher',
        'Technician',
        'BillingClerk',
        'Manager',
        'Admin',
        'Auditor'
      ]
    },
    {
      grant: 'CREATE',
      to   : [
        'YardWorker',
        'Dispatcher',
        'Technician',
        'Manager'
      ]
    }
  ]
  entity DamageRecords      as projection on ret.DamageRecords {
    *,
    virtual null as statusCriticality : Integer
  } excluding {
    repairBill
  };

  @restrict: [
    {
      grant: 'READ',
      to   : [
        'YardWorker',
        'Dispatcher',
        'Technician',
        'BillingClerk',
        'Manager',
        'Admin',
        'Auditor'
      ]
    },
    {
      grant: 'CREATE',
      to   : [
        'YardWorker',
        'Dispatcher',
        'Technician',
        'Manager'
      ]
    }
  ]
  entity DamagePhotos       as projection on ret.DamagePhotos;

  // Value helps
  @readonly
  entity Equipment          as projection on ret.Equipment {
    ID,
    equipmentName,
    equipmentType,
    serialNumber,
    model,
    currentStatus,
    location
  };

  @readonly
  entity Locations          as projection on ret.Locations {
    ID,
    locationName,
    city
  };

  @readonly
  entity Rentals            as projection on ret.Rentals {
    ID,
    customer,
    rentalDate,
    expectedReturnDate,
    rentalStatus
  };

  @readonly
  entity Customers          as projection on ret.Customers {
    ID,
    companyName
  };

  @readonly
  entity DamageCatalogue    as projection on ret.DamageCatalogue {
    ID,
    damageType,
    severity,
    description,
    active
  };

  @readonly
  entity CodeLists      as projection on ret.CodeLists;

  // FR-013: upcoming and overdue maintenance (Maintenance Planner)
  function getUpcomingMaintenance(days: Integer) returns array of MaintenanceRecords;
  function getOverdueMaintenance()               returns array of MaintenanceRecords;
  // FR-014: inspection history of one equipment
  function getInspectionHistory(equipment: UUID) returns array of ConditionLogs;
}

annotate MaintenanceManagementService.MaintenanceRecords with @odata.draft.enabled;
annotate MaintenanceManagementService.ConditionLogs with @odata.draft.enabled;
