/**
 * CutOne - Internationalization (i18n)
 * Supports: English, Japanese
 */

const I18n = (function() {
    // Storage key for language preference
    const STORAGE_LANG = "autocut_language";

    // Default language
    let currentLang = "ja";

    // Translations
    const translations = {
        en: {
            // Auth screen
            "auth.title": "Edit 10x Faster with AI",
            "auth.subtitle": "AI plugin that cut silences, add animated captions, zoom, B-Rolls & more — in one click.",
            "auth.startTrial": "Start 14-Day Free Trial",
            "auth.haveLicense": "I Already Have a License",
            "auth.buyLicense": "Buy a license key",

            // Trial screen
            "trial.title": "Start 14-Day Free Trial",
            "trial.subtitle": "Enter your email to start the trial",
            "trial.email": "your@email.com",
            "trial.activate": "Start Free Trial",
            "trial.step1": "Email",
            "trial.step2": "Activate",

            // License screen
            "license.title": "Enter License Key",
            "license.subtitle": "Enter your email and license key",
            "license.email": "Email",
            "license.key": "License Key",
            "license.keyPlaceholder": "XXXX-XXXX-XXXX-XXXX",
            "license.activate": "Activate",

            // Main screen
            "main.noSequence": "No sequence selected",
            "main.sectionSilence": "Silence Detection",
            "main.threshold": "Silence Threshold",
            "main.thresholdHint": "Lower values detect quieter sounds as silence",
            "main.duration": "Minimum Duration",
            "main.durationHint": "Shorter silences than this will be kept",
            "main.margin": "Cut Margin",
            "main.marginHint": "Padding around each cut to preserve audio",
            "main.sectionOptions": "Options",
            "main.addMarkers": "Add markers at silence positions",
            "main.previewOnly": "Preview only (don't cut)",
            "main.cutSilence": "Cut Silence",
            "main.sectionResults": "Results",
            "main.original": "Original",
            "main.afterCut": "After Cut",
            "main.saved": "Saved",

            // Processing
            "process.analyzing": "Analyzing audio...",
            "process.detecting": "Detecting silence...",
            "process.addingMarkers": "Adding markers...",
            "process.cutting": "Cutting silence...",
            "process.processing": "Processing...",

            // Messages
            "msg.trialStarted": "Trial started! 14 days remaining",
            "msg.trialDays": "Trial: {days} days remaining",
            "msg.licenseActivated": "License activated!",
            "msg.licenseDeactivated": "License deactivated",
            "msg.noSilence": "No silence detected",
            "msg.foundSegments": "Found {count} silence segments",
            "msg.cutSegments": "Cut {count} silence segments!",
            "msg.openSequence": "Please open a sequence first",
            "msg.enterEmail": "Please enter your email",
            "msg.enterLicense": "Please enter your license key",
            "msg.error": "An error occurred",

            // Settings
            "settings.deactivate": "Do you want to deactivate your license?",

            // Status bar
            "status.licensed": "Licensed",
            "status.trialDays": "{days} days left",

            // Homepage
            "home.title": "Homepage",
            "feature.silence": "AutoCut Silences",
            "feature.silenceDesc": "Remove silences from timeline automatically",
            "feature.captions": "AutoCaptions",
            "feature.captionsDesc": "Auto-generate captions with AI",
            "feature.zoom": "AutoZoom",
            "feature.zoomDesc": "Add automatic zoom effects",
            "feature.broll": "AutoB-Rolls",
            "feature.brollDesc": "Auto-insert B-rolls with AI",
            "feature.comingSoon": "Coming Soon",

            // Silence Wizard
            "silence.step1": "Define Section",
            "silence.step2": "Customize Settings",
            "silence.defineSection": "Define Section",
            "silence.defineSectionDesc": "Select the audio sections to process",
            "silence.entireSequence": "Entire Sequence",
            "silence.inOutPoints": "In/Out Points",
            "silence.selectedClips": "Selected Clips",
            "silence.analyzedSection": "Analyzed Section",
            "silence.ignoredSection": "Ignored Section",
            "silence.affectedSection": "Affected Section",
            "silence.defineHint": "Define the audio sections",
            "silence.confirmSection": "Confirm Section",
            "silence.back": "Back",

            // Settings (Step 2)
            "settings.noiseThreshold": "Noise Threshold",
            "settings.noiseThresholdDesc": "Volume setting to identify silence",
            "settings.pacing": "Pacing",
            "settings.defaultPreset": "Default Presets",
            "settings.presetCalm": "Calm",
            "settings.presetCareful": "Careful",
            "settings.presetGood": "Good Pace",
            "settings.presetEnergetic": "Energetic",
            "settings.presetQuick": "Quick",
            "settings.silenceDuration": "Silence Duration",
            "settings.removeLongSilence": "Remove Long Silence",
            "settings.removeLongSilenceHint": "Minimum duration to delete silence (ms)",
            "settings.keepLongTalk": "Keep Long Talk",
            "settings.keepLongTalkHint": "Minimum duration to keep talk segments (ms)",
            "settings.ms": "ms",
            "settings.padding": "Padding",
            "settings.paddingBefore": "Before Padding",
            "settings.paddingBeforeHint": "Silence before noise for smooth conversation start",
            "settings.paddingAfter": "After Padding",
            "settings.paddingAfterHint": "Silence after noise for smooth conversation end",
            "settings.silenceManagement": "Silence Management",
            "settings.deleteSilence": "Delete Silence",
            "settings.keepSilence": "Keep Silence",
            "settings.disableSilence": "Disable Silence",
            "settings.deleteKeepSpace": "Delete Silence & Keep Space",
            "settings.transition": "Transition",
            "settings.transitionDesc": "All cuts can be J-Cut, L-Cut, or both",
            "settings.transitionNone": "None",
            "settings.transitionBoth": "Both",
            "settings.constantPower": "Constant Power",
            "settings.preview": "Preview",
            "settings.previewDesc": "Shows segments to keep and delete",
            "settings.generatePreview": "Generate Preview",
            "settings.legendMargin": "Margin",
            "settings.legendDelete": "Delete",
            "settings.legendGap": "Gap between clips",
            "settings.legendThreshold": "Noise Threshold",
            "settings.cutAndDelete": "Cut & Delete Silence"
        },

        ja: {
            // Auth screen
            "auth.title": "AIで編集を10倍速く",
            "auth.subtitle": "無音カット、字幕生成、ズーム、Bロール挿入など — ワンクリックで実行",
            "auth.startTrial": "14日間無料トライアル",
            "auth.haveLicense": "ライセンスキーを持っている",
            "auth.buyLicense": "ライセンスを購入",

            // Trial screen
            "trial.title": "14日間無料トライアル",
            "trial.subtitle": "メールアドレスを入力してトライアルを開始",
            "trial.email": "your@email.com",
            "trial.activate": "トライアルを開始",
            "trial.step1": "メール",
            "trial.step2": "有効化",

            // License screen
            "license.title": "ライセンスキーを入力",
            "license.subtitle": "メールアドレスとライセンスキーを入力",
            "license.email": "メールアドレス",
            "license.key": "ライセンスキー",
            "license.keyPlaceholder": "XXXX-XXXX-XXXX-XXXX",
            "license.activate": "有効化",

            // Main screen
            "main.noSequence": "シーケンスが選択されていません",
            "main.sectionSilence": "無音検出設定",
            "main.threshold": "無音判定閾値",
            "main.thresholdHint": "小さいほど静かな音も無音として検出",
            "main.duration": "最小無音時間",
            "main.durationHint": "これより短い無音はカットしない",
            "main.margin": "カット前後のマージン",
            "main.marginHint": "音声の切れ目に余白を残す",
            "main.sectionOptions": "オプション",
            "main.addMarkers": "無音位置にマーカーを追加",
            "main.previewOnly": "プレビューのみ（カットしない）",
            "main.cutSilence": "無音カットを実行",
            "main.sectionResults": "処理結果",
            "main.original": "元の長さ",
            "main.afterCut": "カット後",
            "main.saved": "削減",

            // Processing
            "process.analyzing": "音声を解析中...",
            "process.detecting": "無音を検出中...",
            "process.addingMarkers": "マーカーを追加中...",
            "process.cutting": "無音をカット中...",
            "process.processing": "処理中...",

            // Messages
            "msg.trialStarted": "トライアル開始！残り14日",
            "msg.trialDays": "トライアル：残り{days}日",
            "msg.licenseActivated": "ライセンスが有効化されました！",
            "msg.licenseDeactivated": "ライセンスが無効化されました",
            "msg.noSilence": "無音が検出されませんでした",
            "msg.foundSegments": "{count}箇所の無音を検出",
            "msg.cutSegments": "{count}箇所の無音をカットしました！",
            "msg.openSequence": "シーケンスを開いてください",
            "msg.enterEmail": "メールアドレスを入力してください",
            "msg.enterLicense": "ライセンスキーを入力してください",
            "msg.error": "エラーが発生しました",

            // Settings
            "settings.deactivate": "ライセンスを無効化しますか？",

            // Status bar
            "status.licensed": "ライセンス認証済み",
            "status.trialDays": "残り{days}日",

            // Homepage
            "home.title": "ホーム",
            "feature.silence": "無音カット",
            "feature.silenceDesc": "タイムラインから無音部分を自動削除",
            "feature.captions": "自動字幕",
            "feature.captionsDesc": "AIで字幕を自動生成",
            "feature.zoom": "自動ズーム",
            "feature.zoomDesc": "自動ズームエフェクト追加",
            "feature.broll": "自動Bロール",
            "feature.brollDesc": "AIでBロールを自動挿入",
            "feature.comingSoon": "近日公開",

            // Silence Wizard
            "silence.step1": "セクションを定義",
            "silence.step2": "設定をカスタマイズ",
            "silence.defineSection": "セクションを定義",
            "silence.defineSectionDesc": "処理するオーディオセクションを選択してください",
            "silence.entireSequence": "全体のシーケンス",
            "silence.inOutPoints": "イン/アウトポイント",
            "silence.selectedClips": "選択したクリップ",
            "silence.analyzedSection": "分析されたセクション",
            "silence.ignoredSection": "無視されたセクション",
            "silence.affectedSection": "処理対象セクション",
            "silence.defineHint": "オーディオセクションを定義してください",
            "silence.confirmSection": "セクションを確認",
            "silence.back": "戻る",

            // Settings (Step 2)
            "settings.noiseThreshold": "ノイズ閾値",
            "settings.noiseThresholdDesc": "無音を特定するための音量の設定",
            "settings.pacing": "ペーシング",
            "settings.defaultPreset": "デフォルトプリセット",
            "settings.presetCalm": "落ち着いた",
            "settings.presetCareful": "慎重な",
            "settings.presetGood": "ペースの良い",
            "settings.presetEnergetic": "エネルギッシュ",
            "settings.presetQuick": "軽快な",
            "settings.silenceDuration": "無音の持続時間",
            "settings.removeLongSilence": "無音が長い場合に削除",
            "settings.removeLongSilenceHint": "無音を削除する最小期間（ミリ秒）",
            "settings.keepLongTalk": "会話が長い場合は保持",
            "settings.keepLongTalkHint": "トークセグメントを残す最小期間（ミリ秒）",
            "settings.ms": "ミリ秒",
            "settings.padding": "パディング",
            "settings.paddingBefore": "前のパディング",
            "settings.paddingBeforeHint": "会話開始をスムーズにするためのノイズ前の無音時間",
            "settings.paddingAfter": "後のパディング",
            "settings.paddingAfterHint": "会話終了をスムーズにするためのノイズ後の無音時間",
            "settings.silenceManagement": "無音の管理",
            "settings.deleteSilence": "無音を削除",
            "settings.keepSilence": "無音を保持",
            "settings.disableSilence": "無音を無効化",
            "settings.deleteKeepSpace": "無音を削除してスペースを保持",
            "settings.transition": "トランジション",
            "settings.transitionDesc": "すべてのカットはJ-Cut、L-Cut、または両方であることが望ましい場合があります",
            "settings.transitionNone": "なし",
            "settings.transitionBoth": "両方",
            "settings.constantPower": "コンスタントパワー",
            "settings.preview": "プレビュー",
            "settings.previewDesc": "保持および削除されたセグメントを表示します",
            "settings.generatePreview": "プレビューを生成",
            "settings.legendMargin": "マージン",
            "settings.legendDelete": "削除",
            "settings.legendGap": "クリップ間のギャップ",
            "settings.legendThreshold": "ノイズ閾値",
            "settings.cutAndDelete": "無音をカットして削除"
        }
    };

    /**
     * Initialize i18n
     */
    function init() {
        // Load saved language preference
        const savedLang = localStorage.getItem(STORAGE_LANG);
        if (savedLang && translations[savedLang]) {
            currentLang = savedLang;
        } else {
            // Detect browser language
            const browserLang = navigator.language.split("-")[0];
            if (translations[browserLang]) {
                currentLang = browserLang;
            }
        }

        // Apply translations
        applyTranslations();

        return currentLang;
    }

    /**
     * Get translation for key
     * @param {string} key - Translation key
     * @param {object} params - Parameters for interpolation
     */
    function t(key, params = {}) {
        const lang = translations[currentLang] || translations.en;
        let text = lang[key] || translations.en[key] || key;

        // Replace parameters
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });

        return text;
    }

    /**
     * Set current language
     * @param {string} lang - Language code (en, ja)
     */
    function setLanguage(lang) {
        if (translations[lang]) {
            currentLang = lang;
            localStorage.setItem(STORAGE_LANG, lang);
            applyTranslations();
            return true;
        }
        return false;
    }

    /**
     * Get current language
     */
    function getLanguage() {
        return currentLang;
    }

    /**
     * Get available languages
     */
    function getAvailableLanguages() {
        return Object.keys(translations);
    }

    /**
     * Apply translations to DOM elements with data-i18n attribute
     */
    function applyTranslations() {
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            const text = t(key);

            if (el.tagName === "INPUT" && el.getAttribute("placeholder")) {
                el.placeholder = text;
            } else {
                el.textContent = text;
            }
        });

        // Also update elements with data-i18n-placeholder
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            el.placeholder = t(key);
        });
    }

    // Public API
    return {
        init: init,
        t: t,
        setLanguage: setLanguage,
        getLanguage: getLanguage,
        getAvailableLanguages: getAvailableLanguages,
        applyTranslations: applyTranslations
    };
})();
