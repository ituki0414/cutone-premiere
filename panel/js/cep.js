/**
 * CutOne - CEP Communication Layer
 * Version 5.0 - DaVinci Resolve-style implementation
 *
 * Key improvement: Analyze audio levels first, then set relative threshold
 */

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const CEP = (function() {
    let csInterface = null;
    let _isProcessing = false; // Guard against multiple concurrent calls
    let _processCallCount = 0; // Track call count for debugging
    let _lastProcessTime = 0; // Timestamp of last process completion
    const COOLDOWN_MS = 2000; // 2 second cooldown between processes
    let _currentCallId = 0; // Unique ID for each ExtendScript call

    function init() {
        console.log("[CEP] Initializing...");
        try {
            csInterface = new CSInterface();
            console.log("[CEP] CSInterface OK");
            return csInterface;
        } catch (e) {
            console.error("[CEP] Init failed:", e);
            return null;
        }
    }

    function cepPathToFs(cepPath) {
        let fsPath = cepPath.replace(/^file:\/\//, "").replace(/^file:/, "");
        fsPath = decodeURIComponent(fsPath);
        if (!fsPath.startsWith("/") && !fsPath.match(/^[A-Za-z]:/)) {
            fsPath = "/" + fsPath;
        }
        return fsPath;
    }

    function getFFmpegPath() {
        const extPath = cepPathToFs(csInterface.getSystemPath("extension"));
        const isMac = navigator.platform.toLowerCase().includes("mac");
        const ffmpegName = isMac ? "ffmpeg-mac" : "ffmpeg-win.exe";
        return path.join(extPath, "bin", ffmpegName);
    }

    /**
     * Step 1: Analyze audio levels using FFmpeg volumedetect
     * This is what DaVinci Resolve does - analyze first, then detect
     */
    function analyzeAudioLevels(audioPath, totalDuration, onProgress) {
        return new Promise((resolve, reject) => {
            const ffmpegPath = getFFmpegPath();
            console.log("[CEP] Analyzing audio levels...");

            const isMac = navigator.platform.toLowerCase().includes("mac");
            const nullDev = isMac ? "/dev/null" : "NUL";

            const args = [
                "-i", audioPath,
                "-af", "volumedetect",
                "-f", "null",
                nullDev
            ];

            const ffmpeg = childProcess.spawn(ffmpegPath, args);
            let stderr = "";
            const startTime = Date.now();

            ffmpeg.stderr.on("data", (data) => {
                const chunk = data.toString();
                stderr += chunk;

                // Parse progress from FFmpeg output
                const timeMatch = chunk.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                if (timeMatch && totalDuration > 0 && onProgress) {
                    const hours = parseInt(timeMatch[1]);
                    const mins = parseInt(timeMatch[2]);
                    const secs = parseInt(timeMatch[3]);
                    const currentTime = hours * 3600 + mins * 60 + secs;
                    const percent = Math.min(99, Math.round((currentTime / totalDuration) * 100));

                    // Estimate remaining time
                    const elapsedMs = Date.now() - startTime;
                    const estimatedTotalMs = percent > 0 ? (elapsedMs / percent) * 100 : 0;
                    const estimatedRemainingMs = estimatedTotalMs - elapsedMs;
                    const estimatedRemainingSec = Math.max(0, Math.ceil(estimatedRemainingMs / 1000));

                    onProgress(percent, estimatedRemainingSec);
                }
            });

            ffmpeg.on("close", (code) => {
                if (onProgress) onProgress(100, 0);

                // Parse volume info
                const meanMatch = stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
                const maxMatch = stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);

                if (meanMatch && maxMatch) {
                    const meanVolume = parseFloat(meanMatch[1]);
                    const maxVolume = parseFloat(maxMatch[1]);

                    console.log("[CEP] Audio analysis:");
                    console.log("[CEP]   Mean volume: " + meanVolume + " dB");
                    console.log("[CEP]   Max volume: " + maxVolume + " dB");

                    resolve({
                        success: true,
                        meanVolume: meanVolume,
                        maxVolume: maxVolume,
                        hasAudio: true
                    });
                } else {
                    console.log("[CEP] Could not detect audio levels - no audio stream?");
                    resolve({
                        success: false,
                        hasAudio: false,
                        error: "音声ストリームが検出できませんでした"
                    });
                }
            });

            ffmpeg.on("error", (err) => {
                reject(err);
            });
        });
    }

    /**
     * Step 2: Detect silence with calculated threshold
     * Threshold is set relative to the audio's mean volume
     */
    function runFFmpegSilenceDetect(audioPath, threshold, minDuration, totalDuration, onProgress) {
        return new Promise((resolve, reject) => {
            const ffmpegPath = getFFmpegPath();
            console.log("[CEP] Running silence detection...");
            console.log("[CEP]   Threshold: " + threshold + " dB");
            console.log("[CEP]   Min duration: " + minDuration + " s");

            const isMac = navigator.platform.toLowerCase().includes("mac");
            const nullDev = isMac ? "/dev/null" : "NUL";

            const args = [
                "-i", audioPath,
                "-af", `silencedetect=noise=${threshold}dB:d=${minDuration}`,
                "-f", "null",
                nullDev
            ];

            const ffmpeg = childProcess.spawn(ffmpegPath, args);
            let stderr = "";
            const startTime = Date.now();

            ffmpeg.stderr.on("data", (data) => {
                const chunk = data.toString();
                stderr += chunk;

                const timeMatch = chunk.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
                if (timeMatch && totalDuration > 0 && onProgress) {
                    const hours = parseInt(timeMatch[1]);
                    const mins = parseInt(timeMatch[2]);
                    const secs = parseInt(timeMatch[3]);
                    const currentTime = hours * 3600 + mins * 60 + secs;
                    const percent = Math.min(99, Math.round((currentTime / totalDuration) * 100));

                    // Estimate remaining time
                    const elapsedMs = Date.now() - startTime;
                    const estimatedTotalMs = percent > 0 ? (elapsedMs / percent) * 100 : 0;
                    const estimatedRemainingMs = estimatedTotalMs - elapsedMs;
                    const estimatedRemainingSec = Math.max(0, Math.ceil(estimatedRemainingMs / 1000));

                    onProgress(percent, estimatedRemainingSec);
                }
            });

            ffmpeg.on("close", (code) => {
                if (onProgress) onProgress(100, 0);

                const segments = parseSilenceOutput(stderr);
                console.log("[CEP] Detected " + segments.length + " silence segments");

                // Log all segments for debugging
                for (let i = 0; i < segments.length; i++) {
                    const seg = segments[i];
                    console.log(`[CEP]   ${i+1}: ${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s (${seg.duration.toFixed(2)}s)`);
                }

                resolve({
                    success: true,
                    segments: segments
                });
            });

            ffmpeg.on("error", (err) => {
                reject(err);
            });
        });
    }

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

    function callExtendScript(functionName, args = []) {
        return new Promise((resolve, reject) => {
            if (!csInterface) {
                reject(new Error("CSInterface not initialized"));
                return;
            }

            const argsStr = args.map(arg => {
                if (typeof arg === "string") {
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

            // Generate unique call ID
            _currentCallId++;
            const thisCallId = _currentCallId;
            console.log("[CEP] Calling:", functionName, "(callId:", thisCallId + ")");

            // CRITICAL: Guard against multiple callback invocations
            let hasResolved = false;

            csInterface.evalScript(script, (result) => {
                // Prevent multiple resolutions - callback might be called multiple times!
                if (hasResolved) {
                    console.log("[CEP] !!! BLOCKED duplicate callback for:", functionName, "(callId:", thisCallId + ")");
                    return;
                }
                hasResolved = true;
                console.log("[CEP] Callback received for:", functionName, "(callId:", thisCallId + ")");

                if (result === "EvalScript error.") {
                    reject(new Error("ExtendScript error"));
                    return;
                }

                if (result === "undefined" || result === "" || result === "null") {
                    resolve(null);
                    return;
                }

                try {
                    const parsed = JSON.parse(result);
                    if (parsed.success === false) {
                        reject(new Error(parsed.error || "Unknown error"));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    resolve(result);
                }
            });
        });
    }

    async function getActiveSequence() {
        return callExtendScript("getActiveSequence");
    }

    /**
     * Main processing function - DaVinci Resolve style
     * 1. Get sequence/clip info
     * 2. Analyze audio levels first
     * 3. Calculate appropriate threshold
     * 4. Detect silence
     * 5. Apply cuts
     */
    async function processWithOptions(options, onProgress) {
        _processCallCount++;
        const callId = _processCallCount;

        console.log("[CEP] ############################################");
        console.log("[CEP] ### processWithOptions CALL #" + callId + " ###");
        console.log("[CEP] ############################################");

        // CRITICAL: Prevent multiple concurrent calls
        if (_isProcessing) {
            console.log("[CEP] !!! BLOCKED - Already processing (call #" + callId + ") !!!");
            return {
                success: false,
                error: "処理中です。完了までお待ちください。",
                blocked: true
            };
        }

        // CRITICAL: Prevent rapid sequential calls (cooldown period)
        const now = Date.now();
        const timeSinceLastProcess = now - _lastProcessTime;
        if (_lastProcessTime > 0 && timeSinceLastProcess < COOLDOWN_MS) {
            console.log("[CEP] !!! BLOCKED - Cooldown active (call #" + callId + ", " + timeSinceLastProcess + "ms since last) !!!");
            return {
                success: false,
                error: "処理が完了したばかりです。少々お待ちください。",
                blocked: true
            };
        }

        _isProcessing = true;
        console.log("[CEP] _isProcessing = true (call #" + callId + ")");

        try {
            // Step 1: Get sequence info
            if (onProgress) onProgress("init", 0, null, "シーケンス情報を取得中...");

            const seqInfo = await callExtendScript("getSequenceInfo");
            console.log("[CEP] Sequence info:", JSON.stringify(seqInfo, null, 2));

            if (!seqInfo || !seqInfo.sourcePath) {
                throw new Error("シーケンス情報を取得できませんでした");
            }

            const clipStartInSequence = seqInfo.clipStartInSequence || 0;
            const clipEndInSequence = seqInfo.clipEndInSequence || seqInfo.duration || 0;
            const clipInPoint = seqInfo.clipInPoint || 0;
            const clipOutPoint = seqInfo.clipOutPoint || clipEndInSequence;
            const originalDuration = clipEndInSequence - clipStartInSequence;

            console.log("[CEP] Clip timing:");
            console.log("[CEP]   Sequence: " + clipStartInSequence.toFixed(2) + " - " + clipEndInSequence.toFixed(2));
            console.log("[CEP]   Source: " + clipInPoint.toFixed(2) + " - " + clipOutPoint.toFixed(2));
            console.log("[CEP]   Duration: " + originalDuration.toFixed(2) + "s");

            if (originalDuration <= 0) {
                throw new Error("シーケンスの長さが0です");
            }

            // Step 2: Analyze audio levels (DaVinci Resolve's approach)
            if (onProgress) onProgress("analyze", 10, null, "音声レベルを分析中... 0%");

            const audioAnalysis = await analyzeAudioLevels(
                seqInfo.sourcePath,
                clipOutPoint,
                (percent, remainingSec) => {
                    let timeStr = "";
                    if (remainingSec > 60) {
                        const mins = Math.floor(remainingSec / 60);
                        const secs = remainingSec % 60;
                        timeStr = ` 残り約${mins}分${secs}秒`;
                    } else if (remainingSec > 0) {
                        timeStr = ` 残り約${remainingSec}秒`;
                    }
                    const adjustedPercent = 10 + Math.round(percent * 0.1); // 10-20%
                    if (onProgress) onProgress("analyze", adjustedPercent, null, `音声レベルを分析中... ${percent}%${timeStr}`);
                }
            );

            if (!audioAnalysis.hasAudio) {
                throw new Error("音声トラックがありません。クリップに音声が含まれているか確認してください。");
            }

            // Step 3: Calculate appropriate threshold based on audio levels
            // DaVinci Resolve uses relative thresholds
            const userThreshold = options.threshold || -35;
            let effectiveThreshold;

            // If mean volume is very low, adjust threshold
            if (audioAnalysis.meanVolume < -40) {
                // Audio is quiet - use threshold relative to mean
                effectiveThreshold = audioAnalysis.meanVolume - 15;
                console.log("[CEP] Audio is quiet (mean: " + audioAnalysis.meanVolume + "dB)");
                console.log("[CEP] Adjusting threshold to: " + effectiveThreshold + "dB");
            } else {
                effectiveThreshold = userThreshold;
                console.log("[CEP] Using user threshold: " + effectiveThreshold + "dB");
            }

            // Step 4: Run silence detection
            if (onProgress) onProgress("analyze", 20, null, "無音区間を検出中... 0%");

            const minSilenceDuration = options.minSilenceDuration || 0.3;

            const ffmpegResult = await runFFmpegSilenceDetect(
                seqInfo.sourcePath,
                effectiveThreshold,
                minSilenceDuration,
                clipOutPoint,
                (percent, remainingSec) => {
                    let timeStr = "";
                    if (remainingSec > 60) {
                        const mins = Math.floor(remainingSec / 60);
                        const secs = remainingSec % 60;
                        timeStr = ` 残り約${mins}分${secs}秒`;
                    } else if (remainingSec > 0) {
                        timeStr = ` 残り約${remainingSec}秒`;
                    }
                    const adjustedPercent = 20 + Math.round(percent * 0.6);
                    if (onProgress) onProgress("analyze", adjustedPercent, null, `無音区間を検出中... ${percent}%${timeStr}`);
                }
            );

            if (ffmpegResult.segments.length === 0) {
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

            // Step 5: Convert segments from source time to sequence time
            console.log("[CEP] Converting segments to sequence time...");

            const adjustedSegments = ffmpegResult.segments
                .filter(seg => {
                    // Must overlap with clip's source range
                    return seg.end > clipInPoint && seg.start < clipOutPoint;
                })
                .map(seg => {
                    // Clamp to clip range
                    const clampedStart = Math.max(seg.start, clipInPoint);
                    const clampedEnd = Math.min(seg.end, clipOutPoint);

                    // Convert to sequence time
                    const seqStart = clipStartInSequence + (clampedStart - clipInPoint);
                    const seqEnd = clipStartInSequence + (clampedEnd - clipInPoint);

                    return {
                        start: seqStart,
                        end: seqEnd,
                        duration: seqEnd - seqStart
                    };
                })
                .filter(seg => seg.duration >= 0.1);

            console.log("[CEP] Adjusted segments: " + adjustedSegments.length);

            if (adjustedSegments.length === 0) {
                return {
                    success: true,
                    segmentsFound: ffmpegResult.segments.length,
                    segmentsProcessed: 0,
                    originalDuration: originalDuration,
                    newDuration: originalDuration,
                    savedPercent: 0,
                    message: "有効な無音区間がありませんでした"
                };
            }

            // Log what we're about to cut
            let totalSilence = 0;
            for (const seg of adjustedSegments) {
                totalSilence += seg.duration;
            }
            console.log("[CEP] Total silence to cut: " + totalSilence.toFixed(2) + "s");
            console.log("[CEP] Expected remaining: " + (originalDuration - totalSilence).toFixed(2) + "s");

            // Step 6: Process segments in batches with progress updates
            const BATCH_SIZE = 5; // Process 5 segments at a time for progress updates
            const totalSegments = adjustedSegments.length;
            const silenceAction = options.silenceAction || "delete";
            const paddingBefore = options.paddingBefore || 0.2;
            const paddingAfter = options.paddingAfter || 0.2;

            let processedCount = 0;
            let totalDeletedCount = 0;
            let result = null;
            const batchStartTime = Date.now();

            // Sort segments by start time descending (process from end to start)
            // This is critical to avoid position shifts when deleting
            const sortedSegments = [...adjustedSegments].sort((a, b) => b.start - a.start);

            // Process in batches for progress updates
            const batches = [];
            for (let i = 0; i < sortedSegments.length; i += BATCH_SIZE) {
                batches.push(sortedSegments.slice(i, i + BATCH_SIZE));
            }

            console.log("[CEP] Processing " + totalSegments + " segments in " + batches.length + " batches");

            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];

                // Calculate progress
                const progressPercent = 80 + Math.round((batchIndex / batches.length) * 18); // 80-98%
                const elapsedMs = Date.now() - batchStartTime;
                // Use actual average if available, otherwise estimate 500ms per segment
                const avgTimePerSegment = processedCount > 0 ? elapsedMs / processedCount : 500;
                const remainingSegments = totalSegments - processedCount;
                const estimatedRemainingMs = remainingSegments * avgTimePerSegment;
                const estimatedRemainingSec = Math.max(1, Math.ceil(estimatedRemainingMs / 1000)); // At least 1 second

                // Format remaining time
                let timeStr;
                if (estimatedRemainingSec > 60) {
                    const mins = Math.floor(estimatedRemainingSec / 60);
                    const secs = estimatedRemainingSec % 60;
                    timeStr = `残り約${mins}分${secs}秒`;
                } else {
                    timeStr = `残り約${estimatedRemainingSec}秒`;
                }

                const currentSegmentNum = processedCount + 1;
                const progressMessage = `カット中... ${currentSegmentNum}/${totalSegments}件 (${Math.round((processedCount / totalSegments) * 100)}%) ${timeStr}`;
                if (onProgress) onProgress("cut", progressPercent, null, progressMessage);

                const processOptions = {
                    segments: batch,
                    paddingBefore: paddingBefore,
                    paddingAfter: paddingAfter,
                    silenceAction: silenceAction,
                    batchIndex: batchIndex,
                    totalBatches: batches.length,
                    isLastBatch: batchIndex === batches.length - 1
                };

                result = await callExtendScript("processSegments", [JSON.stringify(processOptions)]);

                if (result && result.segmentsProcessed) {
                    totalDeletedCount += result.segmentsProcessed;
                }
                processedCount += batch.length;
            }

            // Update result with totals
            if (result) {
                result.segmentsFound = totalSegments;
                result.segmentsProcessed = totalDeletedCount;
            }

            console.log("[CEP] Result:", JSON.stringify(result, null, 2));

            // Show ExtendScript debug log if available
            if (result && result.debugLog) {
                console.log("[CEP] === ExtendScript Debug Log ===");
                console.log(result.debugLog);
                console.log("[CEP] === End Debug Log ===");
            }

            if (onProgress) onProgress("done", 100, 0, "完了！");

            if (result && result.success) {
                if (!result.originalDuration || result.originalDuration === 0) {
                    result.originalDuration = originalDuration;
                }
            }

            console.log("[CEP] ############################################");
            console.log("[CEP] ### processWithOptions END (call #" + callId + ") ###");
            console.log("[CEP] ############################################");

            _isProcessing = false;
            _lastProcessTime = Date.now();
            console.log("[CEP] _isProcessing = false, cooldown started (call #" + callId + " complete)");

            return result;

        } catch (e) {
            console.error("[CEP] Error in call #" + callId + ":", e);
            _isProcessing = false;
            _lastProcessTime = Date.now();
            console.log("[CEP] _isProcessing = false, cooldown started (call #" + callId + " error)");
            throw e;
        }
    }

    async function addMarkers(segments) {
        return callExtendScript("addSilenceMarkers", [JSON.stringify(segments)]);
    }

    async function clearMarkers() {
        return callExtendScript("clearAllMarkers");
    }

    async function getAudioLevels(numSamples = 100) {
        return callExtendScript("getAudioLevels", [numSamples]);
    }

    function openURL(url) {
        if (typeof cep !== "undefined" && cep.util && cep.util.openURLInDefaultBrowser) {
            cep.util.openURLInDefaultBrowser(url);
            return;
        }
        if (csInterface && typeof csInterface.openURLInDefaultBrowser === "function") {
            csInterface.openURLInDefaultBrowser(url);
            return;
        }
        window.open(url, "_blank");
    }

    function getExtensionPath() {
        return csInterface ? csInterface.getSystemPath(CSInterface.EXTENSION_PATH) : "";
    }

    function isInCEP() {
        return !!window.__adobe_cep__;
    }

    async function testExtendScript() {
        return callExtendScript("testExtendScript");
    }

    return {
        init,
        getActiveSequence,
        processWithOptions,
        addMarkers,
        clearMarkers,
        getAudioLevels,
        openURL,
        getExtensionPath,
        isInCEP,
        callExtendScript,
        testExtendScript
    };
})();
