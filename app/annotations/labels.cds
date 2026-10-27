using ret from '../../db/schema';

// ---------- Field labels (inherited by every service) ----------
annotate ret.Customers with @title: '{i18n>customer}' {
    ID            @title: '{i18n>customer}'  @UI.Hidden;
    companyName   @title: '{i18n>companyName}';
    contactPerson @title: '{i18n>contactPerson}';
    email         @title: '{i18n>email}';
    phone         @title: '{i18n>phone}';
    address       @title: '{i18n>address}';
    s4CustomerId  @title: '{i18n>s4CustomerId}';
};

annotate ret.Locations with @title: '{i18n>location}' {
    ID             @title: '{i18n>location}'  @UI.Hidden;
    locationName   @title: '{i18n>locationName}';
    locationType   @title: '{i18n>locationType}';
    address        @title: '{i18n>address}';
    city           @title: '{i18n>city}';
    latitude       @title: '{i18n>latitude}';
    longitude      @title: '{i18n>longitude}';
    equipmentCount @title: '{i18n>equipmentCount}';
};

annotate ret.Equipment with @title: '{i18n>equipment}' {
    ID               @title: '{i18n>equipment}'  @UI.Hidden;
    location         @title: '{i18n>location}';
    equipmentName    @title: '{i18n>equipmentName}';
    equipmentType    @title: '{i18n>equipmentType}';
    manufacturer     @title: '{i18n>manufacturer}';
    model            @title: '{i18n>model}';
    serialNumber     @title: '{i18n>serialNumber}';
    purchaseDate     @title: '{i18n>purchaseDate}';
    rentalRatePerDay @title: '{i18n>rentalRatePerDay}'  @Measures.ISOCurrency: 'INR';
    currentStatus    @title: '{i18n>currentStatus}';
    nextServiceDate  @title: '{i18n>nextServiceDate}';
};

annotate ret.Rentals with @title: '{i18n>rental}' {
    ID                 @title: '{i18n>rental}'  @UI.Hidden;
    customer           @title: '{i18n>customer}';
    rentalDate         @title: '{i18n>rentalDate}';
    expectedReturnDate @title: '{i18n>expectedReturnDate}';
    actualReturnDate   @title: '{i18n>actualReturnDate}';
    rentalStatus       @title: '{i18n>rentalStatus}';
    totalRentalAmount  @title: '{i18n>totalRentalAmount}'  @Measures.ISOCurrency: 'INR';
    isOverdue          @title: '{i18n>isOverdue}';
    overdueDays        @title: '{i18n>overdueDays}';
};

annotate ret.RentalItems with @title: '{i18n>rentalItem}' {
    ID              @UI.Hidden;
    rental          @title: '{i18n>rental}';
    equipment       @title: '{i18n>equipment}';
    dailyRentalRate @title: '{i18n>dailyRentalRate}'  @Measures.ISOCurrency: 'INR';
    startDate       @title: '{i18n>startDate}';
    endDate         @title: '{i18n>endDate}';
    itemStatus      @title: '{i18n>itemStatus}';
    rentalDays      @title: '{i18n>rentalDays}';
    lineAmount      @title: '{i18n>lineAmount}'  @Measures.ISOCurrency: 'INR';
};

annotate ret.MaintenanceRecords with @title: '{i18n>maintenanceRecord}' {
    ID                  @UI.Hidden;
    equipment           @title: '{i18n>equipment}';
    maintenanceType     @title: '{i18n>maintenanceType}';
    maintenanceDate     @title: '{i18n>maintenanceDate}';
    description         @title: '{i18n>description}'  @UI.MultiLineText;
    serviceProvider     @title: '{i18n>serviceProvider}';
    cost                @title: '{i18n>cost}'  @Measures.ISOCurrency: 'INR';
    nextMaintenanceDate @title: '{i18n>nextMaintenanceDate}';
    status              @title: '{i18n>status}';
    isOverdue           @title: '{i18n>isOverdue}';
};

annotate ret.ConditionLogs with @title: '{i18n>conditionLog}' {
    ID             @UI.Hidden;
    equipment      @title: '{i18n>equipment}';
    rental         @title: '{i18n>rental}';
    inspectionDate @title: '{i18n>inspectionDate}';
    inspectionType @title: '{i18n>inspectionType}';
    conditionGrade @title: '{i18n>conditionGrade}';
    inspectorName  @title: '{i18n>inspectorName}';
    meterReading   @title: '{i18n>meterReading}';
    notes          @title: '{i18n>notes}'  @UI.MultiLineText;
    clientRef      @title: '{i18n>clientRef}'  @UI.Hidden;
};

