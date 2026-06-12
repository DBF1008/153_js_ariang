(function () {
    'use strict';

    angular.module('ariaNg').factory('ariaNgLocalizationService', ['$translate', '$cacheFactory', 'amMoment', function ($translate, $cacheFactory, amMoment) {
        return {
            applyLanguage: function (lang) {
                $translate.use(lang);
                amMoment.changeLocale(lang);

                return true;
            },
            reloadTranslations: function () {
                var translationCache = $cacheFactory.get('translations');

                if (translationCache) {
                    translationCache.removeAll();
                }

                return $translate.refresh();
            },
            getLocalizedText: function (text, params) {
                return $translate.instant(text, params);
            },
            getLongDateFormat: function () {
                return this.getLocalizedText('format.longdate');
            }
        };
    }]);
}());
