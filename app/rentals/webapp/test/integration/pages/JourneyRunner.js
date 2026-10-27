sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ret/rental/rentals/test/integration/pages/RentalsList.gen",
	"ret/rental/rentals/test/integration/pages/RentalsObjectPage.gen"
], function (JourneyRunner, RentalsListGenerated, RentalsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ret/rental/rentals') + '/test/flp.html#app-preview',
        pages: {
			onTheRentalsListGenerated: RentalsListGenerated,
			onTheRentalsObjectPageGenerated: RentalsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

