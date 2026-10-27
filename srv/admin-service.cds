using ret from '../db/schema';

// Configuration, Integration Monitor and audit trail
@path    : '/odata/v4/admin'
@requires: [
  'BillingClerk',
  'Manager',
  'Admin',
  'Auditor'
]
service AdminService {

  @restrict: [
    {
      grant: 'READ',
      to   : [
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
      to   : 'Admin'
    }
  ]
  @cds.search: {
    damageType,
    severity,
    description
  }
  entity DamageCatalogue as projection on ret.DamageCatalogue;

  @restrict: [
    {
      grant: 'READ',
      to   : [
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
      to   : 'Admin'
    }
  ]
  entity Settings        as projection on ret.Settings;

  // Integration Monitor: outbox messages with masked payload and retry
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
      grant: 'retry',
      to   : [
        'BillingClerk',
        'Admin'
      ]
    }
  ]
  @cds.search: {
    messageType,
    interfaceId,
    status,
    targetKey,
    responseRef
  }
  entity OutboxMessages  as projection on ret.OutboxMessages {
    *,
    virtual null as statusCriticality : Integer
  } excluding {
    payload
  }
    actions {
      action retry() returns OutboxMessages;
    };

  @readonly
  @restrict: [{
    grant: 'READ',
    to   : [
      'Manager',
      'Admin',
      'Auditor'
    ]
  }]
  @cds.search: {
    entity,
    action,
    userId
  }
  entity AuditLog        as projection on ret.AuditLog;

  @readonly
  entity CodeLists   as projection on ret.CodeLists;

  type OutboxRun {
    processed : Integer;
    sent      : Integer;
    failed    : Integer;
  }

  type BillingSync {
    checked : Integer;
    billed  : Integer;
  }

  // Outbox worker run on demand (normally every minute, see srv/server.js)
  @requires: [
    'BillingClerk',
    'Admin'
  ]
  action processOutbox()     returns OutboxRun;

  // INT-07: read billing document status from S/4HANA for posted debit memo requests
  @requires: [
    'BillingClerk',
    'Admin'
  ]
  action syncBillingStatus() returns BillingSync;
}

annotate AdminService.DamageCatalogue with @odata.draft.enabled;
annotate AdminService.Settings with @odata.draft.enabled;
