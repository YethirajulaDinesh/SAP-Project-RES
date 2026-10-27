using RentalManagementService as service from '../../srv/rental-service';

annotate service.Rentals with {
    rentalStatus      @readonly;
    totalRentalAmount @readonly;
    actualReturnDate  @readonly;
};

annotate service.RentalItems with {
    itemStatus @readonly;
};

annotate service.Equipment with {
    currentStatus @readonly;
};

// ---------- CUSTOMERS (FR-001) ----------
annotate service.Customers with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>customer}',
        TypeNamePlural: '{i18n>customers}',
        Title         : {Value: companyName},
        Description   : {Value: contactPerson}
    },
    UI.SelectionFields    : [
        companyName,
        contactPerson,
        s4CustomerId
    ],
    UI.LineItem           : [
        {Value: companyName, @HTML5.CssDefaults: {width: '13rem'}},
        {Value: contactPerson, @HTML5.CssDefaults: {width: '10rem'}},
        {Value: email, @HTML5.CssDefaults: {width: '14rem'}},
        {Value: phone, @HTML5.CssDefaults: {width: '9rem'}},
        {Value: s4CustomerId, @HTML5.CssDefaults: {width: '8rem'}}
    ],
    UI.Facets             : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>general}',
            Target: '@UI.FieldGroup#General'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>rentals}',
            Target: 'rentals/@UI.LineItem#ByCustomer'
        }
    ],
    UI.FieldGroup #General: {Data: [
        {Value: companyName},
        {Value: contactPerson},
        {Value: email},
        {Value: phone},
        {Value: address},
        {Value: s4CustomerId}
    ]}
);

// ---------- RENTALS (FR-002, FR-003, FR-008, FR-009) ----------
annotate service.Rentals with @(
    UI.HeaderInfo                  : {
        TypeName      : '{i18n>rental}',
        TypeNamePlural: '{i18n>rentals}',
        Title         : {Value: customer.companyName},
        Description   : {Value: rentalStatus}
    },
    UI.HeaderFacets                : [
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Status'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Total'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Overdue'
        }
    ],
    UI.DataPoint #Status           : {
        Value      : rentalStatus,
        Title      : '{i18n>rentalStatus}',
        Criticality: statusCriticality
    },
    UI.DataPoint #Total            : {
        Value: totalRentalAmount,
        Title: '{i18n>totalRentalAmount}'
    },
    UI.DataPoint #Overdue          : {
        Value: overdueDays,
        Title: '{i18n>overdueDays}'
    },
    UI.SelectionFields             : [
        customer_ID,
        rentalStatus,
        rentalDate,
        expectedReturnDate
    ],
    UI.LineItem                    : [
        {
            Value: customer_ID,

            @HTML5.CssDefaults: {width: '12rem'},
            Label: '{i18n>customer}'
        },
        {Value: rentalDate},
        {Value: expectedReturnDate},
        {Value: actualReturnDate},
        {
            Value: rentalStatus,

            @HTML5.CssDefaults: {width: '8rem'},
            Criticality: statusCriticality
        },
        {Value: overdueDays},
        {Value: totalRentalAmount},
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'RentalManagementService.checkOut',
            Label : '{i18n>checkOut}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'RentalManagementService.returnRental',
            Label : '{i18n>returnRental}'
        }
    ],
    UI.LineItem #ByCustomer        : [
        {Value: rentalDate},
        {Value: expectedReturnDate},
        {Value: actualReturnDate},
        {
            Value: rentalStatus,

            @HTML5.CssDefaults: {width: '8rem'},
            Criticality: statusCriticality
        },
        {Value: totalRentalAmount}
    ],
    UI.PresentationVariant         : {
        SortOrder     : [{
            Property  : rentalDate,
            Descending: true
        }],
        Visualizations: ['@UI.LineItem']
    },
    UI.Identification              : [
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'RentalManagementService.checkOut',
            Label : '{i18n>checkOut}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'RentalManagementService.returnRental',
            Label : '{i18n>returnRental}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'RentalManagementService.closeRental',
            Label : '{i18n>closeRental}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'RentalManagementService.cancelRental',
            Label : '{i18n>cancelRental}'
        }
    ],
    UI.Facets                      : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>general}',
            Target: '@UI.FieldGroup#General'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>rentalItems}',
            Target: 'items/@UI.LineItem'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>inspections}',
            Target: 'conditionLogs/@UI.LineItem#ByRental'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>statusHistory}',
            Target: 'statusHistory/@UI.LineItem'
        }
    ],
    UI.FieldGroup #General         : {Data: [
        {Value: customer_ID},
        {Value: rentalDate},
        {Value: expectedReturnDate},
        {Value: actualReturnDate},
        {
            Value      : rentalStatus,
            Criticality: statusCriticality
        },
        {Value: totalRentalAmount},
        {Value: overdueDays}
    ]}
);

