namespace ret;

using {
  cuid,
  managed
} from '@sap/cds/common';

// ---------- Enumerations ----------
type RentalStatus      : String(30) enum {
  Booked;
  CheckedOut = 'Checked Out';
  Returned;
  Closed;
  Cancelled;
};

type ItemStatus        : String(30) enum {
  Reserved;
  CheckedOut = 'Checked Out';
  Returned;
  Cancelled;
};

type EquipmentStatus   : String(30) enum {
  Available;
  RentedOut = 'Rented Out';
  UnderInspection = 'Under Inspection';
  Damaged;
  InMaintenance = 'In Maintenance';
  Quarantined;
  Retired;
};

type LocationType      : String(50) enum {
  Yard;
  Depot;
  Warehouse;
  Workshop;
  CustomerSite = 'Customer Site';
};

type MaintenanceType   : String(50) enum {
  Preventive;
  Corrective;
  Repair;
  Inspection;
  Calibration;
};

type MaintenanceStatus : String(30) enum {
  Scheduled;
  InProgress = 'In Progress';
  Completed;
  Cancelled;
};

type InspectionType    : String(30) enum {
  CheckOut = 'Check-Out';
  CheckIn = 'Check-In';
  Periodic;
  PostRepair = 'Post-Repair';
};

type ConditionGrade    : String(20) enum { // FR-015: A (as new) to D (unfit)
  A;
  B;
  C;
  D;
};

type Severity          : String(20) enum {
  Minor;
  Moderate;
  Major;
  Critical;
};

type DamageStatus      : String(30) enum { // FR-017
  Reported;
  Confirmed;
  Billed;
  InRepair = 'In Repair';
  Repaired;
  Closed;
  Waived;
};

type BillingStatus     : String(30) enum {
  PendingApproval = 'Pending Approval';
  Approved;
  Posted;
  Billed;
  Rejected;
  Disputed;
};

type OutboxStatus      : String(20) enum {
  Pending;
  Sent;
  Failed;
};

// ---------- Core entities (ER diagram) ----------
entity Customers : cuid, managed {
  companyName   : String(100) @mandatory;
  contactPerson : String(100);
  email         : String(100) @assert.format: '^[^@\s]+@[^@\s]+\.[^@\s]+$';
  phone         : String(20);
  address       : String(255);
  s4CustomerId  : String(50);
  rentals       : Association to many Rentals
                    on rentals.customer = $self;
  repairBills   : Association to many RepairBills
                    on repairBills.customer = $self;
}

entity Locations : cuid, managed {
  locationName           : String(100)  @mandatory;
  locationType           : LocationType @assert.range;
  address                : String(255);
  city                   : String(100);
  latitude               : Decimal(9, 6) @assert.range: [
    -90,
    90
  ];
  longitude              : Decimal(9, 6) @assert.range: [
    -180,
    180
  ];
  virtual equipmentCount : Integer; // computed in handler
  equipment              : Association to many Equipment
                             on equipment.location = $self;
}

entity Equipment : cuid, managed {
  location                : Association to Locations @mandatory;
  equipmentName           : String(100)              @mandatory;
  equipmentType           : String(50)               @mandatory;
  manufacturer            : String(100);
  model                   : String(100);
  serialNumber            : String(100)              @mandatory;
  purchaseDate            : Date;
  rentalRatePerDay        : Decimal(10, 2) default 0;
  currentStatus           : EquipmentStatus default 'Available' @assert.range;
  virtual nextServiceDate : Date; // computed in handler (FR-013)
  rentalItems             : Association to many RentalItems
                              on rentalItems.equipment = $self;
  maintenanceRecords      : Association to many MaintenanceRecords
                              on maintenanceRecords.equipment = $self;
  conditionLogs           : Association to many ConditionLogs
                              on conditionLogs.equipment = $self;
  transfers               : Association to many LocationTransfers
                              on transfers.equipment = $self;
  damageHistory           : Association to many DamageHistory
                              on damageHistory.equipment_ID = ID;
}

