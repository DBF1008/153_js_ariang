(function () {
    'use strict';

    angular.module('ariaNg').factory('ariaNgLanguageLoader', ['$http', '$q', 'ariaNgConstants', 'ariaNgLanguages', 'ariaNgDefaultLanguageResource', 'ariaNgAssetsCacheService', 'ariaNgLanguageOverrideService', 'ariaNgNotificationService', 'ariaNgLogService', 'ariaNgStorageService', function ($http, $q, ariaNgConstants, ariaNgLanguages, ariaNgDefaultLanguageResource, ariaNgAssetsCacheService, ariaNgLanguageOverrideService, ariaNgNotificationService, ariaNgLogService, ariaNgStorageService) {
        var isLanguageResourceEquals = function (langObj1, langObj2) {
            if (!angular.isObject(langObj1) || !angular.isObject(langObj2)) {
                return false;
            }

            for (var key in langObj2) {
                if (!langObj2.hasOwnProperty(key)) {
                    continue;
                }

                var value = langObj2[key];

                if (angular.isObject(value)) {
                    var result = isLanguageResourceEquals(langObj1[key], value);
                    if (!result) {
                        return false;
                    }
                } else {
                    if (value !== langObj1[key]) {
                        return false;
                    }
                }
            }

            return true;
        };

        return function (options) {
            var deferred = $q.defer();

            if (!ariaNgLanguages[options.key]) {
                deferred.reject(options.key);
                return deferred.promise;
            }

            var resolveWithOverride = function (baseLanguageObject) {
                var overrideContent = ariaNgLanguageOverrideService.getOverrideContent(options.key);
                deferred.resolve(ariaNgLanguageOverrideService.applyOverrideToLanguage(baseLanguageObject, overrideContent));
            };

            // The default language has no language file (it is registered statically), so serve it
            // from the in-memory resource here. This allows custom overrides to be applied to the
            // default language as well, and re-applied immediately via $translate.refresh().
            if (options.key === ariaNgConstants.defaultLanguage) {
                resolveWithOverride(ariaNgDefaultLanguageResource);
                return deferred.promise;
            }

            var languageKey = ariaNgConstants.languageStorageKeyPrefix + '.' + options.key;
            var languageResource = ariaNgStorageService.get(languageKey);

            if (languageResource) {
                resolveWithOverride(languageResource);
            }

            if (ariaNgAssetsCacheService.getLanguageAsset(options.key)) {
                var languageObject = ariaNgLanguageOverrideService.parseLanguagePackContent(ariaNgAssetsCacheService.getLanguageAsset(options.key));
                ariaNgStorageService.set(languageKey, languageObject);
                resolveWithOverride(languageObject);

                return deferred.promise;
            }

            var languagePath = ariaNgConstants.languagePath + '/' + options.key + ariaNgConstants.languageFileExtension;

            $http({
                url: languagePath,
                method: 'GET'
            }).then(function onSuccess(response) {
                var languageObject = ariaNgLanguageOverrideService.parseLanguagePackContent(response.data);
                var languageUpdated = false;

                if (languageResource) {
                    languageUpdated = !isLanguageResourceEquals(languageResource, languageObject);
                }

                ariaNgStorageService.set(languageKey, languageObject);

                if (languageUpdated) {
                    ariaNgLogService.info('[ariaNgLanguageLoader] load language resource successfully, and resource is updated');
                    ariaNgNotificationService.notifyInPage('', 'Language resource has been updated, please reload the page for the changes to take effect.', {
                        delay: false,
                        type: 'info',
                        templateUrl: 'views/notification-reloadable.html'
                    });
                } else {
                    ariaNgLogService.info('[ariaNgLanguageLoader] load language resource successfully, but resource is not updated');
                }

                resolveWithOverride(languageObject);
            }).catch(function onError(response) {
                ariaNgLogService.warn('[ariaNgLanguageLoader] cannot get language resource');
                if (!languageResource) {
                    ariaNgNotificationService.notifyInPage('', 'AriaNg cannot get language resources, and will display in default language.', {
                        type: 'error',
                        delay: false
                    });
                }
                return deferred.reject(options.key);
            });

            return deferred.promise;
        };
    }]);
}());
