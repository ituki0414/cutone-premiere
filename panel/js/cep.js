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
            console.log("[CEP] Host environment:", JSON.stringify(csInterface.getHostEnvironment()));
            return csInterface;
        } catch (e) {
            console.error("[CEP] Init failed:", e);
            return null;
        }
    }

    function isConnected() {
        return csInterface !== null;
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

            // Step 2: Analyze audio levels (DaVinci Resolve's approach)
            if (onProgress) onProgress("analyze", 10, null, "音声レベルを分析中... 0%");

            const audioAnalysis = await analyzeAudioLevels(
                sourcePath,
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

            // Step 2: Analyze audio levels
            if (onProgress) onProgress("analyze", 10, null, "音声レベルを分析中...");

            const audioAnalysis = await analyzeAudioLevels(seqInfo.sourcePath, clipOutPoint, null);

            if (!audioAnalysis.hasAudio) {
                throw new Error("音声トラックがありません");
            }

            // Step 3: Calculate threshold
            const userThreshold = options.threshold || -35;
            let effectiveThreshold;

            if (audioAnalysis.meanVolume < -40) {
                effectiveThreshold = audioAnalysis.meanVolume - 15;
            } else {
                effectiveThreshold = userThreshold;
            }

            // Step 4: Run silence detection
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

        const transcription = await callWhisperAPI(audioPath, options.apiKey, options.language, onProgress);

        // Step 4: Clean up temp file
        try {
            const fs = require("fs");
            fs.unlinkSync(audioPath);
        } catch (e) {
            console.log("[CEP] Could not delete temp file:", e);
        }

        // Step 5: Process and return result
        if (onProgress) onProgress("処理完了", 100);

        return {
            success: true,
            segments: transcription.segments,
            text: transcription.text,
            language: transcription.language
        };
    }

    /**
     * Extract audio from sequence to temporary file
     */
    async function extractSequenceAudio(sequenceInfo, onProgress) {
        return new Promise((resolve, reject) => {
            // Get the first video/audio clip path from the sequence
            callExtendScript("getFirstClipPath", []).then(result => {
                if (result && result.success && result.path) {
                    console.log("[CEP] Source media path:", result.path);

                    // Create temp file for extracted audio
                    const os = require("os");
                    const tempDir = os.tmpdir();
                    const timestamp = Date.now();
                    const outputPath = path.join(tempDir, `cutone_audio_${timestamp}.mp3`);

                    const ffmpegPath = getFFmpegPath();
                    if (!ffmpegPath) {
                        reject(new Error("FFmpegが見つかりません"));
                        return;
                    }

                    // Extract audio using FFmpeg (16kHz mono for Whisper)
                    const args = [
                        "-y",
                        "-i", result.path,
                        "-vn",
                        "-acodec", "libmp3lame",
                        "-ar", "16000",
                        "-ac", "1",
                        "-b:a", "64k",
                        outputPath
                    ];

                    console.log("[CEP] Extracting audio:", ffmpegPath);

                    const ffmpeg = childProcess.spawn(ffmpegPath, args);
                    let stderr = "";

                    ffmpeg.stderr.on("data", (data) => {
                        stderr += data.toString();
                        // Parse progress from FFmpeg output
                        const timeMatch = stderr.match(/time=(\d+):(\d+):(\d+)/);
                        if (timeMatch && onProgress) {
                            const mins = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
                            onProgress(`音声を抽出中... ${mins}秒`, 10 + Math.min(mins, 15));
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
     * Call OpenAI Whisper API for transcription
     */
    async function callWhisperAPI(audioPath, apiKey, language, onProgress) {
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

            if (language && language !== "auto") {
                otherFields += `--${boundary}\r\n`;
                otherFields += `Content-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`;
            }

            otherFields += `--${boundary}\r\n`;
            otherFields += `Content-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\nsegment\r\n`;

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
                            const errorMsg = result.error?.message || "APIエラー: " + res.statusCode;
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
     * Add captions to sequence using ExtendScript
     * If Caption API fails, automatically exports SRT and imports it
     */
    async function addCaptionsToSequence(segments) {
        console.log("[CEP] Adding captions to sequence, count:", segments.length);

        const result = await callExtendScript("addCaptionsToSequence", [JSON.stringify(segments)]);

        if (result && result.success) {
            console.log("[CEP] Captions added:", result.count);
            return result;
        }

        // Caption API failed - try SRT import method
        console.log("[CEP] Caption API failed, trying SRT import method...");

        if (result && result.needsSrtImport) {
            try {
                // Get sequence info for path
                const sequenceInfo = await callExtendScript("getSequenceInfo", []);
                let srtPath = "";

                if (sequenceInfo && sequenceInfo.projectPath) {
                    const projectDir = sequenceInfo.projectPath.replace(/[^/\\]+$/, "");
                    srtPath = projectDir + sequenceInfo.name + "_captions.srt";
                } else if (sequenceInfo && sequenceInfo.name) {
                    const os = require("os");
                    srtPath = path.join(os.tmpdir(), sequenceInfo.name + "_captions.srt");
                } else {
                    const os = require("os");
                    srtPath = path.join(os.tmpdir(), "cutone_captions_" + Date.now() + ".srt");
                }

                // Export SRT
                console.log("[CEP] Exporting SRT to:", srtPath);
                await exportSRT(segments, srtPath);

                // Import SRT into Premiere
                console.log("[CEP] Importing SRT into Premiere...");
                const importResult = await callExtendScript("importSRTCaptions", [srtPath]);

                if (importResult && importResult.success) {
                    console.log("[CEP] SRT import result:", importResult);
                    return {
                        success: true,
                        count: segments.length,
                        method: importResult.addedToSequence ? "srtImport" : "srtProjectOnly",
                        message: importResult.message,
                        srtPath: srtPath
                    };
                }
            } catch (srtErr) {
                console.error("[CEP] SRT import failed:", srtErr);
            }
        }

        // Return the original error with debug info
        return result || { success: false, error: "キャプションの追加に失敗しました" };
    }

    /**
     * Export transcription as SRT file
     */
    async function exportSRT(segments, outputPath) {
        const fs = require("fs");

        // Generate SRT content
        let srtContent = "";

        segments.forEach((seg, index) => {
            const startTime = formatSRTTime(seg.start);
            const endTime = formatSRTTime(seg.end);

            srtContent += `${index + 1}\n`;
            srtContent += `${startTime} --> ${endTime}\n`;
            srtContent += `${seg.text}\n\n`;
        });

        // Write to file
        fs.writeFileSync(outputPath, srtContent, "utf8");
        console.log("[CEP] SRT exported to:", outputPath);

        return { success: true, path: outputPath };
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
        isConnected,
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
        debugCaptionAPI
    };
})();
