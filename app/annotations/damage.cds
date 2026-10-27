using DamageManagementService as service from '../../srv/damage-service';

annotate service.DamageRecords with {
    damageStatus @readonly;
    liabilityNote @readonly;
};

annotate service.DamagePhotos with {
    sha256Hash @readonly;
    uploadedAt @readonly;
    uploadedBy @readonly;
    storageUrl @readonly;
};

// ---------- DAMAGE RECORDS / INSPECTION REVIEW (FR-006, FR-016 - FR-021) ----------
annotate service.DamageRecords with @(
    UI.HeaderInfo            : {
        TypeName      : '{i18n>damageRecord}',
        TypeNamePlural: '{i18n>damageRecords}',
        Title         : {Value: damageType},
        Description   : {Value: conditionLog.equipment.equipmentName}
    },
    UI.HeaderFacets          : [
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Status'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Severity'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Estimate'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Target: '@UI.DataPoint#Photos'
        }
    ],
    UI.DataPoint #Status     : {
        Value      : damageStatus,
        Title      : '{i18n>damageStatus}',
        Criticality: statusCriticality
    },
    UI.DataPoint #Severity   : {
        Value: severity,
        Title: '{i18n>severity}'
    },
    UI.DataPoint #Estimate   : {
        Value: repairEstimate,
        Title: '{i18n>repairEstimate}'
    },
    UI.DataPoint #Photos     : {
        Value: photoCount,
        Title: '{i18n>photoCount}'
    },
    UI.SelectionFields       : [
        damageStatus,
        severity,
        damageType,
        customerLiable
    ],
    UI.LineItem              : [
        {Value: damageType, @HTML5.CssDefaults: {width: '9rem'}},
        {
            Value: conditionLog_ID,

            @HTML5.CssDefaults: {width: '12rem'},
            Label: '{i18n>equipment}'
        },
        {
            Value: conditionLog.inspectionDate,
            Label: '{i18n>inspectionDate}'
        },
        {Value: severity, @HTML5.CssDefaults: {width: '7rem'}},
        {Value: damageDescription, @HTML5.CssDefaults: {width: '16rem'}},
        {Value: repairEstimate},
        {Value: customerLiable},
        {
            Value: damageStatus,

            @HTML5.CssDefaults: {width: '8rem'},
            Criticality: statusCriticality
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.confirmDamage',
            Label : '{i18n>confirmDamage}'
        }
    ],
    UI.PresentationVariant   : {
        SortOrder     : [{
            Property  : createdAt,
            Descending: true
        }],
        Visualizations: ['@UI.LineItem']
    },
    UI.Identification        : [
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.confirmDamage',
            Label : '{i18n>confirmDamage}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.generateBill',
            Label : '{i18n>generateBill}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.waiveDamage',
            Label : '{i18n>waiveDamage}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.closeDamage',
            Label : '{i18n>closeDamage}'
        }
    ],
    UI.Facets                : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>damage}',
            Target: '@UI.FieldGroup#Damage'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>liability}',
            Target: '@UI.FieldGroup#Liability'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>inspection}',
            Target: '@UI.FieldGroup#Inspection'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>photos}',
            Target: 'photos/@UI.LineItem'
        }
    ],
    UI.FieldGroup #Damage    : {Data: [
        {Value: conditionLog_ID},
        {Value: damageType},
        {Value: severity},
        {Value: damageDescription},
        {Value: repairEstimate}
    ]},
    UI.FieldGroup #Liability : {Data: [
        {Value: customerLiable},
        {Value: liabilityNote},
        {
            Value      : damageStatus,
            Criticality: statusCriticality
        }
    ]},
    UI.FieldGroup #Inspection: {Data: [
        {
            Value: conditionLog.equipment.equipmentName,
            Label: '{i18n>equipment}'
        },
        {
            Value: conditionLog.equipment.serialNumber,
            Label: '{i18n>serialNumber}'
        },
        {
            Value: conditionLog.inspectionType,
            Label: '{i18n>inspectionType}'
        },
        {
            Value: conditionLog.inspectionDate,
            Label: '{i18n>inspectionDate}'
        },
        {
            Value      : conditionLog.conditionGrade,
            Label      : '{i18n>conditionGrade}',
            Criticality: conditionLog.gradeCriticality
        },
        {
            Value: conditionLog.inspectorName,
            Label: '{i18n>inspectorName}'
        },
        {
            Value: conditionLog.rental.customer.companyName,
            Label: '{i18n>customer}'
        }
    ]}
);

