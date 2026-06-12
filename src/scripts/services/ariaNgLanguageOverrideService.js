(function () {
    'use strict';

    angular.module('ariaNg').factory('ariaNgLanguageOverrideService', ['ariaNgConstants', 'ariaNgLanguages', 'ariaNgStorageService', 'ariaNgLogService', function (ariaNgConstants, ariaNgLanguages, ariaNgStorageService, ariaNgLogService) {
        var getKeyValuePair = function (line) {
            for (var i = 0; i < line.length; i++) {
                if (i > 0 && line.charAt(i - 1) !== '\\' && line.charAt(i) === '=') {
                    return {
                        key: line.substring(0, i).replace('\\=', '='),
                        value: line.substring(i + 1, line.length).replace('\\=', '=')
                    };
                }
            }

            return {
                value: line
            };
        };

        var getCategory = function (langObj, category) {
            var currentCategory = langObj;

            if (!category) {
                return currentCategory;
            }

            if (category[0] === '[' && category[category.length - 1] === ']') {
                category = category.substring(1, category.length - 1);
            }

            if (category === 'global') {
                return currentCategory;
            }

            var categoryNames = category.split('.');

            for (var i = 0; i < categoryNames.length; i++) {
                var categoryName = categoryNames[i];

                if (!currentCategory[categoryName]) {
                    currentCategory[categoryName] = {};
                }

                currentCategory = currentCategory[categoryName];
            }

            return currentCategory;
        };

        var getLanguageObject = function (languageContent) {
            var langObj = {};

            if (!languageContent) {
                return langObj;
            }

            var lines = languageContent.split('\n');
            var currentCatagory = langObj;

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];

                if (!line) {
                    continue;
                }

                line = line.replace('\r', '');

                if (/^\[.+\]$/.test(line)) {
                    currentCatagory = getCategory(langObj, line);
                    continue;
                }

                var pair = getKeyValuePair(line);

                if (pair && pair.key && pair.value && pair.value !== '') {
                    currentCatagory[pair.key] = pair.value;
                }
            }

            return langObj;
        };

        var deepMergeLanguageObject = function (target, source) {
            if (!angular.isObject(source)) {
                return target;
            }

            for (var key in source) {
                if (!source.hasOwnProperty(key)) {
                    continue;
                }

                var value = source[key];

                if (angular.isObject(value) && !angular.isArray(value)) {
                    if (!angular.isObject(target[key]) || angular.isArray(target[key])) {
                        target[key] = {};
                    }

                    deepMergeLanguageObject(target[key], value);
                } else {
                    target[key] = value;
                }
            }

            return target;
        };

        var countLeafKeys = function (obj) {
            var count = 0;

            if (!angular.isObject(obj)) {
                return count;
            }

            for (var key in obj) {
                if (!obj.hasOwnProperty(key)) {
                    continue;
                }

                if (angular.isObject(obj[key]) && !angular.isArray(obj[key])) {
                    count += countLeafKeys(obj[key]);
                } else {
                    count++;
                }
            }

            return count;
        };

        var getStore = function () {
            var store = ariaNgStorageService.get(ariaNgConstants.languageOverrideStorageKey);

            if (!angular.isObject(store) || angular.isArray(store)) {
                return {};
            }

            return store;
        };

        var setStore = function (store) {
            ariaNgStorageService.set(ariaNgConstants.languageOverrideStorageKey, store);
        };

        var isSupportedLanguage = function (langKey) {
            return !!(langKey && ariaNgLanguages[langKey]);
        };

        var getOverride = function (langKey) {
            var store = getStore();
            return store[langKey] || null;
        };

        return {
            parseLanguagePackContent: function (content) {
                return getLanguageObject(content);
            },
            isValidLanguagePack: function (content) {
                var parsed = angular.isString(content) ? getLanguageObject(content) : content;
                return angular.isObject(parsed) && !angular.isArray(parsed) && countLeafKeys(parsed) > 0;
            },
            applyOverrideToLanguage: function (baseObject, overrideContent) {
                var result = angular.copy(baseObject) || {};

                if (overrideContent && angular.isObject(overrideContent)) {
                    deepMergeLanguageObject(result, overrideContent);
                }

                return result;
            },
            getAllOverrides: function () {
                return getStore();
            },
            getOverride: function (langKey) {
                return getOverride(langKey);
            },
            getOverrideContent: function (langKey) {
                var override = getOverride(langKey);
                return override ? override.content : null;
            },
            hasOverride: function (langKey) {
                return !!getOverride(langKey);
            },
            hasAnyOverride: function () {
                var store = getStore();

                for (var key in store) {
                    if (store.hasOwnProperty(key)) {
                        return true;
                    }
                }

                return false;
            },
            getOverrideKeyCount: function (langKey) {
                var override = getOverride(langKey);
                return override ? countLeafKeys(override.content) : 0;
            },
            saveOverride: function (langKey, content, name) {
                if (!isSupportedLanguage(langKey)) {
                    ariaNgLogService.warn('[ariaNgLanguageOverrideService.saveOverride] unsupported language: ' + langKey);
                    return false;
                }

                var parsed = angular.isString(content) ? getLanguageObject(content) : content;

                if (!angular.isObject(parsed) || angular.isArray(parsed) || countLeafKeys(parsed) < 1) {
                    ariaNgLogService.warn('[ariaNgLanguageOverrideService.saveOverride] override content is empty or invalid');
                    return false;
                }

                var store = getStore();

                store[langKey] = {
                    name: name || (ariaNgLanguages[langKey] ? ariaNgLanguages[langKey].displayName : langKey),
                    importedAt: new Date().getTime(),
                    content: parsed
                };

                setStore(store);

                return true;
            },
            removeOverride: function (langKey) {
                var store = getStore();

                if (!store.hasOwnProperty(langKey)) {
                    return false;
                }

                delete store[langKey];
                setStore(store);

                return true;
            },
            clearOverrides: function () {
                ariaNgStorageService.remove(ariaNgConstants.languageOverrideStorageKey);
            }
        };
    }]);

    angular.module('ariaNg').run(['$rootScope', 'ariaNgLanguageOverrideService', 'ariaNgLocalizationService', function ($rootScope, ariaNgLanguageOverrideService, ariaNgLocalizationService) {
        if (!ariaNgLanguageOverrideService.hasAnyOverride()) {
            return;
        }

        var applied = false;

        var unbind = $rootScope.$on('$translateChangeSuccess', function () {
            if (applied) {
                return;
            }

            applied = true;

            if (angular.isFunction(unbind)) {
                unbind();
            }

            ariaNgLocalizationService.reloadTranslations();
        });
    }]);
}());
