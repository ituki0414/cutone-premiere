/**
 * CutOne - CEP Communication Layer
 * Handles communication between panel and ExtendScript
 * Version 2.0 - Complete rewrite for reliability
 */

// Node.js modules (available in CEP with Node.js enabled)
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const CEP = (function() {
    let csInterface = null;

    /**
     * Initialize CSInterface
     */
    function init() {
        console.log("[CEP] Initializing CSInterface...");
        try {
            csInterface = new CSInterface();
            console.log("[CEP] CSInterface initialized successfully:", !!csInterface);

            // Load ExtendScript
            const extPath = csInterface.getSystemPath("extension") + "/hostscript/index.jsx";
            console.log("[CEP] Loading ExtendScript from:", extPath);

            return csInterface;
        } catch (e) {
            console.error("[CEP] Failed to initialize CSInterface:", e);
            return null;
        }
    }

    /**
     * Convert CEP file URL to filesystem path
     */
    function cepPathToFs(cepPath) {
        // Remove file:// prefix but keep the path's leading slash
        let fsPath = cepPath.replace(/^file:\/\//, "").replace(/^file:/, "");
        // Decode URL encoding (e.g., %20 -> space)
        fsPath = decodeURIComponent(fsPath);
        // Ensure leading slash on Mac/Linux
        if (!fsPath.startsWith("/") && !fsPath.match(/^[A-Za-z]:/)) {
            fsPath = "/" + fsPath;
        }
        return fsPath;
    }

    /**
     * Get FFmpeg path
     */
    function getFFmpegPath() {
        const extPath = cepPathToFs(csInterface.getSystemPath("extension"));
        const isMac = navigator.platform.toLowerCase().includes("mac");
        const ffmpegName = isMac ? "ffmpeg-mac" : "ffmpeg-win.exe";
        return path.join(extPath, "bin", ffmpegName);
    }

    /**
     * Run FFmpeg silence detection using Node.js
     * @param {function} onProgress - Progress callback (percent, timeStr)
     */
    function runFFmpegSilenceDetect(audioPath, threshold, minDuration, totalDuration, onProgress) {
        return new Promise((resolve, reject) => {
            const ffmpegPath = getFFmpegPath();
            console.log("[CEP] FFmpeg path:", ffmpegPath);
            console.log("[CEP] Audio path:", audioPath);
            console.log("[CEP] Total duration:", totalDuration);

            // Check if FFmpeg exists
            if (!fs.existsSync(ffmpegPath)) {
                reject(new Error("FFmpeg not found at: " + ffmpegPath));
                return;
            }

            // Check if audio file exists
            if (!fs.existsSync(audioPath)) {
                reject(new Error("Audio file not found: " + audioPath));
                return;
            }

            const args = [
                "-i", audioPath,
                "-af", `silencedetect=noise=${threshold}dB:d=${minDuration}`,
                "-f", "null",
                "/dev/null"
            ];

            console.log("[CEP] Running FFmpeg with args:", args);

            const ffmpeg = childProcess.spawn(ffmpegPath, args);
            let stderr = "";
            const startTime = Date.now();

            ffmpeg.stderr.on("data", (data) => {
                const chunk = data.toString();
                stderr += chunk;

                // Parse progress from FFmpeg output (time=00:00:00.00)
                const timeMatch = chunk.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                if (timeMatch && totalDuration > 0 && onProgress) {
                    const hours = parseInt(timeMatch[1]);
                    const mins = parseInt(timeMatch[2]);
                    const secs = parseInt(timeMatch[3]);
                    const currentTime = hours * 3600 + mins * 60 + secs;
                    const percent = Math.min(99, Math.round((currentTime / totalDuration) * 100));

                    // Estimate remaining time
                    const elapsed = (Date.now() - startTime) / 1000;
                    const speed = currentTime / elapsed;
                    const remaining = speed > 0 ? Math.round((totalDuration - currentTime) / speed) : 0;

                    onProgress(percent, currentTime, remaining);
                }
            });

            ffmpeg.on("close", (code) => {
                console.log("[CEP] FFmpeg exited with code:", code);
                console.log("[CEP] FFmpeg stderr length:", stderr.length);

                // Log raw output for debugging (first 2000 chars)
                console.log("[CEP] FFmpeg raw output (first 2000 chars):");
                console.log(stderr.substring(0, 2000));

                // Check if there are silence_start/silence_end in the output
                const silenceStartCount = (stderr.match(/silence_start/g) || []).length;
                const silenceEndCount = (stderr.match(/silence_end/g) || []).length;
                console.log("[CEP] silence_start occurrences:", silenceStartCount);
                console.log("[CEP] silence_end occurrences:", silenceEndCount);

                if (onProgress) onProgress(100, totalDuration, 0);

                // Parse silence segments from stderr
                const segments = parseSilenceOutput(stderr);
                console.log("[CEP] Parsed segments:", segments.length);

                resolve({
                    success: true,
                    segments: segments,
                    count: segments.length,
                    rawOutputLength: stderr.length,
                    rawOutputSample: stderr.substring(0, 500)
                });
            });

            ffmpeg.on("error", (err) => {
                console.error("[CEP] FFmpeg error:", err);
                reject(err);
            });
        });
    }

    /**
     * Parse FFmpeg silencedetect output
     */
    function parseSilenceOutput(output) {
        const segments = [];
        const lines = output.split("\n");
        let currentStart = null;

        for (const line of lines) {
            const startMatch = line.match(/silence_start:\s*([\d.]+)/);
            if (startMatch) {
                currentStart = parseFloat(startMatch[1]);
            }

            const endMatch = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);
            if (endMatch && currentStart !== null) {
                segments.push({
                    start: currentStart,
                    end: parseFloat(endMatch[1]),
                    duration: parseFloat(endMatch[2])
                });
                currentStart = null;
            }
        }

        return segments;
    }

    /**
     * Call ExtendScript function and return promise
     * @param {string} functionName - Name of ExtendScript function
     * @param {array} args - Arguments to pass
     */
    function callExtendScript(functionName, args = []) {
        return new Promise((resolve, reject) => {
            console.log("[CEP] callExtendScript:", functionName, "csInterface:", !!csInterface);

            if (!csInterface) {
                console.error("[CEP] CSInterface not initialized!");
                reject(new Error("CSInterface not initialized"));
                return;
            }

            // Build script call - use single quotes for JSON strings to avoid escaping issues
            const argsStr = args.map(arg => {
                if (typeof arg === "string") {
                    // Escape single quotes and backslashes for ExtendScript
                    const escaped = arg
                        .replace(/\\/g, '\\\\')
                        .replace(/'/g, "\\'")
                        .replace(/\n/g, '\\n')
                        .replace(/\r/g, '\\r');
                    return "'" + escaped + "'";
                } else if (typeof arg === "number") {
                    return String(arg);
                } else if (typeof arg === "boolean") {
                    return arg ? "true" : "false";
                } else if (typeof arg === "object") {
                    const jsonStr = JSON.stringify(arg)
                        .replace(/\\/g, '\\\\')
                        .replace(/'/g, "\\'");
                    return "'" + jsonStr + "'";
                }
                return String(arg);
            }).join(", ");

            const script = `${functionName}(${argsStr})`;
            console.log("[CEP] Executing script:", script.substring(0, 200) + "...");

            csInterface.evalScript(script, (result) => {
                console.log("[CEP] Raw result from ExtendScript:", result);

                // Handle EvalScript error
                if (result === "EvalScript error.") {
                    console.error("[CEP] EvalScript error - function may not exist or has syntax error");
                    reject(new Error("ExtendScript execution failed. Check console for details."));
                    return;
                }

                if (result === "undefined" || result === "" || result === "null") {
                    console.log("[CEP] Result is empty/undefined");
                    resolve(null);
                    return;
                }

                try {
                    const parsed = JSON.parse(result);
                    console.log("[CEP] Parsed result:", parsed);
                    if (parsed.success === false) {
                        reject(new Error(parsed.error || "Unknown error"));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    // Return raw result if not JSON
                    console.log("[CEP] Result is not JSON, returning raw:", result);
                    resolve(result);
                }
            });
        });
    }

    /**
     * Get active sequence info
     */
    async function getActiveSequence() {
        console.log("[CEP] Calling getActiveSequence...");
        const result = await callExtendScript("getActiveSequence");
        console.log("[CEP] getActiveSequence returned:", result);
        return result;
    }

    /**
     * Detect silence in sequence
     * @param {number} threshold - dB threshold
     * @param {number} minDuration - minimum silence duration
     */
    async function detectSilence(threshold, minDuration) {
        // First get source file path
        const sourcePath = await callExtendScript("getFirstClipSourcePath");

        if (!sourcePath) {
            throw new Error("Could not find source media file");
        }

        return callExtendScript("detectSilence", [sourcePath, threshold, minDuration]);
    }

    /**
     * Preview silence (add markers only)
     * @param {number} threshold - dB threshold
     * @param {number} minDuration - minimum silence duration
     */
    async function previewSilence(threshold, minDuration) {
        return callExtendScript("previewSilence", [threshold, minDuration]);
    }

    /**
     * Advanced preview with all options
     * @param {object} options - Preview options
     */
    async function previewWithOptions(options) {
        const optionsJson = JSON.stringify(options);
        return callExtendScript("previewWithOptions", [optionsJson]);
    }

    /**
     * Cut silence segments (legacy)
     * @param {array} segments - Silence segments to cut
     * @param {number} margin - Margin around cuts
     */
    async function cutSilence(segments, margin) {
        const segmentsJson = JSON.stringify(segments);
        return callExtendScript("rippleDeleteSegments", [segmentsJson, margin]);
    }

    /**
     * Process with full options (uses Node.js for FFmpeg)
     * @param {object} options - All processing options
     * @param {function} onProgress - Progress callback (stage, percent, remaining)
     */
    async function processWithOptions(options, onProgress) {
        console.log("[CEP] =====================================================");
        console.log("[CEP] processWithOptions START");
        console.log("[CEP] Options:", JSON.stringify(options, null, 2));
        console.log("[CEP] =====================================================");

        try {
            // ============================================
            // Step 1: Get sequence info and source path
            // ============================================
            if (onProgress) onProgress("init", 0, null, "シーケンス情報を取得中...");

            const seqInfo = await callExtendScript("getSequenceInfo");
            console.log("[CEP] Sequence info:", JSON.stringify(seqInfo, null, 2));

            // Validate sequence info
            if (!seqInfo) {
                throw new Error("シーケンス情報を取得できませんでした");
            }

            if (!seqInfo.sourcePath) {
                throw new Error("ソースメディアのパスを取得できませんでした。シーケンスにクリップがあることを確認してください。");
            }

            // Extract timing info with defaults
            const clipStartInSequence = seqInfo.clipStartInSequence || 0;
            const clipEndInSequence = seqInfo.clipEndInSequence || seqInfo.sequenceDuration || seqInfo.duration || 0;
            const clipInPoint = seqInfo.clipInPoint || 0;
            const clipOutPoint = seqInfo.clipOutPoint || (clipInPoint + (clipEndInSequence - clipStartInSequence));
            const originalDuration = clipEndInSequence - clipStartInSequence;

            console.log("[CEP] ========== Timing Info ==========");
            console.log("[CEP] Clip in sequence: " + clipStartInSequence.toFixed(2) + "s - " + clipEndInSequence.toFixed(2) + "s");
            console.log("[CEP] Clip duration: " + originalDuration.toFixed(2) + "s");
            console.log("[CEP] Source in/out: " + clipInPoint.toFixed(2) + "s - " + clipOutPoint.toFixed(2) + "s");
            console.log("[CEP] Source path: " + seqInfo.sourcePath);
            console.log("[CEP] ===================================");

            // Validate duration
            if (originalDuration <= 0) {
                throw new Error("シーケンスの長さが0です。クリップが正しく配置されているか確認してください。");
            }

            // ============================================
            // Step 2: Run FFmpeg silence detection
            // ============================================
            console.log("[CEP] Running FFmpeg silence detection...");
            if (onProgress) onProgress("analyze", 0, null, "音声を解析中... 0%");

            const threshold = options.threshold || -35;
            const minSilenceDuration = options.minSilenceDuration || 0.3;

            console.log("[CEP] ========== FFmpeg Settings ==========");
            console.log("[CEP] Threshold:", threshold, "dB");
            console.log("[CEP] Min silence duration:", minSilenceDuration, "s");
            console.log("[CEP] =======================================");

            // FFmpeg analyzes the entire source file
            // We'll filter segments later to only those within clip's used range
            const ffmpegResult = await runFFmpegSilenceDetect(
                seqInfo.sourcePath,
                threshold,
                minSilenceDuration,
                clipOutPoint, // Use outPoint as the duration estimate for progress
                (percent, currentTime, remaining) => {
                    if (onProgress) {
                        let remainStr = "";
                        if (remaining > 0) {
                            const mins = Math.floor(remaining / 60);
                            const secs = remaining % 60;
                            if (mins > 0) {
                                remainStr = `残り約${mins}分${secs > 0 ? secs + "秒" : ""}`;
                            } else {
                                remainStr = `残り約${secs}秒`;
                            }
                        }
                        onProgress("analyze", percent, remaining, `音声を解析中... ${percent}% ${remainStr}`);
                    }
                }
            );

            console.log("[CEP] ========== FFmpeg Result ==========");
            console.log("[CEP] Success:", ffmpegResult.success);
            console.log("[CEP] Raw segments found:", ffmpegResult.segments.length);

            // Log all detected segments
            if (ffmpegResult.segments.length > 0) {
                console.log("[CEP] All detected silence segments (in source file time):");
                let totalSilenceDetected = 0;
                for (let i = 0; i < ffmpegResult.segments.length; i++) {
                    const seg = ffmpegResult.segments[i];
                    console.log(`[CEP]   ${i+1}: ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s (${seg.duration.toFixed(2)}s)`);
                    totalSilenceDetected += seg.duration;
                }
                console.log(`[CEP] Total silence detected: ${totalSilenceDetected.toFixed(2)}s`);
            }

            if (!ffmpegResult.success || ffmpegResult.segments.length === 0) {
                return {
                    success: true,
                    segmentsFound: 0,
                    segmentsProcessed: 0,
                    originalDuration: originalDuration,
                    newDuration: originalDuration,
                    savedPercent: 0,
                    message: "無音区間が検出されませんでした"
                };
            }

            // ============================================
            // Step 3: Filter and adjust segments
            // ============================================
            console.log("[CEP] ========== Segment Filtering ==========");
            console.log("[CEP] Source file range used: " + clipInPoint.toFixed(2) + "s - " + clipOutPoint.toFixed(2) + "s");

            // IMPORTANT: First filter to only segments within the clip's source range
            // FFmpeg times are in SOURCE FILE time
            const filteredSegments = ffmpegResult.segments.filter(seg => {
                // Segment must overlap with the clip's used portion of source
                const overlapStart = Math.max(seg.start, clipInPoint);
                const overlapEnd = Math.min(seg.end, clipOutPoint);

                if (overlapEnd <= overlapStart) {
                    console.log(`[CEP]   SKIP (outside clip range): ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s`);
                    return false;
                }
                return true;
            });

            console.log(`[CEP] Segments within clip range: ${filteredSegments.length} / ${ffmpegResult.segments.length}`);

            // Now adjust timestamps: convert from source file time to sequence time
            // Formula: sequenceTime = clipStartInSequence + (sourceTime - clipInPoint)
            const adjustedSegments = filteredSegments.map(seg => {
                // Clamp segment to clip's source range
                const clampedStart = Math.max(seg.start, clipInPoint);
                const clampedEnd = Math.min(seg.end, clipOutPoint);

                // Convert to sequence time
                const seqStart = clipStartInSequence + (clampedStart - clipInPoint);
                const seqEnd = clipStartInSequence + (clampedEnd - clipInPoint);

                return {
                    start: seqStart,
                    end: seqEnd,
                    duration: seqEnd - seqStart,
                    // Keep original for debugging
                    _sourceStart: clampedStart,
                    _sourceEnd: clampedEnd
                };
            }).filter(seg => {
                // Final validation
                if (seg.duration < 0.1) {
                    console.log(`[CEP]   SKIP (too short after adjustment): ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s (${seg.duration.toFixed(2)}s)`);
                    return false;
                }
                if (seg.start < 0) {
                    console.log(`[CEP]   SKIP (negative start): ${seg.start.toFixed(2)}s`);
                    return false;
                }
                return true;
            });

            console.log("[CEP] Adjusted segments (first 5):");
            for (let i = 0; i < Math.min(5, adjustedSegments.length); i++) {
                const seg = adjustedSegments[i];
                console.log(`[CEP]   ${i+1}: ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s (${seg.duration.toFixed(2)}s) [source: ${seg._sourceStart.toFixed(2)}s - ${seg._sourceEnd.toFixed(2)}s]`);
            }
            if (adjustedSegments.length > 5) {
                console.log(`[CEP]   ... and ${adjustedSegments.length - 5} more`);
            }
            console.log("[CEP] ==========================================");

            if (adjustedSegments.length === 0) {
                return {
                    success: true,
                    segmentsFound: ffmpegResult.segments.length,
                    segmentsProcessed: 0,
                    originalDuration: originalDuration,
                    newDuration: originalDuration,
                    savedPercent: 0,
                    message: "クリップ範囲内に有効な無音区間がありませんでした"
                };
            }

            // ============================================
            // Step 4: Safety checks
            // ============================================
            let totalSilenceDuration = 0;
            for (const seg of adjustedSegments) {
                // Account for padding
                const paddingBefore = options.paddingBefore || 0.2;
                const paddingAfter = options.paddingAfter || 0.2;
                const effectiveDuration = seg.duration - paddingBefore - paddingAfter;
                if (effectiveDuration > 0) {
                    totalSilenceDuration += effectiveDuration;
                }
            }

            const silencePercent = (totalSilenceDuration / originalDuration) * 100;

            console.log("[CEP] ========== Safety Check ==========");
            console.log("[CEP] Total silence to delete: " + totalSilenceDuration.toFixed(2) + "s");
            console.log("[CEP] Original duration: " + originalDuration.toFixed(2) + "s");
            console.log("[CEP] Silence percentage: " + silencePercent.toFixed(1) + "%");

            // SAFETY CHECK 1: Very few segments covering most of the video
            if (adjustedSegments.length <= 2 && silencePercent > 50 && options.silenceAction === "delete") {
                console.error("[CEP] SAFETY STOP: Only " + adjustedSegments.length + " segment(s) covering " + silencePercent.toFixed(1) + "% - likely wrong detection!");
                return {
                    success: false,
                    error: "安全停止: " + adjustedSegments.length + "個のセグメントで動画の" + silencePercent.toFixed(0) + "%をカバー。\n" +
                           "正常な無音検出ではありません。\n" +
                           "音声ファイルに問題がある可能性があります。",
                    segmentsFound: adjustedSegments.length,
                    silencePercent: silencePercent,
                    threshold: threshold
                };
            }

            // SAFETY CHECK 2: More than 80% would be deleted
            if (silencePercent > 80 && options.silenceAction === "delete") {
                console.error("[CEP] SAFETY STOP: Would delete " + silencePercent.toFixed(1) + "% of content!");
                return {
                    success: false,
                    error: "安全停止: 動画の" + silencePercent.toFixed(0) + "%が削除されようとしています。\n" +
                           "閾値(しきいち)の設定を確認してください。\n" +
                           "現在の閾値: " + threshold + "dB\n" +
                           "より低い値（例: -50dB）を試してください。",
                    segmentsFound: adjustedSegments.length,
                    silencePercent: silencePercent,
                    threshold: threshold
                };
            }

            // SAFETY CHECK 3: Would delete entire clip
            if (totalSilenceDuration >= originalDuration * 0.95 && options.silenceAction === "delete") {
                console.error("[CEP] SAFETY STOP: Would delete almost entire clip!");
                return {
                    success: false,
                    error: "安全停止: ほぼ全てのコンテンツが削除されようとしています。\n" +
                           "音声トラックが無音になっていないか確認してください。",
                    segmentsFound: adjustedSegments.length,
                    silencePercent: silencePercent,
                    threshold: threshold
                };
            }
            console.log("[CEP] Safety checks passed ✓");
            console.log("[CEP] ====================================");

            // ============================================
            // Step 5: Send to ExtendScript for processing
            // ============================================
            if (onProgress) onProgress("cut", 0, null, `${adjustedSegments.length}箇所の無音をカット中...`);

            // Clean up segments for ExtendScript (remove debug properties)
            const cleanSegments = adjustedSegments.map(seg => ({
                start: seg.start,
                end: seg.end,
                duration: seg.duration
            }));

            const processOptions = {
                segments: cleanSegments,
                paddingBefore: options.paddingBefore || 0.2,
                paddingAfter: options.paddingAfter || 0.2,
                silenceAction: options.silenceAction || "delete",
                // Pass original duration to ExtendScript for validation
                expectedOriginalDuration: originalDuration
            };

            console.log("[CEP] Calling ExtendScript processSegments...");
            console.log("[CEP] Segments to process: " + cleanSegments.length);

            const result = await callExtendScript("processSegments", [JSON.stringify(processOptions)]);

            console.log("[CEP] processSegments result:", JSON.stringify(result, null, 2));

            if (onProgress) onProgress("done", 100, 0, "完了！");

            // Ensure result has valid duration values
            if (result && result.success) {
                // Use our calculated originalDuration if ExtendScript returned 0
                if (!result.originalDuration || result.originalDuration === 0) {
                    result.originalDuration = originalDuration;
                }
                // Calculate newDuration and savedPercent if not present
                if (result.newDuration === undefined) {
                    result.newDuration = result.originalDuration - totalSilenceDuration;
                }
                if (result.savedPercent === undefined && result.originalDuration > 0) {
                    result.savedPercent = ((result.originalDuration - result.newDuration) / result.originalDuration) * 100;
                }
            }

            console.log("[CEP] =====================================================");
            console.log("[CEP] processWithOptions END");
            console.log("[CEP] Final result:", JSON.stringify(result, null, 2));
            console.log("[CEP] =====================================================");

            return result;

        } catch (e) {
            console.error("[CEP] processWithOptions error:", e);
            console.error("[CEP] Error stack:", e.stack);
            throw e;
        }
    }

    /**
     * Add markers at silence positions
     * @param {array} segments - Silence segments
     */
    async function addMarkers(segments) {
        const segmentsJson = JSON.stringify(segments);
        return callExtendScript("addSilenceMarkers", [segmentsJson]);
    }

    /**
     * Clear all markers
     */
    async function clearMarkers() {
        return callExtendScript("clearAllMarkers");
    }

    /**
     * Get audio levels for waveform visualization
     * @param {number} numSamples - Number of samples to return
     */
    async function getAudioLevels(numSamples = 100) {
        return callExtendScript("getAudioLevels", [numSamples]);
    }

    /**
     * Full processing workflow (legacy)
     * @param {object} options - Processing options
     */
    async function processSequence(options) {
        const {
            threshold = -30,
            minDuration = 0.5,
            margin = 0.1,
            addMarkers = true
        } = options;

        return callExtendScript("processSequence", [
            threshold,
            minDuration,
            margin,
            addMarkers
        ]);
    }

    /**
     * Open URL in default browser
     * @param {string} url - URL to open
     */
    function openURL(url) {
        console.log("[CEP] Opening URL:", url);

        // Method 1: Use cep.util (most reliable in CEP)
        if (typeof cep !== "undefined" && cep.util && cep.util.openURLInDefaultBrowser) {
            console.log("[CEP] Using cep.util.openURLInDefaultBrowser");
            cep.util.openURLInDefaultBrowser(url);
            return;
        }

        // Method 2: Use CSInterface
        if (csInterface && typeof csInterface.openURLInDefaultBrowser === "function") {
            console.log("[CEP] Using csInterface.openURLInDefaultBrowser");
            csInterface.openURLInDefaultBrowser(url);
            return;
        }

        // Method 3: Use window.__adobe_cep__
        if (window.__adobe_cep__ && window.__adobe_cep__.invokeSync) {
            console.log("[CEP] Using __adobe_cep__.invokeSync");
            try {
                window.__adobe_cep__.invokeSync("openURLInDefaultBrowser", url);
                return;
            } catch (e) {
                console.error("[CEP] invokeSync failed:", e);
            }
        }

        // Method 4: Fallback for browser testing
        console.log("[CEP] Using window.open fallback");
        window.open(url, "_blank");
    }

    /**
     * Get extension path
     */
    function getExtensionPath() {
        if (csInterface) {
            return csInterface.getSystemPath(CSInterface.EXTENSION_PATH);
        }
        return "";
    }

    /**
     * Check if running in CEP environment
     */
    function isInCEP() {
        return !!window.__adobe_cep__;
    }

    /**
     * Test ExtendScript loading
     */
    async function testExtendScript() {
        console.log("[CEP] Testing ExtendScript...");
        const result = await callExtendScript("testExtendScript");
        console.log("[CEP] testExtendScript result:", result);
        return result;
    }

    /**
     * Full debug test - tests entire silence detection flow
     */
    async function debugFullTest() {
        console.log("[CEP] Running full debug test...");
        const result = await callExtendScript("debugFullTest");
        console.log("[CEP] debugFullTest result:", result);
        return result;
    }

    // Public API
    return {
        init: init,
        getActiveSequence: getActiveSequence,
        detectSilence: detectSilence,
        previewSilence: previewSilence,
        previewWithOptions: previewWithOptions,
        cutSilence: cutSilence,
        processWithOptions: processWithOptions,
        addMarkers: addMarkers,
        clearMarkers: clearMarkers,
        getAudioLevels: getAudioLevels,
        processSequence: processSequence,
        openURL: openURL,
        getExtensionPath: getExtensionPath,
        isInCEP: isInCEP,
        callExtendScript: callExtendScript,
        testExtendScript: testExtendScript,
        debugFullTest: debugFullTest
    };
})();
