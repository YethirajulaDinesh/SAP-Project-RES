sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ret/maintenance/inspections/test/integration/pages/ConditionLogsList.gen",
	"ret/maintenance/inspections/test/integration/pages/ConditionLogsObjectPage.gen"
], function (JourneyRunner, ConditionLogsListGenerated, ConditionLogsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ret/maintenance/inspections') + '/test/flp.html#app-preview',
        pages: {
			onTheConditionLogsListGenerated: ConditionLogsListGenerated,
			onTheConditionLogsObjectPageGenerated: ConditionLogsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

