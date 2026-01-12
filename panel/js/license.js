/**
 * CutOne - License Management
 */

const LicenseManager = (function() {
    // License API endpoint
    const LICENSE_API = "https://cutone-app.com/api/license";

    // Storage keys
    const STORAGE_LICENSE = "cutone_license";
    const STORAGE_TRIAL = "cutone_trial";
    const STORAGE_DEVICE_ID = "cutone_device_id";

    // Trial duration (14 days in milliseconds)
    const TRIAL_DURATION = 14 * 24 * 60 * 60 * 1000;

    /**
     * Get or generate device ID
     */
    function getDeviceId() {
        let deviceId = localStorage.getItem(STORAGE_DEVICE_ID);
        if (!deviceId) {
            // Generate unique device ID
            deviceId = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 15);
            localStorage.setItem(STORAGE_DEVICE_ID, deviceId);
        }
        return deviceId;
    }

    /**
     * Check if user is activated (has valid license or trial)
     */
    function isActivated() {
        // Check for valid license
        const licenseData = getLicenseData();
        if (licenseData && licenseData.validUntil) {
            const validUntil = new Date(licenseData.validUntil);
            if (validUntil > new Date()) {
                return {
                    activated: true,
                    type: "license",
                    email: licenseData.email,
                    validUntil: validUntil
                };
            }
        }

        // Check for valid trial
        const trialData = getTrialData();
        if (trialData && trialData.trialEnd && trialData.verified) {
            const trialEnd = new Date(trialData.trialEnd);
            if (trialEnd > new Date()) {
                return {
                    activated: true,
                    type: "trial",
                    email: trialData.email,
                    validUntil: trialEnd,
                    daysLeft: Math.ceil((trialEnd - new Date()) / (24 * 60 * 60 * 1000))
                };
            }
        }

        return {
            activated: false,
            type: null
        };
    }

    /**
     * Get license data from storage
     */
    function getLicenseData() {
        try {
            const data = localStorage.getItem(STORAGE_LICENSE);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Get trial data from storage
     */
    function getTrialData() {
        try {
            const data = localStorage.getItem(STORAGE_TRIAL);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Start a new trial (sends verification email)
     * @param {string} email - User's email address
     */
    async function startTrial(email) {
        if (!email || !isValidEmail(email)) {
            return {
                success: false,
                error: "有効なメールアドレスを入力してください"
            };
        }

        const deviceId = getDeviceId();

        // Check if already has verified trial
        const existingTrial = getTrialData();
        if (existingTrial && existingTrial.verified) {
            if (existingTrial.trialEnd > Date.now()) {
                const daysLeft = Math.ceil((existingTrial.trialEnd - Date.now()) / (24 * 60 * 60 * 1000));
                return {
                    success: true,
                    verified: true,
                    daysLeft: daysLeft,
                    validUntil: new Date(existingTrial.trialEnd),
                    message: "既存のトライアルを継続中"
                };
            }
            return {
                success: false,
                error: "トライアル期間が終了しました。ライセンスを購入してください。"
            };
        }

        try {
            // サーバーでトライアル登録（メール認証が必要）
            const response = await fetch(`${LICENSE_API}/trial`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, deviceId })
            });

            const data = await response.json();

            if (data.success) {
                // サーバーから返されたメールアドレスを使用（デバイス既存トライアルの場合は異なる可能性）
                const actualEmail = data.email || email;

                if (data.verified) {
                    // 既に認証済み
                    const trialEnd = new Date(data.expiresAt).getTime();
                    const trialData = {
                        email: actualEmail,
                        trialEnd: trialEnd,
                        startedAt: Date.now(),
                        verified: true
                    };
                    localStorage.setItem(STORAGE_TRIAL, JSON.stringify(trialData));

                    return {
                        success: true,
                        verified: true,
                        email: actualEmail,
                        daysLeft: data.daysRemaining || 14,
                        validUntil: new Date(trialEnd),
                        message: data.message
                    };
                } else {
                    // メール認証待ち
                    const trialData = {
                        email: actualEmail,
                        verified: false,
                        requestedAt: Date.now()
                    };
                    localStorage.setItem(STORAGE_TRIAL, JSON.stringify(trialData));

                    return {
                        success: true,
                        verified: false,
                        email: actualEmail,
                        message: data.message || "認証メールを送信しました。メールを確認してください。"
                    };
                }
            }

            return {
                success: false,
                error: data.error || "トライアルの開始に失敗しました"
            };
        } catch (e) {
            return {
                success: false,
                error: "サーバーに接続できませんでした。ネットワークを確認してください。"
            };
        }
    }

    /**
     * Check trial verification status
     */
    async function checkTrialStatus() {
        const trialData = getTrialData();
        if (!trialData || !trialData.email) {
            return { active: false, reason: "no_trial" };
        }

        const deviceId = getDeviceId();

        try {
            const response = await fetch(`${LICENSE_API}/status`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email: trialData.email, deviceId })
            });

            const data = await response.json();

            if (data.active) {
                // トライアルが有効 - ローカルデータを更新
                const updatedTrialData = {
                    email: data.email,
                    trialEnd: new Date(data.expiresAt).getTime(),
                    verified: true,
                    startedAt: trialData.startedAt || Date.now()
                };
                localStorage.setItem(STORAGE_TRIAL, JSON.stringify(updatedTrialData));

                return {
                    active: true,
                    email: data.email,
                    daysRemaining: data.daysRemaining,
                    expiresAt: data.expiresAt
                };
            }

            return {
                active: false,
                reason: data.reason
            };
        } catch (e) {
            // オフライン - ローカルデータを使用
            if (trialData.verified && trialData.trialEnd > Date.now()) {
                return {
                    active: true,
                    email: trialData.email,
                    daysRemaining: Math.ceil((trialData.trialEnd - Date.now()) / (24 * 60 * 60 * 1000)),
                    offline: true
                };
            }
            return { active: false, reason: "offline" };
        }
    }

    /**
     * Validate and activate license key
     * @param {string} email - User's email
     * @param {string} key - License key
     */
    async function activateLicense(email, key) {
        if (!email || !isValidEmail(email)) {
            return {
                success: false,
                error: "有効なメールアドレスを入力してください"
            };
        }

        if (!key || key.length < 8) {
            return {
                success: false,
                error: "有効なライセンスキーを入力してください"
            };
        }

        try {
            // サーバーでライセンス検証
            const response = await fetch(`${LICENSE_API}/validate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, licenseKey: key })
            });

            const data = await response.json();

            if (data.valid) {
                const licenseData = {
                    email: email,
                    key: key,
                    validUntil: data.expiresAt || getDefaultExpiry(),
                    type: data.type,
                    daysRemaining: data.daysRemaining,
                    activatedAt: Date.now()
                };

                localStorage.setItem(STORAGE_LICENSE, JSON.stringify(licenseData));

                return {
                    success: true,
                    validUntil: new Date(licenseData.validUntil),
                    type: data.type,
                    daysRemaining: data.daysRemaining
                };
            }

            return {
                success: false,
                error: data.error || "無効なライセンスキーです"
            };
        } catch (e) {
            // オフラインモード - キー形式が正しければローカルに保存
            if (isValidKeyFormat(key)) {
                return saveLocalLicense(email, key);
            }

            return {
                success: false,
                error: "サーバーに接続できませんでした。ネットワークを確認してください。"
            };
        }
    }

    /**
     * Save license locally (offline mode)
     */
    function saveLocalLicense(email, key) {
        const licenseData = {
            email: email,
            key: key,
            validUntil: getDefaultExpiry(),
            activatedAt: Date.now(),
            offline: true
        };

        localStorage.setItem(STORAGE_LICENSE, JSON.stringify(licenseData));

        return {
            success: true,
            validUntil: new Date(licenseData.validUntil),
            offline: true
        };
    }

    /**
     * Deactivate license
     */
    function deactivate() {
        localStorage.removeItem(STORAGE_LICENSE);
        localStorage.removeItem(STORAGE_TRIAL);
        return { success: true };
    }

    /**
     * Validate email format
     */
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Validate license key format (XXXX-XXXX-XXXX-XXXX)
     */
    function isValidKeyFormat(key) {
        const cleaned = key.replace(/[-\s]/g, "").toUpperCase();
        return cleaned.length >= 8 && /^[A-Z0-9]+$/.test(cleaned);
    }

    /**
     * Get default expiry (1 year from now)
     */
    function getDefaultExpiry() {
        const expiry = new Date();
        expiry.setFullYear(expiry.getFullYear() + 1);
        return expiry.toISOString();
    }

    /**
     * Format date for display
     */
    function formatDate(date) {
        if (typeof date === "string") {
            date = new Date(date);
        }
        return date.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    // Public API
    return {
        isActivated: isActivated,
        startTrial: startTrial,
        checkTrialStatus: checkTrialStatus,
        activateLicense: activateLicense,
        deactivate: deactivate,
        getLicenseData: getLicenseData,
        getTrialData: getTrialData,
        getDeviceId: getDeviceId,
        formatDate: formatDate
    };
})();
