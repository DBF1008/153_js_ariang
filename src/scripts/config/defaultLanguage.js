(function () {
    'use strict';

    angular.module('ariaNg').config(['$translateProvider', 'ariaNgConstants', 'ariaNgDefaultLanguageResource', function ($translateProvider, ariaNgConstants, ariaNgDefaultLanguageResource) {
        $translateProvider.translations(ariaNgConstants.defaultLanguage, ariaNgDefaultLanguageResource);
    }]);
}());
