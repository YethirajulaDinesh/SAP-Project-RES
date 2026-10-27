using ret from '../db/schema';

// Damage records, photo evidence and repair bills (FR-006, FR-007, FR-016 - FR-021, FR-025)
@path    : '/odata/v4/damage'
@requires: [
  'YardWorker',
  'Dispatcher',
  'Technician',
  'BillingClerk',
  'Manager',
  'Admin',
  'Auditor'
]
service DamageManagementService {

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
        'YardWorker',
        'Technician',
        'Manager'
      ]
    },
    {
      grant: 'confirmDamage',
      to   : [
        'Technician',
        'Manager'
      ]
    },
    {
      grant: 'waiveDamage',
      to   : 'Manager'
    },
    {
      grant: 'closeDamage',
      to   : [
        'Technician',
        'Manager'
      ]
    },
    {
      grant: 'generateBill',
      to   : [
        'BillingClerk',
        'Manager'
      ]
    }
  ]
  @cds.search: {
    damageType,
    damageDescription,
    severity,
    damageStatus
  }
  entity DamageRecords   as projection on ret.DamageRecords {
    *,
    virtual null as statusCriticality : Integer
  }
    actions {
      action confirmDamage()                                  returns DamageRecords;
      action waiveDamage(reason: String @title: '{i18n>reason}' ) returns DamageRecords;
      action closeDamage()                                    returns DamageRecords;
      action generateBill()                                   returns RepairBills;
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
        'YardWorker',
        'Technician',
        'Manager'
      ]
    }
  ]
  entity DamagePhotos    as projection on ret.DamagePhotos;

  // Damage Charge Approval: bills are created by the system, people decide on them
  @readonly
  @restrict: [
    {
      grant: 'READ',
      to   : [
        'BillingClerk',
        'Manager',
        'Admin',
        'Auditor'
      ]
    },
    {
      grant: [
        'approveCharge',
        'adjustCharge',
        'rejectCharge',
        'disputeCharge',
        'resolveDispute'
      ],
      to   : [
        'BillingClerk',
        'Manager'
      ]
    }
  ]
  @cds.search: {
    customer.companyName,
    billingStatus,
    s4BillingDocumentId
  }
  entity RepairBills     as projection on ret.RepairBills {
    *,
    virtual null as statusCriticality : Integer
  }
    actions {
      action approveCharge(remarks: String @title: '{i18n>remarks}' )                        returns RepairBills;
      action adjustCharge(newRepairAmount: Decimal(12, 2) @title: '{i18n>newRepairAmount}',
                    reason: String @title: '{i18n>reason}' )                           returns RepairBills;
      action rejectCharge(reason: String @title: '{i18n>reason}' )                           returns RepairBills;
      action disputeCharge(reason: String @title: '{i18n>reason}' )                          returns RepairBills;
      action resolveDispute(outcome: String @title: '{i18n>outcome}'  @Common.ValueListWithFixedValues
                                     @Common.ValueList: {
                              CollectionPath: 'DisputeOutcomes',
                              Parameters    : [{
                                $Type            : 'Common.ValueListParameterOut',
                                LocalDataProperty: outcome,
                                ValueListProperty: 'code'
                              }]
                            },
                            remarks: String @title: '{i18n>remarks}' )                 returns RepairBills;
    };

  @readonly
  entity RepairBillHistory as projection on ret.RepairBillHistory;

  @readonly
  @cds.persistence.skip
  entity DisputeOutcomes {
    key code : String(20);
  }

  // Context shown on damage and bill pages
  @readonly
  entity ConditionLogs   as projection on ret.ConditionLogs {
    *,
    virtual null as gradeCriticality : Integer
  } excluding {
    damages
  };

  @readonly
  entity Equipment       as projection on ret.Equipment {
    ID,
    equipmentName,
    equipmentType,
    serialNumber,
    model,
    currentStatus,
    location
  };

  @readonly
  entity Locations       as projection on ret.Locations {
    ID,
    locationName,
    city
  };

  @readonly
  entity Rentals         as projection on ret.Rentals {
    ID,
    customer,
    rentalDate,
    expectedReturnDate,
    actualReturnDate,
    rentalStatus
  };

  @readonly
  entity Customers       as projection on ret.Customers {
    ID,
    companyName,
    contactPerson,
    email,
    s4CustomerId
  };

  @readonly
  entity DamageCatalogue as projection on ret.DamageCatalogue;

  @readonly
  entity CodeLists   as projection on ret.CodeLists;

  type ChargePreview {
    repairAmount : Decimal(12, 2);
    taxAmount    : Decimal(12, 2);
    totalAmount  : Decimal(12, 2);
    basis        : String;
    autoApprove  : Boolean;
  }

  // FR-021: what would this damage be charged?
  function calculateCharge(damage: UUID)  returns ChargePreview;
  // FR-020: complete damage timeline of one equipment
  function getDamageHistory(equipment: UUID) returns array of DamageRecords;
}

annotate DamageManagementService.DamageRecords with @odata.draft.enabled;
