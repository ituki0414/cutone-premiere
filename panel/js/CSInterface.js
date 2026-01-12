/**
 * CSInterface - Adobe CEP Communication Library
 * Minimal implementation for AutoCut extension
 */

var CSInterface = function() {
    this.hostEnvironment = {
        appName: "PPRO",
        appVersion: "0.0",
        appLocale: "en_US",
        appUILocale: "en_US",
        appId: "PPRO",
        isAppOnline: true
    };
};

/**
 * Call ExtendScript function
 * @param {string} script - ExtendScript code to execute
 * @param {function} callback - Callback with result
 */
CSInterface.prototype.evalScript = function(script, callback) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.evalScript(script, callback);
    } else {
        // Development mode - simulate response
        console.log("CSInterface.evalScript:", script);
        if (callback) {
            setTimeout(function() {
                callback('{"success": false, "error": "Development mode - no host application"}');
            }, 100);
        }
    }
};

/**
 * Get system path
 * @param {string} pathType - Type of path (extension, userData, etc.)
 */
CSInterface.prototype.getSystemPath = function(pathType) {
    var path = "";
    if (window.__adobe_cep__) {
        path = window.__adobe_cep__.getSystemPath(pathType);
    }
    return path;
};

/**
 * Open URL in default browser
 * @param {string} url - URL to open
 */
CSInterface.prototype.openURLInDefaultBrowser = function(url) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.openURLInDefaultBrowser(url);
    } else {
        window.open(url, "_blank");
    }
};

/**
 * Get host environment info
 */
CSInterface.prototype.getHostEnvironment = function() {
    if (window.__adobe_cep__) {
        var env = window.__adobe_cep__.getHostEnvironment();
        if (typeof env === "string") {
            this.hostEnvironment = JSON.parse(env);
        } else {
            this.hostEnvironment = env;
        }
    }
    return this.hostEnvironment;
};

/**
 * Close extension
 */
CSInterface.prototype.closeExtension = function() {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.closeExtension();
    }
};

/**
 * Request open extension
 * @param {string} extensionId - Extension ID to open
 */
CSInterface.prototype.requestOpenExtension = function(extensionId) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.requestOpenExtension(extensionId);
    }
};

/**
 * Add event listener
 * @param {string} type - Event type
 * @param {function} listener - Event handler
 */
CSInterface.prototype.addEventListener = function(type, listener) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.addEventListener(type, listener);
    }
};

/**
 * Remove event listener
 * @param {string} type - Event type
 * @param {function} listener - Event handler
 */
CSInterface.prototype.removeEventListener = function(type, listener) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.removeEventListener(type, listener);
    }
};

/**
 * Dispatch event
 * @param {object} event - Event object with type and data
 */
CSInterface.prototype.dispatchEvent = function(event) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.dispatchEvent(event);
    }
};

// Path type constants
CSInterface.EXTENSION_PATH = "extension";
CSInterface.USER_DATA_PATH = "userData";
CSInterface.COMMON_FILES_PATH = "commonFiles";
CSInterface.HOST_APPLICATION_PATH = "hostApplication";
CSInterface.MY_DOCUMENTS_PATH = "myDocuments";