annotate ret.DamageRecords with @title: '{i18n>damageRecord}' {
    ID                @UI.Hidden;
    conditionLog      @title: '{i18n>conditionLog}';
    damageType        @title: '{i18n>damageType}';
    damageDescription @title: '{i18n>damageDescription}'  @UI.MultiLineText;
    severity          @title: '{i18n>severity}';
    repairEstimate    @title: '{i18n>repairEstimate}'  @Measures.ISOCurrency: 'INR';
    customerLiable    @title: '{i18n>customerLiable}';
    liabilityNote     @title: '{i18n>liabilityNote}';
    damageStatus      @title: '{i18n>damageStatus}';
    photoCount        @title: '{i18n>photoCount}';
};

annotate ret.DamagePhotos with @title: '{i18n>damagePhoto}' {
    ID           @UI.Hidden;
    damage       @title: '{i18n>damageRecord}';
    fileName     @title: '{i18n>fileName}';
    mediaType    @title: '{i18n>mediaType}';
    photoContent @title: '{i18n>photo}';
    uploadedAt   @title: '{i18n>uploadedAt}';
    uploadedBy   @title: '{i18n>uploadedBy}';
    sha256Hash   @title: '{i18n>sha256Hash}';
    storageUrl   @title: '{i18n>storageUrl}';
};

annotate ret.RepairBills with @title: '{i18n>repairBill}' {
    ID                  @UI.Hidden;
    rental              @title: '{i18n>rental}';
    customer            @title: '{i18n>customer}';
    damage              @title: '{i18n>damageRecord}';
    billDate            @title: '{i18n>billDate}';
    repairAmount        @title: '{i18n>repairAmount}'  @Measures.ISOCurrency: 'INR';
    taxAmount           @title: '{i18n>taxAmount}'  @Measures.ISOCurrency: 'INR';
    totalAmount         @title: '{i18n>totalAmount}'  @Measures.ISOCurrency: 'INR';
    billingStatus       @title: '{i18n>billingStatus}';
    s4BillingDocumentId @title: '{i18n>s4BillingDocumentId}';
    autoApproved        @title: '{i18n>autoApproved}';
    decisionBy          @title: '{i18n>decisionBy}';
    decisionAt          @title: '{i18n>decisionAt}';
    decisionReason      @title: '{i18n>decisionReason}';
};

annotate ret.RentalStatusHistory with {
    ID         @UI.Hidden;
    fromStatus @title: '{i18n>from}';
    toStatus   @title: '{i18n>to}';
    changedBy  @title: '{i18n>changedBy}';
    changedAt  @title: '{i18n>changedAt}';
    remarks    @title: '{i18n>remarks}';
};

annotate ret.RepairBillHistory with {
    ID         @UI.Hidden;
    fromStatus @title: '{i18n>from}';
    toStatus   @title: '{i18n>to}';
    amount     @title: '{i18n>totalAmount}'  @Measures.ISOCurrency: 'INR';
    changedBy  @title: '{i18n>changedBy}';
    changedAt  @title: '{i18n>changedAt}';
    remarks    @title: '{i18n>remarks}';
};

annotate ret.LocationTransfers with {
    ID            @UI.Hidden;
    fromLocation  @title: '{i18n>fromLocation}';
    toLocation    @title: '{i18n>toLocation}';
    transferDate  @title: '{i18n>transferDate}';
    transferredBy @title: '{i18n>transferredBy}';
    reason        @title: '{i18n>reason}';
};

annotate ret.DamageCatalogue with @title: '{i18n>damageCatalogue}' {
    ID           @UI.Hidden;
    damageType   @title: '{i18n>damageType}';
    severity     @title: '{i18n>severity}';
    standardCost @title: '{i18n>standardCost}'  @Measures.ISOCurrency: 'INR';
    description  @title: '{i18n>description}';
    active       @title: '{i18n>active}';
};

annotate ret.Settings with @title: '{i18n>setting}' {
    code        @title: '{i18n>settingCode}';
    value       @title: '{i18n>settingValue}';
    description @title: '{i18n>description}';
};