annotate service.Rentals actions {
    checkOut     @(
        Core.OperationAvailable: {$edmJson: {$Eq: [
            {$Path: 'in/rentalStatus'},
            'Booked'
        ]}},
        Common.SideEffects     : {TargetEntities: [
            'in/items',
            'in/statusHistory'
        ]}
    );
    returnRental @(
        Core.OperationAvailable: {$edmJson: {$Eq: [
            {$Path: 'in/rentalStatus'},
            'Checked Out'
        ]}},
        Common.SideEffects     : {TargetEntities: [
            'in/items',
            'in/statusHistory'
        ]}
    );
    closeRental  @(
        Core.OperationAvailable: {$edmJson: {$Eq: [
            {$Path: 'in/rentalStatus'},
            'Returned'
        ]}},
        Common.SideEffects     : {TargetEntities: ['in/statusHistory']}
    );
    cancelRental @(
        Core.OperationAvailable: {$edmJson: {$Eq: [
            {$Path: 'in/rentalStatus'},
            'Booked'
        ]}},
        Common.SideEffects     : {TargetEntities: [
            'in/items',
            'in/statusHistory'
        ]}
    );
};

annotate service.RentalItems with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>rentalItem}',
        TypeNamePlural: '{i18n>rentalItems}',
        Title         : {Value: equipment.equipmentName},
        Description   : {Value: equipment.serialNumber}
    },
    UI.LineItem           : [
        {Value: equipment_ID, @HTML5.CssDefaults: {width: '12rem'}},
        {
            Value: equipment.serialNumber,

            @HTML5.CssDefaults: {width: '10rem'},
            Label: '{i18n>serialNumber}'
        },
        {Value: startDate},
        {Value: endDate},
        {Value: dailyRentalRate},
        {Value: rentalDays},
        {Value: lineAmount},
        {
            Value: itemStatus,

            @HTML5.CssDefaults: {width: '8rem'},
            Criticality: statusCriticality
        }
    ],
    UI.LineItem #ByEquipment: [
        {
            Value: rental.customer.companyName,

            @HTML5.CssDefaults: {width: '13rem'},
            Label: '{i18n>customer}'
        },
        {Value: startDate},
        {Value: endDate},
        {Value: dailyRentalRate},
        {
            Value: itemStatus,

            @HTML5.CssDefaults: {width: '8rem'},
            Criticality: statusCriticality
        }
    ],
    UI.Facets             : [{
        $Type : 'UI.ReferenceFacet',
        Label : '{i18n>general}',
        Target: '@UI.FieldGroup#General'
    }],
    UI.FieldGroup #General: {Data: [
        {Value: equipment_ID},
        {Value: startDate},
        {Value: endDate},
        {Value: dailyRentalRate},
        {Value: itemStatus}
    ]},
    Common.SideEffects #Rate: {
        SourceProperties: ['equipment_ID'],
        TargetProperties: ['dailyRentalRate']
    }
);

annotate service.RentalStatusHistory with @(
    UI.LineItem            : [
        {Value: changedAt},
        {Value: fromStatus, @HTML5.CssDefaults: {width: '9rem'}},
        {Value: toStatus, @HTML5.CssDefaults: {width: '9rem'}},
        {Value: changedBy, @HTML5.CssDefaults: {width: '11rem'}},
        {Value: remarks, @HTML5.CssDefaults: {width: '14rem'}}
    ],
    UI.PresentationVariant: {
        SortOrder     : [{
            Property  : changedAt,
            Descending: true
        }],
        Visualizations: ['@UI.LineItem']
    }
);

