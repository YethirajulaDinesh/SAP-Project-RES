using MaintenanceManagementService as service from '../../srv/maintenance-service';

annotate service.MaintenanceRecords with {
    status @readonly;
};

annotate service.ConditionLogs with {
    inspectorName @readonly;
};

annotate service.DamageRecords with {
    damageStatus   @readonly;
    customerLiable @readonly;
    liabilityNote  @readonly;
};

annotate service.DamagePhotos with {
    sha256Hash @readonly;
    uploadedAt @readonly;
    uploadedBy @readonly;
    storageUrl @readonly;
};

// ---------- MAINTENANCE PLANNER / REPAIR JOBS (FR-012, FR-013) ----------
annotate service.MaintenanceRecords with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>maintenanceRecord}',
        TypeNamePlural: '{i18n>maintenanceRecords}',
        Title         : {Value: equipment.equipmentName},
        Description   : {Value: maintenanceType}
    },
    UI.HeaderFacets       : [
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Status'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Cost'
        }
    ],
    UI.DataPoint #Status  : {
        Value      : status,
        Title      : '{i18n>status}',
        Criticality: statusCriticality
    },
    UI.DataPoint #Cost    : {
        Value: cost,
        Title: '{i18n>cost}'
    },
    UI.SelectionFields    : [
        equipment_ID,
        maintenanceType,
        status,
        maintenanceDate,
        serviceProvider
    ],
    UI.LineItem           : [
        {
            Value: equipment_ID,

            @HTML5.CssDefaults: {width: '12rem'},
            Label: '{i18n>equipment}'
        },
        {
            Value: equipment.serialNumber,

            @HTML5.CssDefaults: {width: '10rem'},
            Label: '{i18n>serialNumber}'
        },
        {Value: maintenanceType, @HTML5.CssDefaults: {width: '8rem'}},
        {Value: maintenanceDate},
        {
            Value: status,

            @HTML5.CssDefaults: {width: '8rem'},
            Criticality: statusCriticality
        },
        {Value: serviceProvider, @HTML5.CssDefaults: {width: '12rem'}},
        {Value: cost},
        {Value: nextMaintenanceDate},
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'MaintenanceManagementService.startWork',
            Label : '{i18n>startWork}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'MaintenanceManagementService.completeWork',
            Label : '{i18n>completeWork}'
        }
    ],
    UI.PresentationVariant: {
        SortOrder     : [{
            Property  : maintenanceDate,
            Descending: false
        }],
        Visualizations: ['@UI.LineItem']
    },
    UI.Identification     : [
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'MaintenanceManagementService.startWork',
            Label : '{i18n>startWork}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'MaintenanceManagementService.completeWork',
            Label : '{i18n>completeWork}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'MaintenanceManagementService.cancelWork',
            Label : '{i18n>cancelWork}'
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
            Label : '{i18n>costSchedule}',
            Target: '@UI.FieldGroup#Cost'
        }
    ],
    UI.FieldGroup #General: {Data: [
        {Value: equipment_ID},
        {Value: maintenanceType},
        {Value: maintenanceDate},
        {Value: serviceProvider},
        {Value: description}
    ]},
    UI.FieldGroup #Cost   : {Data: [
        {
            Value      : status,
            Criticality: statusCriticality
        },
        {Value: cost},
        {Value: nextMaintenanceDate}
    ]}
);

annotate service.MaintenanceRecords actions {
    startWork    @(Core.OperationAvailable: {$edmJson: {$Eq: [
        {$Path: 'in/status'},
        'Scheduled'
    ]}});
    completeWork @(Core.OperationAvailable: {$edmJson: {$Or: [
        {$Eq: [
            {$Path: 'in/status'},
            'Scheduled'
        ]},
        {$Eq: [
            {$Path: 'in/status'},
            'In Progress'
        ]}
    ]}});
    cancelWork   @(Core.OperationAvailable: {$edmJson: {$Or: [
        {$Eq: [
            {$Path: 'in/status'},
            'Scheduled'
        ]},
        {$Eq: [
            {$Path: 'in/status'},
            'In Progress'
        ]}
    ]}});
};

// ---------- INSPECTIONS / CONDITION LOGS (FR-005, FR-014, FR-015) ----------
// saved inspections are immutable: no Edit / Delete buttons (the service rejects changes as well)
annotate service.ConditionLogs with @(
    UI.UpdateHidden: true,
    UI.DeleteHidden: true
);

