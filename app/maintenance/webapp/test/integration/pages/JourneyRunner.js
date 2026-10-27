sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ret/maintenance/maintenance/test/integration/pages/MaintenanceRecordsList.gen",
	"ret/maintenance/maintenance/test/integration/pages/MaintenanceRecordsObjectPage.gen"
], function (JourneyRunner, MaintenanceRecordsListGenerated, MaintenanceRecordsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ret/maintenance/maintenance') + '/test/flp.html#app-preview',
        pages: {
			onTheMaintenanceRecordsListGenerated: MaintenanceRecordsListGenerated,
			onTheMaintenanceRecordsObjectPageGenerated: MaintenanceRecordsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