annotate service.InspectionHistory with @(
    UI.LineItem         : [
        {Value: inspectionDate},
        {Value: inspectionType, @HTML5.CssDefaults: {width: '8rem'}},
        {
            Value: conditionGrade,

            @HTML5.CssDefaults: {width: '6rem'},
            Criticality: gradeCriticality
        },
        {Value: inspectorName, @HTML5.CssDefaults: {width: '11rem'}},
        {Value: meterReading},
        {Value: notes, @HTML5.CssDefaults: {width: '12rem'}}
    ],
    UI.LineItem #ByRental: [
        {Value: inspectionDate},
        {Value: equipment.equipmentName, Label: '{i18n>equipment}'},
        {Value: inspectionType, @HTML5.CssDefaults: {width: '8rem'}},
        {
            Value: conditionGrade,

            @HTML5.CssDefaults: {width: '6rem'},
            Criticality: gradeCriticality
        },
        {Value: inspectorName, @HTML5.CssDefaults: {width: '11rem'}}
    ]
);

annotate service.MaintenanceHistory with @(UI.LineItem: [
    {Value: maintenanceDate},
    {Value: maintenanceType, @HTML5.CssDefaults: {width: '8rem'}},
    {
        Value: status,

        @HTML5.CssDefaults: {width: '8rem'},
        Criticality: statusCriticality
    },
    {Value: serviceProvider, @HTML5.CssDefaults: {width: '12rem'}},
    {Value: cost},
    {Value: nextMaintenanceDate},
    {Value: description, @HTML5.CssDefaults: {width: '14rem'}}
]);

annotate service.DamageHistory with @(UI.LineItem: [
    {Value: inspectionDate},
    {Value: damageType, @HTML5.CssDefaults: {width: '9rem'}},
    {Value: severity, @HTML5.CssDefaults: {width: '7rem'}},
    {Value: damageDescription, @HTML5.CssDefaults: {width: '16rem'}},
    {Value: customerLiable},
    {
        Value: damageStatus,

        @HTML5.CssDefaults: {width: '8rem'},
        Criticality: statusCriticality
    },
    {Value: billedAmount},
    {Value: s4BillingDocumentId, @HTML5.CssDefaults: {width: '9rem'}}
]);

annotate service.LocationTransfers with @(UI.LineItem: [
    {Value: transferDate},
    {Value: fromLocation_ID, @HTML5.CssDefaults: {width: '11rem'}},
    {Value: toLocation_ID, @HTML5.CssDefaults: {width: '11rem'}},
    {Value: transferredBy, @HTML5.CssDefaults: {width: '11rem'}},
    {Value: reason, @HTML5.CssDefaults: {width: '14rem'}}
]);

// ---------- EQUIPMENT: Fleet list and Asset Detail (FR-004, FR-010, FR-011, FR-020) ----------
annotate service.Equipment with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>equipment}',
        TypeNamePlural: '{i18n>equipmentPlural}',
        Title         : {Value: equipmentName},
        Description   : {Value: serialNumber}
    },
    UI.HeaderFacets       : [
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Status'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Custodian'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#NextService'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Rate'
        }
    ],
    UI.DataPoint #Status  : {
        Value      : currentStatus,
        Title      : '{i18n>currentStatus}',
        Criticality: statusCriticality
    },
    UI.DataPoint #Custodian: {
        Value: custodian,
        Title: '{i18n>custodian}'
    },
    UI.DataPoint #NextService: {
        Value: nextServiceDate,
        Title: '{i18n>nextServiceDate}'
    },
    UI.DataPoint #Rate    : {
        Value: rentalRatePerDay,
        Title: '{i18n>rentalRatePerDay}'
    },
    UI.SelectionFields    : [
        equipmentType,
        currentStatus,
        location_ID,
        manufacturer
    ],
    UI.LineItem           : [
        {Value: equipmentName, @HTML5.CssDefaults: {width: '13rem'}},
        {Value: serialNumber, @HTML5.CssDefaults: {width: '11rem'}},
        {Value: equipmentType, @HTML5.CssDefaults: {width: '9rem'}},
        {Value: manufacturer, @HTML5.CssDefaults: {width: '9rem'}},
        {Value: model, @HTML5.CssDefaults: {width: '8rem'}},
        {
            Value: location_ID,

            @HTML5.CssDefaults: {width: '11rem'},
            Label: '{i18n>location}'
        },
        {
            Value: currentStatus,

            @HTML5.CssDefaults: {width: '9rem'},
            Criticality: statusCriticality
        },
        {Value: rentalRatePerDay},
        {Value: nextServiceDate}
    ],
    UI.Identification     : [
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'RentalManagementService.transferLocation',
            Label : '{i18n>transferLocation}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'RentalManagementService.quarantine',
            Label : '{i18n>quarantine}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'RentalManagementService.releaseQuarantine',
            Label : '{i18n>releaseQuarantine}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'RentalManagementService.retireEquipment',
            Label : '{i18n>retireEquipment}'
        }
    ],
    UI.Facets             : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>general}',
            Target: '@UI.FieldGroup#General'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>rentals}',
            Target: 'rentalItems/@UI.LineItem#ByEquipment'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>inspections}',
            Target: 'conditionLogs/@UI.LineItem'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>damageHistory}',
            Target: 'damageHistory/@UI.LineItem'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>maintenanceRepairs}',
            Target: 'maintenanceRecords/@UI.LineItem'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>locationHistory}',
            Target: 'transfers/@UI.LineItem'
        }
    ],
    UI.FieldGroup #General: {Data: [
        {Value: equipmentName},
        {Value: equipmentType},
        {Value: manufacturer},
        {Value: model},
        {Value: serialNumber},
        {Value: purchaseDate},
        {Value: rentalRatePerDay},
        {Value: location_ID}
    ]}
);

