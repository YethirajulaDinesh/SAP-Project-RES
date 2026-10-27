sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ret/admin/catalogue/test/integration/pages/DamageCatalogueList.gen",
	"ret/admin/catalogue/test/integration/pages/DamageCatalogueObjectPage.gen"
], function (JourneyRunner, DamageCatalogueListGenerated, DamageCatalogueObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ret/admin/catalogue') + '/test/flp.html#app-preview',
        pages: {
			onTheDamageCatalogueListGenerated: DamageCatalogueListGenerated,
			onTheDamageCatalogueObjectPageGenerated: DamageCatalogueObjectPageGenerated
        },
        async: true
    });

    return runner;
});

