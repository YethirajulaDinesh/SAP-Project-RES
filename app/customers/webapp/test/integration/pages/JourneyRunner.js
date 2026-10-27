sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ret/rental/customers/test/integration/pages/CustomersList.gen",
	"ret/rental/customers/test/integration/pages/CustomersObjectPage.gen"
], function (JourneyRunner, CustomersListGenerated, CustomersObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ret/rental/customers') + '/test/flp.html#app-preview',
        pages: {
			onTheCustomersListGenerated: CustomersListGenerated,
			onTheCustomersObjectPageGenerated: CustomersObjectPageGenerated
        },
        async: true
    });

    return runner;
});