annotate service.Equipment actions {
    transferLocation  @(
        Core.OperationAvailable: {$edmJson: {$Ne: [
            {$Path: 'in/currentStatus'},
            'Rented Out'
        ]}},
        Common.SideEffects     : {TargetEntities: ['in/transfers']}
    );
    quarantine        @(Core.OperationAvailable: {$edmJson: {$Or: [
        {$Eq: [
            {$Path: 'in/currentStatus'},
            'Available'
        ]},
        {$Eq: [
            {$Path: 'in/currentStatus'},
            'Damaged'
        ]},
        {$Eq: [
            {$Path: 'in/currentStatus'},
            'Under Inspection'
        ]}
    ]}});
    releaseQuarantine @(Core.OperationAvailable: {$edmJson: {$Or: [
        {$Eq: [
            {$Path: 'in/currentStatus'},
            'Quarantined'
        ]},
        {$Eq: [
            {$Path: 'in/currentStatus'},
            'Damaged'
        ]},
        {$Eq: [
            {$Path: 'in/currentStatus'},
            'In Maintenance'
        ]}
    ]}});
    retireEquipment   @(Core.OperationAvailable: {$edmJson: {$Ne: [
        {$Path: 'in/currentStatus'},
        'Rented Out'
    ]}});
};

// ---------- LOCATIONS (FR-010) ----------
annotate service.Locations with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>location}',
        TypeNamePlural: '{i18n>locations}',
        Title         : {Value: locationName},
        Description   : {Value: city}
    },
    UI.SelectionFields    : [
        locationType,
        city
    ],
    UI.LineItem           : [
        {Value: locationName, @HTML5.CssDefaults: {width: '12rem'}},
        {Value: locationType, @HTML5.CssDefaults: {width: '8rem'}},
        {Value: city, @HTML5.CssDefaults: {width: '8rem'}},
        {Value: address, @HTML5.CssDefaults: {width: '14rem'}},
        {Value: latitude},
        {Value: longitude},
        {Value: equipmentCount}
    ],
    UI.Facets             : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>general}',
            Target: '@UI.FieldGroup#General'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>equipmentPlural}',
            Target: 'equipment/@UI.LineItem#ByLocation'
        }
    ],
    UI.FieldGroup #General: {Data: [
        {Value: locationName},
        {Value: locationType},
        {Value: address},
        {Value: city},
        {Value: latitude},
        {Value: longitude}
    ]}
);

annotate service.Equipment with @(UI.LineItem #ByLocation: [
    {Value: equipmentName, @HTML5.CssDefaults: {width: '13rem'}},
    {Value: serialNumber, @HTML5.CssDefaults: {width: '11rem'}},
    {Value: equipmentType, @HTML5.CssDefaults: {width: '9rem'}},
    {
        Value: currentStatus,

        @HTML5.CssDefaults: {width: '9rem'},
        Criticality: statusCriticality
    }
]);