annotate ret.OutboxMessages with @title: '{i18n>outboxMessage}' {
    ID             @UI.Hidden;
    messageType    @title: '{i18n>messageType}';
    interfaceId    @title: '{i18n>interfaceId}';
    destination    @title: '{i18n>destination}';
    targetEntity   @title: '{i18n>targetEntity}';
    targetKey      @title: '{i18n>targetKey}';
    idempotencyKey @title: '{i18n>idempotencyKey}';
    status         @title: '{i18n>status}';
    attempts       @title: '{i18n>attempts}';
    lastError      @title: '{i18n>lastError}';
    responseRef    @title: '{i18n>responseRef}';
    processedAt    @title: '{i18n>processedAt}';
    maskedPayload  @title: '{i18n>maskedPayload}'  @UI.MultiLineText;
};

annotate ret.AuditLog with @title: '{i18n>auditLog}' {
    ID        @UI.Hidden;
    entity    @title: '{i18n>auditEntity}';
    entityKey @title: '{i18n>auditKey}';
    action    @title: '{i18n>auditAction}';
    userId    @title: '{i18n>user}';
    timestamp @title: '{i18n>timestamp}';
    details   @title: '{i18n>details}'  @UI.MultiLineText;
};

annotate ret.DamageHistory with {
    ID                  @UI.Hidden;
    inspectionDate      @title: '{i18n>inspectionDate}';
    inspectionType      @title: '{i18n>inspectionType}';
    conditionGrade      @title: '{i18n>conditionGrade}';
    billedAmount        @title: '{i18n>totalAmount}'  @Measures.ISOCurrency: 'INR';
    billingStatus       @title: '{i18n>billingStatus}';
    s4BillingDocumentId @title: '{i18n>s4BillingDocumentId}';
};

annotate ret.CodeLists with {
    code      @title: '{i18n>value}';
    list      @UI.Hidden;
    sortOrder @UI.Hidden;
};

// dropdown values in business order (A, B, C, D / Minor ... Critical)
annotate ret.CodeLists with @(
    UI.LineItem                       : [{Value: code, @HTML5.CssDefaults: {width: '12rem'}}],
    UI.PresentationVariant #SortOrder : {
        SortOrder     : [{Property: sortOrder}],
        Visualizations: ['@UI.LineItem']
    }
);

// ---------- Readable texts for keys and value helps ----------
annotate ret.Rentals with {
    customer @(
        Common.Text           : customer.companyName,
        Common.TextArrangement: #TextOnly,
        Common.ValueList      : {
            CollectionPath: 'Customers',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: customer_ID,
                    ValueListProperty: 'ID'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'companyName'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'contactPerson'
                }
            ]
        }
    );
};

annotate ret.RepairBills with {
    customer @(
        Common.Text           : customer.companyName,
        Common.TextArrangement: #TextOnly
    );
    rental   @(
        Common.Text           : rental.rentalDate,
        Common.TextArrangement: #TextOnly
    );
    damage   @(
        Common.Text           : damage.damageType,
        Common.TextArrangement: #TextOnly
    );
};

annotate ret.Equipment with {
    location @(
        Common.Text           : location.locationName,
        Common.TextArrangement: #TextOnly,
        Common.ValueList      : {
            CollectionPath: 'Locations',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: location_ID,
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
        }
    );
};

annotate ret.LocationTransfers with {
    fromLocation @(
        Common.Text           : fromLocation.locationName,
        Common.TextArrangement: #TextOnly
    );
    toLocation   @(
        Common.Text           : toLocation.locationName,
        Common.TextArrangement: #TextOnly
    );
};

// equipment value help, shared by rental items, maintenance records and condition logs
annotate ret.RentalItems with {
    equipment @(
        Common.Text           : equipment.equipmentName,
        Common.TextArrangement: #TextOnly,
        Common.ValueList      : {
            CollectionPath: 'Equipment',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: equipment_ID,
                    ValueListProperty: 'ID'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'equipmentName'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'serialNumber'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'currentStatus'
                }
            ]
        }
    );
};

annotate ret.MaintenanceRecords with {
    equipment @(
        Common.Text           : equipment.equipmentName,
        Common.TextArrangement: #TextOnly,
        Common.ValueList      : {
            CollectionPath: 'Equipment',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: equipment_ID,
                    ValueListProperty: 'ID'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'equipmentName'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'serialNumber'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'currentStatus'
                }
            ]
        }
    );
};

