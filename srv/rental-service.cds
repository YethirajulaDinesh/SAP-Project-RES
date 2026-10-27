using ret from '../db/schema';

// Customers, rentals, equipment and locations (FR-001 - FR-004, FR-008 - FR-011, FR-022)
@path    : '/odata/v4/rental'
@requires: 'authenticated-user'
service RentalManagementService {

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
      grant: [
        'CREATE',
        'UPDATE'
      ],
      to   : [
        'Dispatcher',
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
    companyName,
    contactPerson,
    email,
    s4CustomerId
  }
  entity Customers           as projection on ret.Customers excluding {
    repairBills
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
      grant: [
        'CREATE',
        'UPDATE',
        'checkOut',
        'returnRental',
        'closeRental',
        'cancelRental'
      ],
      to   : [
        'Dispatcher',
        'Manager'
      ]
    },
    {
      grant: [
        'CREATE',
        'UPDATE',
        'DELETE'
      ],
      to   : 'Admin'
    }
  ]
  @cds.search: {
    customer.companyName,
    rentalStatus
  }
  entity Rentals             as projection on ret.Rentals {
    *,
    virtual null as statusCriticality : Integer
  } excluding {
    repairBills
  }
    actions {
      action checkOut(overrideReason: String  @title: '{i18n>overrideReason}' )   returns Rentals;
      action returnRental(actualReturnDate: Date @title: '{i18n>actualReturnDate}' ) returns Rentals;
      action closeRental()                                                        returns Rentals;
      action cancelRental(reason: String  @title: '{i18n>reason}' )              returns Rentals;
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
      grant: [
        'CREATE',
        'UPDATE',
        'DELETE'
      ],
      to   : [
        'Dispatcher',
        'Manager',
        'Admin'
      ]
    }
  ]
  entity RentalItems         as projection on ret.RentalItems {
    *,
    virtual null as statusCriticality : Integer
  };

  @readonly
  entity RentalStatusHistory as projection on ret.RentalStatusHistory;

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
      grant: 'transferLocation',
      to   : [
        'YardWorker',
        'Dispatcher',
        'Manager',
        'Admin'
      ]
    },
    {
      grant: 'releaseQuarantine',
      to   : [
        'Technician',
        'Manager'
      ]
    },
    {
      grant: 'quarantine',
      to   : [
        'Technician',
        'Dispatcher',
        'Manager'
      ]
    },
    {
      grant: [
        'CREATE',
        'UPDATE',
        'retireEquipment'
      ],
      to   : [
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
    equipmentName,
    equipmentType,
    manufacturer,
    model,
    serialNumber
  }
  entity Equipment           as projection on ret.Equipment {
    *,
    virtual null as statusCriticality : Integer,
    virtual null as custodian         : String(100)
  }
    actions {
      action transferLocation(toLocation: UUID @title: '{i18n>toLocation}'  @Common.ValueList: {
        CollectionPath: 'Locations',
        Parameters    : [
          {
            $Type            : 'Common.ValueListParameterOut',
            LocalDataProperty: toLocation,
            ValueListProperty: 'ID'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'locationName'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'city'
          }
        ]
      },
                              reason: String @title: '{i18n>reason}' )   returns Equipment;
      action quarantine(reason: String @title: '{i18n>reason}' )        returns Equipment;
      action releaseQuarantine(remarks: String @title: '{i18n>remarks}' ) returns Equipment;
      action retireEquipment(reason: String @title: '{i18n>reason}' )   returns Equipment;
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
      grant: [
        'CREATE',
        'UPDATE'
      ],
      to   : [
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
    locationName,
    city,
    locationType
  }
  entity Locations           as projection on ret.Locations;

  // Read-only history shown on the Asset Detail page
  @readonly
  entity LocationTransfers   as projection on ret.LocationTransfers;

  @readonly
  entity MaintenanceHistory  as projection on ret.MaintenanceRecords {
    *,
    virtual null as statusCriticality : Integer
  };

  @readonly
  entity InspectionHistory   as projection on ret.ConditionLogs {
    *,
    virtual null as gradeCriticality : Integer
  } excluding {
    damages
  };

  @readonly
  entity DamageHistory       as projection on ret.DamageHistory {
    *,
    virtual null as statusCriticality : Integer
  };

  @readonly
  entity CodeLists           as projection on ret.CodeLists;

  // FR-003: is this equipment free for the given period?
  function checkAvailability(equipment: UUID, fromDate: Date, toDate: Date) returns Boolean;
}

annotate RentalManagementService.Customers with @odata.draft.enabled;
annotate RentalManagementService.Rentals with @odata.draft.enabled;
annotate RentalManagementService.Equipment with @odata.draft.enabled;
annotate RentalManagementService.Locations with @odata.draft.enabled;
