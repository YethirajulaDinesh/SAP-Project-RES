sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ret/damage/repairbills/test/integration/pages/RepairBillsList.gen",
	"ret/damage/repairbills/test/integration/pages/RepairBillsObjectPage.gen"
], function (JourneyRunner, RepairBillsListGenerated, RepairBillsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ret/damage/repairbills') + '/test/flp.html#app-preview',
        pages: {
			onTheRepairBillsListGenerated: RepairBillsListGenerated,
			onTheRepairBillsObjectPageGenerated: RepairBillsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

