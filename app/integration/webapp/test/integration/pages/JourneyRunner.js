sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ret/admin/integration/test/integration/pages/OutboxMessagesList.gen",
	"ret/admin/integration/test/integration/pages/OutboxMessagesObjectPage.gen"
], function (JourneyRunner, OutboxMessagesListGenerated, OutboxMessagesObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ret/admin/integration') + '/test/flp.html#app-preview',
        pages: {
			onTheOutboxMessagesListGenerated: OutboxMessagesListGenerated,
			onTheOutboxMessagesObjectPageGenerated: OutboxMessagesObjectPageGenerated
        },
        async: true
    });

    return runner;
});