annotate service.DamageRecords actions {
    confirmDamage @(Core.OperationAvailable: {$edmJson: {$Eq: [
        {$Path: 'in/damageStatus'},
        'Reported'
    ]}});
    waiveDamage   @(Core.OperationAvailable: {$edmJson: {$Or: [
        {$Eq: [
            {$Path: 'in/damageStatus'},
            'Reported'
        ]},
        {$Eq: [
            {$Path: 'in/damageStatus'},
            'Confirmed'
        ]}
    ]}});
    closeDamage   @(Core.OperationAvailable: {$edmJson: {$Or: [
        {$Eq: [
            {$Path: 'in/damageStatus'},
            'Repaired'
        ]},
        {$Eq: [
            {$Path: 'in/damageStatus'},
            'Billed'
        ]}
    ]}});
    generateBill  @(Core.OperationAvailable: {$edmJson: {$And: [
        {$Eq: [
            {$Path: 'in/customerLiable'},
            true
        ]},
        {$Ne: [
            {$Path: 'in/damageStatus'},
            'Reported'
        ]}
    ]}});
};

annotate service.DamagePhotos with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>damagePhoto}',
        TypeNamePlural: '{i18n>photos}',
        Title         : {Value: fileName},
        Description   : {Value: uploadedBy}
    },
    UI.LineItem           : [
        {Value: photoContent},
        {Value: fileName, @HTML5.CssDefaults: {width: '10rem'}},
        {Value: uploadedAt},
        {Value: uploadedBy},
        {Value: sha256Hash, @HTML5.CssDefaults: {width: '12rem'}}
    ],
    UI.Facets             : [{
        $Type : 'UI.ReferenceFacet',
        Label : '{i18n>photo}',
        Target: '@UI.FieldGroup#Photo'
    }],
    UI.FieldGroup #Photo  : {Data: [
        {Value: photoContent},
        {Value: fileName},
        {Value: mediaType},
        {Value: uploadedAt},
        {Value: uploadedBy},
        {Value: sha256Hash},
        {Value: storageUrl}
    ]}
);