annotate Equipment with @assert.unique: {serialNumber: [serialNumber]};

entity Rentals : cuid, managed {
  customer            : Association to Customers @mandatory;
  rentalDate          : Date                     @mandatory;
  expectedReturnDate  : Date                     @mandatory;
  actualReturnDate    : Date;
  rentalStatus        : RentalStatus default 'Booked' @assert.range;
  totalRentalAmount   : Decimal(12, 2) default 0;
  virtual isOverdue   : Boolean; // FR-009, computed in handler
  virtual overdueDays : Integer;
  items               : Composition of many RentalItems
                          on items.rental = $self;
  statusHistory       : Composition of many RentalStatusHistory
                          on statusHistory.rental = $self;
  conditionLogs       : Association to many ConditionLogs
                          on conditionLogs.rental = $self;
  repairBills         : Association to many RepairBills
                          on repairBills.rental = $self;
}

entity RentalItems : cuid, managed {
  rental             : Association to Rentals;
  equipment          : Association to Equipment @mandatory;
  dailyRentalRate    : Decimal(10, 2);
  startDate          : Date;
  endDate            : Date;
  itemStatus         : ItemStatus default 'Reserved' @assert.range;
  virtual rentalDays : Integer;
  virtual lineAmount : Decimal(12, 2);
}

entity MaintenanceRecords : cuid, managed {
  equipment           : Association to Equipment @mandatory;
  maintenanceType     : MaintenanceType          @mandatory  @assert.range;
  maintenanceDate     : Date                     @mandatory;
  description         : String(500);
  serviceProvider     : String(150);
  cost                : Decimal(12, 2) default 0;
  nextMaintenanceDate : Date;
  status              : MaintenanceStatus default 'Scheduled' @assert.range;
  virtual isOverdue   : Boolean;
}

entity ConditionLogs : cuid, managed {
  equipment      : Association to Equipment @mandatory;
  rental         : Association to Rentals;
  inspectionDate : DateTime;
  inspectionType : InspectionType           @mandatory  @assert.range;
  conditionGrade : ConditionGrade           @mandatory  @assert.range;
  inspectorName  : String(100);
  meterReading   : Decimal(10, 2);
  notes          : String(500);
  clientRef      : String(64); // idempotency key for mobile offline sync
  damages        : Composition of many DamageRecords
                     on damages.conditionLog = $self;
}

annotate ConditionLogs with @assert.unique: {clientRef: [clientRef]};

entity DamageRecords : cuid, managed {
  conditionLog       : Association to ConditionLogs;
  damageType         : String(50)  @mandatory;
  damageDescription  : String(500);
  severity           : Severity    @mandatory  @assert.range;
  repairEstimate     : Decimal(12, 2);
  customerLiable     : Boolean default true; // FR-016
  liabilityNote      : String(255);
  damageStatus       : DamageStatus default 'Reported' @assert.range;
  virtual photoCount : Integer;
  photos             : Composition of many DamagePhotos
                         on photos.damage = $self;
  repairBill         : Association to one RepairBills
                         on repairBill.damage = $self;
}

entity DamagePhotos : cuid {
  damage       : Association to DamageRecords;
  fileName     : String(255);
  mediaType    : String(100) @Core.IsMediaType;
  photoContent : LargeBinary @Core.MediaType: mediaType  @Core.ContentDisposition.Filename: fileName;
  uploadedAt   : DateTime    @cds.on.insert: $now;
  uploadedBy   : String(100) @cds.on.insert: $user;
  sha256Hash   : String(64); // evidence integrity
  storageUrl   : String(500); // copy in Cloudinary / Object Store, when configured
}

