sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"ret/admin/settings/test/integration/pages/SettingsList.gen",
	"ret/admin/settings/test/integration/pages/SettingsObjectPage.gen"
], function (JourneyRunner, SettingsListGenerated, SettingsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('ret/admin/settings') + '/test/flp.html#app-preview',
        pages: {
			onTheSettingsListGenerated: SettingsListGenerated,
			onTheSettingsObjectPageGenerated: SettingsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

