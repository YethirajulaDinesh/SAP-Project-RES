using ret from '../db/schema';

// REST API for the yard mobile app: scan, inspect, photograph, transfer (offline sync)
// Price data is not part of this API.
@protocol: 'rest'
@path    : '/rest/mobile'
@requires: [
  'YardWorker',
  'Dispatcher',
  'Technician',
  'Manager',
  'Admin'
]
service MobileService {

  @readonly
  entity Equipment       as
    select from ret.Equipment {
      ID,
      equipmentName,
      equipmentType,
      manufacturer,
      model,
      serialNumber,
      currentStatus,
      location.ID           as locationID,
      location.locationName as locationName,
      location.city         as city
    }
    where
      currentStatus != 'Retired';

  @readonly
  entity Locations       as
    select from ret.Locations {
      ID,
      locationName,
      locationType,
      city
    };

  @readonly
  entity DamageTypes     as
    select from ret.DamageCatalogue {
      ID,
      damageType,
      severity,
      description
    }
    where
      active = true;

  @readonly
  entity OpenRentalItems as
    select from ret.RentalItems {
      ID,
      rental.ID                   as rentalID,
      rental.customer.companyName as customer,
      rental.rentalStatus         as rentalStatus,
      rental.expectedReturnDate   as expectedReturnDate,
      equipment.ID                as equipmentID,
      equipment.equipmentName     as equipmentName,
      equipment.serialNumber      as serialNumber,
      itemStatus
    }
    where
      rental.rentalStatus in (
        'Booked', 'Checked Out', 'Returned'
      );

  @readonly
  entity CodeLists       as projection on ret.CodeLists;

  type DamageInput {
    damageType        : String(50);
    damageDescription : String(500);
    severity          : String(20);
  }

  type ScanResult {
    equipmentID        : UUID;
    equipmentName      : String;
    equipmentType      : String;
    model              : String;
    serialNumber       : String;
    currentStatus      : String;
    locationName       : String;
    rentalID           : UUID;
    customer           : String;
    rentalStatus       : String;
    expectedReturnDate : Date;
    lastGrade          : String;
    lastMeterReading   : Decimal(10, 2);
    lastInspectionDate : DateTime;
    openDamages        : Integer;
  }

  type InspectionResult {
    conditionLogID  : UUID;
    damageIDs       : array of UUID;
    duplicate       : Boolean;
    equipmentStatus : String;
  }

  type PhotoResult {
    photoID   : UUID;
    sha256    : String;
    duplicate : Boolean;
  }

  function scanEquipment(code: String)                      returns ScanResult;

  @requires: [
    'YardWorker',
    'Dispatcher',
    'Technician',
    'Manager'
  ]
  action   submitInspection(clientRef: String(64),
                            equipmentID: UUID,
                            rentalID: UUID,
                            inspectionType: String(30),
                            conditionGrade: String(20),
                            meterReading: Decimal(10, 2),
                            notes: String(500),
                            damages: many DamageInput)       returns InspectionResult;

  @requires: [
    'YardWorker',
    'Dispatcher',
    'Technician',
    'Manager'
  ]
  action   uploadPhoto(damageID: UUID,
                       fileName: String(255),
                       mediaType: String(100),
                       content: LargeString, // base64
                       sha256: String(64))                  returns PhotoResult;

  @requires: [
    'YardWorker',
    'Dispatcher',
    'Manager',
    'Admin'
  ]
  action   transferEquipment(equipmentID: UUID,
                             toLocationID: UUID,
                             reason: String(500))           returns ScanResult;
}