entity RepairBills : cuid, managed {
  rental              : Association to Rentals;
  customer            : Association to Customers;
  damage              : Association to DamageRecords;
  billDate            : Date;
  repairAmount        : Decimal(12, 2);
  taxAmount           : Decimal(12, 2);
  totalAmount         : Decimal(12, 2);
  billingStatus       : BillingStatus default 'Pending Approval' @assert.range;
  s4BillingDocumentId : String(50);
  // approval workflow (Damage Charge Approval screen)
  autoApproved        : Boolean default false;
  decisionBy          : String(100);
  decisionAt          : Timestamp;
  decisionReason      : String(500);
  history             : Composition of many RepairBillHistory
                          on history.repairBill = $self;
}

annotate RepairBills with @assert.unique: {damage: [damage]}; // one bill per damage (1:1)

// ---------- Supporting entities (FRD requirements) ----------
entity RentalStatusHistory : cuid { // FR-008
  rental     : Association to Rentals;
  fromStatus : String(30);
  toStatus   : String(30);
  changedBy  : String(100);
  changedAt  : Timestamp;
  remarks    : String(500);
}

entity RepairBillHistory : cuid {
  repairBill : Association to RepairBills;
  fromStatus : String(30);
  toStatus   : String(30);
  amount     : Decimal(12, 2);
  changedBy  : String(100);
  changedAt  : Timestamp;
  remarks    : String(500);
}

entity LocationTransfers : cuid, managed { // FR-011
  equipment     : Association to Equipment;
  fromLocation  : Association to Locations;
  toLocation    : Association to Locations;
  transferDate  : Timestamp;
  transferredBy : String(100);
  reason        : String(500);
}

// Configuration: damage catalogue and pricing / approval rules
entity DamageCatalogue : cuid, managed {
  damageType   : String(50)     @mandatory;
  severity     : Severity       @mandatory  @assert.range;
  standardCost : Decimal(12, 2) @mandatory;
  description  : String(255);
  active       : Boolean default true;
}

annotate DamageCatalogue with @assert.unique: {typeSeverity: [
  damageType,
  severity
]};

entity Settings : managed {
  key code        : String(40);
      value       : String(100) @mandatory;
      description : String(255);
}

// Fixed values for dropdowns (value helps), e.g. list 'ConditionGrade' -> A, B, C, D
entity CodeLists {
  key list      : String(30);
  key code      : String(30);
      sortOrder : Integer;
}

// Integration outbox (INT-04 / INT-06 / INT-07), shown in the Integration Monitor
entity OutboxMessages : cuid, managed {
  messageType           : String(40);
  interfaceId           : String(10);
  destination           : String(40);
  targetEntity          : String(40);
  targetKey             : String(40);
  idempotencyKey        : String(100);
  payload               : LargeString;
  status                : OutboxStatus default 'Pending';
  attempts              : Integer default 0;
  lastError             : String(1000);
  responseRef           : String(50);
  processedAt           : Timestamp;
  virtual maskedPayload : String(1000);
}

annotate OutboxMessages with @assert.unique: {idempotencyKey: [idempotencyKey]};

// ---------- Audit (all write actions are logged) ----------
entity AuditLog : cuid {
  entity    : String(40);
  entityKey : String(40);
  action    : String(30);
  userId    : String(100);
  timestamp : Timestamp;
  details   : LargeString;
}

// ---------- Views ----------
// FR-020: damage timeline per equipment
entity DamageHistory as
  select from DamageRecords {
    key ID,
        conditionLog.equipment.ID      as equipment_ID : UUID,
        conditionLog.inspectionDate    as inspectionDate,
        conditionLog.inspectionType    as inspectionType,
        conditionLog.conditionGrade    as conditionGrade,
        conditionLog.rental.ID         as rental_ID    : UUID,
        damageType,
        damageDescription,
        severity,
        repairEstimate,
        customerLiable,
        damageStatus,
        repairBill.totalAmount         as billedAmount,
        repairBill.billingStatus       as billingStatus,
        repairBill.s4BillingDocumentId as s4BillingDocumentId
  };
