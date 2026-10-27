using AdminService as service from '../../srv/admin-service';

// ---------- CONFIGURATION: damage catalogue ----------
annotate service.DamageCatalogue with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>damageCatalogueEntry}',
        TypeNamePlural: '{i18n>damageCatalogue}',
        Title         : {Value: damageType},
        Description   : {Value: severity}
    },
    UI.SelectionFields    : [
        damageType,
        severity,
        active
    ],
    UI.LineItem           : [
        {Value: damageType, @HTML5.CssDefaults: {width: '9rem'}},
        {Value: severity, @HTML5.CssDefaults: {width: '7rem'}},
        {Value: standardCost},
        {Value: description, @HTML5.CssDefaults: {width: '14rem'}},
        {Value: active}
    ],
    UI.Facets             : [{
        $Type : 'UI.ReferenceFacet',
        Label : '{i18n>general}',
        Target: '@UI.FieldGroup#General'
    }],
    UI.FieldGroup #General: {Data: [
        {Value: damageType},
        {Value: severity},
        {Value: standardCost},
        {Value: description},
        {Value: active}
    ]}
);

// ---------- CONFIGURATION: pricing and approval rules ----------
annotate service.Settings with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>setting}',
        TypeNamePlural: '{i18n>settings}',
        Title         : {Value: code},
        Description   : {Value: description}
    },
    UI.LineItem           : [
        {Value: code, @HTML5.CssDefaults: {width: '12rem'}},
        {Value: value, @HTML5.CssDefaults: {width: '6rem'}},
        {Value: description, @HTML5.CssDefaults: {width: '14rem'}},
        {Value: modifiedBy},
        {Value: modifiedAt}
    ],
    UI.Facets             : [{
        $Type : 'UI.ReferenceFacet',
        Label : '{i18n>general}',
        Target: '@UI.FieldGroup#General'
    }],
    UI.FieldGroup #General: {Data: [
        {Value: code},
        {Value: value},
        {Value: description}
    ]}
);

// ---------- INTEGRATION MONITOR ----------
annotate service.OutboxMessages with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>outboxMessage}',
        TypeNamePlural: '{i18n>outboxMessages}',
        Title         : {Value: messageType},
        Description   : {Value: interfaceId}
    },
    UI.HeaderFacets       : [{
        $Type : 'UI.ReferenceFacet',
        Target: '@UI.DataPoint#Status'
    }],
    UI.DataPoint #Status  : {
        Value      : status,
        Title      : '{i18n>status}',
        Criticality: statusCriticality
    },
    UI.SelectionFields    : [
        status,
        messageType,
        interfaceId
    ],
    UI.LineItem           : [
        {Value: createdAt},
        {Value: interfaceId, @HTML5.CssDefaults: {width: '6rem'}},
        {Value: messageType, @HTML5.CssDefaults: {width: '11rem'}},
        {Value: targetEntity, @HTML5.CssDefaults: {width: '9rem'}},
        {
            Value: status,

            @HTML5.CssDefaults: {width: '8rem'},
            Criticality: statusCriticality
        },
        {Value: attempts},
        {Value: responseRef, @HTML5.CssDefaults: {width: '8rem'}},
        {Value: lastError, @HTML5.CssDefaults: {width: '14rem'}},
        {Value: processedAt},
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'AdminService.retry',
            Label : '{i18n>retry}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'AdminService.EntityContainer/processOutbox',
            Label : '{i18n>processOutbox}'
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action: 'AdminService.EntityContainer/syncBillingStatus',
            Label : '{i18n>syncBillingStatus}'
        }
    ],
    UI.PresentationVariant: {
        SortOrder     : [{
            Property  : createdAt,
            Descending: true
        }],
        Visualizations: ['@UI.LineItem']
    },
    UI.Identification     : [{
        $Type : 'UI.DataFieldForAction',
        Action: 'AdminService.retry',
        Label : '{i18n>retry}'
    }],
    UI.Facets             : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>general}',
            Target: '@UI.FieldGroup#General'
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : '{i18n>maskedPayload}',
            Target: '@UI.FieldGroup#Payload'
        }
    ],
    UI.FieldGroup #General: {Data: [
        {Value: interfaceId},
        {Value: messageType},
        {Value: destination},
        {Value: targetEntity},
        {Value: targetKey},
        {Value: idempotencyKey},
        {
            Value      : status,
            Criticality: statusCriticality
        },
        {Value: attempts},
        {Value: responseRef},
        {Value: lastError},
        {Value: processedAt}
    ]},
    UI.FieldGroup #Payload: {Data: [{Value: maskedPayload}]}
);

annotate service.OutboxMessages actions {
    retry @(Core.OperationAvailable: {$edmJson: {$Ne: [
        {$Path: 'in/status'},
        'Sent'
    ]}});
};

// ---------- AUDIT LOG ----------
annotate service.AuditLog with @(
    UI.HeaderInfo         : {
        TypeName      : '{i18n>auditEntry}',
        TypeNamePlural: '{i18n>auditLog}',
        Title         : {Value: action},
        Description   : {Value: entity}
    },
    UI.SelectionFields    : [
        entity,
        action,
        userId,
        timestamp
    ],
    UI.LineItem           : [
        {Value: timestamp},
        {Value: entity, @HTML5.CssDefaults: {width: '9rem'}},
        {Value: action, @HTML5.CssDefaults: {width: '10rem'}},
        {Value: userId, @HTML5.CssDefaults: {width: '11rem'}},
        {Value: entityKey, @HTML5.CssDefaults: {width: '12rem'}},
        {Value: details, @HTML5.CssDefaults: {width: '18rem'}}
    ],
    UI.PresentationVariant: {
        SortOrder     : [{
            Property  : timestamp,
            Descending: true
        }],
        Visualizations: ['@UI.LineItem']
    },
    UI.Facets             : [{
        $Type : 'UI.ReferenceFacet',
        Label : '{i18n>general}',
        Target: '@UI.FieldGroup#General'
    }],
    UI.FieldGroup #General: {Data: [
        {Value: timestamp},
        {Value: entity},
        {Value: entityKey},
        {Value: action},
        {Value: userId},
        {Value: details}
    ]}
);
