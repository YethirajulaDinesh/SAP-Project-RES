sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ret/damage/damages/test/integration/pages/DamageRecordsList.gen",
	"ret/damage/damages/test/integration/pages/DamageRecordsObjectPage.gen"
], function (JourneyRunner, DamageRecordsListGenerated, DamageRecordsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ret/damage/damages') + '/test/flp.html#app-preview',
        pages: {
			onTheDamageRecordsListGenerated: DamageRecordsListGenerated,
			onTheDamageRecordsObjectPageGenerated: DamageRecordsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