// ---------- DAMAGE CHARGE APPROVAL (FR-007, FR-025) ----------
annotate service.RepairBills with @(
    UI.HeaderInfo          : {
        TypeName      : '{i18n>repairBill}',
        TypeNamePlural: '{i18n>repairBills}',
        Title         : {Value: customer.companyName},
        Description   : {Value: damage.damageType}
    },
    UI.HeaderFacets        : [
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
            Target: '@UI.DataPoint#S4'
        }
    ],
    UI.DataPoint #Status   : {
        Value      : billingStatus,
        Title      : '{i18n>billingStatus}',
        Criticality: statusCriticality
    },
    UI.DataPoint #Total    : {
        Value: totalAmount,
        Title: '{i18n>totalAmount}'
    },
    UI.DataPoint #S4       : {
        Value: s4BillingDocumentId,
        Title: '{i18n>s4BillingDocumentId}'
    },
    UI.SelectionFields     : [
        billingStatus,
        customer_ID,
        billDate,
        autoApproved
    ],
    UI.LineItem            : [
        {Value: billDate},
        {
            Value: customer_ID,

            @HTML5.CssDefaults: {width: '12rem'},
            Label: '{i18n>customer}'
        },
        {
            Value: damage_ID,

            @HTML5.CssDefaults: {width: '9rem'},
            Label: '{i18n>damageType}'
        },
        {Value: repairAmount},
        {Value: taxAmount},
        {Value: totalAmount},
        {
            Value: billingStatus,

            @HTML5.CssDefaults: {width: '9rem'},
            Criticality: statusCriticality
        },
        {Value: autoApproved},
        {Value: s4BillingDocumentId, @HTML5.CssDefaults: {width: '9rem'}},
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.approveCharge',
            Label : '{i18n>approve}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.rejectCharge',
            Label : '{i18n>reject}'
        }
    ],
    UI.PresentationVariant : {
        SortOrder     : [{
            Property  : billDate,
            Descending: true
        }],
        Visualizations: ['@UI.LineItem']
    },
    UI.Identification      : [
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.approveCharge',
            Label : '{i18n>approve}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.adjustCharge',
            Label : '{i18n>adjust}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.rejectCharge',
            Label : '{i18n>reject}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.disputeCharge',
            Label : '{i18n>dispute}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'DamageManagementService.resolveDispute',
            Label : '{i18n>resolveDispute}'
        }
    ],
    UI.Facets              : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>charge}',
            Target: '@UI.FieldGroup#Charge'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>damage}',
            Target: '@UI.FieldGroup#Damage'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>decision}',
            Target: '@UI.FieldGroup#Decision'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>auditTrail}',
            Target: 'history/@UI.LineItem'
        }
    ],
    UI.FieldGroup #Charge  : {Data: [
        {Value: billDate},
        {Value: customer_ID},
        {
            Value: customer.s4CustomerId,
            Label: '{i18n>s4CustomerId}'
        },
        {Value: repairAmount},
        {Value: taxAmount},
        {Value: totalAmount}
    ]},
    UI.FieldGroup #Damage  : {Data: [
        {
            Value: damage.damageType,
            Label: '{i18n>damageType}'
        },
        {
            Value: damage.severity,
            Label: '{i18n>severity}'
        },
        {
            Value: damage.damageDescription,
            Label: '{i18n>damageDescription}'
        },
        {
            Value: damage.repairEstimate,
            Label: '{i18n>repairEstimate}'
        },
        {
            Value: damage.conditionLog.equipment.equipmentName,
            Label: '{i18n>equipment}'
        },
        {
            Value: rental.rentalDate,
            Label: '{i18n>rentalDate}'
        },
        {
            Value: rental.actualReturnDate,
            Label: '{i18n>actualReturnDate}'
        }
    ]},
    UI.FieldGroup #Decision: {Data: [
        {
            Value      : billingStatus,
            Criticality: statusCriticality
        },
        {Value: autoApproved},
        {Value: decisionBy},
        {Value: decisionAt},
        {Value: decisionReason},
        {Value: s4BillingDocumentId}
    ]}
);

annotate service.RepairBills actions {
    approveCharge  @(Core.OperationAvailable: {$edmJson: {$Eq: [
        {$Path: 'in/billingStatus'},
        'Pending Approval'
    ]}}, Common.SideEffects: {TargetEntities: ['in/history']});
    adjustCharge   @(Core.OperationAvailable: {$edmJson: {$Or: [
        {$Eq: [
            {$Path: 'in/billingStatus'},
            'Pending Approval'
        ]},
        {$Eq: [
            {$Path: 'in/billingStatus'},
            'Disputed'
        ]}
    ]}}, Common.SideEffects: {TargetEntities: ['in/history']});
    rejectCharge   @(Core.OperationAvailable: {$edmJson: {$Or: [
        {$Eq: [
            {$Path: 'in/billingStatus'},
            'Pending Approval'
        ]},
        {$Eq: [
            {$Path: 'in/billingStatus'},
            'Disputed'
        ]}
    ]}}, Common.SideEffects: {TargetEntities: ['in/history']});
    disputeCharge  @(Core.OperationAvailable: {$edmJson: {$And: [
        {$Ne: [
            {$Path: 'in/billingStatus'},
            'Disputed'
        ]},
        {$Ne: [
            {$Path: 'in/billingStatus'},
            'Rejected'
        ]}
    ]}}, Common.SideEffects: {TargetEntities: ['in/history']});
    resolveDispute @(Core.OperationAvailable: {$edmJson: {$Eq: [
        {$Path: 'in/billingStatus'},
        'Disputed'
    ]}}, Common.SideEffects: {TargetEntities: ['in/history']});
};

annotate service.RepairBillHistory with @(
    UI.LineItem            : [
        {Value: changedAt},
        {Value: fromStatus, @HTML5.CssDefaults: {width: '9rem'}},
        {Value: toStatus, @HTML5.CssDefaults: {width: '9rem'}},
        {Value: amount},
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
