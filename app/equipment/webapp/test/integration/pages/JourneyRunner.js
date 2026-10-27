sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ret/rental/equipment/test/integration/pages/EquipmentList.gen",
	"ret/rental/equipment/test/integration/pages/EquipmentObjectPage.gen"
], function (JourneyRunner, EquipmentListGenerated, EquipmentObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ret/rental/equipment') + '/test/flp.html#app-preview',
        pages: {
			onTheEquipmentListGenerated: EquipmentListGenerated,
			onTheEquipmentObjectPageGenerated: EquipmentObjectPageGenerated
        },
        async: true
    });

    return runner;
});

