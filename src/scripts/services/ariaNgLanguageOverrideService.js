(function () {
    'use strict';

    angular.module('ariaNg').factory('ariaNgLanguageOverrideService', ['ariaNgStorageService', 'ariaNgLogService', function (ariaNgStorageService, ariaNgLogService) {
        var STORAGE_KEY = 'CustomLanguageOverride';
        var MAX_OVERRIDE_SIZE = 512 * 1024; // 512KB
        var UNSAFE_KEYS = { '__proto__': true, 'constructor': true, 'prototype': true };

        /**
         * Validate override package structure.
         * @param {object} pkg - The override package to validate
         * @returns {{ valid: boolean, error: string|null }}
         */
        var validateOverridePackage = function (pkg) {
            if (!pkg || !angular.isObject(pkg) || angular.isArray(pkg)) {
                return { valid: false, error: 'Override package must be a non-null object.' };
            }

            if (!pkg.translations || !angular.isObject(pkg.translations) || angular.isArray(pkg.translations)) {
                return { valid: false, error: 'Override package must contain a "translations" object.' };
            }

            if (pkg.baseLanguage !== undefined && pkg.baseLanguage !== null && !angular.isString(pkg.baseLanguage)) {
                return { valid: false, error: '"baseLanguage" must be a string if provided.' };
            }

            return { valid: true, error: null };
        };

        /**
         * Deep-merge override translations into base translations.
         * Mutates and returns base. Handles nested objects recursively.
         * Only keys present in overrides replace base values;
         * all other base keys remain untouched (partial override).
         * Filters out unsafe keys to prevent prototype pollution.
         * @param {object} base - The base translations object (mutated)
         * @param {object} overrides - The override translations to merge
         * @returns {object} - The mutated base object
         */
        var deepMerge = function (base, overrides) {
            if (!base || !overrides || !angular.isObject(overrides)) {
                return base;
            }

            for (var key in overrides) {
                if (!overrides.hasOwnProperty(key)) {
                    continue;
                }

                if (UNSAFE_KEYS[key]) {
                    ariaNgLogService.warn('[ariaNgLanguageOverrideService] skipping unsafe key: ' + key);
                    continue;
                }

                var overrideValue = overrides[key];

                if (angular.isObject(overrideValue) && !angular.isArray(overrideValue)
                    && angular.isObject(base[key]) && !angular.isArray(base[key])) {
                    deepMerge(base[key], overrideValue);
                } else {
                    base[key] = overrideValue;
                }
            }

            return base;
        };

        /**
         * Check if an override package applies to a given language key.
         * If baseLanguage is omitted/null, it applies to ALL languages.
         * If baseLanguage is set, it only applies when langKey === baseLanguage.
         * @param {object} pkg - The override package
         * @param {string} langKey - The language key being loaded
         * @returns {boolean}
         */
        var appliesToLanguage = function (pkg, langKey) {
            return !pkg.baseLanguage || pkg.baseLanguage === langKey;
        };

        return {
            /**
             * Save an override package to localStorage after validation.
             * @param {object} pkg - The override package object
             * @returns {{ success: boolean, error: string|null }}
             */
            saveOverride: function (pkg) {
                var validation = validateOverridePackage(pkg);
                if (!validation.valid) {
                    ariaNgLogService.warn('[ariaNgLanguageOverrideService] validation failed: ' + validation.error);
                    return validation;
                }

                var jsonCheck = angular.toJson(pkg);
                if (jsonCheck && jsonCheck.length > MAX_OVERRIDE_SIZE) {
                    var errorMsg = 'Override package is too large (max ' + (MAX_OVERRIDE_SIZE / 1024) + 'KB).';
                    ariaNgLogService.warn('[ariaNgLanguageOverrideService] ' + errorMsg);
                    return { success: false, error: errorMsg };
                }

                try {
                    ariaNgStorageService.set(STORAGE_KEY, pkg);
                    ariaNgLogService.info('[ariaNgLanguageOverrideService] override package saved');
                    return { success: true, error: null };
                } catch (e) {
                    ariaNgLogService.error('[ariaNgLanguageOverrideService] failed to save override', e);
                    return { success: false, error: 'Failed to save override to storage.' };
                }
            },

            /**
             * Retrieve stored override package (or null if none).
             * @returns {object|null}
             */
            getOverride: function () {
                try {
                    var pkg = ariaNgStorageService.get(STORAGE_KEY);
                    if (pkg && angular.isObject(pkg) && pkg.translations) {
                        return pkg;
                    }
                    return null;
                } catch (e) {
                    ariaNgLogService.error('[ariaNgLanguageOverrideService] failed to read override from storage', e);
                    return null;
                }
            },

            /**
             * Remove stored override package.
             */
            clearOverride: function () {
                try {
                    ariaNgStorageService.remove(STORAGE_KEY);
                    ariaNgLogService.info('[ariaNgLanguageOverrideService] override package cleared');
                } catch (e) {
                    ariaNgLogService.error('[ariaNgLanguageOverrideService] failed to clear override', e);
                }
            },

            /**
             * Check if an override package is currently stored.
             * @returns {boolean}
             */
            hasOverride: function () {
                return this.getOverride() !== null;
            },

            /**
             * Merge overrides into a loaded language data object.
             * Called by the language loader AFTER loading base translations.
             * @param {string} langKey - The language being loaded
             * @param {object} languageData - The parsed base language translations (mutated)
             * @returns {object} - The (possibly mutated) languageData
             */
            mergeIntoLanguage: function (langKey, languageData) {
                try {
                    var pkg = this.getOverride();
                    if (!pkg || !pkg.translations) {
                        return languageData;
                    }

                    if (!appliesToLanguage(pkg, langKey)) {
                        ariaNgLogService.debug('[ariaNgLanguageOverrideService] override does not apply to language: ' + langKey);
                        return languageData;
                    }

                    ariaNgLogService.info('[ariaNgLanguageOverrideService] merging override into language: ' + langKey);
                    return deepMerge(languageData, pkg.translations);
                } catch (e) {
                    ariaNgLogService.error('[ariaNgLanguageOverrideService] error merging override', e);
                    return languageData;
                }
            },

            /**
             * Import override from JSON string. Validates and saves.
             * @param {string} jsonString - JSON string to parse and import
             * @returns {{ success: boolean, error: string|null }}
             */
            importOverride: function (jsonString) {
                if (!jsonString || !angular.isString(jsonString)) {
                    return { success: false, error: 'No data provided.' };
                }

                var pkg;
                try {
                    pkg = JSON.parse(jsonString);
                } catch (e) {
                    ariaNgLogService.error('[ariaNgLanguageOverrideService] JSON parse error', e);
                    return { success: false, error: 'Invalid JSON format.' };
                }

                return this.saveOverride(pkg);
            },

            /**
             * Export current override as JSON string.
             * @returns {string|null}
             */
            exportOverride: function () {
                var pkg = this.getOverride();
                if (!pkg) {
                    return null;
                }

                return angular.toJson(pkg, true);
            }
        };
    }]);
}());
