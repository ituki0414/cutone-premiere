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
        useScribeV2: document.getElementById("useScribeV2"),
        scribeApiKeySection: document.getElementById("scribeApiKeySection"),
        elevenLabsApiKey: document.getElementById("elevenLabsApiKey"),
        toggleElevenLabsApiKeyBtn: document.getElementById("toggleElevenLabsApiKeyBtn"),
        elevenLabsApiLink: document.getElementById("elevenLabsApiLink"),
        addToSequence: document.getElementById("addToSequence"),
        exportSrt: document.getElementById("exportSrt"),
        exportVtt: document.getElementById("exportVtt"),
        batchExportBtn: document.getElementById("batchExportBtn"),
        darkModeBtn: document.getElementById("darkModeBtn"),
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
        progressContainer: document.getElementById("progressContainer"),
        progressFill: document.getElementById("progressFill"),
        progressPercent: document.getElementById("progressPercent"),
        cancelProcessBtn: document.getElementById("cancelProcessBtn"),

        // Toast
        toast: document.getElementById("toast"),
        toastMessage: document.getElementById("toastMessage")
    };

    // Cancellation state
    let cancelRequested = false;

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

    // Undo state - stores last operation for undo
    let lastOperationState = null;

    // Auto-refresh interval
    let autoRefreshInterval = null;

    // ============================================
    // Initialization
    // ============================================
    function init() {
        console.log("[CutOne] ========== Initializing CutOne ==========");

        // Initialize i18n
        const lang = I18n.init();
        updateLanguageLabel(lang);
        console.log("[CutOne] i18n initialized, language:", lang);

        // Load saved UI language preference
        loadSavedUILanguage();

        // Load dark mode preference
        loadDarkModePreference();

        // Initialize CEP
        const cepResult = CEP.init();
        console.log("[CutOne] CEP initialized:", !!cepResult);

        // Setup event listeners
        setupEventListeners();
        console.log("[CutOne] Event listeners set up");

        // Setup drag and drop
        setupDragAndDrop();
        console.log("[CutOne] Drag and drop set up");

        // Start auto-refresh for sequence info
        startAutoRefresh();
        console.log("[CutOne] Auto-refresh started");

        // Load processing history
        loadHistoryFromStorage();
        updateHistoryDisplay();
        console.log("[CutOne] History loaded");

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
        // Save UI language preference
        localStorage.setItem("cutone_ui_language", newLang);
    }

    function updateLanguageLabel(lang) {
        elements.langLabel.textContent = lang.toUpperCase();
    }

    function loadSavedUILanguage() {
        const savedLang = localStorage.getItem("cutone_ui_language");
        if (savedLang && (savedLang === "ja" || savedLang === "en")) {
            I18n.setLanguage(savedLang);
            updateLanguageLabel(savedLang);
        }
    }

    // ============================================
    // Dark Mode
    // ============================================
    function toggleDarkMode() {
        const isDark = document.body.classList.toggle("dark-mode");
        localStorage.setItem("cutone_dark_mode", isDark ? "true" : "false");
        updateDarkModeIcon(isDark);
    }

    function loadDarkModePreference() {
        const saved = localStorage.getItem("cutone_dark_mode");
        if (saved === "true") {
            document.body.classList.add("dark-mode");
            updateDarkModeIcon(true);
        }
    }

    function updateDarkModeIcon(isDark) {
        const icon = document.getElementById("darkModeIcon");
        if (icon) {
            if (isDark) {
                // Sun icon for light mode toggle
                icon.innerHTML = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
            } else {
                // Moon icon for dark mode toggle
                icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
            }
        }
    }

    // ============================================
    // Processing Timer
    // ============================================
    let processingStartTime = null;
    let processingTimerInterval = null;

    function startProcessingTimer() {
        processingStartTime = Date.now();
        updateProcessingTimeDisplay();
        processingTimerInterval = setInterval(updateProcessingTimeDisplay, 1000);
    }

    function stopProcessingTimer() {
        if (processingTimerInterval) {
            clearInterval(processingTimerInterval);
            processingTimerInterval = null;
        }
        processingStartTime = null;
    }

    function updateProcessingTimeDisplay() {
        if (!processingStartTime) return;
        const elapsed = Math.floor((Date.now() - processingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const timerDisplay = document.getElementById("processingTimer");
        if (timerDisplay) {
            // Update the span inside the timer div (not the entire div which contains the SVG)
            const timerSpan = timerDisplay.querySelector("span");
            if (timerSpan) {
                timerSpan.textContent = timeText;
            }
        }
    }

    function formatElapsedTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // ============================================
    // Processing Log
    // ============================================
    let processingLogs = [];

    function addProcessingLog(message, type = "info") {
        const timestamp = new Date().toLocaleTimeString();
        processingLogs.push({ timestamp, message, type });
        updateProcessingLogDisplay();
    }

    function clearProcessingLogs() {
        processingLogs = [];
        updateProcessingLogDisplay();
    }

    function updateProcessingLogDisplay() {
        const logContainer = document.getElementById("processingLogContainer");
        if (!logContainer) return;

        if (processingLogs.length === 0) {
            logContainer.style.display = "none";
            return;
        }

        logContainer.style.display = "block";
        const logContent = logContainer.querySelector(".processing-log-content");
        if (logContent) {
            logContent.innerHTML = processingLogs.map(log =>
                `<div class="log-entry log-${log.type}">
                    <span class="log-time">${log.timestamp}</span>
                    <span class="log-message">${log.message}</span>
                </div>`
            ).join("");
            // Auto-scroll to bottom
            logContent.scrollTop = logContent.scrollHeight;
        }
    }

    // ============================================
    // Silence Cut Presets
    // ============================================
    function saveSilencePreset(name) {
        const preset = {
            name: name,
            threshold: parseInt(elements.thresholdSlider.value),
            minSilenceDuration: parseInt(elements.minSilenceDuration.value),
            minTalkDuration: parseInt(elements.minTalkDuration.value),
            paddingBefore: parseInt(elements.paddingBefore.value),
            paddingAfter: parseInt(elements.paddingAfter.value),
            silenceAction: getSelectedSilenceAction(),
            transition: getSelectedTransition()
        };

        // Get existing presets
        let presets = JSON.parse(localStorage.getItem("cutone_silence_presets") || "[]");

        // Check if preset with same name exists
        const existingIndex = presets.findIndex(p => p.name === name);
        if (existingIndex >= 0) {
            presets[existingIndex] = preset;
        } else {
            presets.push(preset);
        }

        localStorage.setItem("cutone_silence_presets", JSON.stringify(presets));
        showToast(`プリセット「${name}」を保存しました`, "success");
        return preset;
    }

    function loadSilencePreset(preset) {
        elements.thresholdSlider.value = preset.threshold;
        updateThresholdDisplay();
        elements.minSilenceDuration.value = preset.minSilenceDuration;
        elements.minTalkDuration.value = preset.minTalkDuration;
        elements.paddingBefore.value = preset.paddingBefore;
        elements.paddingAfter.value = preset.paddingAfter;

        // Set silence action radio
        const actionRadio = document.querySelector(`input[name="silenceAction"][value="${preset.silenceAction}"]`);
        if (actionRadio) actionRadio.checked = true;

        // Set transition radio
        const transitionRadio = document.querySelector(`input[name="transition"][value="${preset.transition}"]`);
        if (transitionRadio) transitionRadio.checked = true;

        showToast(`プリセット「${preset.name}」を読み込みました`, "success");
    }

    function getSavedSilencePresets() {
        return JSON.parse(localStorage.getItem("cutone_silence_presets") || "[]");
    }

    function deleteSilencePreset(name) {
        let presets = getSavedSilencePresets();
        presets = presets.filter(p => p.name !== name);
        localStorage.setItem("cutone_silence_presets", JSON.stringify(presets));
        showToast(`プリセット「${name}」を削除しました`, "info");
    }

    function saveLastUsedSettings() {
        const settings = {
            threshold: parseInt(elements.thresholdSlider.value),
            minSilenceDuration: parseInt(elements.minSilenceDuration.value),
            minTalkDuration: parseInt(elements.minTalkDuration.value),
            paddingBefore: parseInt(elements.paddingBefore.value),
            paddingAfter: parseInt(elements.paddingAfter.value),
            silenceAction: getSelectedSilenceAction(),
            transition: getSelectedTransition()
        };
        localStorage.setItem("cutone_last_silence_settings", JSON.stringify(settings));
    }

    function loadLastUsedSettings() {
        const saved = localStorage.getItem("cutone_last_silence_settings");
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                loadSilencePreset({ ...settings, name: "前回の設定" });
            } catch (e) {
                console.log("[CutOne] Failed to load last settings");
            }
        }
    }

    function setupEventListeners() {
        // Language switcher
        elements.langBtn.addEventListener("click", toggleLanguage);

        // Dark mode toggle
        if (elements.darkModeBtn) {
            elements.darkModeBtn.addEventListener("click", toggleDarkMode);
        }

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
        elements.useScribeV2.addEventListener("change", toggleScribeApiKeySection);
        elements.toggleElevenLabsApiKeyBtn.addEventListener("click", toggleElevenLabsApiKeyVisibility);
        elements.elevenLabsApiLink.addEventListener("click", openElevenLabsApiPage);
        elements.startTranscriptionBtn.addEventListener("click", startTranscription);
        elements.reTranscribeBtn.addEventListener("click", resetTranscription);
        elements.applyTranscriptionBtn.addEventListener("click", applyTranscription);

        // Quick transcription button (one-click execution)
        const quickTranscribeBtn = document.getElementById("quickTranscribeBtn");
        if (quickTranscribeBtn) {
            quickTranscribeBtn.addEventListener("click", quickTranscribe);
        }

        // API key real-time validation
        elements.openaiApiKey.addEventListener("input", (e) => {
            const key = e.target.value.trim();
            validateApiKeyFormat(key);
            // Auto-save on valid input
            if (key && key.startsWith("sk-") && key.length > 20) {
                saveApiKey(key);
            }
        });

        // ElevenLabs API key auto-save
        elements.elevenLabsApiKey.addEventListener("input", (e) => {
            const key = e.target.value.trim();
            if (key) {
                localStorage.setItem("cutone_elevenlabs_api_key", key);
            }
        });

        // Output options persistence
        elements.addToSequence.addEventListener("change", saveOutputOptions);
        elements.exportSrt.addEventListener("change", saveOutputOptions);
        if (elements.exportVtt) {
            elements.exportVtt.addEventListener("change", saveOutputOptions);
        }

        // Batch export button
        if (elements.batchExportBtn) {
            elements.batchExportBtn.addEventListener("click", async () => {
                if (transcriptionSegments.length === 0) {
                    showToast("文字起こし結果がありません", "error");
                    return;
                }
                showLoading("一括エクスポート中...");
                const result = await batchExportCaptions(transcriptionSegments);
                hideLoading();
                if (result.cancelled) {
                    showToast("エクスポートをキャンセルしました", "info");
                } else if (result.success) {
                    showToast(`${result.formats.join(" + ")} を書き出しました`, "success");
                }
            });
        }

        // Settings reset button
        const resetBtn = document.getElementById("resetSettingsBtn");
        if (resetBtn) {
            resetBtn.addEventListener("click", resetAllSettings);
        }

        // Merge segments button
        const mergeBtn = document.getElementById("mergeSegmentsBtn");
        if (mergeBtn) {
            mergeBtn.addEventListener("click", mergeSelectedSegments);
        }

        // Clear history button
        const clearHistoryBtn = document.getElementById("clearHistoryBtn");
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener("click", clearHistory);
        }

        // Segment list buttons
        const selectAllBtn = document.getElementById("selectAllSegments");
        if (selectAllBtn) {
            selectAllBtn.addEventListener("click", selectAllSegments);
        }
        const deselectAllBtn = document.getElementById("deselectAllSegments");
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener("click", deselectAllSegments);
        }

        // Profile save button
        const saveProfileBtn = document.getElementById("saveProfileBtn");
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener("click", saveProfile);
        }

        // Initialize profiles and stats
        updateProfileList();
        updateStatsDashboard();

        // Setup waveform interaction
        setupWaveformInteraction();

        // Completion sound option
        const soundToggle = document.getElementById("completionSoundToggle");
        if (soundToggle) {
            soundToggle.addEventListener("change", (e) => {
                localStorage.setItem("cutone_completion_sound", e.target.checked ? "true" : "false");
            });
        }

        // Filler removal option
        const fillerToggle = document.getElementById("removeFillerToggle");
        if (fillerToggle) {
            fillerToggle.addEventListener("change", (e) => {
                localStorage.setItem("cutone_remove_filler", e.target.checked ? "true" : "false");
            });
        }

        // LLM post-processing toggle
        const llmToggle = document.getElementById("enableLLMPostProcess");
        const llmModelSection = document.getElementById("llmModelSection");
        if (llmToggle) {
            llmToggle.addEventListener("change", (e) => {
                localStorage.setItem("cutone_enable_llm", e.target.checked ? "true" : "false");
                if (llmModelSection) {
                    llmModelSection.style.display = e.target.checked ? "block" : "none";
                }
            });
        }

        // LLM model selection
        const llmModelRadios = document.querySelectorAll('input[name="llmModel"]');
        llmModelRadios.forEach(radio => {
            radio.addEventListener("change", (e) => {
                localStorage.setItem("cutone_llm_model", e.target.value);
            });
        });

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

        // Global keyboard shortcuts
        document.addEventListener("keydown", handleKeyboardShortcuts);

        // Preset save button
        const savePresetBtn = document.getElementById("savePresetBtn");
        if (savePresetBtn) {
            savePresetBtn.addEventListener("click", promptSavePreset);
        }

        // Log toggle button
        const toggleLogBtn = document.getElementById("toggleLogBtn");
        if (toggleLogBtn) {
            toggleLogBtn.addEventListener("click", toggleProcessingLog);
        }

        // Load and display custom presets
        displayCustomPresets();

        // Use case presets
        document.querySelectorAll(".usecase-preset-btn").forEach(btn => {
            btn.addEventListener("click", () => applyUseCasePreset(btn.dataset.usecase));
        });

        // Auto threshold detection
        const autoThresholdBtn = document.getElementById("autoThresholdBtn");
        if (autoThresholdBtn) {
            autoThresholdBtn.addEventListener("click", autoDetectThreshold);
        }

        // Copy result button
        const copyResultBtn = document.getElementById("copyResultBtn");
        if (copyResultBtn) {
            copyResultBtn.addEventListener("click", copyResultToClipboard);
        }

        // Prompt preset buttons for transcription
        document.querySelectorAll(".prompt-preset-btn").forEach(btn => {
            btn.addEventListener("click", () => applyPromptPreset(btn.dataset.preset));
        });
    }

    /**
     * Apply a prompt preset to the custom prompt textarea
     */
    function applyPromptPreset(presetName) {
        const customPromptEl = document.getElementById("customPrompt");
        if (!customPromptEl) return;

        const presetContent = CEP.getPromptPreset(presetName);
        if (!presetContent) return;

        // Append to existing content if there's already text
        const currentValue = customPromptEl.value.trim();
        if (currentValue) {
            customPromptEl.value = currentValue + ", " + presetContent;
        } else {
            customPromptEl.value = presetContent;
        }

        // Toggle active state on buttons
        document.querySelectorAll(".prompt-preset-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.preset === presetName);
        });

        showToast(`${getPromptPresetLabel(presetName)}用語を追加しました`, "success");
    }

    /**
     * Get label for prompt preset
     */
    function getPromptPresetLabel(presetName) {
        const labels = {
            video: "映像制作",
            tech: "IT・テック",
            business: "ビジネス",
            gaming: "ゲーム"
        };
        return labels[presetName] || presetName;
    }

    function promptSavePreset() {
        const name = prompt("プリセット名を入力してください:");
        if (name && name.trim()) {
            saveSilencePreset(name.trim());
            displayCustomPresets();
        }
    }

    function displayCustomPresets() {
        const presets = getSavedSilencePresets();
        const container = document.getElementById("customPresetsContainer");
        const list = document.getElementById("customPresetsList");

        if (!container || !list) return;

        if (presets.length === 0) {
            container.style.display = "none";
            return;
        }

        container.style.display = "block";
        list.innerHTML = presets.map(preset => `
            <div class="custom-preset-item">
                <span class="preset-name" onclick="window.AppFunctions.loadPreset('${preset.name}')">${preset.name}</span>
                <button class="preset-delete" onclick="window.AppFunctions.deletePreset('${preset.name}')" title="削除">×</button>
            </div>
        `).join("");
    }

    function toggleProcessingLog() {
        const container = document.getElementById("processingLogContainer");
        const content = container?.querySelector(".processing-log-content");
        const btn = document.getElementById("toggleLogBtn");

        if (content) {
            if (content.style.display === "none") {
                content.style.display = "block";
                if (btn) btn.style.transform = "rotate(0deg)";
            } else {
                content.style.display = "none";
                if (btn) btn.style.transform = "rotate(-90deg)";
            }
        }
    }

    // ============================================
    // Keyboard Shortcuts
    // ============================================
    function handleKeyboardShortcuts(e) {
        // Don't trigger shortcuts when typing in inputs
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
            // Only allow Escape to cancel
            if (e.key === "Escape" && !elements.processingOverlay.classList.contains("hidden")) {
                e.preventDefault();
                triggerCancel();
            }
            return;
        }

        // Escape - Cancel current operation
        if (e.key === "Escape") {
            if (!elements.processingOverlay.classList.contains("hidden")) {
                e.preventDefault();
                triggerCancel();
            }
            return;
        }

        // Enter/Cmd+Enter - Execute main action
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            executeMainAction();
            return;
        }

        // R - Refresh sequence info
        if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            if (!elements.silenceScreen.classList.contains("hidden")) {
                refreshSequenceInfo();
            } else if (!elements.transcriptionScreen.classList.contains("hidden")) {
                refreshTranscriptionSequenceInfo();
            }
            return;
        }

        // Cmd+Z - Show undo hint (actual undo is in Premiere Pro)
        if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
            // Don't prevent default - let Premiere Pro handle it
            // Just show a hint if we have a recent operation
            if (lastOperationState) {
                showToast("Premiere Proでアンドゥを実行中...", "info");
            }
            return;
        }
    }

    function triggerCancel() {
        const cancelBtn = elements.cancelProcessBtn;
        if (cancelBtn && cancelBtn.style.display !== "none") {
            cancelBtn.click();
            showToast("キャンセルしました (Esc)", "info");
        }
    }

    function executeMainAction() {
        // Determine which screen is active and execute the main action
        if (!elements.silenceScreen.classList.contains("hidden")) {
            // Silence screen
            if (currentWizardStep === 1) {
                goToStep2();
            } else {
                processSequence();
            }
        } else if (!elements.transcriptionScreen.classList.contains("hidden")) {
            // Transcription screen
            if (transcriptionSegments.length > 0) {
                applyTranscription();
            } else {
                startTranscription();
            }
        }
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
        // Load last used settings
        loadLastUsedSettings();
    }

    function showTranscriptionScreen() {
        showScreen("transcription");
        // Load saved API key
        loadSavedApiKey();
        // Load saved Scribe v2 settings
        loadScribeSettings();
        // Load saved language preference
        loadSavedLanguage();
        // Load saved output options
        loadOutputOptions();
        // Load saved completion sound option
        loadCompletionSoundOption();
        // Load saved filler removal option
        loadFillerRemovalOption();
        // Refresh sequence info
        refreshTranscriptionSequenceInfo();
        // Reset transcription state (but keep API key)
        resetTranscription();
    }

    // ============================================
    // Transcription Functions
    // ============================================

    async function refreshTranscriptionSequenceInfo() {
        try {
            const result = await CEP.getActiveSequence();
            if (result && result.success) {
                currentSequence = result;
                elements.transcriptionSequenceName.textContent = result.name;
                elements.transcriptionSequenceDuration.textContent = result.durationFormatted;
            } else {
                currentSequence = null;
                elements.transcriptionSequenceName.textContent = I18n.t("main.noSequence");
                elements.transcriptionSequenceDuration.textContent = "--:--";
            }
        } catch (e) {
            console.error("[CutOne] Error getting sequence:", e);
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

    function toggleScribeApiKeySection() {
        const isChecked = elements.useScribeV2.checked;
        elements.scribeApiKeySection.style.display = isChecked ? "block" : "none";
        localStorage.setItem("cutone_use_scribe_v2", isChecked ? "true" : "false");
    }

    function toggleElevenLabsApiKeyVisibility() {
        const input = elements.elevenLabsApiKey;
        if (input.type === "password") {
            input.type = "text";
        } else {
            input.type = "password";
        }
    }

    function openElevenLabsApiPage(e) {
        e.preventDefault();
        CEP.openURL("https://elevenlabs.io/app/settings/api-keys");
    }

    function loadScribeSettings() {
        // Restore Scribe v2 checkbox
        const useScribe = localStorage.getItem("cutone_use_scribe_v2") === "true";
        elements.useScribeV2.checked = useScribe;
        elements.scribeApiKeySection.style.display = useScribe ? "block" : "none";

        // Restore ElevenLabs API key
        const savedKey = localStorage.getItem("cutone_elevenlabs_api_key");
        if (savedKey) {
            elements.elevenLabsApiKey.value = savedKey;
        }
    }

    function loadSavedApiKey() {
        const savedKey = localStorage.getItem("cutone_openai_api_key");
        if (savedKey) {
            elements.openaiApiKey.value = savedKey;
            // Show validation indicator
            validateApiKeyFormat(savedKey);
        }
    }

    function saveApiKey(key) {
        localStorage.setItem("cutone_openai_api_key", key);
    }

    function validateApiKeyFormat(key) {
        const input = elements.openaiApiKey;
        const container = input.parentElement;

        // Remove any existing status indicator
        let indicator = container.querySelector(".api-key-status");
        if (!indicator) {
            indicator = document.createElement("span");
            indicator.className = "api-key-status";
            container.appendChild(indicator);
        }

        if (!key || key.length === 0) {
            // Empty - neutral state
            input.style.borderColor = "";
            indicator.textContent = "";
            indicator.className = "api-key-status";
        } else if (key.startsWith("sk-") && key.length > 20) {
            // Valid format
            input.style.borderColor = "#22c55e";
            indicator.textContent = "✓";
            indicator.className = "api-key-status valid";
        } else if (key.startsWith("sk-")) {
            // Partial valid
            input.style.borderColor = "#f59e0b";
            indicator.textContent = "";
            indicator.className = "api-key-status";
        } else {
            // Invalid format
            input.style.borderColor = "#ef4444";
            indicator.textContent = "sk-で始まる必要があります";
            indicator.className = "api-key-status invalid";
        }
    }

    function saveOutputOptions() {
        const options = {
            addToSequence: elements.addToSequence.checked,
            exportSrt: elements.exportSrt.checked,
            exportVtt: elements.exportVtt ? elements.exportVtt.checked : false
        };
        localStorage.setItem("cutone_output_options", JSON.stringify(options));
    }

    function loadOutputOptions() {
        const saved = localStorage.getItem("cutone_output_options");
        if (saved) {
            try {
                const options = JSON.parse(saved);
                if (typeof options.addToSequence === "boolean") {
                    elements.addToSequence.checked = options.addToSequence;
                }
                if (typeof options.exportSrt === "boolean") {
                    elements.exportSrt.checked = options.exportSrt;
                }
                if (typeof options.exportVtt === "boolean" && elements.exportVtt) {
                    elements.exportVtt.checked = options.exportVtt;
                }
            } catch (e) {
                console.log("[CutOne] Failed to parse output options");
            }
        }
    }

    // ============================================
    // VTT Export
    // ============================================
    function generateVTT(segments) {
        let vtt = "WEBVTT\n\n";

        segments.forEach((seg, index) => {
            const startTime = formatVTTTime(seg.start);
            const endTime = formatVTTTime(seg.end);
            vtt += `${index + 1}\n`;
            vtt += `${startTime} --> ${endTime}\n`;
            vtt += `${seg.text}\n\n`;
        });

        return vtt;
    }

    function formatVTTTime(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    // ============================================
    // Drag & Drop Support
    // ============================================
    function setupDragAndDrop() {
        const screens = [elements.silenceScreen, elements.transcriptionScreen];

        screens.forEach(screen => {
            if (!screen) return;

            screen.addEventListener("dragover", handleDragOver);
            screen.addEventListener("dragleave", handleDragLeave);
            screen.addEventListener("drop", handleDrop);
        });

        // Also add to the main app container for global drop support
        const app = document.getElementById("app");
        if (app) {
            app.addEventListener("dragover", handleDragOver);
            app.addEventListener("dragleave", handleDragLeave);
            app.addEventListener("drop", handleDrop);
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();

        // Only show drag indicator for file drops
        if (e.dataTransfer.types.includes("Files")) {
            e.currentTarget.classList.add("drag-over");
            e.dataTransfer.dropEffect = "copy";
        }
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove("drag-over");
    }

    async function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove("drag-over");

        const files = e.dataTransfer.files;
        if (files.length === 0) return;

        const file = files[0];
        const fileName = file.name.toLowerCase();

        // Check if it's an SRT file for import
        if (fileName.endsWith(".srt")) {
            handleSRTImport(file);
            return;
        }

        // Check if it's an audio/video file
        const mediaExtensions = [".mp4", ".mov", ".avi", ".mkv", ".mp3", ".wav", ".m4a", ".aac", ".flac"];
        const isMedia = mediaExtensions.some(ext => fileName.endsWith(ext));

        if (isMedia) {
            showToast(`${file.name} をインポートしています...`, "info");
            try {
                // Import the file to project
                const result = await CEP.callExtendScript("importFileToProject", [file.path]);
                if (result && result.success) {
                    showToast(`${file.name} をプロジェクトにインポートしました`, "success");
                    refreshSequenceInfo();
                } else {
                    showToast("ファイルのインポートに失敗しました", "error");
                }
            } catch (err) {
                console.error("[CutOne] Import error:", err);
                showToast("ファイルのインポートに失敗しました", "error");
            }
        } else {
            showToast("サポートされていないファイル形式です", "error");
        }
    }

    async function handleSRTImport(file) {
        showToast(`${file.name} を読み込んでいます...`, "info");

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target.result;
                const segments = parseSRT(content);

                if (segments.length > 0) {
                    transcriptionSegments = segments;
                    displayTranscriptionResult(segments);
                    showToast(`${segments.length}個のセグメントを読み込みました`, "success");

                    // Switch to transcription screen if not already there
                    if (elements.transcriptionScreen.classList.contains("hidden")) {
                        showTranscriptionScreen();
                    }
                } else {
                    showToast("SRTファイルのパースに失敗しました", "error");
                }
            };
            reader.readAsText(file);
        } catch (err) {
            console.error("[CutOne] SRT import error:", err);
            showToast("SRTファイルの読み込みに失敗しました", "error");
        }
    }

    function parseSRT(content) {
        const segments = [];
        const blocks = content.trim().split(/\n\n+/);

        for (const block of blocks) {
            const lines = block.split("\n");
            if (lines.length >= 3) {
                // Parse timestamp line (format: 00:00:00,000 --> 00:00:00,000)
                const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
                if (timeMatch) {
                    const start = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
                    const end = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
                    const text = lines.slice(2).join(" ").trim();

                    segments.push({ start, end, text });
                }
            }
        }

        return segments;
    }

    // ============================================
    // Confirmation Dialog
    // ============================================
    function showConfirmationDialog(options, segments, excludedCount = 0) {
        return new Promise((resolve) => {
            const totalSilenceDuration = segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
            const estimatedNewDuration = currentSequence.duration - totalSilenceDuration;
            const savedPercent = ((totalSilenceDuration / currentSequence.duration) * 100).toFixed(1);

            const actionLabels = {
                delete: "無音部分を削除",
                disable: "無音部分を無効化",
                deleteKeepSpace: "削除（スペース保持）",
                keep: "マーカーのみ追加"
            };

            const excludedNote = excludedCount > 0
                ? `<div class="info-row"><span class="info-label">除外セグメント</span><span class="info-value muted">${excludedCount}箇所（処理対象外）</span></div>`
                : "";

            const dialog = document.createElement("div");
            dialog.className = "confirmation-dialog-overlay";
            dialog.innerHTML = `
                <div class="confirmation-dialog">
                    <div class="confirmation-header">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <h3>処理の確認</h3>
                    </div>
                    <div class="confirmation-content">
                        <div class="confirmation-info">
                            <div class="info-row">
                                <span class="info-label">シーケンス</span>
                                <span class="info-value">${currentSequence.name}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">元の長さ</span>
                                <span class="info-value">${currentSequence.durationFormatted}</span>
                            </div>
                            <div class="info-row highlight">
                                <span class="info-label">処理対象の無音</span>
                                <span class="info-value">${segments.length}箇所 (${formatTime(totalSilenceDuration)})</span>
                            </div>
                            ${excludedNote}
                            <div class="info-row highlight">
                                <span class="info-label">予想削減率</span>
                                <span class="info-value accent">-${savedPercent}%</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">処理内容</span>
                                <span class="info-value">${actionLabels[options.silenceAction] || options.silenceAction}</span>
                            </div>
                        </div>
                        <div class="confirmation-warning">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span>この操作は取り消し可能です（Cmd+Z / 編集メニューから）</span>
                        </div>
                    </div>
                    <div class="confirmation-actions">
                        <button class="btn-secondary" id="confirmCancel">キャンセル</button>
                        <button class="btn-primary" id="confirmProceed">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            処理を実行
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);

            // Animate in
            requestAnimationFrame(() => {
                dialog.classList.add("visible");
            });

            const closeDialog = (result) => {
                dialog.classList.remove("visible");
                setTimeout(() => {
                    dialog.remove();
                    resolve(result);
                }, 200);
            };

            dialog.querySelector("#confirmCancel").addEventListener("click", () => closeDialog(false));
            dialog.querySelector("#confirmProceed").addEventListener("click", () => closeDialog(true));
            dialog.addEventListener("click", (e) => {
                if (e.target === dialog) closeDialog(false);
            });
        });
    }

    // ============================================
    // Undo Support
    // ============================================
    function saveOperationState(operationType, data) {
        lastOperationState = {
            type: operationType,
            timestamp: Date.now(),
            data: data
        };
        // Show undo hint
        showToast("Cmd+Z でアンドゥできます", "info");
    }

    async function undoLastOperation() {
        if (!lastOperationState) {
            showToast("アンドゥする操作がありません", "info");
            return;
        }

        showToast("Premiere Proの編集メニューからアンドゥしてください", "info");
        lastOperationState = null;
    }

    // ============================================
    // Auto-refresh Sequence Info
    // ============================================
    function startAutoRefresh() {
        // Stop any existing interval
        stopAutoRefresh();

        // Refresh every 5 seconds when on silence/transcription screen
        autoRefreshInterval = setInterval(() => {
            if (!elements.silenceScreen.classList.contains("hidden")) {
                refreshSequenceInfo();
            } else if (!elements.transcriptionScreen.classList.contains("hidden")) {
                refreshTranscriptionSequenceInfo();
            }
        }, 5000);

        // Also refresh on window focus
        window.addEventListener("focus", handleWindowFocus);
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        window.removeEventListener("focus", handleWindowFocus);
    }

    function handleWindowFocus() {
        if (!elements.silenceScreen.classList.contains("hidden")) {
            refreshSequenceInfo();
        } else if (!elements.transcriptionScreen.classList.contains("hidden")) {
            refreshTranscriptionSequenceInfo();
        }
    }

    // ============================================
    // Batch Export (SRT + VTT)
    // ============================================
    async function batchExportCaptions(segments) {
        const results = [];
        const sequenceResult = await CEP.callExtendScript("getSequenceInfo", []);
        let defaultPath = getLastExportPath(); // Use saved export path
        const baseName = currentSequence?.name || "captions";

        // Fallback to project path if no saved export path
        if (!defaultPath && sequenceResult && sequenceResult.projectPath) {
            defaultPath = sequenceResult.projectPath.replace(/[^/\\]+$/, "");
        }

        // Ask for base filename once
        const dialogResult = await CEP.callExtendScript("showSaveDialog", [baseName, defaultPath]);

        if (!dialogResult || !dialogResult.success || dialogResult.cancelled) {
            return { cancelled: true };
        }

        const basePath = dialogResult.path.replace(/\.srt$/i, "");

        // Save the export directory for next time
        const exportDir = basePath.replace(/[^/\\]+$/, "");
        saveLastExportPath(exportDir);

        // Export SRT
        const srtPath = basePath + ".srt";
        const srtResult = await CEP.exportSRT(segments, srtPath);
        if (srtResult && srtResult.success) {
            results.push("SRT");
        }

        // Export VTT
        const vttPath = basePath + ".vtt";
        const vttContent = generateVTT(segments);
        const fs = require("fs");
        try {
            fs.writeFileSync(vttPath, vttContent, "utf8");
            results.push("VTT");
        } catch (e) {
            console.error("[CutOne] VTT export failed:", e);
        }

        return {
            success: true,
            formats: results,
            basePath: basePath
        };
    }

    function loadCompletionSoundOption() {
        const toggle = document.getElementById("completionSoundToggle");
        if (toggle) {
            const saved = localStorage.getItem("cutone_completion_sound");
            toggle.checked = saved === "true";
        }
    }

    // ============================================
    // Processing History
    // ============================================
    const processingHistory = [];
    const MAX_HISTORY_ITEMS = 10;

    function addToHistory(operation) {
        processingHistory.unshift({
            ...operation,
            timestamp: Date.now(),
            id: Date.now().toString()
        });

        // Keep only last N items
        if (processingHistory.length > MAX_HISTORY_ITEMS) {
            processingHistory.pop();
        }

        updateHistoryDisplay();
        saveHistoryToStorage();
    }

    function loadHistoryFromStorage() {
        const saved = localStorage.getItem("cutone_processing_history");
        if (saved) {
            try {
                const items = JSON.parse(saved);
                processingHistory.length = 0;
                processingHistory.push(...items.slice(0, MAX_HISTORY_ITEMS));
            } catch (e) {
                console.log("[CutOne] Failed to parse history");
            }
        }
    }

    function saveHistoryToStorage() {
        localStorage.setItem("cutone_processing_history", JSON.stringify(processingHistory));
    }

    function updateHistoryDisplay() {
        const container = document.getElementById("historyContainer");
        if (!container) return;

        if (processingHistory.length === 0) {
            container.innerHTML = '<div class="history-empty">履歴がありません</div>';
            return;
        }

        container.innerHTML = processingHistory.map(item => {
            const date = new Date(item.timestamp);
            const timeStr = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
            const statusClass = item.success ? 'success' : 'error';
            const statusIcon = item.success
                ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
                : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

            return `
                <div class="history-item ${statusClass}">
                    <div class="history-icon">${statusIcon}</div>
                    <div class="history-content">
                        <div class="history-title">${item.type}</div>
                        <div class="history-details">${item.details || ''}</div>
                    </div>
                    <div class="history-time">${timeStr}</div>
                </div>
            `;
        }).join('');
    }

    function clearHistory() {
        processingHistory.length = 0;
        localStorage.removeItem("cutone_processing_history");
        updateHistoryDisplay();
        showToast("履歴をクリアしました", "info");
    }

    // ============================================
    // Settings Reset
    // ============================================
    function resetAllSettings() {
        // Default values
        const defaults = {
            threshold: -35,
            minSilenceDuration: 500,
            minTalkDuration: 300,
            paddingBefore: 100,
            paddingAfter: 100
        };

        // Reset sliders
        elements.thresholdSlider.value = defaults.threshold;
        elements.minSilenceDuration.value = defaults.minSilenceDuration;
        elements.minTalkDuration.value = defaults.minTalkDuration;
        elements.paddingBefore.value = defaults.paddingBefore;
        elements.paddingAfter.value = defaults.paddingAfter;

        // Update displays
        updateSliderDisplays();

        // Reset presets
        document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("active"));

        // Reset checkboxes
        elements.addToSequence.checked = true;
        elements.exportSrt.checked = true;
        if (elements.exportVtt) elements.exportVtt.checked = false;

        // Save
        saveOutputOptions();

        showToast("設定をリセットしました", "success");
    }

    // ============================================
    // Segment Merge
    // ============================================
    function mergeSelectedSegments() {
        const selectedIndices = getSelectedSegmentIndices();
        if (selectedIndices.length < 2) {
            showToast("マージするには2つ以上のセグメントを選択してください", "info");
            return;
        }

        // Sort indices
        selectedIndices.sort((a, b) => a - b);

        // Check if consecutive
        for (let i = 1; i < selectedIndices.length; i++) {
            if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
                showToast("連続したセグメントのみマージできます", "error");
                return;
            }
        }

        // Merge segments
        const firstIdx = selectedIndices[0];
        const lastIdx = selectedIndices[selectedIndices.length - 1];
        const first = transcriptionSegments[firstIdx];
        const last = transcriptionSegments[lastIdx];

        const mergedText = selectedIndices
            .map(i => transcriptionSegments[i].text)
            .join(' ');

        const mergedSegment = {
            start: first.start,
            end: last.end,
            text: mergedText
        };

        // Replace segments
        transcriptionSegments.splice(firstIdx, selectedIndices.length, mergedSegment);

        // Refresh display
        displayTranscriptionResult(transcriptionSegments);
        showToast(`${selectedIndices.length}個のセグメントをマージしました`, "success");
    }

    function getSelectedSegmentIndices() {
        const selected = [];
        document.querySelectorAll(".transcription-segment.selected").forEach(el => {
            const index = parseInt(el.dataset.index);
            if (!isNaN(index)) selected.push(index);
        });
        return selected;
    }

    // ============================================
    // Detected Segment List (Interactive)
    // ============================================
    let excludedSegments = new Set(); // Track segments to exclude from processing

    function renderDetectedSegmentList() {
        const container = document.getElementById("segmentListContainer");
        const list = document.getElementById("segmentList");
        const countSpan = document.getElementById("segmentCount");

        if (!container || !list) return;

        if (detectedSegments.length === 0) {
            container.style.display = "none";
            return;
        }

        container.style.display = "block";
        countSpan.textContent = detectedSegments.length;

        list.innerHTML = detectedSegments.map((seg, index) => {
            const isSelected = !excludedSegments.has(index);
            const startTime = formatTimestamp(seg.start);
            const endTime = formatTimestamp(seg.end);
            const duration = (seg.end - seg.start).toFixed(2);

            return `
                <div class="segment-item ${isSelected ? 'selected' : 'excluded'}" data-index="${index}">
                    <div class="segment-checkbox">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </div>
                    <div class="segment-info">
                        <span class="segment-time">${startTime} → ${endTime}</span>
                        <span class="segment-duration">${duration}秒</span>
                    </div>
                    <button class="segment-preview-btn" data-start="${seg.start}">再生</button>
                </div>
            `;
        }).join('');

        // Add click handlers
        list.querySelectorAll(".segment-item").forEach(item => {
            item.addEventListener("click", (e) => {
                if (e.target.classList.contains("segment-preview-btn")) return;
                const index = parseInt(item.dataset.index);
                toggleSegmentSelection(index);
            });
        });

        list.querySelectorAll(".segment-preview-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const start = parseFloat(btn.dataset.start);
                try {
                    await CEP.callExtendScript("setPlayerPosition", [start]);
                } catch (err) {
                    console.log("[CutOne] Could not set player position:", err);
                }
            });
        });
    }

    function toggleSegmentSelection(index) {
        if (excludedSegments.has(index)) {
            excludedSegments.delete(index);
        } else {
            excludedSegments.add(index);
        }
        renderDetectedSegmentList();
        renderPreviewWaveform(); // Re-render to show excluded segments
    }

    function selectAllSegments() {
        excludedSegments.clear();
        renderDetectedSegmentList();
        renderPreviewWaveform();
    }

    function deselectAllSegments() {
        detectedSegments.forEach((_, index) => excludedSegments.add(index));
        renderDetectedSegmentList();
        renderPreviewWaveform();
    }

    function getActiveSegments() {
        return detectedSegments.filter((_, index) => !excludedSegments.has(index));
    }

    // ============================================
    // Settings Profiles
    // ============================================
    const MAX_PROFILES = 5;

    function getCurrentSettings() {
        return {
            threshold: parseInt(elements.thresholdSlider.value),
            minSilenceDuration: parseInt(elements.minSilenceDuration.value),
            minTalkDuration: parseInt(elements.minTalkDuration.value),
            paddingBefore: parseInt(elements.paddingBefore.value),
            paddingAfter: parseInt(elements.paddingAfter.value),
            silenceAction: getSelectedSilenceAction(),
            transition: getSelectedTransition()
        };
    }

    function saveProfile() {
        const profiles = loadProfiles();

        if (profiles.length >= MAX_PROFILES) {
            showToast(`最大${MAX_PROFILES}個のプロファイルまで保存できます`, "error");
            return;
        }

        const name = prompt("プロファイル名を入力してください:");
        if (!name || name.trim() === "") return;

        const settings = getCurrentSettings();
        const profile = {
            id: Date.now().toString(),
            name: name.trim(),
            settings: settings,
            createdAt: Date.now()
        };

        profiles.push(profile);
        localStorage.setItem("cutone_profiles", JSON.stringify(profiles));
        updateProfileList();
        showToast(`プロファイル「${name}」を保存しました`, "success");
    }

    function loadProfiles() {
        const saved = localStorage.getItem("cutone_profiles");
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    function applyProfile(profileId) {
        const profiles = loadProfiles();
        const profile = profiles.find(p => p.id === profileId);
        if (!profile) return;

        const s = profile.settings;
        elements.thresholdSlider.value = s.threshold;
        elements.minSilenceDuration.value = s.minSilenceDuration;
        elements.minTalkDuration.value = s.minTalkDuration;
        elements.paddingBefore.value = s.paddingBefore;
        elements.paddingAfter.value = s.paddingAfter;

        updateSliderDisplays();
        showToast(`プロファイル「${profile.name}」を適用しました`, "success");
    }

    function deleteProfile(profileId) {
        let profiles = loadProfiles();
        profiles = profiles.filter(p => p.id !== profileId);
        localStorage.setItem("cutone_profiles", JSON.stringify(profiles));
        updateProfileList();
        showToast("プロファイルを削除しました", "info");
    }

    function updateProfileList() {
        const container = document.getElementById("profileList");
        if (!container) return;

        const profiles = loadProfiles();

        if (profiles.length === 0) {
            container.innerHTML = '<div class="profile-empty">プロファイルがありません</div>';
            return;
        }

        container.innerHTML = profiles.map(profile => {
            const desc = `閾値: ${profile.settings.threshold}dB, 最小無音: ${profile.settings.minSilenceDuration}ms`;
            return `
                <div class="profile-item" data-id="${profile.id}">
                    <div class="profile-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                        </svg>
                    </div>
                    <div class="profile-info">
                        <span class="profile-name">${profile.name}</span>
                        <span class="profile-desc">${desc}</span>
                    </div>
                    <button class="profile-delete" data-id="${profile.id}" title="削除">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll(".profile-item").forEach(item => {
            item.addEventListener("click", (e) => {
                if (e.target.closest(".profile-delete")) return;
                applyProfile(item.dataset.id);
            });
        });

        container.querySelectorAll(".profile-delete").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (confirm("このプロファイルを削除しますか？")) {
                    deleteProfile(btn.dataset.id);
                }
            });
        });
    }

    // ============================================
    // Statistics Dashboard
    // ============================================
    function loadStats() {
        const saved = localStorage.getItem("cutone_stats");
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return getDefaultStats();
            }
        }
        return getDefaultStats();
    }

    function getDefaultStats() {
        return {
            totalProcessed: 0,
            totalSavedSeconds: 0,
            totalReductions: [],
            totalTranscribed: 0
        };
    }

    function saveStats(stats) {
        localStorage.setItem("cutone_stats", JSON.stringify(stats));
    }

    function updateStatsAfterProcess(savedSeconds, reductionPercent) {
        const stats = loadStats();
        stats.totalProcessed++;
        stats.totalSavedSeconds += savedSeconds;
        stats.totalReductions.push(reductionPercent);
        // Keep only last 100 reductions for average
        if (stats.totalReductions.length > 100) {
            stats.totalReductions.shift();
        }
        saveStats(stats);
        updateStatsDashboard();
    }

    function updateStatsAfterTranscribe() {
        const stats = loadStats();
        stats.totalTranscribed++;
        saveStats(stats);
        updateStatsDashboard();
    }

    function updateStatsDashboard() {
        const stats = loadStats();

        const totalProcessedEl = document.getElementById("statTotalProcessed");
        const totalSavedEl = document.getElementById("statTotalSaved");
        const avgReductionEl = document.getElementById("statAvgReduction");
        const totalTranscribedEl = document.getElementById("statTotalTranscribed");

        if (totalProcessedEl) totalProcessedEl.textContent = stats.totalProcessed;
        if (totalTranscribedEl) totalTranscribedEl.textContent = stats.totalTranscribed;

        if (totalSavedEl) {
            const mins = Math.floor(stats.totalSavedSeconds / 60);
            const secs = Math.floor(stats.totalSavedSeconds % 60);
            totalSavedEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        if (avgReductionEl) {
            if (stats.totalReductions.length > 0) {
                const avg = stats.totalReductions.reduce((a, b) => a + b, 0) / stats.totalReductions.length;
                avgReductionEl.textContent = `${avg.toFixed(1)}%`;
            } else {
                avgReductionEl.textContent = "0%";
            }
        }
    }

    // ============================================
    // Export Folder Memory
    // ============================================
    function saveLastExportPath(path) {
        localStorage.setItem("cutone_last_export_path", path);
    }

    function getLastExportPath() {
        return localStorage.getItem("cutone_last_export_path") || "";
    }

    // ============================================
    // Waveform Hover Tooltip
    // ============================================
    function setupWaveformInteraction() {
        const waveform = elements.previewWaveform;
        if (!waveform) return;

        let tooltip = null;

        waveform.addEventListener("mousemove", (e) => {
            if (!currentSequence || !waveform.querySelector("canvas")) return;

            const rect = waveform.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            const time = percent * currentSequence.duration;

            // Create or update tooltip
            if (!tooltip) {
                tooltip = document.createElement("div");
                tooltip.className = "waveform-tooltip";
                waveform.appendChild(tooltip);
            }

            tooltip.textContent = formatTimestamp(time);
            tooltip.style.left = `${x + 10}px`;
            tooltip.style.top = `${e.clientY - rect.top - 25}px`;
            tooltip.style.display = "block";
        });

        waveform.addEventListener("mouseleave", () => {
            if (tooltip) {
                tooltip.style.display = "none";
            }
        });

        waveform.addEventListener("click", async (e) => {
            if (!currentSequence) return;

            const rect = waveform.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            const time = percent * currentSequence.duration;

            try {
                await CEP.callExtendScript("setPlayerPosition", [time]);
            } catch (err) {
                console.log("[CutOne] Could not set player position:", err);
            }
        });
    }

    // ============================================
    // Use Case Presets
    // ============================================
    const useCasePresets = {
        podcast: {
            threshold: -40,
            minSilence: 600,
            minTalk: 300,
            paddingBefore: 100,
            paddingAfter: 100,
            pacing: "calm"
        },
        interview: {
            threshold: -38,
            minSilence: 500,
            minTalk: 250,
            paddingBefore: 80,
            paddingAfter: 80,
            pacing: "careful"
        },
        vlog: {
            threshold: -32,
            minSilence: 250,
            minTalk: 150,
            paddingBefore: 50,
            paddingAfter: 50,
            pacing: "energetic"
        },
        tutorial: {
            threshold: -36,
            minSilence: 400,
            minTalk: 200,
            paddingBefore: 60,
            paddingAfter: 60,
            pacing: "good"
        },
        asmr: {
            threshold: -50,
            minSilence: 1000,
            minTalk: 500,
            paddingBefore: 200,
            paddingAfter: 200,
            pacing: "calm"
        }
    };

    function applyUseCasePreset(usecase) {
        const preset = useCasePresets[usecase];
        if (!preset) return;

        // Update threshold slider
        if (elements.thresholdSlider) {
            elements.thresholdSlider.value = preset.threshold;
            updateThresholdDisplay();
        }

        // Update silence duration
        const minSilenceInput = document.getElementById("minSilenceDuration");
        if (minSilenceInput) minSilenceInput.value = preset.minSilence;

        // Update talk duration
        const minTalkInput = document.getElementById("minTalkDuration");
        if (minTalkInput) minTalkInput.value = preset.minTalk;

        // Update padding
        const paddingBefore = document.getElementById("paddingBefore");
        const paddingAfter = document.getElementById("paddingAfter");
        if (paddingBefore) paddingBefore.value = preset.paddingBefore;
        if (paddingAfter) paddingAfter.value = preset.paddingAfter;

        // Update pacing preset
        const pacingBtn = document.querySelector(`.preset-btn[data-preset="${preset.pacing}"]`);
        if (pacingBtn) {
            elements.presetBtns.forEach(btn => btn.classList.remove("active"));
            pacingBtn.classList.add("active");
        }

        // Update button states
        document.querySelectorAll(".usecase-preset-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.usecase === usecase);
        });

        showToast(`${getUseCaseLabel(usecase)}プリセットを適用しました`, "success");

        // Re-generate preview if we have audio levels
        if (audioLevels.length > 0) {
            generatePreview();
        }
    }

    function getUseCaseLabel(usecase) {
        const labels = {
            podcast: "ポッドキャスト",
            interview: "インタビュー",
            vlog: "Vlog",
            tutorial: "チュートリアル",
            asmr: "ASMR"
        };
        return labels[usecase] || usecase;
    }

    // ============================================
    // Auto Threshold Detection
    // ============================================
    function autoDetectThreshold() {
        if (audioLevels.length === 0) {
            showToast("先にプレビューを生成してください", "info");
            return;
        }

        // Convert levels to dB values
        const dbLevels = audioLevels.map(level => {
            if (level <= 0) return -60;
            return 20 * Math.log10(level);
        });

        // Sort levels to find distribution
        const sorted = [...dbLevels].sort((a, b) => a - b);

        // Find the 10th percentile (likely silence) and 50th percentile (likely speech)
        const silencePercentile = Math.floor(sorted.length * 0.1);
        const speechPercentile = Math.floor(sorted.length * 0.5);

        const silenceLevel = sorted[silencePercentile];
        const speechLevel = sorted[speechPercentile];

        // Calculate optimal threshold (midpoint between silence and speech)
        let optimalThreshold = (silenceLevel + speechLevel) / 2;

        // Clamp to valid range
        optimalThreshold = Math.max(-60, Math.min(-20, Math.round(optimalThreshold)));

        // Apply threshold
        if (elements.thresholdSlider) {
            elements.thresholdSlider.value = optimalThreshold;
            updateThresholdDisplay();
        }

        showToast(`閾値を自動検出: ${optimalThreshold}dB`, "success");

        // Re-generate preview
        generatePreview();
    }

    // ============================================
    // Copy Result to Clipboard
    // ============================================
    function copyResultToClipboard() {
        const statsData = loadStats();
        const result = lastProcessingResult || {};

        const text = `CutOne 処理結果
━━━━━━━━━━━━━━━━━━━━
シーケンス: ${currentSequence?.name || "N/A"}
元の長さ: ${result.originalDuration ? formatTime(result.originalDuration) : "N/A"}
処理後: ${result.newDuration ? formatTime(result.newDuration) : "N/A"}
削減率: ${result.savedPercent ? result.savedPercent.toFixed(1) + "%" : "N/A"}
検出セグメント: ${detectedSegments.length}箇所
━━━━━━━━━━━━━━━━━━━━
累計処理回数: ${statsData.totalProcessed}
累計短縮時間: ${formatTime(statsData.totalSavedSeconds)}`;

        navigator.clipboard.writeText(text).then(() => {
            showToast("結果をクリップボードにコピーしました", "success");
        }).catch(() => {
            showToast("コピーに失敗しました", "error");
        });
    }

    // ============================================
    // Play Segment Preview in Premiere
    // ============================================
    async function playSegmentPreview(startTime, endTime) {
        try {
            // Jump to start time
            await CEP.callExtendScript("setPlayerPosition", [startTime]);

            // TODO: In future, could implement play-and-pause using QE API
            showToast(`${formatTimestamp(startTime)} へジャンプしました`, "info");
        } catch (err) {
            console.error("[CutOne] Play preview error:", err);
            showToast("再生に失敗しました", "error");
        }
    }

    // ============================================
    // Segment Split
    // ============================================
    function showSplitDialog(segmentIndex) {
        const segment = transcriptionSegments[segmentIndex];
        if (!segment) return;

        const midpoint = (segment.start + segment.end) / 2;

        const dialog = document.createElement("div");
        dialog.className = "split-dialog-overlay";
        dialog.innerHTML = `
            <div class="split-dialog">
                <h3>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    セグメント分割
                </h3>
                <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">
                    分割位置を入力してください (${formatTimestamp(segment.start)} - ${formatTimestamp(segment.end)})
                </p>
                <div class="split-time-input">
                    <input type="text" id="splitTimeInput" value="${formatTimestamp(midpoint)}" placeholder="0:00.00">
                </div>
                <div class="split-dialog-actions">
                    <button class="btn-secondary" id="splitCancel">キャンセル</button>
                    <button class="btn-primary" id="splitConfirm">分割</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        requestAnimationFrame(() => {
            dialog.classList.add("visible");
        });

        const closeDialog = () => {
            dialog.classList.remove("visible");
            setTimeout(() => dialog.remove(), 200);
        };

        document.getElementById("splitCancel").addEventListener("click", closeDialog);

        document.getElementById("splitConfirm").addEventListener("click", () => {
            const timeInput = document.getElementById("splitTimeInput").value;
            const splitTime = parseTimestamp(timeInput);

            if (splitTime <= segment.start || splitTime >= segment.end) {
                showToast("分割位置はセグメント内である必要があります", "error");
                return;
            }

            // Split the segment
            const firstHalf = {
                start: segment.start,
                end: splitTime,
                text: segment.text.substring(0, Math.floor(segment.text.length / 2))
            };

            const secondHalf = {
                start: splitTime,
                end: segment.end,
                text: segment.text.substring(Math.floor(segment.text.length / 2))
            };

            transcriptionSegments.splice(segmentIndex, 1, firstHalf, secondHalf);
            displayTranscriptionResult(transcriptionSegments);
            showToast("セグメントを分割しました", "success");
            closeDialog();
        });
    }

    function parseTimestamp(str) {
        // Parse formats like "0:00.00", "00:00", "1:23.45"
        const parts = str.split(":");
        if (parts.length === 2) {
            const mins = parseInt(parts[0]);
            const secs = parseFloat(parts[1]);
            return mins * 60 + secs;
        }
        return parseFloat(str) || 0;
    }

    let lastProcessingResult = null;

    // ============================================
    // Retry on Error
    // ============================================
    let lastFailedOperation = null;

    function saveFailedOperation(operation, params) {
        lastFailedOperation = { operation, params, timestamp: Date.now() };
        showRetryButton(operation);
    }

    function showRetryButton(operationType) {
        // Remove any existing retry container
        hideRetryButton();

        const retryContainer = document.createElement("div");
        retryContainer.id = "retryContainer";
        retryContainer.className = "retry-container";
        retryContainer.innerHTML = `
            <span class="retry-message">処理に失敗しました。もう一度試しますか？</span>
            <button class="btn-retry" id="retryBtn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                リトライ
            </button>
        `;

        // Find a suitable place to insert the retry container
        const resultsSection = document.getElementById("resultsSection");
        if (resultsSection && !resultsSection.classList.contains("hidden")) {
            resultsSection.appendChild(retryContainer);
        } else {
            // Try inserting in the processing log area or main content
            const logContainer = document.getElementById("processingLogContainer");
            if (logContainer) {
                logContainer.parentNode.insertBefore(retryContainer, logContainer.nextSibling);
            }
        }

        // Add click handler
        document.getElementById("retryBtn").addEventListener("click", async () => {
            hideRetryButton();
            await retryLastOperation();
        });
    }

    function hideRetryButton() {
        const existing = document.getElementById("retryContainer");
        if (existing) {
            existing.remove();
        }
    }

    async function retryLastOperation() {
        if (!lastFailedOperation) {
            showToast("リトライする操作がありません", "info");
            return;
        }

        const { operation } = lastFailedOperation;
        lastFailedOperation = null;
        hideRetryButton();

        showToast("リトライ中...", "info");

        try {
            switch (operation) {
                case "transcribe":
                    await startTranscription();
                    break;
                case "silenceCut":
                    await processSequence(true);
                    break;
                case "apply":
                    await applyTranscription();
                    break;
                default:
                    showToast("リトライできない操作です", "error");
            }
        } catch (e) {
            showToast(`リトライ失敗: ${e.message}`, "error");
        }
    }

    // ============================================
    // Progress Stages
    // ============================================
    const progressStages = [
        { id: "analyze", label: "音声分析", percent: 0 },
        { id: "detect", label: "無音検出", percent: 25 },
        { id: "process", label: "クリップ処理", percent: 50 },
        { id: "finalize", label: "完了処理", percent: 90 }
    ];

    function updateProgressStage(stageId, percent) {
        const stageIndicator = document.getElementById("progressStageIndicator");
        if (!stageIndicator) return;

        const stage = progressStages.find(s => s.id === stageId);
        if (!stage) return;

        // Update stage display
        stageIndicator.innerHTML = progressStages.map(s => {
            const isActive = s.id === stageId;
            const isComplete = progressStages.indexOf(s) < progressStages.indexOf(stage);
            const stateClass = isComplete ? 'complete' : (isActive ? 'active' : '');

            return `
                <div class="progress-stage ${stateClass}">
                    <div class="stage-dot"></div>
                    <span class="stage-label">${s.label}</span>
                </div>
            `;
        }).join('<div class="stage-connector"></div>');
    }

    function loadFillerRemovalOption() {
        const toggle = document.getElementById("removeFillerToggle");
        if (toggle) {
            const saved = localStorage.getItem("cutone_remove_filler");
            toggle.checked = saved === "true";
        }

        // Restore LLM post-processing settings
        const llmToggle = document.getElementById("enableLLMPostProcess");
        const llmModelSection = document.getElementById("llmModelSection");
        if (llmToggle) {
            const savedLLM = localStorage.getItem("cutone_enable_llm");
            // Default to enabled if not set
            llmToggle.checked = savedLLM === null ? true : savedLLM === "true";
            if (llmModelSection) {
                llmModelSection.style.display = llmToggle.checked ? "block" : "none";
            }
        }

        // Restore LLM model selection
        const savedModel = localStorage.getItem("cutone_llm_model");
        if (savedModel) {
            const modelRadio = document.querySelector(`input[name="llmModel"][value="${savedModel}"]`);
            if (modelRadio) {
                modelRadio.checked = true;
            }
        }
    }

    function isCompletionSoundEnabled() {
        return localStorage.getItem("cutone_completion_sound") === "true";
    }

    function isFillerRemovalEnabled() {
        return localStorage.getItem("cutone_remove_filler") === "true";
    }

    function playCompletionSound() {
        if (!isCompletionSoundEnabled()) return;
        try {
            // Use Web Audio API for a simple completion chime
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.4);
        } catch (e) {
            console.log("[CutOne] Could not play completion sound:", e);
        }
    }

    function removeFillerWords(text) {
        if (!isFillerRemovalEnabled()) return text;
        // Common Japanese filler words
        const fillers = [
            /えー+と?/g,
            /あー+/g,
            /うー+ん?/g,
            /んー+/g,
            /あのー?/g,
            /そのー?/g,
            /えっと/g,
            /まあ/g,
            /なんか/g
        ];
        let result = text;
        for (const filler of fillers) {
            result = result.replace(filler, "");
        }
        // Clean up extra spaces
        return result.replace(/\s+/g, " ").trim();
    }

    function loadSavedLanguage() {
        const savedLang = localStorage.getItem("cutone_transcription_language");
        if (savedLang) {
            const radio = document.querySelector(`input[name="transcriptionLang"][value="${savedLang}"]`);
            if (radio) {
                radio.checked = true;
            }
        }
    }

    function saveLanguage(lang) {
        localStorage.setItem("cutone_transcription_language", lang);
    }

    function getSelectedTranscriptionLanguage() {
        const selected = document.querySelector('input[name="transcriptionLang"]:checked');
        const lang = selected ? selected.value : "ja";
        saveLanguage(lang);
        return lang;
    }

    // Quick transcription: starts immediately and auto-applies
    async function quickTranscribe() {
        const apiKey = elements.openaiApiKey.value.trim();
        if (!apiKey || !apiKey.startsWith("sk-") || apiKey.length <= 20) {
            showToast("まず有効なAPIキーを入力してください", "error");
            elements.openaiApiKey.focus();
            return;
        }

        // Start transcription
        await startTranscription();

        // Auto-apply after transcription completes (if successful)
        if (transcriptionSegments.length > 0) {
            await applyTranscription();
        }
    }

    async function startTranscription() {
        if (isTranscribing) {
            console.log("[CutOne] Already transcribing");
            return;
        }

        // Check if using Scribe v2
        const useScribeV2 = elements.useScribeV2.checked;

        if (useScribeV2) {
            // Validate ElevenLabs API key
            const elevenLabsApiKey = elements.elevenLabsApiKey.value.trim();
            if (!elevenLabsApiKey) {
                showToast("ElevenLabs APIキーを入力してください", "error");
                return;
            }
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
            showLoading("文字起こしを開始中...", {
                showProgress: true,
                cancellable: true,
                onCancel: () => {
                    console.log("[CutOne] Transcription cancelled by user");
                }
            });

            // Get custom prompt from textarea
            const customPromptEl = document.getElementById("customPrompt");
            const customPrompt = customPromptEl ? customPromptEl.value.trim() : "";

            // Get LLM post-processing options
            const enableLLMPostProcess = document.getElementById("enableLLMPostProcess")?.checked ?? true;
            const llmModelEl = document.querySelector('input[name="llmModel"]:checked');
            const llmModel = llmModelEl ? llmModelEl.value : "gpt-5.2";
            const useBatchAPI = document.getElementById("useBatchAPI")?.checked ?? true;

            // Get subtitle format options (number inputs)
            const maxCharsPerSegment = parseInt(document.getElementById("maxCharsPerSegment")?.value || "18", 10);
            const maxLinesPerSegment = parseInt(document.getElementById("maxLinesPerSegment")?.value || "2", 10);

            const options = {
                apiKey: apiKey,
                language: getSelectedTranscriptionLanguage(),
                customPrompt: customPrompt,
                enableLLMPostProcess: enableLLMPostProcess,
                llmModel: llmModel,
                useBatchAPI: useBatchAPI,
                subtitleFormat: {
                    maxCharsPerSegment: maxCharsPerSegment,
                    maxLinesPerSegment: maxLinesPerSegment
                },
                // Scribe v2 options
                useScribeV2: useScribeV2,
                elevenLabsApiKey: useScribeV2 ? elements.elevenLabsApiKey.value.trim() : null
            };

            const result = await CEP.transcribeAudio(options, (message, percent) => {
                if (isCancelRequested()) {
                    throw new Error("キャンセルされました");
                }
                updateLoadingText(message);
                if (percent !== undefined) {
                    updateLoadingProgress(percent);
                }
            });

            if (isCancelRequested()) {
                hideLoading();
                showToast("文字起こしをキャンセルしました", "info");
                return;
            }

            hideLoading();

            if (result && result.success) {
                // Apply filler word removal if enabled
                transcriptionSegments = result.segments.map(seg => ({
                    ...seg,
                    text: removeFillerWords(seg.text)
                }));
                displayTranscriptionResult(transcriptionSegments);
                showToast(`${result.segments.length}セグメントの文字起こしが完了しました`, "success");
                // Play completion sound
                playCompletionSound();
                // Update statistics
                updateStatsAfterTranscribe();
                // Add to history
                addToHistory({
                    type: "文字起こし",
                    details: `${result.segments.length}セグメント`,
                    success: true
                });
            } else {
                showToast(result?.error || "文字起こしに失敗しました", "error");
                addToHistory({
                    type: "文字起こし",
                    details: result?.error || "文字起こしに失敗しました",
                    success: false
                });
                saveFailedOperation("transcribe", {});
            }
        } catch (e) {
            hideLoading();
            if (e.message === "キャンセルされました") {
                showToast("文字起こしをキャンセルしました", "info");
                addToHistory({
                    type: "文字起こし",
                    details: "キャンセル",
                    success: true
                });
            } else {
                showToast(e.message || "文字起こしに失敗しました", "error");
                console.error("[CutOne] Transcription error:", e);
                addToHistory({
                    type: "文字起こし",
                    details: e.message || "エラー",
                    success: false
                });
                saveFailedOperation("transcribe", {});
            }
        } finally {
            isTranscribing = false;
        }
    }

    function displayTranscriptionResult(segments) {
        // Show preview section
        elements.transcriptionPreviewSection.style.display = "block";

        // Render segments with inline editing
        let html = "";
        let totalChars = 0;

        segments.forEach((seg, index) => {
            const startTime = formatTimestamp(seg.start);
            const endTime = formatTimestamp(seg.end);
            totalChars += seg.text.length;

            html += `
                <div class="transcription-segment" data-index="${index}">
                    <div class="transcription-segment-header">
                        <div class="transcription-segment-time">
                            <span class="time-badge">${startTime}</span>
                            <span class="time-arrow">→</span>
                            <span class="time-badge">${endTime}</span>
                        </div>
                        <div class="segment-actions">
                            <button class="segment-action-mini" data-action="split" data-index="${index}" title="セグメントを分割">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                    <polyline points="19 12 12 19 5 12"/>
                                </svg>
                            </button>
                            <button class="segment-jump-btn" data-time="${seg.start}" data-end="${seg.end}" title="この位置にジャンプ">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="transcription-segment-text"
                         contenteditable="true"
                         data-index="${index}"
                         spellcheck="false">${escapeHtml(seg.text)}</div>
                </div>
            `;
        });

        elements.transcriptionResult.innerHTML = html;
        elements.transcriptionSegmentCount.textContent = segments.length;
        elements.transcriptionCharCount.textContent = totalChars;

        // Add event listeners for inline editing
        elements.transcriptionResult.querySelectorAll(".transcription-segment-text").forEach(el => {
            el.addEventListener("blur", handleSegmentEdit);
            el.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    el.blur();
                }
            });
        });

        // Add event listeners for jump buttons
        elements.transcriptionResult.querySelectorAll(".segment-jump-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const startTime = parseFloat(btn.dataset.time);
                const endTime = parseFloat(btn.dataset.end);
                playSegmentPreview(startTime, endTime);
            });
        });

        // Add event listeners for split buttons
        elements.transcriptionResult.querySelectorAll(".segment-action-mini[data-action='split']").forEach(btn => {
            btn.addEventListener("click", () => {
                const index = parseInt(btn.dataset.index);
                showSplitDialog(index);
            });
        });

        // Show result actions, hide start button
        elements.startTranscriptionBtn.parentElement.style.display = "none";
        elements.transcriptionResultActions.style.display = "flex";
    }

    function handleSegmentEdit(e) {
        const index = parseInt(e.target.dataset.index);
        const newText = e.target.textContent.trim();

        if (transcriptionSegments[index] && transcriptionSegments[index].text !== newText) {
            transcriptionSegments[index].text = newText;
            updateTranscriptionStats();
            console.log(`[CutOne] Segment ${index} updated:`, newText);
        }
    }

    function updateTranscriptionStats() {
        let totalChars = 0;
        transcriptionSegments.forEach(seg => {
            totalChars += seg.text.length;
        });
        elements.transcriptionCharCount.textContent = totalChars;
    }

    async function jumpToTime(seconds) {
        try {
            await CEP.callExtendScript("setPlayerPosition", [seconds]);
        } catch (e) {
            console.error("[CutOne] Jump to time failed:", e);
        }
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

            // Add to sequence as captions/markers
            if (addToSeq) {
                const addResult = await CEP.addCaptionsToSequence(transcriptionSegments);
                console.log("[CutOne] addCaptionsToSequence result:", JSON.stringify(addResult, null, 2));

                if (addResult && addResult.success) {
                    // Show which method was used
                    switch (addResult.method) {
                        case "captionTrack":
                            results.push(`${addResult.count}個の字幕を追加しました`);
                            break;
                        case "graphicsText":
                            results.push(`${addResult.count}個のテキストを追加しました`);
                            break;
                        case "srtImport":
                            results.push("SRTファイルをプロジェクトにインポートしました");
                            results.push("字幕トラックにドラッグして使用してください");
                            break;
                        case "markers":
                        default:
                            results.push(`${addResult.count}個のマーカーを追加`);
                            results.push("（SRTファイルを手動でインポートすると字幕になります）");
                            break;
                    }
                } else if (addResult && addResult.error) {
                    results.push(`エラー: ${addResult.error}`);
                }
            }

            // Export SRT file
            if (exportSrt) {
                // Get project folder path for default location
                const sequenceResult = await CEP.callExtendScript("getSequenceInfo", []);
                let defaultPath = getLastExportPath(); // Use saved export path
                const defaultName = currentSequence?.name || "captions";

                // Fallback to project path if no saved export path
                if (!defaultPath && sequenceResult && sequenceResult.projectPath) {
                    defaultPath = sequenceResult.projectPath.replace(/[^/\\]+$/, "");
                }

                // Show save dialog to let user choose location and filename
                const dialogResult = await CEP.callExtendScript("showSaveDialog", [defaultName, defaultPath]);

                if (dialogResult && dialogResult.success && dialogResult.path) {
                    const srtPath = dialogResult.path;
                    // Save export directory for next time
                    saveLastExportPath(srtPath.replace(/[^/\\]+$/, ""));
                    const srtResult = await CEP.exportSRT(transcriptionSegments, srtPath);
                    if (srtResult && srtResult.success) {
                        results.push(`SRTファイルを保存しました`);
                    }
                } else if (dialogResult && dialogResult.cancelled) {
                    // User cancelled, skip SRT export silently
                    console.log("[CutOne] SRT export cancelled by user");
                }
            }

            // Export VTT file
            const exportVtt = elements.exportVtt ? elements.exportVtt.checked : false;
            if (exportVtt) {
                const sequenceResult = await CEP.callExtendScript("getSequenceInfo", []);
                let defaultPath = getLastExportPath(); // Use saved export path
                const defaultName = (currentSequence?.name || "captions") + ".vtt";

                // Fallback to project path if no saved export path
                if (!defaultPath && sequenceResult && sequenceResult.projectPath) {
                    defaultPath = sequenceResult.projectPath.replace(/[^/\\]+$/, "");
                }

                // Show save dialog for VTT
                const dialogResult = await CEP.callExtendScript("showSaveDialogVTT", [defaultName, defaultPath]);

                if (dialogResult && dialogResult.success && dialogResult.path) {
                    // Save export directory for next time
                    saveLastExportPath(dialogResult.path.replace(/[^/\\]+$/, ""));
                    const vttContent = generateVTT(transcriptionSegments);
                    const vttResult = await CEP.callExtendScript("writeTextFile", [dialogResult.path, vttContent]);
                    if (vttResult && vttResult.success) {
                        results.push(`VTTファイルを保存しました`);
                    }
                } else if (dialogResult && dialogResult.cancelled) {
                    console.log("[CutOne] VTT export cancelled by user");
                }
            }

            hideLoading();

            if (results.length > 0) {
                showToast(results.join("、"), "success");
                // Add to history
                addToHistory({
                    type: "字幕適用",
                    details: results[0],
                    success: true
                });
            } else {
                showToast("出力オプションを選択してください", "info");
            }

        } catch (e) {
            hideLoading();
            showToast(e.message || "適用に失敗しました", "error");
            console.error("[CutOne] Apply error:", e);
            addToHistory({
                type: "字幕適用",
                details: e.message || "適用に失敗しました",
                success: false
            });
            saveFailedOperation("apply", {});
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

                // Clear excluded segments and render segment list
                excludedSegments.clear();
                renderDetectedSegmentList();

                hideLoading();

                if (result.count > 0) {
                    showToast(I18n.t("msg.foundSegments", { count: result.count }), "success");
                } else {
                    showToast(I18n.t("msg.noSilence"), "info");
                }
            } else {
                hideLoading();
                showToast(I18n.t("msg.noSilence"), "info");
                // Hide segment list when no segments found
                const container = document.getElementById("segmentListContainer");
                if (container) container.style.display = "none";
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
        // Active segments: red, Excluded segments: gray
        for (let i = 0; i < detectedSegments.length; i++) {
            const seg = detectedSegments[i];
            const isExcluded = excludedSegments.has(i);
            ctx.fillStyle = isExcluded ? "rgba(156, 163, 175, 0.3)" : "rgba(239, 68, 68, 0.3)";
            const startX = (seg.start / duration) * width;
            const endX = (seg.end / duration) * width;
            ctx.fillRect(startX, 0, endX - startX, height);
        }

        // Draw margin regions (green) - only for active segments
        ctx.fillStyle = "rgba(16, 185, 129, 0.4)"; // Green for margin
        for (let i = 0; i < detectedSegments.length; i++) {
            if (excludedSegments.has(i)) continue; // Skip excluded segments
            const seg = detectedSegments[i];
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

        for (let i = 0; i < detectedSegments.length; i++) {
            const seg = detectedSegments[i];
            const isExcluded = excludedSegments.has(i);
            const startPercent = (seg.start / duration) * 100;
            const widthPercent = (seg.duration / duration) * 100;

            const marker = document.createElement("div");
            marker.style.cssText = `
                position: absolute;
                left: ${startPercent}%;
                width: ${widthPercent}%;
                height: 100%;
                background: ${isExcluded ? "rgba(156, 163, 175, 0.4)" : "rgba(239, 68, 68, 0.6)"};
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
                elements.sequenceName.textContent = I18n.t("main.noSequence");
                elements.sequenceDuration.textContent = "--:--";
                console.log("[CutOne] No sequence found or error:", result);
            }
        } catch (e) {
            currentSequence = null;
            elements.sequenceName.textContent = I18n.t("main.noSequence");
            elements.sequenceDuration.textContent = "--:--";
            console.error("[CutOne] Error getting sequence:", e);
        }

        // Update timeline info in wizard
        updateTimelineInfo();
    }

    // ============================================
    // Processing - Full Implementation
    // ============================================
    async function processSequence(skipConfirmation = false) {
        console.log("[CutOne] processSequence called");

        // CRITICAL: Prevent multiple concurrent calls
        if (isProcessing) {
            console.log("[CutOne] Already processing - ignoring duplicate call!");
            return;
        }
        isProcessing = true;
        console.log("[CutOne] isProcessing set to true");

        // Save settings for next time
        saveLastUsedSettings();

        // Clear and start processing log
        clearProcessingLogs();
        addProcessingLog("処理を開始しました", "info");

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

        // Show confirmation dialog if we have detected segments and skipConfirmation is false
        const activeSegments = getActiveSegments();
        if (!skipConfirmation && activeSegments.length > 0) {
            isProcessing = false; // Allow dialog interaction
            const excludedCount = excludedSegments.size;
            const confirmed = await showConfirmationDialog(options, activeSegments, excludedCount);
            if (!confirmed) {
                showToast("処理をキャンセルしました", "info");
                return;
            }
            isProcessing = true; // Resume processing guard
        }

        console.log("[CutOne] Processing options:", options);

        try {
            showLoading(I18n.t("process.processing"));
            console.log("[CutOne] Calling CEP.processWithOptions...");

            addProcessingLog(`閾値: ${options.threshold}dB, 最小無音: ${options.minSilenceDuration}s`, "info");

            // Initialize progress stage display
            updateProgressStage("analyze", 0);

            // Use the new processWithOptions function with progress callback
            const result = await CEP.processWithOptions(options, (stage, percent, remaining, message) => {
                updateLoadingText(message);
                addProcessingLog(message, "info");
                console.log(`[CutOne] Progress: ${stage} ${percent}% - ${message}`);

                // Map stage names to progress stage IDs
                let stageId = "analyze";
                if (stage === "detecting" || message.includes("検出")) {
                    stageId = "detect";
                } else if (stage === "processing" || message.includes("処理") || message.includes("クリップ")) {
                    stageId = "process";
                } else if (stage === "finalizing" || message.includes("完了") || percent >= 90) {
                    stageId = "finalize";
                }
                updateProgressStage(stageId, percent);
            });

            hideLoading();
            isProcessing = false;
            console.log("[CutOne] isProcessing set to false (success)");

            if (result && result.success) {
                addProcessingLog(`処理完了: ${result.segmentsProcessed}箇所を処理`, "success");

                // Save result for clipboard copy
                lastProcessingResult = {
                    originalDuration: result.originalDuration,
                    newDuration: result.newDuration,
                    savedPercent: result.savedPercent
                };

                // Show results
                showResults(lastProcessingResult);

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
                // Play completion sound
                playCompletionSound();
                // Save operation state for undo reference
                saveOperationState("silenceCut", {
                    segmentsProcessed: result.segmentsProcessed,
                    savedPercent: result.savedPercent
                });
                // Add to processing history
                addToHistory({
                    type: "無音カット",
                    details: `${result.segmentsProcessed}箇所処理 / ${result.savedPercent.toFixed(1)}%短縮`,
                    success: true
                });
                // Update statistics
                const savedSeconds = (result.originalDuration || 0) - (result.newDuration || 0);
                updateStatsAfterProcess(savedSeconds, result.savedPercent || 0);
            } else {
                if (result && result.segmentsFound === 0) {
                    addProcessingLog("無音部分が見つかりませんでした", "info");
                    showToast(I18n.t("msg.noSilence"), "info");
                    addToHistory({
                        type: "無音カット",
                        details: "無音部分が見つかりませんでした",
                        success: true
                    });
                } else if (result && result.error) {
                    addProcessingLog(`エラー: ${result.error}`, "error");
                    showToast(result.error, "error");
                    addToHistory({
                        type: "無音カット",
                        details: result.error,
                        success: false
                    });
                    saveFailedOperation("silenceCut", options);
                } else {
                    addProcessingLog("処理に失敗しました", "error");
                    showToast(I18n.t("msg.error"), "error");
                    addToHistory({
                        type: "無音カット",
                        details: "処理に失敗しました",
                        success: false
                    });
                    saveFailedOperation("silenceCut", options);
                }
            }
        } catch (e) {
            hideLoading();
            isProcessing = false;
            addProcessingLog(`エラー: ${e.message || "不明なエラー"}`, "error");
            console.log("[CutOne] isProcessing set to false (error)");
            showToast(e.message || I18n.t("msg.error"), "error");
            addToHistory({
                type: "無音カット",
                details: e.message || "不明なエラー",
                success: false
            });
            saveFailedOperation("silenceCut", options);
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
    function showLoading(text = "Processing...", options = {}) {
        cancelRequested = false;
        elements.processingText.textContent = text;
        elements.processingOverlay.classList.remove("hidden");

        // Start processing timer
        startProcessingTimer();

        // Show timer display
        const timerDisplay = document.getElementById("processingTimer");
        if (timerDisplay) {
            timerDisplay.style.display = "block";
        }

        // Show/hide progress bar
        if (options.showProgress) {
            elements.progressContainer.style.display = "block";
            elements.progressFill.style.width = "0%";
            elements.progressPercent.textContent = "0%";
        } else {
            elements.progressContainer.style.display = "none";
        }

        // Show/hide cancel button
        if (options.cancellable) {
            elements.cancelProcessBtn.style.display = "inline-flex";
            elements.cancelProcessBtn.onclick = () => {
                cancelRequested = true;
                elements.processingText.textContent = "キャンセル中...";
                elements.cancelProcessBtn.style.display = "none";
                if (options.onCancel) {
                    options.onCancel();
                }
            };
        } else {
            elements.cancelProcessBtn.style.display = "none";
        }
    }

    function updateLoadingText(text) {
        elements.processingText.textContent = text;
    }

    function updateLoadingProgress(percent) {
        elements.progressFill.style.width = percent + "%";
        elements.progressPercent.textContent = Math.round(percent) + "%";
    }

    function isCancelRequested() {
        return cancelRequested;
    }

    function hideLoading() {
        // Calculate and log total processing time
        if (processingStartTime) {
            const totalTime = Date.now() - processingStartTime;
            addProcessingLog(`処理時間: ${formatElapsedTime(totalTime)}`, "info");
        }

        // Stop the timer
        stopProcessingTimer();

        elements.processingOverlay.classList.add("hidden");
        elements.progressContainer.style.display = "none";
        elements.cancelProcessBtn.style.display = "none";
        cancelRequested = false;
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
        // Preset functions
        loadPreset: function(name) {
            const presets = getSavedSilencePresets();
            const preset = presets.find(p => p.name === name);
            if (preset) {
                loadSilencePreset(preset);
            }
        },
        deletePreset: function(name) {
            if (confirm(`プリセット「${name}」を削除しますか？`)) {
                deleteSilencePreset(name);
                displayCustomPresets();
            }
        },
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