annotate service.ConditionLogs with @(
    UI.HeaderInfo            : {
        TypeName      : '{i18n>conditionLog}',
        TypeNamePlural: '{i18n>conditionLogs}',
        Title         : {Value: equipment.equipmentName},
        Description   : {Value: inspectionType}
    },
    UI.HeaderFacets          : [
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Grade'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Meter'
        }
    ],
    UI.DataPoint #Grade      : {
        Value      : conditionGrade,
        Title      : '{i18n>conditionGrade}',
        Criticality: gradeCriticality
    },
    UI.DataPoint #Meter      : {
        Value: meterReading,
        Title: '{i18n>meterReading}'
    },
    UI.SelectionFields       : [
        equipment_ID,
        inspectionType,
        conditionGrade,
        rental_ID,
        inspectorName
    ],
    UI.LineItem              : [
        {Value: inspectionDate},
        {
            Value: equipment_ID,

            @HTML5.CssDefaults: {width: '12rem'},
            Label: '{i18n>equipment}'
        },
        {Value: inspectionType, @HTML5.CssDefaults: {width: '8rem'}},
        {
            Value: conditionGrade,

            @HTML5.CssDefaults: {width: '6rem'},
            Criticality: gradeCriticality
        },
        {
            Value: rental_ID,

            @HTML5.CssDefaults: {width: '12rem'},
            Label: '{i18n>customer}'
        },
        {Value: inspectorName, @HTML5.CssDefaults: {width: '11rem'}},
        {Value: meterReading}
    ],
    UI.PresentationVariant   : {
        SortOrder     : [{
            Property  : inspectionDate,
            Descending: true
        }],
        Visualizations: ['@UI.LineItem']
    },
    UI.Facets                : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>inspection}',
            Target: '@UI.FieldGroup#Inspection'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>damages}',
            Target: 'damages/@UI.LineItem'
        }
    ],
    UI.FieldGroup #Inspection: {Data: [
        {Value: equipment_ID},
        {Value: rental_ID},
        {Value: inspectionType},
        {Value: inspectionDate},
        {
            Value      : conditionGrade,
            Criticality: gradeCriticality
        },
        {Value: meterReading},
        {Value: inspectorName},
        {Value: notes}
    ]}
);

annotate service.DamageRecords with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>damageRecord}',
        TypeNamePlural: '{i18n>damageRecords}',
        Title         : {Value: damageType},
        Description   : {Value: severity}
    },
    UI.LineItem           : [
        {Value: damageType, @HTML5.CssDefaults: {width: '9rem'}},
        {Value: severity, @HTML5.CssDefaults: {width: '7rem'}},
        {Value: damageDescription, @HTML5.CssDefaults: {width: '16rem'}},
        {Value: repairEstimate},
        {Value: customerLiable},
        {
            Value: damageStatus,

            @HTML5.CssDefaults: {width: '8rem'},
            Criticality: statusCriticality
        }
    ],
    UI.Facets             : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>damage}',
            Target: '@UI.FieldGroup#Damage'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>photos}',
            Target: 'photos/@UI.LineItem'
        }
    ],
    UI.FieldGroup #Damage : {Data: [
        {Value: damageType},
        {Value: severity},
        {Value: damageDescription},
        {Value: repairEstimate},
        {Value: customerLiable},
        {Value: liabilityNote},
        {Value: damageStatus}
    ]}
);

annotate service.DamagePhotos with @(
    UI.HeaderInfo       : {
        TypeName      : '{i18n>damagePhoto}',
        TypeNamePlural: '{i18n>photos}',
        Title         : {Value: fileName}
    },
    UI.LineItem         : [
        {Value: photoContent},
        {Value: fileName, @HTML5.CssDefaults: {width: '10rem'}},
        {Value: uploadedAt},
        {Value: uploadedBy},
        {Value: sha256Hash, @HTML5.CssDefaults: {width: '12rem'}}
    ],
    UI.Facets           : [{
        $Type : 'UI.ReferenceFacet',
        Label : '{i18n>photo}',
        Target: '@UI.FieldGroup#Photo'
    }],
    UI.FieldGroup #Photo: {Data: [
        {Value: photoContent},
        {Value: fileName},
        {Value: mediaType},
        {Value: uploadedAt},
        {Value: uploadedBy},
        {Value: sha256Hash}
    ]}
);
