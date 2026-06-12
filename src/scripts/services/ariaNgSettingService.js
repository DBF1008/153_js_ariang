(function () {
    'use strict';

    angular.module('ariaNg').factory('ariaNgSettingService', ['$window', '$location', '$filter', 'ariaNgConstants', 'ariaNgDefaultOptions', 'ariaNgLanguages', 'ariaNgCommonService', 'ariaNgLogService', 'ariaNgStorageService', function ($window, $location, $filter, ariaNgConstants, ariaNgDefaultOptions, ariaNgLanguages, ariaNgCommonService, ariaNgLogService, ariaNgStorageService) {
        var browserFeatures = (function () {
            var supportLocalStroage = ariaNgStorageService.isLocalStorageSupported();
            var supportCookies = ariaNgStorageService.isCookiesSupported();

            return {
                localStroage: supportLocalStroage,
                cookies: supportCookies
            };
        })();
        var browserSupportStorage = browserFeatures.localStroage || browserFeatures.cookies;
        var browserSupportMatchMedia = !!$window.matchMedia;
        var browserSupportDarkMode = browserSupportMatchMedia
            && $window.matchMedia('(prefers-color-scheme: dark)')
            && $window.matchMedia('(prefers-color-scheme: dark)').media !== 'not all'
            && angular.isFunction($window.matchMedia('(prefers-color-scheme: dark)').addEventListener);

        var onFirstVisitCallbacks = [];
        var firstVisitCallbackFired = false;
        var sessionSettings = {
            debugMode: false
        };

        var fireFirstVisitEvent = function () {
            if (!browserSupportStorage) {
                return;
            }

            if (firstVisitCallbackFired || !angular.isArray(onFirstVisitCallbacks) || onFirstVisitCallbacks.length < 1) {
                return;
            }

            for (var i = 0; i < onFirstVisitCallbacks.length; i++) {
                var callback = onFirstVisitCallbacks[i];
                callback();
            }

            firstVisitCallbackFired = true;
        };

        var isInsecureProtocolDisabled = function () {
            var protocol = $location.protocol();

            return protocol === 'https';
        };

        var getLanguageNameFromAlias = function (alias) {
            for (var langName in ariaNgLanguages) {
                if (!ariaNgLanguages.hasOwnProperty(langName)) {
                    continue;
                }

                if (langName.toLowerCase() === alias.toLowerCase()) {
                    return langName;
                }

                var language = ariaNgLanguages[langName];
                var aliases = language.aliases;

                if (!angular.isArray(aliases) || aliases.length < 1) {
                    continue;
                }

                for (var i = 0; i < aliases.length; i++) {
                    if (aliases[i].toLowerCase() === alias.toLowerCase()) {
                        return langName;
                    }
                }
            }

            return null;
        };

        var getDefaultLanguage = function () {
            var browserLang = $window.navigator.browserLanguage ? $window.navigator.browserLanguage : $window.navigator.language;

            if (!browserLang) {
                ariaNgLogService.info('[ariaNgSettingService] cannot get browser language, use default language');
                return ariaNgDefaultOptions.language;
            }

            browserLang = browserLang.replace(/\-/g, '_');

            if (!ariaNgLanguages[browserLang]) {
                var languageName = getLanguageNameFromAlias(browserLang);

                if (languageName) {
                    browserLang = languageName;
                }
            }

            if (!ariaNgLanguages[browserLang] && browserLang.split('_').length > 1) { // maybe language-script-region
                var langParts = browserLang.split('_');
                browserLang = langParts[0] + '_' + langParts[1];

                if (!ariaNgLanguages[browserLang]) {
                    var languageName = getLanguageNameFromAlias(browserLang);

                    if (languageName) {
                        browserLang = languageName;
                    }
                }

                if (!ariaNgLanguages[browserLang]) {
                    browserLang = langParts[0];
                    var languageName = getLanguageNameFromAlias(browserLang);

                    if (languageName) {
                        browserLang = languageName;
                    }
                }
            }

            if (!ariaNgLanguages[browserLang]) {
                ariaNgLogService.info('[ariaNgSettingService] browser language \"' + browserLang + '\" not support, use default language');
                return ariaNgDefaultOptions.language;
            }

            ariaNgLogService.info('[ariaNgSettingService] use browser language \"' + browserLang + '\" as current language');
            return browserLang;
        };

        var getLanguageNameFromAliasOrDefaultLanguage = function (lang) {
            var languageName = getLanguageNameFromAlias(lang);

            if (languageName) {
                return languageName;
            }

            return getDefaultLanguage();
        };

        var getDefaultRpcHost = function () {
            var currentHost = $location.host();

            if (currentHost) {
                return currentHost;
            }

            return ariaNgConstants.defaultHost;
        };

        var setOptions = function (options) {
            return ariaNgStorageService.set(ariaNgConstants.optionStorageKey, options);
        };

        var getOptions = function () {
            var options = ariaNgStorageService.get(ariaNgConstants.optionStorageKey);

            if (options && !ariaNgLanguages[options.language]) {
                options.language = getLanguageNameFromAliasOrDefaultLanguage(options.language);
            }

            if (!options) {
                options = angular.extend({}, ariaNgDefaultOptions);
                options.language = getDefaultLanguage();

                if (!options.rpcHost) {
                    initRpcSettingWithDefaultHostAndProtocol(options);
                }

                if (angular.isArray(options.extendRpcServers)) {
                    for (var i = 0; i < options.extendRpcServers.length; i++) {
                        var rpcSetting = options.extendRpcServers[i];

                        if (!rpcSetting.rpcHost) {
                            initRpcSettingWithDefaultHostAndProtocol(rpcSetting);
                        }
                    }
                }

                setOptions(options);
                fireFirstVisitEvent();
            }

            return options;
        };

        var clearAll = function () {
            return ariaNgStorageService.clearAll();
        };

        var getOption = function (key) {
            var options = getOptions();

            if (angular.isUndefined(options[key]) && angular.isDefined(ariaNgDefaultOptions[key])) {
                options[key] = ariaNgDefaultOptions[key];
                setOptions(options);
            }

            return options[key];
        };

        var setOption = function (key, value) {
            var options = getOptions();
            options[key] = value;

            setOptions(options);
        };

        var initRpcSettingWithDefaultHostAndProtocol = function (setting) {
            setting.rpcHost = getDefaultRpcHost();

            if (isInsecureProtocolDisabled()) {
                setting.protocol = ariaNgConstants.defaultSecureProtocol;
            }
        };

        var cloneRpcSetting = function (setting) {
            return {
                rpcAlias: setting.rpcAlias,
                rpcHost: setting.rpcHost,
                rpcPort: setting.rpcPort,
                rpcInterface: setting.rpcInterface,
                protocol: setting.protocol,
                httpMethod: setting.httpMethod,
                rpcRequestHeaders: setting.rpcRequestHeaders,
                secret: setting.secret
            };
        };

        var createNewRpcSetting = function () {
            var setting = cloneRpcSetting(ariaNgDefaultOptions);
            setting.rpcId = ariaNgCommonService.generateUniqueId();

            initRpcSettingWithDefaultHostAndProtocol(setting);

            return setting;
        };

        var rpcSettingFields = ['rpcAlias', 'rpcHost', 'rpcPort', 'rpcInterface', 'protocol', 'httpMethod', 'rpcRequestHeaders', 'secret'];

        var isRpcSettingField = function (key) {
            return rpcSettingFields.indexOf(key) >= 0;
        };

        var getRpcSettingIdentity = function (setting) {
            var protocol = (setting.protocol ? ('' + setting.protocol) : '').toLowerCase();
            var rpcHost = (setting.rpcHost ? ('' + setting.rpcHost) : '').toLowerCase();
            var rpcPort = (angular.isUndefined(setting.rpcPort) || setting.rpcPort === null ? '' : ('' + setting.rpcPort));
            var rpcInterface = (setting.rpcInterface ? ('' + setting.rpcInterface) : '');

            return protocol + '://' + rpcHost + ':' + rpcPort + '/' + rpcInterface;
        };

        var getRpcSettingName = function (setting) {
            if (setting.rpcAlias) {
                return setting.rpcAlias;
            }

            var rpcHost = (setting.rpcHost ? setting.rpcHost : '');
            var rpcPort = (angular.isUndefined(setting.rpcPort) || setting.rpcPort === null ? '' : setting.rpcPort);

            return rpcHost + ':' + rpcPort;
        };

        var buildRpcServerFromSource = function (source) {
            var finalRpcSetting = createNewRpcSetting();

            for (var i = 0; i < rpcSettingFields.length; i++) {
                var field = rpcSettingFields[i];

                if (!source.hasOwnProperty(field)) {
                    continue;
                }

                if (angular.isObject(source[field]) || angular.isArray(source[field])) {
                    continue;
                }

                finalRpcSetting[field] = source[field];
            }

            return finalRpcSetting;
        };

        // Collects every connection contained in an options object (the inlined default RPC plus extendRpcServers),
        // dropping entries that have no real endpoint host. Used by both the import pre-check and selective import.
        var getImportableRpcConnections = function (options) {
            var connections = [];

            var defaultConnection = cloneRpcSetting(options);
            defaultConnection.isDefaultInImport = true;
            connections.push(defaultConnection);

            if (angular.isArray(options.extendRpcServers)) {
                for (var i = 0; i < options.extendRpcServers.length; i++) {
                    var extendConnection = cloneRpcSetting(options.extendRpcServers[i]);
                    extendConnection.isDefaultInImport = false;
                    connections.push(extendConnection);
                }
            }

            var result = [];

            for (var j = 0; j < connections.length; j++) {
                if (!connections[j].rpcHost) {
                    continue;
                }

                result.push(connections[j]);
            }

            return result;
        };

        var getCurrentRpcIdentitySet = function () {
            var options = getOptions();
            var identitySet = {};

            identitySet[getRpcSettingIdentity(options)] = true;

            if (angular.isArray(options.extendRpcServers)) {
                for (var i = 0; i < options.extendRpcServers.length; i++) {
                    identitySet[getRpcSettingIdentity(options.extendRpcServers[i])] = true;
                }
            }

            return identitySet;
        };

        return {
            isBrowserSupportStorage: function () {
                return browserSupportStorage;
            },
            isBrowserSupportDarkMode: function () {
                return browserSupportDarkMode;
            },
            getBrowserFeatures: function () {
                return browserFeatures;
            },
            getAllOptions: function () {
                var options = angular.extend({}, ariaNgDefaultOptions, getOptions());

                if (options.secret) {
                    options.secret = ariaNgCommonService.base64Decode(options.secret);
                }

                if (angular.isArray(options.extendRpcServers)) {
                    for (var i = 0; i < options.extendRpcServers.length; i++) {
                        var rpcSetting = options.extendRpcServers[i];

                        if (rpcSetting.secret) {
                            rpcSetting.secret = ariaNgCommonService.base64Decode(rpcSetting.secret);
                        }
                    }
                }

                return options;
            },
            getAllRpcSettings: function () {
                var result = [];

                var options = this.getAllOptions();
                var defaultRpcSetting = cloneRpcSetting(options);
                defaultRpcSetting.isDefault = true;
                result.push(defaultRpcSetting);

                if (angular.isArray(options.extendRpcServers)) {
                    for (var i = 0; i < options.extendRpcServers.length; i++) {
                        var rpcSetting = cloneRpcSetting(options.extendRpcServers[i]);
                        rpcSetting.rpcId = options.extendRpcServers[i].rpcId;
                        rpcSetting.isDefault = false;
                        result.push(rpcSetting);
                    }
                }

                var displayOrder = this.getRPCListDisplayOrder();

                if (displayOrder === 'recentlyUsed') {
                    // Do Nothing
                } else if (displayOrder === 'rpcAlias') {
                    result.sort(function (rpc1, rpc2) {
                        return String.naturalCompare(rpc1.rpcAlias, rpc2.rpcAlias);
                    });
                }

                return result;
            },
            checkImportOptions: function (options) {
                var currentOptions = getOptions();
                var effectiveCurrent = angular.extend({}, ariaNgDefaultOptions, currentOptions);

                var globalTotal = 0;
                var globalChanged = 0;

                for (var key in options) {
                    if (!options.hasOwnProperty(key) || !ariaNgDefaultOptions.hasOwnProperty(key)) {
                        continue;
                    }

                    if (key === 'extendRpcServers' || isRpcSettingField(key)) {
                        continue;
                    }

                    if (angular.isObject(options[key]) || angular.isArray(options[key])) {
                        continue;
                    }

                    globalTotal++;

                    if (options[key] !== effectiveCurrent[key]) {
                        globalChanged++;
                    }
                }

                var currentIdentitySet = getCurrentRpcIdentitySet();
                var importConnections = getImportableRpcConnections(options);
                var connections = [];
                var newCount = 0;
                var duplicateCount = 0;
                var seenInImport = {};

                for (var i = 0; i < importConnections.length; i++) {
                    var connection = importConnections[i];
                    var identity = getRpcSettingIdentity(connection);
                    var isDuplicate = !!currentIdentitySet[identity] || !!seenInImport[identity];

                    seenInImport[identity] = true;

                    if (isDuplicate) {
                        duplicateCount++;
                    } else {
                        newCount++;
                    }

                    connections.push({
                        name: getRpcSettingName(connection),
                        isDefaultInImport: connection.isDefaultInImport,
                        isDuplicate: isDuplicate
                    });
                }

                var currentCount = 1 + (angular.isArray(currentOptions.extendRpcServers) ? currentOptions.extendRpcServers.length : 0);

                return {
                    global: {
                        available: globalTotal > 0,
                        total: globalTotal,
                        changed: globalChanged
                    },
                    rpc: {
                        currentDefault: {
                            name: getRpcSettingName(effectiveCurrent)
                        },
                        currentCount: currentCount,
                        connections: connections,
                        newCount: newCount,
                        duplicateCount: duplicateCount
                    }
                };
            },
            importOptions: function (options, params) {
                params = angular.extend({
                    importGlobalSettings: true,
                    importRpcSettings: true,
                    rpcImportMode: 'merge',
                    resetToDefaults: false
                }, params);

                var finalOptions;

                if (params.resetToDefaults) {
                    finalOptions = angular.copy(ariaNgDefaultOptions);
                } else {
                    finalOptions = angular.extend(angular.copy(ariaNgDefaultOptions), angular.copy(getOptions()));
                }

                if (!angular.isArray(finalOptions.extendRpcServers)) {
                    finalOptions.extendRpcServers = [];
                }

                if (params.importGlobalSettings) {
                    for (var key in options) {
                        if (!options.hasOwnProperty(key) || !ariaNgDefaultOptions.hasOwnProperty(key)) {
                            continue;
                        }

                        if (key === 'extendRpcServers' || isRpcSettingField(key)) {
                            continue;
                        }

                        if (angular.isObject(options[key]) || angular.isArray(options[key])) {
                            continue;
                        }

                        finalOptions[key] = options[key];
                    }
                }

                if (params.importRpcSettings) {
                    if (params.rpcImportMode === 'overwrite') {
                        for (var i = 0; i < rpcSettingFields.length; i++) {
                            var field = rpcSettingFields[i];

                            if (!options.hasOwnProperty(field)) {
                                continue;
                            }

                            if (angular.isObject(options[field]) || angular.isArray(options[field])) {
                                continue;
                            }

                            finalOptions[field] = options[field];
                        }

                        finalOptions.extendRpcServers = [];

                        if (angular.isArray(options.extendRpcServers)) {
                            for (var j = 0; j < options.extendRpcServers.length; j++) {
                                finalOptions.extendRpcServers.push(buildRpcServerFromSource(options.extendRpcServers[j]));
                            }
                        }
                    } else {
                        var identitySet = getCurrentRpcIdentitySet();
                        var importConnections = getImportableRpcConnections(options);

                        for (var k = 0; k < importConnections.length; k++) {
                            var connection = importConnections[k];
                            var identity = getRpcSettingIdentity(connection);

                            if (identitySet[identity]) {
                                continue;
                            }

                            identitySet[identity] = true;
                            finalOptions.extendRpcServers.push(buildRpcServerFromSource(connection));
                        }
                    }
                }

                setOptions(finalOptions);
            },
            importAllOptions: function (options) {
                this.importOptions(options, {
                    importGlobalSettings: true,
                    importRpcSettings: true,
                    rpcImportMode: 'overwrite',
                    resetToDefaults: true
                });
            },
            exportAllOptions: function () {
                var options = angular.extend({}, ariaNgDefaultOptions, getOptions());

                return options;
            },
            getAllSessionOptions: function () {
                return angular.copy(sessionSettings);
            },
            isInsecureProtocolDisabled: function () {
                return isInsecureProtocolDisabled();
            },
            getLanguage: function () {
                return getOption('language');
            },
            setLanguage: function (value) {
                if (!ariaNgLanguages[value]) {
                    return false;
                }

                setOption('language', value);
                return true;
            },
            getTheme: function () {
                return getOption('theme');
            },
            setTheme: function (value) {
                setOption('theme', value);
                return true;
            },
            isEnableDebugMode: function () {
                return sessionSettings.debugMode;
            },
            setDebugMode: function (value) {
                sessionSettings.debugMode = value;
                ariaNgLogService.setEnableDebugLog(value);
            },
            getTitle: function () {
                return getOption('title');
            },
            setTitle: function (value) {
                setOption('title', value);
            },
            getBrowserNotification: function () {
                return getOption('browserNotification');
            },
            setBrowserNotification: function (value) {
                setOption('browserNotification', value);
            },
            getBrowserNotificationSound: function () {
                return getOption('browserNotificationSound');
            },
            setBrowserNotificationSound: function (value) {
                setOption('browserNotificationSound', value);
            },
            getBrowserNotificationFrequency: function () {
                return getOption('browserNotificationFrequency');
            },
            setBrowserNotificationFrequency: function (value) {
                setOption('browserNotificationFrequency', value);
            },
            getWebSocketReconnectInterval: function () {
                return getOption('webSocketReconnectInterval');
            },
            setWebSocketReconnectInterval: function (value) {
                setOption('webSocketReconnectInterval', value);
            },
            getTitleRefreshInterval: function () {
                return getOption('titleRefreshInterval');
            },
            setTitleRefreshInterval: function (value) {
                setOption('titleRefreshInterval', Math.max(parseInt(value), 0));
            },
            getGlobalStatRefreshInterval: function () {
                return getOption('globalStatRefreshInterval');
            },
            setGlobalStatRefreshInterval: function (value) {
                setOption('globalStatRefreshInterval', Math.max(parseInt(value), 0));
            },
            getDownloadTaskRefreshInterval: function () {
                return getOption('downloadTaskRefreshInterval');
            },
            setDownloadTaskRefreshInterval: function (value) {
                setOption('downloadTaskRefreshInterval', Math.max(parseInt(value), 0));
            },
            getKeyboardShortcuts: function () {
                return getOption('keyboardShortcuts');
            },
            setKeyboardShortcuts: function (value) {
                setOption('keyboardShortcuts', value);
            },
            getSwipeGesture: function () {
                return getOption('swipeGesture');
            },
            setSwipeGesture: function (value) {
                setOption('swipeGesture', value);
            },
            getDragAndDropTasks: function () {
                return getOption('dragAndDropTasks');
            },
            setDragAndDropTasks: function (value) {
                setOption('dragAndDropTasks', value);
            },
            getRPCListDisplayOrder: function () {
                return getOption('rpcListDisplayOrder');
            },
            setRPCListDisplayOrder: function (value) {
                setOption('rpcListDisplayOrder', value);
            },
            getAfterCreatingNewTask: function () {
                return getOption('afterCreatingNewTask');
            },
            setAfterCreatingNewTask: function (value) {
                setOption('afterCreatingNewTask', value);
            },
            getRemoveOldTaskAfterRetrying: function () {
                return getOption('removeOldTaskAfterRetrying');
            },
            setRemoveOldTaskAfterRetrying: function (value) {
                setOption('removeOldTaskAfterRetrying', value);
            },
            getConfirmTaskRemoval: function () {
                return getOption('confirmTaskRemoval');
            },
            setConfirmTaskRemoval: function (value) {
                setOption('confirmTaskRemoval', value);
            },
            getIncludePrefixWhenCopyingFromTaskDetails: function () {
                return getOption('includePrefixWhenCopyingFromTaskDetails');
            },
            setIncludePrefixWhenCopyingFromTaskDetails: function (value) {
                setOption('includePrefixWhenCopyingFromTaskDetails', value);
            },
            getShowPiecesInfoInTaskDetailPage: function () {
                return getOption('showPiecesInfoInTaskDetailPage');
            },
            setShowPiecesInfoInTaskDetailPage: function (value) {
                setOption('showPiecesInfoInTaskDetailPage', value);
            },
            getAfterRetryingTask: function () {
                return getOption('afterRetryingTask');
            },
            setAfterRetryingTask: function (value) {
                setOption('afterRetryingTask', value);
            },
            getCurrentRpcDisplayName: function () {
                var options = getOptions();

                if (options.rpcAlias) {
                    return options.rpcAlias;
                }

                return options.rpcHost + ':' + options.rpcPort;
            },
            getCurrentRpcUrl: function () {
                var options = getOptions();
                var protocol = options.protocol;
                var rpcHost = options.rpcHost;
                var rpcPort = options.rpcPort;
                var rpcInterface = options.rpcInterface;

                return protocol + '://' + rpcHost + ':' + rpcPort + '/' + rpcInterface;
            },
            getCurrentRpcHttpMethod: function () {
                return getOption('httpMethod');
            },
            getCurrentRpcRequestHeaders: function () {
                return getOption('rpcRequestHeaders');
            },
            isCurrentRpcUseWebSocket: function (protocol) {
                if (!protocol) {
                    var options = getOptions();
                    protocol = options.protocol;
                }

                return protocol === 'ws' || protocol === 'wss';
            },
            getCurrentRpcSecret: function () {
                var value = getOption('secret');
                return (value ? ariaNgCommonService.base64Decode(value) : value);
            },
            addNewRpcSetting: function () {
                var options = getOptions();

                if (!angular.isArray(options.extendRpcServers)) {
                    options.extendRpcServers = [];
                }

                var newRpcSetting = createNewRpcSetting();
                options.extendRpcServers.push(newRpcSetting);

                setOptions(options);

                return newRpcSetting;
            },
            updateRpcSetting: function (setting, field) {
                if (!setting) {
                    return setting;
                }

                var updatedSetting = cloneRpcSetting(setting);

                if (angular.isUndefined(updatedSetting[field])) {
                    return setting;
                }

                var value = updatedSetting[field];

                if (field === 'rpcPort') {
                    value = Math.max(parseInt(value), 0);
                } else if (field === 'secret') {
                    if (value) {
                        value = ariaNgCommonService.base64Encode(value);
                    }
                }

                if (setting.isDefault) {
                    setOption(field, value);

                    return setting;
                } else {
                    var options = getOptions();

                    if (!angular.isArray(options.extendRpcServers)) {
                        return setting;
                    }

                    for (var i = 0; i < options.extendRpcServers.length; i++) {
                        if (options.extendRpcServers[i].rpcId === setting.rpcId) {
                            options.extendRpcServers[i][field] = value;
                            break;
                        }
                    }

                    setOptions(options);

                    return setting;
                }
            },
            removeRpcSetting: function (setting) {
                var options = getOptions();

                if (!angular.isArray(options.extendRpcServers)) {
                    return setting;
                }

                for (var i = 0; i < options.extendRpcServers.length; i++) {
                    if (options.extendRpcServers[i].rpcId === setting.rpcId) {
                        options.extendRpcServers.splice(i, 1);
                        break;
                    }
                }

                setOptions(options);

                return setting;
            },
            setDefaultRpcSetting: function (setting, params) {
                params = angular.extend({
                    keepCurrent: true,
                    forceSet: false
                }, params);

                var options = getOptions();
                var currentSetting = cloneRpcSetting(options);
                currentSetting.rpcId = ariaNgCommonService.generateUniqueId();

                if (!angular.isArray(options.extendRpcServers)) {
                    options.extendRpcServers = [];
                }

                var newDefaultSetting = null;

                for (var i = 0; i < options.extendRpcServers.length; i++) {
                    if (options.extendRpcServers[i].rpcId === setting.rpcId) {
                        newDefaultSetting = cloneRpcSetting(options.extendRpcServers[i]);
                        options.extendRpcServers.splice(i, 1);
                        break;
                    }
                }

                if (params.forceSet) {
                    newDefaultSetting = cloneRpcSetting(setting);

                    if (newDefaultSetting.secret) {
                        newDefaultSetting.secret = ariaNgCommonService.base64Encode(newDefaultSetting.secret);
                    }
                }

                if (newDefaultSetting) {
                    if (params.keepCurrent) {
                        options.extendRpcServers.splice(0, 0, currentSetting);
                    }

                    options = angular.extend(options, newDefaultSetting);
                }

                setOptions(options);

                return setting;
            },
            isRpcSettingEqualsDefault: function (setting) {
                if (!setting) {
                    return false;
                }

                var options = this.getAllOptions();

                if (options.rpcHost !== setting.rpcHost) {
                    return false;
                }

                if (options.rpcPort !== setting.rpcPort) {
                    return false;
                }

                if (options.rpcInterface !== setting.rpcInterface) {
                    return false;
                }

                if (options.protocol !== setting.protocol) {
                    return false;
                }

                if (options.httpMethod !== setting.httpMethod) {
                    return false;
                }

                if (options.rpcRequestHeaders !== setting.rpcRequestHeaders) {
                    return false;
                }

                if (options.secret !== setting.secret) {
                    return false;
                }

                return true;
            },
            getTaskListIndependentDisplayOrder: function () {
                return getOption('taskListIndependentDisplayOrder');
            },
            setTaskListIndependentDisplayOrder: function (value) {
                setOption('taskListIndependentDisplayOrder', value);
            },
            getTaskListDisplayOrderKey: function (taskListPageType) {
                var optionKey = 'displayOrder';

                if (this.getTaskListIndependentDisplayOrder()) {
                    if (taskListPageType === 'waiting') {
                        optionKey = 'waitingTaskListPageDisplayOrder';
                    } else if (taskListPageType === 'stopped') {
                        optionKey = 'stoppedTaskListPageDisplayOrder';
                    }
                }

                return optionKey;
            },
            getDisplayOrder: function (taskListPageType) {
                var optionKey = this.getTaskListDisplayOrderKey(taskListPageType);
                var value = getOption(optionKey);

                if (!value) {
                    value = 'default:asc';
                }

                return value;
            },
            setDisplayOrder: function (value, taskListPageType) {
                var optionKey = this.getTaskListDisplayOrderKey(taskListPageType);
                setOption(optionKey, value);
            },
            getFileListDisplayOrder: function () {
                var value = getOption('fileListDisplayOrder');

                if (!value) {
                    value = 'default:asc';
                }

                return value;
            },
            setFileListDisplayOrder: function (value) {
                setOption('fileListDisplayOrder', value);
            },
            getPeerListDisplayOrder: function () {
                var value = getOption('peerListDisplayOrder');

                if (!value) {
                    value = 'default:asc';
                }

                return value;
            },
            setPeerListDisplayOrder: function (value) {
                setOption('peerListDisplayOrder', value);
            },
            resetSettings: function () {
                clearAll();
            },
            onFirstAccess: function (callback) {
                if (!callback) {
                    return;
                }

                onFirstVisitCallbacks.push(callback);
            }
        };
    }]);
}());
