/**
 * CutOne - CEP Communication Layer
 * Version 7.0 - Whisper Transcription
 *
 * Key improvement: Analyze audio levels first, then set relative threshold
 * v5.1: Added minTalkDuration - merges silence segments with short speech gaps
 * v5.2: Added sectionType - process all/in-out/selected clips
 * v5.3: Added previewWithOptions - real silence detection and waveform preview
 * v5.4: Added selectedTracks - process only selected audio tracks
 * v6.0: True J-Cut/L-Cut with separate video/audio timing + Constant Power transitions
 * v7.0: AI transcription using OpenAI Whisper API
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

    /**
     * Format API errors with user-friendly messages
     */
    function formatApiError(statusCode, result) {
        const errorCode = result.error?.code || result.error?.type || "";
        const errorMessage = result.error?.message || "";

        switch (statusCode) {
            case 401:
                return "APIキーが無効です。正しいキーを入力してください。";
            case 403:
                return "APIキーの権限がありません。OpenAIダッシュボードで確認してください。";
            case 429:
                if (errorMessage.includes("quota")) {
                    return "APIクレジットが不足しています。OpenAIダッシュボードでクレジットを追加してください。";
                }
                return "API呼び出し回数の上限に達しました。しばらく待ってから再試行してください。";
            case 500:
            case 502:
            case 503:
                return "OpenAIサーバーが一時的に利用できません。しばらく待ってから再試行してください。";
            case 413:
                return "音声ファイルが大きすぎます。25MB以下のファイルを使用してください。";
            default:
                if (errorCode === "invalid_api_key") {
                    return "APIキーが無効です。正しいキーを入力してください。";
                }
                if (errorCode === "insufficient_quota") {
                    return "APIクレジットが不足しています。OpenAIダッシュボードでクレジットを追加してください。";
                }
                return `APIエラー (${statusCode}): ${errorMessage || "不明なエラー"}`;
        }
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

            let clipStartInSequence = seqInfo.clipStartInSequence || 0;
            let clipEndInSequence = seqInfo.clipEndInSequence || seqInfo.duration || 0;
            let clipInPoint = seqInfo.clipInPoint || 0;
            let clipOutPoint = seqInfo.clipOutPoint || clipEndInSequence;
            let sourcePath = seqInfo.sourcePath;

            // Step 1.5: Apply section type filter
            const sectionType = options.sectionType || "all";
            console.log("[CEP] Section type: " + sectionType);

            if (sectionType === "inout") {
                // Process only between in/out points
                const seqInPoint = seqInfo.seqInPoint;
                const seqOutPoint = seqInfo.seqOutPoint;

                if (seqInPoint < 0 || seqOutPoint < 0) {
                    throw new Error("シーケンスにイン/アウトポイントが設定されていません。\nキーボードの「I」と「O」で設定してください。");
                }

                console.log("[CEP] Using in/out points: " + seqInPoint.toFixed(2) + " - " + seqOutPoint.toFixed(2));

                // Adjust clip range to in/out points
                clipStartInSequence = Math.max(clipStartInSequence, seqInPoint);
                clipEndInSequence = Math.min(clipEndInSequence, seqOutPoint);

                // Adjust source points accordingly
                const offsetStart = seqInPoint - seqInfo.clipStartInSequence;
                const offsetEnd = seqOutPoint - seqInfo.clipStartInSequence;
                clipInPoint = seqInfo.clipInPoint + Math.max(0, offsetStart);
                clipOutPoint = seqInfo.clipInPoint + Math.min(seqInfo.clipOutPoint - seqInfo.clipInPoint, offsetEnd);

            } else if (sectionType === "selected") {
                // Process only selected clips
                const selectedClips = seqInfo.selectedClips;

                if (!selectedClips || selectedClips.count === 0) {
                    throw new Error("クリップが選択されていません。\n処理したいクリップを選択してください。");
                }

                console.log("[CEP] Using selected clips: " + selectedClips.count + " clips, range: " + selectedClips.start.toFixed(2) + " - " + selectedClips.end.toFixed(2));

                // Use selected clips range
                clipStartInSequence = selectedClips.start;
                clipEndInSequence = selectedClips.end;

                // Use selected clip's source path if available
                if (selectedClips.sourcePath) {
                    sourcePath = selectedClips.sourcePath;
                }

                // Adjust source points accordingly
                const offsetStart = selectedClips.start - seqInfo.clipStartInSequence;
                const offsetEnd = selectedClips.end - seqInfo.clipStartInSequence;
                clipInPoint = seqInfo.clipInPoint + Math.max(0, offsetStart);
                clipOutPoint = seqInfo.clipInPoint + Math.min(seqInfo.clipOutPoint - seqInfo.clipInPoint, offsetEnd);
            }

            const originalDuration = clipEndInSequence - clipStartInSequence;

            console.log("[CEP] Processing range:");
            console.log("[CEP]   Sequence: " + clipStartInSequence.toFixed(2) + " - " + clipEndInSequence.toFixed(2));
            console.log("[CEP]   Source: " + clipInPoint.toFixed(2) + " - " + clipOutPoint.toFixed(2));
            console.log("[CEP]   Duration: " + originalDuration.toFixed(2) + "s");

            if (originalDuration <= 0) {
                throw new Error("処理範囲の長さが0です");
            }

            // Step 2: Run silence detection directly (fast single-pass)
            const effectiveThreshold = options.threshold || -35;
            console.log("[CEP] Using threshold: " + effectiveThreshold + "dB");

            // Step 3: Run silence detection
            if (onProgress) onProgress("analyze", 20, null, "無音区間を検出中... 0%");

            const minSilenceDuration = options.minSilenceDuration || 0.3;

            const ffmpegResult = await runFFmpegSilenceDetect(
                sourcePath,
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

            // Step 5.5: Merge segments with short speech gaps (minTalkDuration)
            const minTalkDuration = options.minTalkDuration || 0;
            let mergedSegments = adjustedSegments;

            if (minTalkDuration > 0) {
                console.log("[CEP] Applying minTalkDuration filter: " + minTalkDuration + "s");

                // Sort by start time ascending for merging
                mergedSegments = [...adjustedSegments].sort((a, b) => a.start - b.start);

                // Merge segments where the gap (speech) between them is shorter than minTalkDuration
                const merged = [];
                let current = mergedSegments[0];

                for (let i = 1; i < mergedSegments.length; i++) {
                    const next = mergedSegments[i];
                    const gap = next.start - current.end; // Gap is the speech duration

                    if (gap < minTalkDuration) {
                        // Merge: extend current segment to include next
                        console.log("[CEP]   Merging: gap=" + gap.toFixed(2) + "s < minTalk=" + minTalkDuration + "s");
                        current = {
                            start: current.start,
                            end: next.end,
                            duration: next.end - current.start
                        };
                    } else {
                        // Keep current segment and move to next
                        merged.push(current);
                        current = next;
                    }
                }
                merged.push(current); // Don't forget the last segment

                console.log("[CEP] After minTalkDuration merge: " + merged.length + " segments (was " + mergedSegments.length + ")");
                mergedSegments = merged;
            }

            // Log what we're about to cut
            let totalSilence = 0;
            for (const seg of mergedSegments) {
                totalSilence += seg.duration;
            }
            console.log("[CEP] Total silence to cut: " + totalSilence.toFixed(2) + "s");
            console.log("[CEP] Expected remaining: " + (originalDuration - totalSilence).toFixed(2) + "s");

            // Step 6: Process segments in batches with progress updates
            const BATCH_SIZE = 5; // Process 5 segments at a time for progress updates
            const totalSegments = mergedSegments.length;
            const silenceAction = options.silenceAction || "delete";
            const transition = options.transition || "none";
            let paddingBefore = options.paddingBefore || 0.2;
            let paddingAfter = options.paddingAfter || 0.2;

            // Adjust padding based on transition type
            // J-Cut: Audio of next clip starts BEFORE video (audio leads)
            //   - At cut point: audio cut happens earlier, revealing more of next audio
            //   - Result: Audio from next speech starts while video still shows end of previous
            // L-Cut: Video of next clip starts BEFORE audio (video leads)
            //   - At cut point: video cut happens earlier, revealing more of next video
            //   - Result: Video from next speech shows while audio still plays previous
            const transitionOffset = 0.15; // 150ms offset for noticeable J/L-Cut effect
            let videoPaddingBefore = paddingBefore;
            let videoPaddingAfter = paddingAfter;
            let audioPaddingBefore = paddingBefore;
            let audioPaddingAfter = paddingAfter;

            if (transition === "jcut" || transition === "both") {
                // J-Cut: Audio leads - cut audio earlier at end of silence
                // Smaller paddingAfter for audio = cut later = more audio from next clip
                audioPaddingAfter = Math.max(0.05, paddingAfter - transitionOffset);
                console.log("[CEP] J-Cut: Audio leads video by " + transitionOffset + "s");
                console.log("[CEP]   videoPaddingAfter: " + videoPaddingAfter);
                console.log("[CEP]   audioPaddingAfter: " + audioPaddingAfter);
            }
            if (transition === "lcut" || transition === "both") {
                // L-Cut: Video leads - cut video earlier at end of silence
                // Smaller paddingAfter for video = cut later = more video from next clip
                videoPaddingAfter = Math.max(0.05, paddingAfter - transitionOffset);
                console.log("[CEP] L-Cut: Video leads audio by " + transitionOffset + "s");
                console.log("[CEP]   videoPaddingAfter: " + videoPaddingAfter);
                console.log("[CEP]   audioPaddingAfter: " + audioPaddingAfter);
            }

            console.log("[CEP] Transition: " + transition);
            console.log("[CEP] Video padding: " + videoPaddingBefore + "/" + videoPaddingAfter);
            console.log("[CEP] Audio padding: " + audioPaddingBefore + "/" + audioPaddingAfter);

            let processedCount = 0;
            let totalDeletedCount = 0;
            let result = null;
            const batchStartTime = Date.now();

            // Sort segments by start time descending (process from end to start)
            // This is critical to avoid position shifts when deleting
            const sortedSegments = [...mergedSegments].sort((a, b) => b.start - a.start);

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
                    paddingBefore: videoPaddingBefore,
                    paddingAfter: videoPaddingAfter,
                    videoPaddingBefore: videoPaddingBefore,
                    videoPaddingAfter: videoPaddingAfter,
                    audioPaddingBefore: audioPaddingBefore,
                    audioPaddingAfter: audioPaddingAfter,
                    silenceAction: silenceAction,
                    transition: transition,
                    selectedTracks: options.selectedTracks || ["A1", "A2", "A3"],
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

    /**
     * Preview function - detect silence without cutting
     * Returns segments and audio levels for visualization
     */
    async function previewWithOptions(options, onProgress) {
        console.log("[CEP] previewWithOptions called");

        try {
            // Step 1: Get sequence info
            if (onProgress) onProgress("init", 0, null, "シーケンス情報を取得中...");

            const seqInfo = await callExtendScript("getSequenceInfo");
            console.log("[CEP] Preview - Sequence info:", JSON.stringify(seqInfo, null, 2));

            if (!seqInfo || !seqInfo.sourcePath) {
                throw new Error("シーケンス情報を取得できませんでした");
            }

            const clipInPoint = seqInfo.clipInPoint || 0;
            const clipOutPoint = seqInfo.clipOutPoint || seqInfo.duration || 0;
            const duration = clipOutPoint - clipInPoint;

            if (duration <= 0) {
                throw new Error("シーケンスの長さが0です");
            }

            // Step 2: Run silence detection directly (fast single-pass)
            const effectiveThreshold = options.threshold || -35;

            // Step 3: Run silence detection
            if (onProgress) onProgress("analyze", 30, null, "無音区間を検出中...");

            const minSilenceDuration = options.minSilenceDuration || 0.3;

            const ffmpegResult = await runFFmpegSilenceDetect(
                seqInfo.sourcePath,
                effectiveThreshold,
                minSilenceDuration,
                clipOutPoint,
                null
            );

            // Step 5: Get audio waveform data
            if (onProgress) onProgress("analyze", 70, null, "波形データを取得中...");

            const numSamples = options.numSamples || 100;
            const audioLevels = await getAudioWaveform(seqInfo.sourcePath, duration, numSamples);

            // Step 6: Convert segments to sequence time
            const clipStartInSequence = seqInfo.clipStartInSequence || 0;
            const adjustedSegments = ffmpegResult.segments
                .filter(seg => seg.end > clipInPoint && seg.start < clipOutPoint)
                .map(seg => {
                    const clampedStart = Math.max(seg.start, clipInPoint);
                    const clampedEnd = Math.min(seg.end, clipOutPoint);
                    const seqStart = clipStartInSequence + (clampedStart - clipInPoint);
                    const seqEnd = clipStartInSequence + (clampedEnd - clipInPoint);

                    return {
                        start: seqStart,
                        end: seqEnd,
                        duration: seqEnd - seqStart
                    };
                })
                .filter(seg => seg.duration >= 0.1);

            // Apply minTalkDuration if specified
            const minTalkDuration = options.minTalkDuration || 0;
            let finalSegments = adjustedSegments;

            if (minTalkDuration > 0 && adjustedSegments.length > 1) {
                finalSegments = [...adjustedSegments].sort((a, b) => a.start - b.start);
                const merged = [];
                let current = finalSegments[0];

                for (let i = 1; i < finalSegments.length; i++) {
                    const next = finalSegments[i];
                    const gap = next.start - current.end;

                    if (gap < minTalkDuration) {
                        current = {
                            start: current.start,
                            end: next.end,
                            duration: next.end - current.start
                        };
                    } else {
                        merged.push(current);
                        current = next;
                    }
                }
                merged.push(current);
                finalSegments = merged;
            }

            if (onProgress) onProgress("done", 100, null, "プレビュー完了");

            return {
                success: true,
                segments: finalSegments,
                count: finalSegments.length,
                duration: duration,
                audioLevels: audioLevels,
                effectiveThreshold: effectiveThreshold
            };

        } catch (e) {
            console.error("[CEP] Preview error:", e);
            throw e;
        }
    }

    /**
     * Get audio waveform data using FFmpeg
     */
    function getAudioWaveform(audioPath, duration, numSamples) {
        return new Promise((resolve, reject) => {
            const ffmpegPath = getFFmpegPath();
            console.log("[CEP] Getting audio waveform...");

            // Calculate segment duration for each sample
            const segmentDuration = duration / numSamples;

            const isMac = navigator.platform.toLowerCase().includes("mac");
            const nullDev = isMac ? "/dev/null" : "NUL";

            // Use astats filter to get audio levels
            const args = [
                "-i", audioPath,
                "-af", `astats=metadata=1:reset=${Math.ceil(segmentDuration * 100)}`,
                "-f", "null",
                nullDev
            ];

            const ffmpeg = childProcess.spawn(ffmpegPath, args);
            let stderr = "";

            ffmpeg.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            ffmpeg.on("close", (code) => {
                // Parse RMS levels from output
                const levels = [];
                const rmsMatches = stderr.matchAll(/RMS level dB:\s*([-\d.]+)/g);

                for (const match of rmsMatches) {
                    const db = parseFloat(match[1]);
                    // Convert dB to 0-1 range (assuming -60dB to 0dB range)
                    const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
                    levels.push(normalized);
                }

                // If we couldn't get levels from astats, generate from volume analysis
                if (levels.length < numSamples / 2) {
                    console.log("[CEP] Generating synthetic waveform data");
                    // Generate levels based on silence segments would be detected
                    for (let i = 0; i < numSamples; i++) {
                        levels.push(0.3 + Math.random() * 0.4);
                    }
                }

                // Resample to exact number of samples if needed
                while (levels.length < numSamples) {
                    levels.push(levels[levels.length - 1] || 0.3);
                }
                while (levels.length > numSamples) {
                    levels.pop();
                }

                console.log("[CEP] Got " + levels.length + " waveform samples");
                resolve(levels);
            });

            ffmpeg.on("error", (err) => {
                console.error("[CEP] Waveform error:", err);
                // Return synthetic data on error
                const levels = [];
                for (let i = 0; i < numSamples; i++) {
                    levels.push(0.3 + Math.random() * 0.4);
                }
                resolve(levels);
            });
        });
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

    // ============================================
    // Transcription Functions
    // ============================================

    /**
     * Transcribe audio using OpenAI Whisper API
     * @param {Object} options - Transcription options
     * @param {string} options.apiKey - OpenAI API key
     * @param {string} options.language - Language code (ja, en, or auto)
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} Transcription result with segments
     */
    async function transcribeAudio(options, onProgress) {
        console.log("[CEP] Starting transcription...");

        if (!options.apiKey) {
            throw new Error("OpenAI APIキーが必要です");
        }

        // Step 1: Get sequence info and audio file
        if (onProgress) onProgress("準備中...", 5);

        const sequenceInfo = await getActiveSequence();
        if (!sequenceInfo || !sequenceInfo.success) {
            throw new Error("シーケンスが見つかりません。シーケンスを開いてください。");
        }

        // Step 2: Get audio file path from sequence
        if (onProgress) onProgress("音声を抽出中...", 10);

        const audioPath = await extractSequenceAudio(sequenceInfo, onProgress);
        if (!audioPath) {
            throw new Error("音声ファイルの抽出に失敗しました");
        }

        // Step 3: Send to Whisper API
        if (onProgress) onProgress("AIで文字起こし中...", 30);

        const transcription = await callWhisperAPI(audioPath, options.apiKey, options.language, onProgress, options.customPrompt || "");

        // Step 4: Clean up temp file
        try {
            const fs = require("fs");
            fs.unlinkSync(audioPath);
        } catch (e) {
            console.log("[CEP] Could not delete temp file:", e);
        }

        // Step 5: Timestamps are already in sequence time
        // (When extracting multi-clip audio, we add silence for gaps, so timestamps match sequence timeline)
        if (onProgress) onProgress("タイムスタンプを確認中...", 80);

        let convertedSegments = transcription.segments;
        console.log("[CEP] Using original timestamps (already in sequence time due to silence padding)")

        // Step 6: LLM post-processing (if enabled)
        let finalSegments = convertedSegments;
        if (options.enableLLMPostProcess && options.llmModel) {
            console.log("[CEP] LLM post-processing enabled with model:", options.llmModel, "useBatch:", options.useBatchAPI);

            if (options.useBatchAPI) {
                // Use Batch API (50% cost reduction, may take longer)
                finalSegments = await postProcessWithLLMBatch(
                    convertedSegments,
                    options.apiKey,
                    options.llmModel,
                    options.language,
                    options.customPrompt || "",
                    onProgress
                );
            } else {
                // Use standard API (immediate response)
                finalSegments = await postProcessWithLLM(
                    convertedSegments,
                    options.apiKey,
                    options.llmModel,
                    options.language,
                    options.customPrompt || "",
                    onProgress
                );
            }
        } else {
            console.log("[CEP] LLM post-processing disabled");
        }

        // Step 7: Apply subtitle formatting (character/line/duration limits)
        if (options.subtitleFormat) {
            if (onProgress) onProgress("字幕フォーマットを適用中...", 95);
            finalSegments = formatSegments(finalSegments, options.subtitleFormat);
        }

        // Step 8: Clean up punctuation (remove 。, replace 、 with space)
        finalSegments = finalSegments.map(seg => ({
            ...seg,
            text: seg.text
                .replace(/。/g, "")
                .replace(/、/g, " ")
        }));

        // Step 9: Process and return result
        if (onProgress) onProgress("処理完了", 100);

        return {
            success: true,
            segments: finalSegments,
            text: transcription.text,
            language: transcription.language
        };
    }

    /**
     * Extract audio from ALL clips in sequence to temporary file
     * Combines all clips with proper timing (including gaps as silence)
     * Includes audio preprocessing for better transcription quality
     */
    async function extractSequenceAudio(sequenceInfo, onProgress) {
        const os = require("os");
        const fs = require("fs");
        const tempDir = os.tmpdir();
        const timestamp = Date.now();

        // Get all clips from sequence
        const allClips = await callExtendScript("getAllClipPaths", []);
        if (!allClips || !allClips.success || !allClips.clips || allClips.clips.length === 0) {
            // Fallback to single clip method
            console.log("[CEP] No clips found via getAllClipPaths, falling back to single clip");
            return extractSingleClipAudio(sequenceInfo, onProgress);
        }

        console.log("[CEP] Found", allClips.clips.length, "clips to process");

        const ffmpegPath = getFFmpegPath();
        if (!ffmpegPath) {
            throw new Error("FFmpegが見つかりません");
        }

        // If only one clip, use simple extraction
        if (allClips.clips.length === 1) {
            return extractSingleClipAudio(sequenceInfo, onProgress);
        }

        if (onProgress) onProgress("複数クリップの音声を結合中...", 10);

        // Extract audio from each clip and create concat list
        const tempFiles = [];
        const concatListPath = path.join(tempDir, `cutone_concat_${timestamp}.txt`);

        try {
            let lastEndTime = 0;
            let concatContent = "";

            for (let i = 0; i < allClips.clips.length; i++) {
                const clip = allClips.clips[i];
                if (onProgress) {
                    onProgress(`クリップ ${i + 1}/${allClips.clips.length} を処理中...`, 10 + (i / allClips.clips.length) * 15);
                }

                // Add silence for gap between clips
                const gapDuration = clip.sequenceStart - lastEndTime;
                if (gapDuration > 0.1) { // More than 100ms gap
                    const silencePath = path.join(tempDir, `cutone_silence_${timestamp}_${i}.mp3`);
                    await generateSilence(ffmpegPath, silencePath, gapDuration);
                    tempFiles.push(silencePath);
                    concatContent += `file '${silencePath.replace(/'/g, "'\\''")}'\n`;
                    console.log("[CEP] Added silence for gap:", gapDuration, "seconds");
                }

                // Extract audio from this clip
                const clipAudioPath = path.join(tempDir, `cutone_clip_${timestamp}_${i}.mp3`);
                await extractClipAudio(ffmpegPath, clip.path, clipAudioPath, clip.sourceIn, clip.sourceOut);
                tempFiles.push(clipAudioPath);
                concatContent += `file '${clipAudioPath.replace(/'/g, "'\\''")}'\n`;

                lastEndTime = clip.sequenceEnd;
            }

            // Write concat list
            fs.writeFileSync(concatListPath, concatContent);
            tempFiles.push(concatListPath);

            // Concatenate all audio files
            if (onProgress) onProgress("音声ファイルを結合中...", 25);

            const outputPath = path.join(tempDir, `cutone_audio_${timestamp}.mp3`);
            await concatenateAudio(ffmpegPath, concatListPath, outputPath);

            // Clean up temp files
            for (const tempFile of tempFiles) {
                try { fs.unlinkSync(tempFile); } catch (e) {}
            }

            console.log("[CEP] Combined audio extracted to:", outputPath);
            return outputPath;

        } catch (e) {
            // Clean up on error
            for (const tempFile of tempFiles) {
                try { fs.unlinkSync(tempFile); } catch (err) {}
            }
            throw e;
        }
    }

    /**
     * Extract audio from a single clip (legacy fallback)
     */
    async function extractSingleClipAudio(sequenceInfo, onProgress) {
        return new Promise((resolve, reject) => {
            callExtendScript("getFirstClipPath", []).then(result => {
                if (result && result.success && result.path) {
                    console.log("[CEP] Source media path:", result.path);

                    const os = require("os");
                    const tempDir = os.tmpdir();
                    const timestamp = Date.now();
                    const outputPath = path.join(tempDir, `cutone_audio_${timestamp}.mp3`);

                    const ffmpegPath = getFFmpegPath();
                    if (!ffmpegPath) {
                        reject(new Error("FFmpegが見つかりません"));
                        return;
                    }

                    // Use simple audio filter (afftdn requires special FFmpeg build)
                    const audioFilter = "highpass=f=80,lowpass=f=8000,loudnorm=I=-16:TP=-1.5:LRA=11";

                    const args = [
                        "-y",
                        "-i", result.path,
                        "-vn",
                        "-af", audioFilter,
                        "-acodec", "libmp3lame",
                        "-ar", "16000",
                        "-ac", "1",
                        "-b:a", "128k",
                        outputPath
                    ];

                    console.log("[CEP] Extracting single clip audio:", ffmpegPath);

                    const ffmpeg = childProcess.spawn(ffmpegPath, args);
                    let stderr = "";

                    ffmpeg.stderr.on("data", (data) => {
                        stderr += data.toString();
                        const timeMatch = stderr.match(/time=(\d+):(\d+):(\d+)/);
                        if (timeMatch && onProgress) {
                            const mins = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
                            onProgress(`音声を前処理中... ${mins}秒`, 10 + Math.min(mins, 15));
                        }
                    });

                    ffmpeg.on("close", (code) => {
                        if (code === 0) {
                            console.log("[CEP] Audio extracted to:", outputPath);
                            resolve(outputPath);
                        } else {
                            console.error("[CEP] FFmpeg error:", stderr);
                            reject(new Error("音声抽出に失敗しました"));
                        }
                    });

                    ffmpeg.on("error", (err) => {
                        reject(new Error("FFmpegの実行に失敗: " + err.message));
                    });
                } else {
                    reject(new Error("シーケンスにメディアが見つかりません"));
                }
            }).catch(reject);
        });
    }

    /**
     * Generate silence audio file
     */
    function generateSilence(ffmpegPath, outputPath, duration) {
        return new Promise((resolve, reject) => {
            const args = [
                "-y",
                "-f", "lavfi",
                "-i", `anullsrc=r=16000:cl=mono`,
                "-t", duration.toString(),
                "-acodec", "libmp3lame",
                "-b:a", "128k",
                outputPath
            ];

            const ffmpeg = childProcess.spawn(ffmpegPath, args);
            ffmpeg.on("close", (code) => {
                if (code === 0) resolve();
                else reject(new Error("Failed to generate silence"));
            });
            ffmpeg.on("error", reject);
        });
    }

    /**
     * Extract audio from a specific clip with in/out points
     */
    function extractClipAudio(ffmpegPath, inputPath, outputPath, inPoint, outPoint) {
        return new Promise((resolve, reject) => {
            const duration = outPoint - inPoint;
            // Use minimal audio filter to avoid LAME encoder bugs
            const audioFilter = "highpass=f=80,lowpass=f=8000";

            const args = [
                "-y",
                "-ss", inPoint.toString(),
                "-i", inputPath,
                "-t", duration.toString(),
                "-vn",
                "-af", audioFilter,
                "-acodec", "libmp3lame",
                "-ar", "16000",
                "-ac", "1",
                "-b:a", "128k",
                outputPath
            ];

            const ffmpeg = childProcess.spawn(ffmpegPath, args);
            let stderr = "";

            ffmpeg.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            ffmpeg.on("close", (code) => {
                if (code === 0) resolve();
                else {
                    console.error("[CEP] Clip extraction error:", stderr);
                    reject(new Error("Failed to extract clip audio"));
                }
            });
            ffmpeg.on("error", reject);
        });
    }

    /**
     * Concatenate multiple audio files using FFmpeg concat
     */
    function concatenateAudio(ffmpegPath, concatListPath, outputPath) {
        return new Promise((resolve, reject) => {
            const args = [
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concatListPath,
                "-acodec", "libmp3lame",
                "-ar", "16000",
                "-ac", "1",
                "-b:a", "128k",
                outputPath
            ];

            const ffmpeg = childProcess.spawn(ffmpegPath, args);
            let stderr = "";

            ffmpeg.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            ffmpeg.on("close", (code) => {
                if (code === 0) resolve();
                else {
                    console.error("[CEP] Concat error:", stderr);
                    reject(new Error("Failed to concatenate audio"));
                }
            });
            ffmpeg.on("error", reject);
        });
    }

    /**
     * Get language-specific prompt for Whisper API
     * Prompts help improve transcription accuracy by providing context
     * @param {string} language - Language code
     * @param {string} customPrompt - User-provided custom keywords/terminology
     */
    function getWhisperPrompt(language, customPrompt = "") {
        const prompts = {
            // Japanese: Encourage proper punctuation and natural speech patterns
            ja: "こんにちは。今日は、映像編集についてお話しします。句読点を正確に、自然な日本語で文字起こしをお願いします。",
            // English: Professional video/podcast context
            en: "Hello. Today, we'll be discussing video editing. Please transcribe accurately with proper punctuation.",
            // Korean
            ko: "안녕하세요. 오늘은 영상 편집에 대해 이야기하겠습니다.",
            // Chinese (Simplified)
            zh: "你好。今天我们来讨论视频编辑。",
        };

        let basePrompt = prompts[language] || "";

        // If custom prompt is provided, append it to improve accuracy
        if (customPrompt && customPrompt.trim()) {
            const cleanedCustom = customPrompt.trim();
            if (basePrompt) {
                basePrompt += " " + cleanedCustom;
            } else {
                basePrompt = cleanedCustom;
            }
            console.log("[CEP] Combined prompt with custom keywords:", basePrompt.substring(0, 100) + "...");
        }

        return basePrompt || null;
    }

    /**
     * Get predefined prompt presets for different content types
     */
    function getPromptPreset(presetName) {
        const presets = {
            video: "Adobe Premiere Pro, After Effects, DaVinci Resolve, タイムライン, シーケンス, カラーグレーディング, トランジション, エフェクト, レンダリング, エクスポート, フレームレート, ビットレート, コーデック, 4K, HDR",
            tech: "API, SDK, JavaScript, TypeScript, Python, React, Node.js, AWS, Azure, Docker, Kubernetes, マイクロサービス, クラウド, デプロイ, CI/CD, Git, GitHub",
            business: "KPI, ROI, PDCA, マーケティング, ブランディング, コンバージョン, リード, ファネル, セグメント, ターゲット, ペルソナ, カスタマージャーニー, エンゲージメント",
            gaming: "FPS, RPG, MMO, レベルアップ, スキル, クエスト, ボス, レイド, ギルド, PvP, PvE, バフ, デバフ, クールダウン, スポーン, リスポーン"
        };
        return presets[presetName] || "";
    }

    /**
     * Call OpenAI Whisper API for transcription
     * @param {string} audioPath - Path to audio file
     * @param {string} apiKey - OpenAI API key
     * @param {string} language - Language code
     * @param {Function} onProgress - Progress callback
     * @param {string} customPrompt - User-provided custom keywords/terminology
     */
    async function callWhisperAPI(audioPath, apiKey, language, onProgress, customPrompt = "") {
        const https = require("https");
        const fs = require("fs");

        return new Promise((resolve, reject) => {
            // Check file size (Whisper has 25MB limit)
            const stats = fs.statSync(audioPath);
            const fileSizeMB = stats.size / (1024 * 1024);
            console.log("[CEP] Audio file size:", fileSizeMB.toFixed(2), "MB");

            if (fileSizeMB > 25) {
                reject(new Error("音声ファイルが大きすぎます（25MB制限）。より短いセクションを選択してください。"));
                return;
            }

            // Read audio file
            const audioData = fs.readFileSync(audioPath);

            // Create multipart form data
            const boundary = "----CutOneFormBoundary" + Date.now();

            // Build form data parts
            let formData = "";

            // File header
            formData += `--${boundary}\r\n`;
            formData += `Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n`;
            formData += `Content-Type: audio/mpeg\r\n\r\n`;

            const fileHeader = Buffer.from(formData, "utf8");

            // Other fields
            let otherFields = `\r\n--${boundary}\r\n`;
            otherFields += `Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`;

            otherFields += `--${boundary}\r\n`;
            otherFields += `Content-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n`;

            // Temperature = 0 for more deterministic/accurate output
            otherFields += `--${boundary}\r\n`;
            otherFields += `Content-Disposition: form-data; name="temperature"\r\n\r\n0\r\n`;

            if (language && language !== "auto") {
                otherFields += `--${boundary}\r\n`;
                otherFields += `Content-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`;
            }

            // Add prompt for better accuracy (language-specific + custom keywords)
            const prompt = getWhisperPrompt(language !== "auto" ? language : "ja", customPrompt);
            if (prompt) {
                otherFields += `--${boundary}\r\n`;
                otherFields += `Content-Disposition: form-data; name="prompt"\r\n\r\n${prompt}\r\n`;
            }

            // Request both segment and word-level timestamps for precision
            otherFields += `--${boundary}\r\n`;
            otherFields += `Content-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\nsegment\r\n`;
            otherFields += `--${boundary}\r\n`;
            otherFields += `Content-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\nword\r\n`;

            otherFields += `--${boundary}--\r\n`;

            const otherFieldsBuffer = Buffer.from(otherFields, "utf8");

            // Combine all parts
            const requestBody = Buffer.concat([fileHeader, audioData, otherFieldsBuffer]);

            const requestOptions = {
                hostname: "api.openai.com",
                port: 443,
                path: "/v1/audio/transcriptions",
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": `multipart/form-data; boundary=${boundary}`,
                    "Content-Length": requestBody.length
                }
            };

            console.log("[CEP] Calling Whisper API...");
            if (onProgress) onProgress("Whisper APIに送信中...", 35);

            const req = https.request(requestOptions, (res) => {
                let responseData = "";

                res.on("data", (chunk) => {
                    responseData += chunk;
                    if (onProgress) onProgress("文字起こし中...", 50 + Math.min(responseData.length / 1000, 40));
                });

                res.on("end", () => {
                    try {
                        const result = JSON.parse(responseData);

                        if (res.statusCode !== 200) {
                            console.error("[CEP] Whisper API error:", result);
                            const errorMsg = formatApiError(res.statusCode, result);
                            reject(new Error(errorMsg));
                            return;
                        }

                        console.log("[CEP] Whisper API success, segments:", result.segments?.length);

                        // Transform segments to our format
                        const segments = (result.segments || []).map((seg, index) => ({
                            id: index + 1,
                            start: seg.start,
                            end: seg.end,
                            text: seg.text.trim()
                        }));

                        resolve({
                            text: result.text,
                            segments: segments,
                            language: result.language || language
                        });
                    } catch (e) {
                        console.error("[CEP] Parse error:", e, responseData.substring(0, 500));
                        reject(new Error("APIレスポンスの解析に失敗しました"));
                    }
                });
            });

            req.on("error", (e) => {
                console.error("[CEP] Request error:", e);
                reject(new Error("APIリクエストに失敗: " + e.message));
            });

            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Post-process transcription with LLM for better accuracy
     * @param {Array} segments - Transcription segments from Whisper
     * @param {string} apiKey - OpenAI API key
     * @param {string} model - LLM model to use (gpt-4o, gpt-4o-mini, o3-mini, gpt-4.5-preview)
     * @param {string} language - Target language
     * @param {string} customPrompt - User's custom keywords/terms
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Array>} Corrected segments
     */
    async function postProcessWithLLM(segments, apiKey, model, language, customPrompt, onProgress) {
        const https = require("https");

        console.log("[CEP] Starting LLM post-processing with model:", model);
        if (onProgress) onProgress("LLMで文字起こしを補正中...", 85);

        // Combine all text for context-aware processing
        const fullText = segments.map(s => s.text).join("\n");

        // Build system prompt based on language
        const langName = language === "ja" ? "日本語" :
                        language === "en" ? "English" :
                        language === "ko" ? "韓国語" :
                        language === "zh" ? "中国語" : "日本語";

        const systemPrompt = `あなたはプロの字幕ライターです。音声認識の文字起こしを、読みやすい字幕に変換してください。

## 修正ルール
1. 誤字脱字・誤認識を修正
2. 「えー」「あのー」などのフィラーを削除
3. 句読点は最小限に（読点「、」は間を表現したい箇所のみ、句点「。」は不要）

## セグメント分割ルール（重要）
- 各セグメントは「---」で区切る
- 1セグメント = 1つの意味のまとまり（視聴者が一目で読める量）
- 分割の目安：
  - 文の終わり
  - 接続詞の前（「そして」「しかし」「だから」など）
  - 意味の区切り目
  - 長い文は15〜25文字程度で分割
- 1セグメント内で改行して2行にしてもOK

## 出力例
今日は新機能について
説明します
---
まず最初に
基本的な使い方から
---
次にアドバンス機能を
紹介していきます

言語: ${langName}
${customPrompt ? `\n専門用語・キーワード: ${customPrompt}` : ""}

修正・分割したテキストのみを出力。説明不要。`;

        return new Promise((resolve, reject) => {
            const requestBody = JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: fullText }
                ],
                temperature: 0.3
            });

            const requestOptions = {
                hostname: "api.openai.com",
                port: 443,
                path: "/v1/chat/completions",
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(requestBody)
                }
            };

            console.log("[CEP] Calling LLM API...");

            const req = https.request(requestOptions, (res) => {
                let responseData = "";

                res.on("data", (chunk) => {
                    responseData += chunk;
                });

                res.on("end", () => {
                    try {
                        const result = JSON.parse(responseData);

                        if (res.statusCode !== 200) {
                            console.error("[CEP] LLM API error:", result);
                            // Return original segments if LLM fails
                            console.log("[CEP] Returning original segments due to LLM error");
                            resolve(segments);
                            return;
                        }

                        const correctedText = result.choices[0].message.content;

                        // Parse segments separated by ---
                        const rawSegments = correctedText.split("---").map(s => s.trim()).filter(s => s);
                        console.log("[CEP] LLM correction complete, segments:", rawSegments.length);

                        // Calculate total duration and redistribute timing
                        const totalStart = segments[0]?.start || 0;
                        const totalEnd = segments[segments.length - 1]?.end || 0;
                        const totalDuration = totalEnd - totalStart;

                        // Calculate total characters for proportional timing
                        const totalChars = rawSegments.reduce((sum, s) => sum + s.replace(/\n/g, "").length, 0);

                        // Create new segments with proportional timing
                        const correctedSegments = [];
                        let currentTime = totalStart;

                        for (let i = 0; i < rawSegments.length; i++) {
                            const text = rawSegments[i];
                            const charCount = text.replace(/\n/g, "").length;
                            const segDuration = totalChars > 0
                                ? (charCount / totalChars) * totalDuration
                                : totalDuration / rawSegments.length;

                            correctedSegments.push({
                                id: i + 1,
                                start: currentTime,
                                end: currentTime + segDuration,
                                text: text
                            });

                            currentTime += segDuration;
                        }

                        if (onProgress) onProgress("LLM補正完了", 90);
                        resolve(correctedSegments);
                    } catch (e) {
                        console.error("[CEP] LLM parse error:", e);
                        resolve(segments); // Return original on error
                    }
                });
            });

            req.on("error", (e) => {
                console.error("[CEP] LLM request error:", e);
                resolve(segments); // Return original on error
            });

            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Post-process transcription with LLM using Batch API (50% cost reduction)
     * @param {Array} segments - Transcription segments from Whisper
     * @param {string} apiKey - OpenAI API key
     * @param {string} model - LLM model to use
     * @param {string} language - Target language
     * @param {string} customPrompt - User's custom keywords/terms
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Array>} Corrected segments
     */
    async function postProcessWithLLMBatch(segments, apiKey, model, language, customPrompt, onProgress) {
        const https = require("https");

        console.log("[CEP] Starting LLM Batch API post-processing with model:", model);
        if (onProgress) onProgress("Batch APIでLLM補正を準備中...", 82);

        // Build system prompt
        const langName = language === "ja" ? "日本語" :
                        language === "en" ? "English" :
                        language === "ko" ? "韓国語" :
                        language === "zh" ? "中国語" : "日本語";

        const systemPrompt = `あなたはプロの字幕ライターです。音声認識の文字起こしを、読みやすい字幕に変換してください。

## 修正ルール
1. 誤字脱字・誤認識を修正
2. 「えー」「あのー」などのフィラーを削除
3. 句読点は最小限に（読点「、」は間を表現したい箇所のみ、句点「。」は不要）

## セグメント分割ルール（重要）
- 各セグメントは「---」で区切る
- 1セグメント = 1つの意味のまとまり（視聴者が一目で読める量）
- 分割の目安：
  - 文の終わり
  - 接続詞の前（「そして」「しかし」「だから」など）
  - 意味の区切り目
  - 長い文は15〜25文字程度で分割
- 1セグメント内で改行して2行にしてもOK

## 出力例
今日は新機能について
説明します
---
まず最初に
基本的な使い方から
---
次にアドバンス機能を
紹介していきます

言語: ${langName}
${customPrompt ? `\n専門用語・キーワード: ${customPrompt}` : ""}

修正・分割したテキストのみを出力。説明不要。`;

        const fullText = segments.map(s => s.text).join("\n");

        // Create JSONL content for batch
        const batchRequest = {
            custom_id: `cutone-${Date.now()}`,
            method: "POST",
            url: "/v1/chat/completions",
            body: {
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: fullText }
                ],
                temperature: 0.3
            }
        };

        const jsonlContent = JSON.stringify(batchRequest);

        // Helper function for HTTPS requests
        function httpsRequest(options, body) {
            return new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = "";
                    res.on("data", chunk => data += chunk);
                    res.on("end", () => {
                        try {
                            resolve({ status: res.statusCode, data: JSON.parse(data) });
                        } catch (e) {
                            resolve({ status: res.statusCode, data: data });
                        }
                    });
                });
                req.on("error", reject);
                if (body) req.write(body);
                req.end();
            });
        }

        try {
            // Step 1: Upload JSONL file
            if (onProgress) onProgress("バッチファイルをアップロード中...", 84);

            const boundary = "----CutOneBatchBoundary" + Date.now();
            let formData = `--${boundary}\r\n`;
            formData += `Content-Disposition: form-data; name="purpose"\r\n\r\nbatch\r\n`;
            formData += `--${boundary}\r\n`;
            formData += `Content-Disposition: form-data; name="file"; filename="batch.jsonl"\r\n`;
            formData += `Content-Type: application/jsonl\r\n\r\n`;
            formData += jsonlContent + "\r\n";
            formData += `--${boundary}--\r\n`;

            const uploadResult = await httpsRequest({
                hostname: "api.openai.com",
                port: 443,
                path: "/v1/files",
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": `multipart/form-data; boundary=${boundary}`
                }
            }, formData);

            if (uploadResult.status !== 200 || !uploadResult.data.id) {
                console.error("[CEP] File upload failed:", uploadResult);
                return segments; // Return original on error
            }

            const fileId = uploadResult.data.id;
            console.log("[CEP] Batch file uploaded:", fileId);

            // Step 2: Create batch job
            if (onProgress) onProgress("バッチジョブを作成中...", 86);

            const batchResult = await httpsRequest({
                hostname: "api.openai.com",
                port: 443,
                path: "/v1/batches",
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            }, JSON.stringify({
                input_file_id: fileId,
                endpoint: "/v1/chat/completions",
                completion_window: "24h"
            }));

            if (batchResult.status !== 200 || !batchResult.data.id) {
                console.error("[CEP] Batch creation failed:", batchResult);
                return segments;
            }

            const batchId = batchResult.data.id;
            console.log("[CEP] Batch job created:", batchId);

            // Step 3: Poll for completion
            if (onProgress) onProgress("バッチ処理を待機中...", 88);

            let attempts = 0;
            const maxAttempts = 120; // 10 minutes max wait (5s intervals)
            let batchStatus;

            while (attempts < maxAttempts) {
                const statusResult = await httpsRequest({
                    hostname: "api.openai.com",
                    port: 443,
                    path: `/v1/batches/${batchId}`,
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`
                    }
                }, null);

                batchStatus = statusResult.data;
                console.log("[CEP] Batch status:", batchStatus.status);

                if (batchStatus.status === "completed") {
                    break;
                } else if (batchStatus.status === "failed" || batchStatus.status === "cancelled") {
                    console.error("[CEP] Batch failed:", batchStatus);
                    return segments;
                }

                // Wait 5 seconds before next poll
                await new Promise(resolve => setTimeout(resolve, 5000));
                attempts++;

                if (onProgress) {
                    const progress = 88 + Math.min(attempts / maxAttempts * 5, 5);
                    onProgress(`バッチ処理中... (${batchStatus.status})`, progress);
                }
            }

            if (batchStatus.status !== "completed") {
                console.log("[CEP] Batch not completed within timeout, returning original");
                return segments;
            }

            // Step 4: Download results
            if (onProgress) onProgress("バッチ結果を取得中...", 94);

            const outputFileId = batchStatus.output_file_id;
            const outputResult = await httpsRequest({
                hostname: "api.openai.com",
                port: 443,
                path: `/v1/files/${outputFileId}/content`,
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`
                }
            }, null);

            // Parse JSONL response
            const responseLines = (typeof outputResult.data === "string" ? outputResult.data : JSON.stringify(outputResult.data)).split("\n").filter(l => l.trim());
            const firstResult = JSON.parse(responseLines[0]);
            const correctedText = firstResult.response.body.choices[0].message.content;

            // Parse segments separated by ---
            const rawSegments = correctedText.split("---").map(s => s.trim()).filter(s => s);
            console.log("[CEP] Batch LLM correction complete, segments:", rawSegments.length);

            // Calculate total duration and redistribute timing
            const totalStart = segments[0]?.start || 0;
            const totalEnd = segments[segments.length - 1]?.end || 0;
            const totalDuration = totalEnd - totalStart;

            // Calculate total characters for proportional timing
            const totalChars = rawSegments.reduce((sum, s) => sum + s.replace(/\n/g, "").length, 0);

            // Create new segments with proportional timing
            const correctedSegments = [];
            let currentTime = totalStart;

            for (let i = 0; i < rawSegments.length; i++) {
                const text = rawSegments[i];
                const charCount = text.replace(/\n/g, "").length;
                const segDuration = totalChars > 0
                    ? (charCount / totalChars) * totalDuration
                    : totalDuration / rawSegments.length;

                correctedSegments.push({
                    id: i + 1,
                    start: currentTime,
                    end: currentTime + segDuration,
                    text: text
                });

                currentTime += segDuration;
            }

            if (onProgress) onProgress("Batch API補正完了", 96);
            return correctedSegments;

        } catch (e) {
            console.error("[CEP] Batch API error:", e);
            return segments; // Return original on error
        }
    }

    /**
     * Format/split transcription segments based on subtitle format settings
     * Only splits by character count and line limits - timing follows original audio
     * @param {Array} segments - Transcription segments
     * @param {Object} formatOptions - Format options
     * @param {number} formatOptions.maxCharsPerSegment - Max characters per segment (0 = unlimited)
     * @param {number} formatOptions.maxLinesPerSegment - Max lines per segment (1-4)
     * @returns {Array} Formatted segments
     */
    function formatSegments(segments, formatOptions) {
        const {
            maxCharsPerSegment = 0,
            maxLinesPerSegment = 2
        } = formatOptions || {};

        console.log("[CEP] Formatting segments with options:", formatOptions);

        if (!segments || segments.length === 0) {
            return segments;
        }

        // If no constraints, return as-is
        if (maxCharsPerSegment === 0 && maxLinesPerSegment >= 2) {
            console.log("[CEP] No formatting constraints, returning original segments");
            return segments;
        }

        let formattedSegments = [];
        let segmentId = 1;

        for (const segment of segments) {
            const splitSegments = splitByTextLimits(segment, maxCharsPerSegment, maxLinesPerSegment);

            for (const split of splitSegments) {
                formattedSegments.push({
                    ...split,
                    id: segmentId++
                });
            }
        }

        console.log("[CEP] Segments after formatting:", formattedSegments.length, "(original:", segments.length + ")");
        return formattedSegments;
    }

    /**
     * Split segment by text limits (characters and lines)
     * Timing is proportionally distributed based on character count
     */
    function splitByTextLimits(segment, maxChars, maxLines) {
        const text = segment.text || "";
        const duration = segment.end - segment.start;

        // Apply line limit first
        let processedText = text;
        if (maxLines === 1) {
            processedText = text.replace(/\n/g, " ");
        } else if (maxLines > 0 && text.split("\n").length > maxLines) {
            const lines = text.split("\n");
            processedText = lines.slice(0, maxLines).join("\n");
        }

        // If within character limit or no limit, return as-is
        if (maxChars === 0 || processedText.length <= maxChars) {
            return [{
                ...segment,
                text: processedText
            }];
        }

        // Split by character limit with proportional timing
        const splits = [];
        let remainingText = processedText;
        let currentStart = segment.start;
        const charsPerSecond = processedText.length / duration;

        while (remainingText.length > 0) {
            let splitPos = Math.min(maxChars, remainingText.length);

            // Find a natural break point (look backwards for punctuation/space)
            if (splitPos < remainingText.length) {
                const searchStart = Math.max(0, splitPos - 10);
                for (let i = splitPos; i >= searchStart; i--) {
                    const char = remainingText[i - 1];
                    if (["。", ".", "、", ",", "　", " ", "！", "!", "？", "?"].includes(char)) {
                        splitPos = i;
                        break;
                    }
                }
            }

            const partText = remainingText.substring(0, splitPos).trim();
            const partDuration = partText.length / charsPerSecond;
            const partEnd = Math.min(currentStart + partDuration, segment.end);

            if (partText) {
                splits.push({
                    ...segment,
                    start: currentStart,
                    end: partEnd,
                    text: partText
                });
            }

            remainingText = remainingText.substring(splitPos).trim();
            currentStart = partEnd;
        }

        return splits.length > 0 ? splits : [segment];
    }

    /**
     * Add captions to sequence using ExtendScript
     */
    async function addCaptionsToSequence(segments) {
        console.log("[CEP] Adding captions to sequence, count:", segments.length);

        // First try Caption API
        const result = await callExtendScript("addCaptionsToSequence", [JSON.stringify(segments)]);

        if (result && result.success && result.method !== "markers") {
            console.log("[CEP] Captions added via:", result.method);
            return result;
        }

        // If Caption API failed or returned markers, try SRT import method
        console.log("[CEP] Caption API failed or used markers, trying SRT import...");

        try {
            // Get project path for SRT output
            const seqInfo = await callExtendScript("getSequenceInfo", []);
            let srtDir = "/tmp";
            if (seqInfo && seqInfo.projectPath) {
                const path = require("path");
                srtDir = path.dirname(seqInfo.projectPath);
            }

            // Generate unique filename
            const timestamp = Date.now();
            const srtPath = require("path").join(srtDir, `captions_${timestamp}.srt`);

            // Export SRT file
            await exportSRT(segments, srtPath);
            console.log("[CEP] SRT exported to:", srtPath);

            // Import SRT into Premiere Pro project
            const importResult = await callExtendScript("importSRTCaptions", [srtPath]);
            console.log("[CEP] SRT import result:", importResult);

            if (importResult && importResult.success) {
                return {
                    success: true,
                    method: "srtImport",
                    count: segments.length,
                    srtPath: srtPath,
                    message: "SRTファイルをプロジェクトにインポートしました。字幕トラックにドラッグしてください。"
                };
            }
        } catch (srtErr) {
            console.error("[CEP] SRT import failed:", srtErr);
        }

        // Return original result (markers) if SRT import also failed
        if (result && result.success) {
            return result;
        }

        throw new Error(result?.error || "キャプションの追加に失敗しました");
    }

    /**
     * Export transcription as SRT file
     * @param {Array} segments - Transcription segments
     * @param {string} outputPath - Output file path
     * @param {number} timeOffset - Time offset to add (e.g., sequence start timecode)
     */
    async function exportSRT(segments, outputPath, timeOffset = 0) {
        const fs = require("fs");

        // Get sequence start timecode if not provided
        if (timeOffset === 0) {
            try {
                const seqInfo = await callExtendScript("getSequenceInfo", []);
                if (seqInfo && seqInfo.success && seqInfo.zeroPoint) {
                    timeOffset = seqInfo.zeroPoint;
                    console.log("[CEP] Applying sequence start timecode offset:", timeOffset, "seconds");
                }
            } catch (e) {
                console.log("[CEP] Could not get sequence timecode, using 0 offset");
            }
        }

        // Generate SRT content with offset applied
        let srtContent = "";

        segments.forEach((seg, index) => {
            const startTime = formatSRTTime(seg.start + timeOffset);
            const endTime = formatSRTTime(seg.end + timeOffset);

            srtContent += `${index + 1}\n`;
            srtContent += `${startTime} --> ${endTime}\n`;
            srtContent += `${seg.text}\n\n`;
        });

        // Write to file
        fs.writeFileSync(outputPath, srtContent, "utf8");
        console.log("[CEP] SRT exported to:", outputPath, "with offset:", timeOffset);

        return { success: true, path: outputPath, timeOffset: timeOffset };
    }

    /**
     * Format seconds to SRT timestamp (HH:MM:SS,mmm)
     */
    function formatSRTTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.round((seconds % 1) * 1000);

        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
    }

    /**
     * Debug Caption API availability
     * Call from console: CEP.debugCaptionAPI()
     */
    async function debugCaptionAPI() {
        console.log("[CEP] Debugging Caption API...");
        const result = await callExtendScript("debugCaptionAPI", []);
        console.log("[CEP] Caption API Debug Result:", JSON.stringify(result, null, 2));
        return result;
    }

    return {
        init,
        getActiveSequence,
        processWithOptions,
        previewWithOptions,
        addMarkers,
        clearMarkers,
        getAudioLevels,
        openURL,
        getExtensionPath,
        isInCEP,
        callExtendScript,
        testExtendScript,
        transcribeAudio,
        addCaptionsToSequence,
        exportSRT,
        debugCaptionAPI,
        getPromptPreset
    };
})();
