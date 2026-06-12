(function () {
    'use strict';

    angular.module('ariaNg').factory('ariaNgLocalizationService', ['$translate', 'amMoment', 'ariaNgLanguageOverrideService', function ($translate, amMoment, ariaNgLanguageOverrideService) {
        return {
            applyLanguage: function (lang) {
                $translate.use(lang);
                amMoment.changeLocale(lang);

                return true;
            },
            getLocalizedText: function (text, params) {
                return $translate.instant(text, params);
            },
            getLongDateFormat: function () {
                return this.getLocalizedText('format.longdate');
            },
            applyLanguageOverride: function (jsonString) {
                var result = ariaNgLanguageOverrideService.importOverride(jsonString);
                if (result.success) {
                    $translate.refresh($translate.use());
                }
                return result;
            },
            clearLanguageOverride: function () {
                ariaNgLanguageOverrideService.clearOverride();
                $translate.refresh($translate.use());
            },
            getLanguageOverride: function () {
                return ariaNgLanguageOverrideService.getOverride();
            },
            hasLanguageOverride: function () {
                return ariaNgLanguageOverrideService.hasOverride();
            },
            exportLanguageOverride: function () {
                return ariaNgLanguageOverrideService.exportOverride();
            }
        };
    }]);
}());