annotate ret.ConditionLogs with {
    equipment @(
        Common.Text           : equipment.equipmentName,
        Common.TextArrangement: #TextOnly,
        Common.ValueList      : {
            CollectionPath: 'Equipment',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: equipment_ID,
                    ValueListProperty: 'ID'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'equipmentName'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'serialNumber'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'currentStatus'
                }
            ]
        }
    );
    rental    @(
        Common.Text           : rental.customer.companyName,
        Common.TextArrangement: #TextOnly,
        Common.ValueList      : {
            CollectionPath: 'Rentals',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: rental_ID,
                    ValueListProperty: 'ID'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'customer_ID'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'rentalDate'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'rentalStatus'
                }
            ]
        }
    );
};

annotate ret.DamageRecords with {
    conditionLog @(
        Common.Text           : conditionLog.equipment.equipmentName,
        Common.TextArrangement: #TextOnly,
        Common.ValueList      : {
            CollectionPath: 'ConditionLogs',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: conditionLog_ID,
                    ValueListProperty: 'ID'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'equipment_ID'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'inspectionType'
                },
                {
                    $Type            : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty: 'inspectionDate'
                }
            ]
        }
    );
};

// ---------- Dropdowns from the code lists ----------
annotate ret.Rentals with {
    rentalStatus @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: rentalStatus,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'RentalStatus'
                }
            ]
        }
    );
};

annotate ret.RentalItems with {
    itemStatus @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: itemStatus,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'ItemStatus'
                }
            ]
        }
    );
};

annotate ret.Equipment with {
    currentStatus @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: currentStatus,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'EquipmentStatus'
                }
            ]
        }
    );
    equipmentType @(Common.ValueList: {
        CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
        Parameters    : [
            {
                $Type            : 'Common.ValueListParameterOut',
                LocalDataProperty: equipmentType,
                ValueListProperty: 'code'
            },
            {
                $Type            : 'Common.ValueListParameterConstant',
                ValueListProperty: 'list',
                Constant         : 'EquipmentType'
            }
        ]
    });
};

annotate ret.Locations with {
    locationType @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: locationType,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'LocationType'
                }
            ]
        }
    );
};

annotate ret.MaintenanceRecords with {
    maintenanceType @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: maintenanceType,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'MaintenanceType'
                }
            ]
        }
    );
    status          @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: status,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'MaintenanceStatus'
                }
            ]
        }
    );
};

annotate ret.ConditionLogs with {
    inspectionType @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: inspectionType,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'InspectionType'
                }
            ]
        }
    );
    conditionGrade @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: conditionGrade,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'ConditionGrade'
                }
            ]
        }
    );
};

annotate ret.DamageRecords with {
    damageType   @(Common.ValueList: {
        CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
        Parameters    : [
            {
                $Type            : 'Common.ValueListParameterOut',
                LocalDataProperty: damageType,
                ValueListProperty: 'code'
            },
            {
                $Type            : 'Common.ValueListParameterConstant',
                ValueListProperty: 'list',
                Constant         : 'DamageType'
            }
        ]
    });
    severity     @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: severity,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'Severity'
                }
            ]
        }
    );
    damageStatus @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: damageStatus,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'DamageStatus'
                }
            ]
        }
    );
};

annotate ret.DamageCatalogue with {
    damageType @(Common.ValueList: {
        CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
        Parameters    : [
            {
                $Type            : 'Common.ValueListParameterOut',
                LocalDataProperty: damageType,
                ValueListProperty: 'code'
            },
            {
                $Type            : 'Common.ValueListParameterConstant',
                ValueListProperty: 'list',
                Constant         : 'DamageType'
            }
        ]
    });
    severity   @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: severity,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'Severity'
                }
            ]
        }
    );
};

annotate ret.RepairBills with {
    billingStatus @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: billingStatus,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'BillingStatus'
                }
            ]
        }
    );
};

annotate ret.OutboxMessages with {
    status @(
        Common.ValueListWithFixedValues,
        Common.ValueList: {
            CollectionPath              : 'CodeLists',
            PresentationVariantQualifier: 'SortOrder',
            Parameters    : [
                {
                    $Type            : 'Common.ValueListParameterOut',
                    LocalDataProperty: status,
                    ValueListProperty: 'code'
                },
                {
                    $Type            : 'Common.ValueListParameterConstant',
                    ValueListProperty: 'list',
                    Constant         : 'OutboxStatus'
                }
            ]
        }
    );
};
