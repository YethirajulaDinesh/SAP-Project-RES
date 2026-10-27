sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ret/rental/locations/test/integration/pages/LocationsList.gen",
	"ret/rental/locations/test/integration/pages/LocationsObjectPage.gen"
], function (JourneyRunner, LocationsListGenerated, LocationsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ret/rental/locations') + '/test/flp.html#app-preview',
        pages: {
			onTheLocationsListGenerated: LocationsListGenerated,
			onTheLocationsObjectPageGenerated: LocationsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

