/**
 * CutOne - Main Application
 * Full implementation with all features
 */

(function() {
    "use strict";

    // ============================================
    // DOM Elements
    // ============================================
    const elements = {
        // Language
        langBtn: document.getElementById("langBtn"),
        langLabel: document.getElementById("langLabel"),

        // Screens
        authScreen: document.getElementById("authScreen"),
        trialScreen: document.getElementById("trialScreen"),
        licenseScreen: document.getElementById("licenseScreen"),
        mainScreen: document.getElementById("mainScreen"),
        silenceScreen: document.getElementById("silenceScreen"),

        // Auth buttons
        startTrialBtn: document.getElementById("startTrialBtn"),
        enterLicenseBtn: document.getElementById("enterLicenseBtn"),
        buyLicenseBtn: document.getElementById("buyLicenseBtn"),

        // Trial screen
        trialEmail: document.getElementById("trialEmail"),
        activateTrialBtn: document.getElementById("activateTrialBtn"),
        backFromTrialBtn: document.getElementById("backFromTrialBtn"),

        // License screen
        licenseEmail: document.getElementById("licenseEmail"),
        licenseKey: document.getElementById("licenseKey"),
        activateLicenseBtn: document.getElementById("activateLicenseBtn"),
        backFromLicenseBtn: document.getElementById("backFromLicenseBtn"),

        // Feature cards
        featureSilence: document.getElementById("featureSilence"),
        featureCaptions: document.getElementById("featureCaptions"),
        backFromSilenceBtn: document.getElementById("backFromSilenceBtn"),
        backFromTranscriptionBtn: document.getElementById("backFromTranscriptionBtn"),

        // Transcription screen
        transcriptionScreen: document.getElementById("transcriptionScreen"),
        transcriptionSequenceName: document.getElementById("transcriptionSequenceName"),
        transcriptionSequenceDuration: document.getElementById("transcriptionSequenceDuration"),
        transcriptionRefreshBtn: document.getElementById("transcriptionRefreshBtn"),
        openaiApiKey: document.getElementById("openaiApiKey"),
        toggleApiKeyBtn: document.getElementById("toggleApiKeyBtn"),
        openaiApiLink: document.getElementById("openaiApiLink"),
        addToSequence: document.getElementById("addToSequence"),
        exportSrt: document.getElementById("exportSrt"),
        transcriptionPreviewSection: document.getElementById("transcriptionPreviewSection"),
        transcriptionResult: document.getElementById("transcriptionResult"),
        transcriptionSegmentCount: document.getElementById("transcriptionSegmentCount"),
        transcriptionCharCount: document.getElementById("transcriptionCharCount"),
        startTranscriptionBtn: document.getElementById("startTranscriptionBtn"),
        transcriptionResultActions: document.getElementById("transcriptionResultActions"),
        reTranscribeBtn: document.getElementById("reTranscribeBtn"),
        applyTranscriptionBtn: document.getElementById("applyTranscriptionBtn"),

        // Wizard
        wizardStep1: document.getElementById("step1"),
        wizardStep2: document.getElementById("step2"),
        stepContent1: document.getElementById("stepContent1"),
        stepContent2: document.getElementById("stepContent2"),
        nextStepBtn: document.getElementById("nextStepBtn"),
        prevStepBtn: document.getElementById("prevStepBtn"),
        sectionTypeBtns: document.querySelectorAll(".section-type-btn"),
        timelineStart: document.getElementById("timelineStart"),
        timelineEnd: document.getElementById("timelineEnd"),
        audioTracks: document.getElementById("audioTracks"),

        // Header
        refreshBtn: document.getElementById("refreshBtn"),
        settingsBtn: document.getElementById("settingsBtn"),

        // Status bar
        statusBar: document.getElementById("statusBar"),
        trialStatus: document.getElementById("trialStatus"),
        upgradeBtn: document.getElementById("upgradeBtn"),
        helpBtn: document.getElementById("helpBtn"),

        // Sequence info
        sequenceName: document.getElementById("sequenceName"),
        sequenceDuration: document.getElementById("sequenceDuration"),

        // Step 2 Settings
        thresholdSlider: document.getElementById("thresholdSlider"),
        thresholdValue: document.getElementById("thresholdValue"),
        presetBtns: document.querySelectorAll(".preset-btn"),
        minSilenceDuration: document.getElementById("minSilenceDuration"),
        minTalkDuration: document.getElementById("minTalkDuration"),
        paddingBefore: document.getElementById("paddingBefore"),
        paddingAfter: document.getElementById("paddingAfter"),
        generatePreviewBtn: document.getElementById("generatePreviewBtn"),
        previewWaveform: document.getElementById("previewWaveform"),
        sequenceStart: document.getElementById("sequenceStart"),
        sequenceEnd: document.getElementById("sequenceEnd"),
        previewStart: document.getElementById("previewStart"),
        previewEnd: document.getElementById("previewEnd"),

        // Action
        processBtn: document.getElementById("processBtn"),

        // Results
        resultsSection: document.getElementById("resultsSection"),
        originalDuration: document.getElementById("originalDuration"),
        newDuration: document.getElementById("newDuration"),
        savedPercent: document.getElementById("savedPercent"),

        // Overlay
        processingOverlay: document.getElementById("processingOverlay"),
        processingText: document.getElementById("processingText"),

        // Toast
        toast: document.getElementById("toast"),
        toastMessage: document.getElementById("toastMessage")
    };

    // ============================================
    // State
    // ============================================
    let currentSequence = null;
    let detectedSegments = [];
    let audioLevels = [];
    let currentWizardStep = 1;
    let selectedSectionType = "all";
    let selectedTracks = ["A1", "A2", "A3"];
    let isProcessing = false; // Guard against multiple concurrent processing

    // Transcription state
    let transcriptionSegments = [];
    let isTranscribing = false;

    // ============================================
    // Initialization
    // ============================================
    function init() {
        console.log("[CutOne] ========== Initializing CutOne ==========");

        // Initialize i18n
        const lang = I18n.init();
        updateLanguageLabel(lang);
        console.log("[CutOne] i18n initialized, language:", lang);

        // Initialize CEP
        const cepResult = CEP.init();
        console.log("[CutOne] CEP initialized:", !!cepResult);

        // Setup event listeners
        setupEventListeners();
        console.log("[CutOne] Event listeners set up");

        // Check license status
        checkLicenseStatus();
        console.log("[CutOne] License check started");

        // Update slider displays
        updateSliderDisplays();
        console.log("[CutOne] ========== Initialization Complete ==========");
    }

    // ============================================
    // Language Functions
    // ============================================
    function toggleLanguage() {
        const currentLang = I18n.getLanguage();
        const newLang = currentLang === "ja" ? "en" : "ja";
        I18n.setLanguage(newLang);
        updateLanguageLabel(newLang);
    }

    function updateLanguageLabel(lang) {
        elements.langLabel.textContent = lang.toUpperCase();
    }

    function setupEventListeners() {
        // Language switcher
        elements.langBtn.addEventListener("click", toggleLanguage);

        // Auth screen buttons
        elements.startTrialBtn.addEventListener("click", showTrialScreen);
        elements.enterLicenseBtn.addEventListener("click", showLicenseScreen);
        elements.buyLicenseBtn.addEventListener("click", openPurchasePage);

        // Trial screen
        elements.activateTrialBtn.addEventListener("click", activateTrial);
        elements.backFromTrialBtn.addEventListener("click", showAuthScreen);

        // License screen
        elements.activateLicenseBtn.addEventListener("click", activateLicense);
        elements.backFromLicenseBtn.addEventListener("click", showAuthScreen);

        // Feature cards
        elements.featureSilence.addEventListener("click", showSilenceScreen);
        elements.backFromSilenceBtn.addEventListener("click", showMainScreen);
        elements.featureCaptions.addEventListener("click", showTranscriptionScreen);
        elements.backFromTranscriptionBtn.addEventListener("click", showMainScreen);

        // Transcription screen
        elements.transcriptionRefreshBtn.addEventListener("click", refreshTranscriptionSequenceInfo);
        elements.toggleApiKeyBtn.addEventListener("click", toggleApiKeyVisibility);
        elements.openaiApiLink.addEventListener("click", openOpenAIApiPage);
        elements.startTranscriptionBtn.addEventListener("click", startTranscription);
        elements.reTranscribeBtn.addEventListener("click", resetTranscription);
        elements.applyTranscriptionBtn.addEventListener("click", applyTranscription);

        // Wizard navigation
        elements.nextStepBtn.addEventListener("click", goToStep2);
        elements.prevStepBtn.addEventListener("click", goToStep1);

        // Section type buttons
        elements.sectionTypeBtns.forEach(btn => {
            btn.addEventListener("click", () => selectSectionType(btn));
        });

        // Track checkboxes
        document.querySelectorAll(".track-checkbox input").forEach(checkbox => {
            checkbox.addEventListener("change", updateSelectedTracks);
        });

        // Header buttons
        elements.refreshBtn.addEventListener("click", refreshSequenceInfo);
        elements.settingsBtn.addEventListener("click", showSettings);

        // Status bar buttons
        elements.upgradeBtn.addEventListener("click", openPurchasePage);
        elements.helpBtn.addEventListener("click", openHelpPage);

        // Step 2 Settings
        elements.thresholdSlider.addEventListener("input", updateThresholdDisplay);

        // Preset buttons
        elements.presetBtns.forEach(btn => {
            btn.addEventListener("click", () => selectPreset(btn));
        });

        // Generate preview button
        elements.generatePreviewBtn.addEventListener("click", generatePreview);

        // Process button - SINGLE listener only, with guard flag
        console.log("[CutOne] Setting up processBtn listener, element:", elements.processBtn);
        if (elements.processBtn && !elements.processBtn._listenerAttached) {
            elements.processBtn._listenerAttached = true;
            elements.processBtn.addEventListener("click", function(e) {
                console.log("[CutOne] Process button CLICK!");
                e.preventDefault();
                e.stopPropagation();
                processSequence();
            });
            console.log("[CutOne] processBtn listener attached successfully");
        } else if (elements.processBtn && elements.processBtn._listenerAttached) {
            console.log("[CutOne] processBtn listener already attached - skipping");
        } else {
            console.error("[CutOne] processBtn element not found!");
        }

        // Enter key on inputs
        elements.trialEmail.addEventListener("keypress", (e) => {
            if (e.key === "Enter") activateTrial();
        });
        elements.licenseKey.addEventListener("keypress", (e) => {
            if (e.key === "Enter") activateLicense();
        });
    }

    function updateSliderDisplays() {
        updateThresholdDisplay();
    }

    // ============================================
    // Screen Navigation
    // ============================================
    function showScreen(screenName) {
        // Hide all screens
        elements.authScreen.classList.add("hidden");
        elements.trialScreen.classList.add("hidden");
        elements.licenseScreen.classList.add("hidden");
        elements.mainScreen.classList.add("hidden");
        elements.silenceScreen.classList.add("hidden");
        elements.transcriptionScreen.classList.add("hidden");

        // Hide status bar by default
        elements.statusBar.classList.add("hidden");

        // Show requested screen
        switch (screenName) {
            case "auth":
                elements.authScreen.classList.remove("hidden");
                break;
            case "trial":
                elements.trialScreen.classList.remove("hidden");
                break;
            case "license":
                elements.licenseScreen.classList.remove("hidden");
                break;
            case "main":
                elements.mainScreen.classList.remove("hidden");
                elements.statusBar.classList.remove("hidden");
                updateStatusBar();
                break;
            case "silence":
                elements.silenceScreen.classList.remove("hidden");
                elements.statusBar.classList.remove("hidden");
                refreshSequenceInfo();
                break;
            case "transcription":
                elements.transcriptionScreen.classList.remove("hidden");
                elements.statusBar.classList.remove("hidden");
                refreshTranscriptionSequenceInfo();
                loadSavedApiKey();
                break;
        }
    }

    function showAuthScreen() {
        showScreen("auth");
    }

    function showTrialScreen() {
        showScreen("trial");
        elements.trialEmail.focus();
    }

    function showLicenseScreen() {
        showScreen("license");
        elements.licenseEmail.focus();
    }

    function showMainScreen() {
        showScreen("main");
    }

    function showSilenceScreen() {
        showScreen("silence");
        // Reset wizard to step 1
        currentWizardStep = 1;
        updateWizardUI();
        // Reset preview
        resetPreviewWaveform();
    }

    function showTranscriptionScreen() {
        showScreen("transcription");
        // Reset transcription state
        resetTranscription();
    }

    // ============================================
    // Transcription Functions
    // ============================================

    async function refreshTranscriptionSequenceInfo() {
        console.log("[CutOne] refreshTranscriptionSequenceInfo called");

        // DEBUG: Show that we're trying to get sequence
        elements.transcriptionSequenceName.textContent = "取得中...";

        try {
            console.log("[CutOne] Calling CEP.getActiveSequence()...");
            const result = await CEP.getActiveSequence();
            console.log("[CutOne] CEP.getActiveSequence() returned:", JSON.stringify(result));

            if (result && result.success) {
                currentSequence = result;
                elements.transcriptionSequenceName.textContent = result.name;
                elements.transcriptionSequenceDuration.textContent = result.durationFormatted;
                console.log("[CutOne] Transcription screen - Sequence loaded:", result.name);
            } else {
                currentSequence = null;
                // DEBUG: Show actual result for debugging
                elements.transcriptionSequenceName.textContent = "結果: " + JSON.stringify(result);
                elements.transcriptionSequenceDuration.textContent = "--:--";
                console.log("[CutOne] Transcription screen - No sequence, result:", result);
            }
        } catch (e) {
            // When callExtendScript rejects (success: false), this is triggered
            // Update UI to show no sequence
            currentSequence = null;
            // DEBUG: Show actual error for debugging
            const errorMsg = e.message || e.toString() || "unknown error";
            elements.transcriptionSequenceName.textContent = "エラー: " + errorMsg;
            elements.transcriptionSequenceDuration.textContent = "--:--";
            console.error("[CutOne] Transcription screen - Error getting sequence:", errorMsg);
        }
    }

    function toggleApiKeyVisibility() {
        const input = elements.openaiApiKey;
        if (input.type === "password") {
            input.type = "text";
        } else {
            input.type = "password";
        }
    }

    function openOpenAIApiPage(e) {
        e.preventDefault();
        CEP.openURL("https://platform.openai.com/api-keys");
    }

    function loadSavedApiKey() {
        const savedKey = localStorage.getItem("cutone_openai_api_key");
        if (savedKey) {
            elements.openaiApiKey.value = savedKey;
        }
    }

    function saveApiKey(key) {
        localStorage.setItem("cutone_openai_api_key", key);
    }

    function getSelectedTranscriptionLanguage() {
        const selected = document.querySelector('input[name="transcriptionLang"]:checked');
        return selected ? selected.value : "ja";
    }

    async function startTranscription() {
        if (isTranscribing) {
            console.log("[CutOne] Already transcribing");
            return;
        }

        const apiKey = elements.openaiApiKey.value.trim();
        if (!apiKey) {
            showToast("OpenAI APIキーを入力してください", "error");
            return;
        }

        if (!apiKey.startsWith("sk-")) {
            showToast("有効なAPIキーを入力してください（sk-で始まる）", "error");
            return;
        }

        // Save API key for future use
        saveApiKey(apiKey);

        if (!currentSequence) {
            await refreshTranscriptionSequenceInfo();
            if (!currentSequence) {
                showToast("シーケンスを開いてください", "error");
                return;
            }
        }

        isTranscribing = true;

        try {
            showLoading("文字起こしを開始中...");

            const options = {
                apiKey: apiKey,
                language: getSelectedTranscriptionLanguage()
            };

            const result = await CEP.transcribeAudio(options, (message, percent) => {
                updateLoadingText(message);
            });

            hideLoading();

            if (result && result.success) {
                transcriptionSegments = result.segments;
                displayTranscriptionResult(result.segments);
                showToast(`${result.segments.length}セグメントの文字起こしが完了しました`, "success");
            } else {
                showToast(result?.error || "文字起こしに失敗しました", "error");
            }
        } catch (e) {
            hideLoading();
            showToast(e.message || "文字起こしに失敗しました", "error");
            console.error("[CutOne] Transcription error:", e);
        } finally {
            isTranscribing = false;
        }
    }

    function displayTranscriptionResult(segments) {
        // Show preview section
        elements.transcriptionPreviewSection.style.display = "block";

        // Render segments
        let html = "";
        let totalChars = 0;

        segments.forEach((seg) => {
            const startTime = formatTimestamp(seg.start);
            const endTime = formatTimestamp(seg.end);
            totalChars += seg.text.length;

            html += `
                <div class="transcription-segment">
                    <div class="transcription-segment-time">${startTime} → ${endTime}</div>
                    <div class="transcription-segment-text">${escapeHtml(seg.text)}</div>
                </div>
            `;
        });

        elements.transcriptionResult.innerHTML = html;
        elements.transcriptionSegmentCount.textContent = segments.length;
        elements.transcriptionCharCount.textContent = totalChars;

        // Show result actions, hide start button
        elements.startTranscriptionBtn.parentElement.style.display = "none";
        elements.transcriptionResultActions.style.display = "flex";
    }

    function formatTimestamp(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    function resetTranscription() {
        transcriptionSegments = [];
        isTranscribing = false;

        // Hide preview section
        elements.transcriptionPreviewSection.style.display = "none";
        elements.transcriptionResult.innerHTML = "";

        // Show start button, hide result actions
        elements.startTranscriptionBtn.parentElement.style.display = "flex";
        elements.transcriptionResultActions.style.display = "none";
    }

    async function applyTranscription() {
        if (transcriptionSegments.length === 0) {
            showToast("文字起こし結果がありません", "error");
            return;
        }

        showLoading("字幕を適用中...");

        try {
            const addToSeq = elements.addToSequence.checked;
            const exportSrt = elements.exportSrt.checked;

            let results = [];

            // Get project folder path for SRT export
            const sequenceResult = await CEP.callExtendScript("getSequenceInfo", []);
            let srtPath = "";

            if (sequenceResult && sequenceResult.projectPath) {
                const projectDir = sequenceResult.projectPath.replace(/[^/\\]+$/, "");
                srtPath = projectDir + currentSequence.name + "_captions.srt";
            } else {
                // Fallback to temp directory
                const os = require("os");
                srtPath = os.tmpdir() + "/" + (currentSequence?.name || "captions") + ".srt";
            }

            // Always export SRT first
            const srtResult = await CEP.exportSRT(transcriptionSegments, srtPath);

            if (!srtResult || !srtResult.success) {
                hideLoading();
                showToast("SRTファイルの保存に失敗しました", "error");
                return;
            }

            // Add to sequence as captions
            if (addToSeq) {
                // Import SRT into project
                const importResult = await CEP.callExtendScript("importSRTCaptions", [srtPath]);
                console.log("[CutOne] importSRTCaptions result:", JSON.stringify(importResult, null, 2));

                if (importResult && importResult.success) {
                    if (importResult.addedToSequence) {
                        results.push(`字幕トラックに追加しました`);
                    } else {
                        results.push(`SRTをプロジェクトにインポートしました`);
                        // Open Finder to show the SRT file
                        try {
                            const { exec } = require("child_process");
                            exec(`open -R "${srtPath}"`);
                        } catch (e) {
                            console.log("[CutOne] Could not open Finder:", e);
                        }
                        results.push(`「キャプション」パネルにドラッグして追加してください`);
                    }
                } else {
                    results.push(`SRTをエクスポートしました: ${srtPath}`);
                    // Open Finder to show the SRT file
                    try {
                        const { exec } = require("child_process");
                        exec(`open -R "${srtPath}"`);
                    } catch (e) {
                        console.log("[CutOne] Could not open Finder:", e);
                    }
                    results.push(`Finderで開きました。シーケンスにドラッグして追加してください`);
                }
            }

            // Export SRT file notification
            if (exportSrt && !addToSeq) {
                results.push(`SRTファイルを保存: ${srtPath}`);
                // Open Finder to show the SRT file
                try {
                    const { exec } = require("child_process");
                    exec(`open -R "${srtPath}"`);
                } catch (e) {
                    console.log("[CutOne] Could not open Finder:", e);
                }
            }

            hideLoading();

            if (results.length > 0) {
                showToast(results.join("、"), "success");
            } else {
                showToast("出力オプションを選択してください", "info");
            }

        } catch (e) {
            hideLoading();
            showToast(e.message || "適用に失敗しました", "error");
            console.error("[CutOne] Apply error:", e);
        }
    }

    // ============================================
    // Wizard Functions
    // ============================================
    function goToStep1() {
        currentWizardStep = 1;
        updateWizardUI();
    }

    function goToStep2() {
        currentWizardStep = 2;
        updateWizardUI();
    }

    function updateWizardUI() {
        // Update step indicators
        if (currentWizardStep === 1) {
            elements.wizardStep1.classList.add("active");
            elements.wizardStep1.classList.remove("completed");
            elements.wizardStep2.classList.remove("active");
            elements.stepContent1.classList.remove("hidden");
            elements.stepContent2.classList.add("hidden");
        } else {
            elements.wizardStep1.classList.remove("active");
            elements.wizardStep1.classList.add("completed");
            elements.wizardStep2.classList.add("active");
            elements.stepContent1.classList.add("hidden");
            elements.stepContent2.classList.remove("hidden");
        }
    }

    function selectSectionType(btn) {
        // Remove active from all buttons
        elements.sectionTypeBtns.forEach(b => b.classList.remove("active"));
        // Add active to clicked button
        btn.classList.add("active");
        // Update state
        selectedSectionType = btn.dataset.type;
    }

    function updateSelectedTracks() {
        selectedTracks = [];
        document.querySelectorAll(".track-checkbox input:checked").forEach(checkbox => {
            selectedTracks.push(checkbox.dataset.track);
        });
    }

    function updateTimelineInfo() {
        const duration = currentSequence ? currentSequence.durationFormatted || "00:00:00" : "00:00:00";

        if (currentSequence) {
            elements.timelineStart.textContent = "00:00:00";
            elements.timelineEnd.textContent = duration;
        } else {
            elements.timelineStart.textContent = "00:00:00";
            elements.timelineEnd.textContent = "00:00:00";
        }

        // Update sequence bar times (Step 2)
        if (elements.sequenceStart) elements.sequenceStart.textContent = "00:00:00";
        if (elements.sequenceEnd) elements.sequenceEnd.textContent = duration;
        if (elements.previewStart) elements.previewStart.textContent = "00:00:00";
        if (elements.previewEnd) elements.previewEnd.textContent = duration;
    }

    // ============================================
    // Settings Functions (Step 2)
    // ============================================
    function updateThresholdDisplay() {
        const value = elements.thresholdSlider.value;
        elements.thresholdValue.textContent = value + "dB";
    }

    function selectPreset(btn) {
        // Remove active from all preset buttons
        elements.presetBtns.forEach(b => b.classList.remove("active"));
        // Add active to clicked button
        btn.classList.add("active");

        // Apply preset values
        const preset = btn.dataset.preset;
        switch (preset) {
            case "calm":
                elements.minSilenceDuration.value = 500;
                elements.minTalkDuration.value = 300;
                elements.paddingBefore.value = 300;
                elements.paddingAfter.value = 300;
                break;
            case "careful":
                elements.minSilenceDuration.value = 400;
                elements.minTalkDuration.value = 250;
                elements.paddingBefore.value = 250;
                elements.paddingAfter.value = 250;
                break;
            case "good":
                elements.minSilenceDuration.value = 300;
                elements.minTalkDuration.value = 200;
                elements.paddingBefore.value = 200;
                elements.paddingAfter.value = 200;
                break;
            case "energetic":
                elements.minSilenceDuration.value = 200;
                elements.minTalkDuration.value = 150;
                elements.paddingBefore.value = 150;
                elements.paddingAfter.value = 150;
                break;
            case "quick":
                elements.minSilenceDuration.value = 150;
                elements.minTalkDuration.value = 100;
                elements.paddingBefore.value = 100;
                elements.paddingAfter.value = 100;
                break;
        }
    }

    /**
     * Get selected silence action from radio buttons
     */
    function getSelectedSilenceAction() {
        const selected = document.querySelector('input[name="silenceAction"]:checked');
        return selected ? selected.value : "delete";
    }

    /**
     * Get selected transition from radio buttons
     */
    function getSelectedTransition() {
        const selected = document.querySelector('input[name="transition"]:checked');
        return selected ? selected.value : "none";
    }

    /**
     * Generate preview with waveform visualization
     */
    async function generatePreview() {
        if (!currentSequence) {
            showToast(I18n.t("msg.openSequence"), "error");
            return;
        }

        showLoading(I18n.t("process.detecting"));

        try {
            // Get all current settings
            const options = {
                threshold: parseInt(elements.thresholdSlider.value),
                minSilenceDuration: parseInt(elements.minSilenceDuration.value) / 1000,
                minTalkDuration: parseInt(elements.minTalkDuration.value) / 1000,
                numSamples: 100
            };

            // Get preview with options (includes silence detection and waveform)
            const result = await CEP.previewWithOptions(options, (stage, percent, remaining, message) => {
                updateLoadingText(message);
            });

            if (result && result.success) {
                detectedSegments = result.segments || [];

                // Use audio levels from the preview result
                if (result.audioLevels && result.audioLevels.length > 0) {
                    audioLevels = result.audioLevels;
                }

                // Render waveform with detected segments
                renderPreviewWaveform();

                hideLoading();

                if (result.count > 0) {
                    showToast(I18n.t("msg.foundSegments", { count: result.count }), "success");
                } else {
                    showToast(I18n.t("msg.noSilence"), "info");
                }
            } else {
                hideLoading();
                showToast(I18n.t("msg.noSilence"), "info");
            }
        } catch (e) {
            hideLoading();
            showToast(e.message || I18n.t("msg.error"), "error");
        }
    }

    /**
     * Reset preview waveform to initial state
     */
    function resetPreviewWaveform() {
        if (elements.previewWaveform) {
            elements.previewWaveform.innerHTML = `
                <button class="btn-preview" id="generatePreviewBtn">
                    <span data-i18n="settings.generatePreview">${I18n.t("settings.generatePreview")}</span>
                </button>
            `;
            // Re-attach event listener
            document.getElementById("generatePreviewBtn").addEventListener("click", generatePreview);
        }
        detectedSegments = [];
        audioLevels = [];
    }

    /**
     * Render waveform with detected silence segments
     */
    function renderPreviewWaveform() {
        if (!elements.previewWaveform || !currentSequence) return;

        const duration = currentSequence.duration;
        const paddingBefore = parseInt(elements.paddingBefore.value) / 1000;
        const paddingAfter = parseInt(elements.paddingAfter.value) / 1000;
        const threshold = parseInt(elements.thresholdSlider.value);

        // Create canvas for waveform
        const container = elements.previewWaveform;
        container.innerHTML = "";

        const canvas = document.createElement("canvas");
        canvas.width = container.offsetWidth || 300;
        canvas.height = container.offsetHeight || 120;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.fillStyle = "#f6f8ff";
        ctx.fillRect(0, 0, width, height);

        // Draw threshold line
        const thresholdY = height / 2;
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, thresholdY);
        ctx.lineTo(width, thresholdY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw silence segments (delete regions)
        ctx.fillStyle = "rgba(239, 68, 68, 0.3)"; // Red for delete
        for (const seg of detectedSegments) {
            const startX = (seg.start / duration) * width;
            const endX = (seg.end / duration) * width;
            ctx.fillRect(startX, 0, endX - startX, height);
        }

        // Draw margin regions (green)
        ctx.fillStyle = "rgba(16, 185, 129, 0.4)"; // Green for margin
        for (const seg of detectedSegments) {
            // Before padding
            const beforeStartX = (seg.start / duration) * width;
            const beforeEndX = ((seg.start + paddingBefore) / duration) * width;
            ctx.fillRect(beforeStartX, 0, beforeEndX - beforeStartX, height);

            // After padding
            const afterStartX = ((seg.end - paddingAfter) / duration) * width;
            const afterEndX = (seg.end / duration) * width;
            ctx.fillRect(afterStartX, 0, afterEndX - afterStartX, height);
        }

        // Draw waveform
        if (audioLevels.length > 0) {
            ctx.strokeStyle = "#5f7cf2";
            ctx.lineWidth = 1;
            ctx.beginPath();

            const step = width / audioLevels.length;
            for (let i = 0; i < audioLevels.length; i++) {
                const x = i * step;
                const amplitude = audioLevels[i] * (height / 2 - 10);
                const y1 = height / 2 - amplitude;
                const y2 = height / 2 + amplitude;

                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
            }
            ctx.stroke();

            // Fill waveform area
            ctx.fillStyle = "rgba(95, 124, 242, 0.2)";
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            for (let i = 0; i < audioLevels.length; i++) {
                const x = i * step;
                const amplitude = audioLevels[i] * (height / 2 - 10);
                ctx.lineTo(x, height / 2 - amplitude);
            }
            for (let i = audioLevels.length - 1; i >= 0; i--) {
                const x = i * step;
                const amplitude = audioLevels[i] * (height / 2 - 10);
                ctx.lineTo(x, height / 2 + amplitude);
            }
            ctx.closePath();
            ctx.fill();
        }

        // Update timeline with segment markers
        updateSequenceBarMarkers();
    }

    /**
     * Update sequence bar with silence markers
     */
    function updateSequenceBarMarkers() {
        const sequenceProgress = document.getElementById("sequenceProgress");
        if (!sequenceProgress || !currentSequence) return;

        const markersContainer = sequenceProgress.querySelector(".sequence-markers");
        if (!markersContainer) return;

        markersContainer.innerHTML = "";

        const duration = currentSequence.duration;

        for (const seg of detectedSegments) {
            const startPercent = (seg.start / duration) * 100;
            const widthPercent = (seg.duration / duration) * 100;

            const marker = document.createElement("div");
            marker.style.cssText = `
                position: absolute;
                left: ${startPercent}%;
                width: ${widthPercent}%;
                height: 100%;
                background: rgba(239, 68, 68, 0.6);
                border-radius: 2px;
            `;
            markersContainer.appendChild(marker);
        }
    }

    // ============================================
    // Status Bar
    // ============================================
    function updateStatusBar() {
        const status = LicenseManager.isActivated();

        if (status.type === "trial") {
            elements.trialStatus.textContent = I18n.t("status.trialDays", { days: status.daysLeft });
            elements.upgradeBtn.classList.remove("hidden");
        } else if (status.type === "license") {
            elements.trialStatus.textContent = I18n.t("status.licensed");
            elements.upgradeBtn.classList.add("hidden");
        } else {
            elements.trialStatus.textContent = "";
            elements.upgradeBtn.classList.add("hidden");
        }
    }

    function openHelpPage() {
        CEP.openURL("https://cutone-app.com/help");
    }

    // ============================================
    // License Management
    // ============================================
    async function checkLicenseStatus() {
        const status = LicenseManager.isActivated();

        if (status.activated) {
            showMainScreen();

            // Show trial days remaining
            if (status.type === "trial") {
                showToast(I18n.t("msg.trialDays", { days: status.daysLeft }), "info");
            }
            return;
        }

        // Check server for trial status
        const trialData = LicenseManager.getTrialData();
        if (trialData && trialData.email) {
            const serverStatus = await LicenseManager.checkTrialStatus();

            if (serverStatus.active) {
                showMainScreen();
                showToast(I18n.t("msg.trialDays", { days: serverStatus.daysRemaining }), "info");
                return;
            }

            if (serverStatus.reason === "not_verified") {
                showScreen("trial");
                showVerificationPending(trialData.email);
                return;
            }
        }

        showAuthScreen();
    }

    async function activateTrial() {
        const email = elements.trialEmail.value.trim();

        if (!email) {
            showToast(I18n.t("msg.enterEmail"), "error");
            return;
        }

        showLoading(I18n.t("process.processing"));

        const result = await LicenseManager.startTrial(email);

        hideLoading();

        if (result.success) {
            if (result.verified) {
                showToast(I18n.t("msg.trialStarted"), "success");
                showMainScreen();
            } else {
                showToast(result.message || "認証メールを送信しました。メールを確認してください。", "info");
                showVerificationPending(email);
            }
        } else {
            showToast(result.error, "error");
        }
    }

    function showVerificationPending(email) {
        const trialContent = elements.trialScreen.querySelector(".trial-content");

        trialContent.innerHTML = `
            <div class="verification-pending" style="text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">📧</div>
                <h3 style="margin-bottom: 12px; color: #1f273a;">メールを確認してください</h3>
                <p style="color: #4b5a78; margin-bottom: 8px;">
                    <strong>${email}</strong> に認証メールを送信しました
                </p>
                <p style="color: #8ea0c4; font-size: 14px; margin-bottom: 8px;">
                    メール内のリンクをクリックしてトライアルを開始してください
                </p>
                <p style="color: #e57373; font-size: 12px; margin-bottom: 24px;">
                    ※ 届かない場合は迷惑メールフォルダをご確認ください
                </p>
                <button onclick="location.reload()" class="btn-primary" style="width: 100%;">
                    認証完了後、ここをクリック
                </button>
                <button onclick="window.AppFunctions.showAuthScreen()" class="btn-secondary" style="width: 100%; margin-top: 12px;">
                    戻る
                </button>
            </div>
        `;
    }

    async function activateLicense() {
        const email = elements.licenseEmail.value.trim();
        const key = elements.licenseKey.value.trim();

        if (!email) {
            showToast(I18n.t("msg.enterEmail"), "error");
            return;
        }

        if (!key) {
            showToast(I18n.t("msg.enterLicense"), "error");
            return;
        }

        showLoading(I18n.t("process.processing"));

        const result = await LicenseManager.activateLicense(email, key);

        hideLoading();

        if (result.success) {
            showToast(I18n.t("msg.licenseActivated"), "success");
            showMainScreen();
        } else {
            showToast(result.error, "error");
        }
    }

    function openPurchasePage() {
        CEP.openURL("https://cutone-app.com/buy");
    }

    function showSettings() {
        if (confirm(I18n.t("settings.deactivate"))) {
            LicenseManager.deactivate();
            showToast(I18n.t("msg.licenseDeactivated"), "info");
            showAuthScreen();
        }
    }

    // ============================================
    // Sequence Functions
    // ============================================
    async function refreshSequenceInfo() {
        console.log("[CutOne] Refreshing sequence info...");

        // DEBUG: Show that we're trying to get sequence
        elements.sequenceName.textContent = "取得中...";

        try {
            const result = await CEP.getActiveSequence();
            console.log("[CutOne] getActiveSequence result:", result);

            if (result && result.success) {
                currentSequence = result;
                elements.sequenceName.textContent = result.name;
                elements.sequenceDuration.textContent = result.durationFormatted;
                console.log("[CutOne] Sequence loaded:", result.name, result.durationFormatted);
            } else {
                currentSequence = null;
                // DEBUG: Show actual result
                elements.sequenceName.textContent = "結果: " + JSON.stringify(result);
                elements.sequenceDuration.textContent = "--:--";
                console.log("[CutOne] No sequence found or error:", result);
            }
        } catch (e) {
            currentSequence = null;
            // DEBUG: Show actual error
            const errorMsg = e.message || e.toString() || "unknown";
            elements.sequenceName.textContent = "エラー: " + errorMsg;
            elements.sequenceDuration.textContent = "--:--";
            console.error("[CutOne] Error getting sequence:", e);
        }

        // Update timeline info in wizard
        updateTimelineInfo();
    }

    // ============================================
    // Processing - Full Implementation
    // ============================================
    async function processSequence() {
        console.log("[CutOne] processSequence called");

        // CRITICAL: Prevent multiple concurrent calls
        if (isProcessing) {
            console.log("[CutOne] Already processing - ignoring duplicate call!");
            return;
        }
        isProcessing = true;
        console.log("[CutOne] isProcessing set to true");

        console.log("[CutOne] currentSequence:", currentSequence);

        // Try to get sequence info if not available
        if (!currentSequence) {
            console.log("[CutOne] No sequence cached, trying to refresh...");
            await refreshSequenceInfo();
            console.log("[CutOne] After refresh, currentSequence:", currentSequence);
        }

        if (!currentSequence) {
            console.log("[CutOne] Still no sequence - showing error toast");
            showToast(I18n.t("msg.openSequence"), "error");
            isProcessing = false;
            return;
        }

        // Gather all settings from UI
        const options = {
            threshold: parseInt(elements.thresholdSlider.value),
            minSilenceDuration: parseInt(elements.minSilenceDuration.value) / 1000,
            minTalkDuration: parseInt(elements.minTalkDuration.value) / 1000,
            paddingBefore: parseInt(elements.paddingBefore.value) / 1000,
            paddingAfter: parseInt(elements.paddingAfter.value) / 1000,
            silenceAction: getSelectedSilenceAction(),
            transition: getSelectedTransition(),
            selectedTracks: selectedTracks,
            sectionType: selectedSectionType
        };

        console.log("[CutOne] Processing options:", options);

        try {
            showLoading(I18n.t("process.processing"));
            console.log("[CutOne] Calling CEP.processWithOptions...");

            // Use the new processWithOptions function with progress callback
            const result = await CEP.processWithOptions(options, (stage, percent, remaining, message) => {
                updateLoadingText(message);
                console.log(`[CutOne] Progress: ${stage} ${percent}% - ${message}`);
            });

            hideLoading();
            isProcessing = false;
            console.log("[CutOne] isProcessing set to false (success)");

            if (result && result.success) {
                // Show results
                showResults({
                    originalDuration: result.originalDuration,
                    newDuration: result.newDuration,
                    savedPercent: result.savedPercent
                });

                // Show appropriate message based on action
                let message;
                switch (options.silenceAction) {
                    case "keep":
                        message = I18n.t("msg.foundSegments", { count: result.segmentsProcessed });
                        break;
                    case "disable":
                        message = `${result.segmentsProcessed}箇所の無音をマーク（無効化）しました`;
                        break;
                    case "deleteKeepSpace":
                        message = `${result.segmentsProcessed}箇所の無音を削除（スペース保持）しました`;
                        break;
                    default:
                        message = I18n.t("msg.cutSegments", { count: result.segmentsProcessed });
                }

                showToast(message, "success");
            } else {
                if (result && result.segmentsFound === 0) {
                    showToast(I18n.t("msg.noSilence"), "info");
                } else if (result && result.error) {
                    // Show the actual error message from the result
                    showToast(result.error, "error");
                } else {
                    showToast(I18n.t("msg.error"), "error");
                }
            }
        } catch (e) {
            hideLoading();
            isProcessing = false;
            console.log("[CutOne] isProcessing set to false (error)");
            showToast(e.message || I18n.t("msg.error"), "error");
        }
    }

    // ============================================
    // UI Updates
    // ============================================

    function showResults(data) {
        elements.resultsSection.classList.remove("hidden");
        elements.originalDuration.textContent = formatTime(data.originalDuration || 0);
        elements.newDuration.textContent = formatTime(data.newDuration || 0);
        const savedPct = data.savedPercent || 0;
        elements.savedPercent.textContent = "-" + savedPct.toFixed(0) + "%";
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return m + ":" + s.toString().padStart(2, "0");
    }

    // ============================================
    // Loading & Toast
    // ============================================
    function showLoading(text = "Processing...") {
        elements.processingText.textContent = text;
        elements.processingOverlay.classList.remove("hidden");
    }

    function updateLoadingText(text) {
        elements.processingText.textContent = text;
    }

    function hideLoading() {
        elements.processingOverlay.classList.add("hidden");
    }

    function showToast(message, type = "info") {
        elements.toastMessage.textContent = message;
        elements.toast.className = "toast " + type;

        setTimeout(() => {
            elements.toast.classList.add("hidden");
        }, 3000);
    }

    // ============================================
    // Global Functions (for inline handlers and debugging)
    // ============================================
    window.AppFunctions = {
        showAuthScreen: showAuthScreen,
        checkLicenseStatus: checkLicenseStatus,
        // Debug functions
        refreshSequence: refreshSequenceInfo,
        testCEP: async function() {
            console.log("[Debug] Testing CEP communication...");
            try {
                const result = await CEP.getActiveSequence();
                console.log("[Debug] CEP test result:", result);
                return result;
            } catch (e) {
                console.error("[Debug] CEP test error:", e);
                return null;
            }
        },
        getCurrentSequence: function() {
            console.log("[Debug] Current sequence:", currentSequence);
            return currentSequence;
        },
        forceProcess: processSequence
    };

    // ============================================
    // Start Application
    // ============================================
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
