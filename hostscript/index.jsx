/**
 * CutOne - Premiere Pro Extension
 * ExtendScript for Premiere Pro API interaction
 * Version 6.0 - DaVinci Resolve style implementation
 *
 * Key change: Use Time objects instead of raw ticks to avoid precision issues
 */

// ============================================
// JSON Polyfill for ExtendScript (ES3)
// ============================================
var JSON = JSON || {};

JSON.stringify = function(obj) {
    var t = typeof obj;
    if (obj === null) return "null";
    if (t === "undefined") return undefined;
    if (t === "number" || t === "boolean") return String(obj);
    if (t === "string") {
        return '"' + obj
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t') + '"';
    }
    if (t === "object") {
        if (obj.constructor === Array) {
            var arrRes = [];
            for (var i = 0; i < obj.length; i++) {
                var val = JSON.stringify(obj[i]);
                arrRes.push(val === undefined ? "null" : val);
            }
            return "[" + arrRes.join(",") + "]";
        } else {
            var objRes = [];
            for (var k in obj) {
                if (obj.hasOwnProperty(k)) {
                    var val = JSON.stringify(obj[k]);
                    if (val !== undefined) {
                        objRes.push('"' + k + '":' + val);
                    }
                }
            }
            return "{" + objRes.join(",") + "}";
        }
    }
    return undefined;
};

JSON.parse = function(str) {
    try {
        return eval("(" + str + ")");
    } catch (e) {
        throw new Error("JSON parse error: " + e.message);
    }
};

// ============================================
// Constants
// ============================================
var TICKS_PER_SECOND = 254016000000;

// ============================================
// Utility Functions
// ============================================
var _debugLog = [];

function log(msg) {
    $.writeln("[CutOne] " + msg);
    _debugLog.push(msg);
    if (_debugLog.length > 50) _debugLog.shift();
}

function getDebugLog() {
    return _debugLog.join("\n");
}

function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
}

function ticksToSeconds(ticks) {
    if (typeof ticks === "string") {
        ticks = parseFloat(ticks);
    }
    return ticks / TICKS_PER_SECOND;
}

function getTimeInSeconds(timeObj) {
    if (!timeObj) return 0;
    if (typeof timeObj.seconds === "number") {
        return timeObj.seconds;
    }
    var ticks = timeObj.ticks;
    if (ticks !== undefined && ticks !== null) {
        var tickNum = (typeof ticks === "string") ? parseFloat(ticks) : ticks;
        return tickNum / TICKS_PER_SECOND;
    }
    return 0;
}

/**
 * Get current sequence duration in seconds
 */
function getSequenceDuration(sequence) {
    return ticksToSeconds(sequence.end - sequence.zeroPoint);
}

// ============================================
// Test Functions
// ============================================
function testExtendScript() {
    return JSON.stringify({
        success: true,
        message: "ExtendScript v7.0 (Debug)",
        os: $.os
    });
}

/**
 * Test function to debug a single extract operation
 * Call this from CEP console: CEP.callExtendScript("testSingleExtract")
 */
function testSingleExtract() {
    try {
        log("=== testSingleExtract ===");

        var seq = app.project.activeSequence;
        if (!seq) {
            return JSON.stringify({ success: false, error: "No sequence" });
        }

        app.enableQE();
        var qeSeq = qe.project.getActiveSequence();
        if (!qeSeq) {
            return JSON.stringify({ success: false, error: "No QE sequence" });
        }

        // Get initial state
        var initialDur = getSequenceDuration(seq);
        log("Initial duration: " + initialDur.toFixed(2) + "s");
        log("Sequence end raw: " + seq.end);
        log("Sequence zeroPoint: " + seq.zeroPoint);

        // Try to delete 1 second from 2s to 3s
        var startSec = 2;
        var endSec = 3;

        if (initialDur < 4) {
            // If sequence is short, use smaller range
            startSec = initialDur * 0.3;
            endSec = initialDur * 0.5;
        }

        log("Test delete range: " + startSec.toFixed(2) + "s - " + endSec.toFixed(2) + "s");

        var startTicks = Math.round(startSec * TICKS_PER_SECOND);
        var endTicks = Math.round(endSec * TICKS_PER_SECOND);

        log("Start ticks: " + startTicks);
        log("End ticks: " + endTicks);

        // Clear existing in/out
        log("Clearing in/out...");
        try {
            qeSeq.setInPoint(String(-1));
            qeSeq.setOutPoint(String(-1));
            log("Cleared");
        } catch (e) {
            log("Clear error: " + e);
        }

        // Set in point
        log("Setting in point to " + startTicks + "...");
        qeSeq.setInPoint(String(startTicks));

        // Set out point
        log("Setting out point to " + endTicks + "...");
        qeSeq.setOutPoint(String(endTicks));

        // Check CTI position
        try {
            log("CTI timecode: " + qeSeq.CTI.timecode);
        } catch (e) {
            log("CTI error: " + e);
        }

        // Get duration before extract
        var durBefore = getSequenceDuration(seq);
        log("Duration before extract: " + durBefore.toFixed(2) + "s");

        // DO NOT ACTUALLY EXTRACT - just return the debug info
        // Uncomment below to actually test
        // log("Extracting...");
        // qeSeq.extract();
        // var durAfter = getSequenceDuration(seq);
        // log("Duration after: " + durAfter.toFixed(2) + "s");

        return JSON.stringify({
            success: true,
            initialDuration: initialDur,
            testRange: startSec + " - " + endSec,
            startTicks: startTicks,
            endTicks: endTicks,
            message: "Test complete - extract NOT executed. Check ExtendScript console for logs."
        });

    } catch (e) {
        log("ERROR: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

// ============================================
// Sequence Functions
// ============================================
function getActiveSequence() {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        var durationSeconds = getSequenceDuration(sequence);

        return JSON.stringify({
            success: true,
            name: sequence.name,
            videoTracks: sequence.videoTracks.numTracks,
            audioTracks: sequence.audioTracks.numTracks,
            duration: durationSeconds,
            durationFormatted: formatTime(durationSeconds)
        });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function getSequenceInfo() {
    try {
        log("========== getSequenceInfo v7.0 ==========");

        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "アクティブなシーケンスがありません" });
        }

        log("Sequence: " + sequence.name);

        var seqDuration = getSequenceDuration(sequence);
        log("Duration: " + seqDuration.toFixed(2) + "s");

        var clipInfo = findFirstClipWithMedia(sequence);

        if (!clipInfo) {
            return JSON.stringify({ success: false, error: "メディアクリップがありません" });
        }

        log("Clip: " + clipInfo.sourcePath);
        log("  Sequence: " + clipInfo.startInSequence.toFixed(2) + " - " + clipInfo.endInSequence.toFixed(2));
        log("  Source: " + clipInfo.inPoint.toFixed(2) + " - " + clipInfo.outPoint.toFixed(2));

        // Get in/out points of sequence
        var seqInPoint = -1;
        var seqOutPoint = -1;
        try {
            var inPointTime = sequence.getInPoint();
            var outPointTime = sequence.getOutPoint();
            if (inPointTime && inPointTime !== "undefined") {
                seqInPoint = getTimeInSeconds(inPointTime);
            }
            if (outPointTime && outPointTime !== "undefined") {
                seqOutPoint = getTimeInSeconds(outPointTime);
            }
            log("Sequence In/Out: " + seqInPoint.toFixed(2) + " / " + seqOutPoint.toFixed(2));
        } catch (e) {
            log("Could not get in/out points: " + e.toString());
        }

        // Get selected clips info
        var selectedClipsInfo = getSelectedClipsRange(sequence);
        log("Selected clips: " + (selectedClipsInfo ? selectedClipsInfo.count + " clips" : "none"));

        return JSON.stringify({
            success: true,
            name: sequence.name,
            sequenceDuration: seqDuration,
            sourcePath: clipInfo.sourcePath,
            clipStartInSequence: clipInfo.startInSequence,
            clipEndInSequence: clipInfo.endInSequence,
            clipInPoint: clipInfo.inPoint,
            clipOutPoint: clipInfo.outPoint,
            clipDuration: clipInfo.duration,
            duration: seqDuration,
            // New fields for section type
            seqInPoint: seqInPoint,
            seqOutPoint: seqOutPoint,
            selectedClips: selectedClipsInfo
        });

    } catch (e) {
        log("ERROR: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

/**
 * Get the time range of selected clips
 */
function getSelectedClipsRange(sequence) {
    try {
        var minStart = Infinity;
        var maxEnd = -Infinity;
        var count = 0;
        var selectedPath = null;

        // Check video tracks for selection
        for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
            var track = sequence.videoTracks[v];
            for (var c = 0; c < track.clips.numItems; c++) {
                var clip = track.clips[c];
                if (clip && clip.isSelected()) {
                    var startSec = getTimeInSeconds(clip.start);
                    var endSec = getTimeInSeconds(clip.end);
                    if (startSec < minStart) minStart = startSec;
                    if (endSec > maxEnd) maxEnd = endSec;
                    count++;

                    // Get source path of first selected clip
                    if (!selectedPath && clip.projectItem) {
                        try {
                            selectedPath = clip.projectItem.getMediaPath();
                        } catch (e) {}
                    }
                }
            }
        }

        // Check audio tracks for selection
        for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
            var track = sequence.audioTracks[a];
            for (var c = 0; c < track.clips.numItems; c++) {
                var clip = track.clips[c];
                if (clip && clip.isSelected()) {
                    var startSec = getTimeInSeconds(clip.start);
                    var endSec = getTimeInSeconds(clip.end);
                    if (startSec < minStart) minStart = startSec;
                    if (endSec > maxEnd) maxEnd = endSec;
                    count++;

                    // Get source path of first selected clip
                    if (!selectedPath && clip.projectItem) {
                        try {
                            selectedPath = clip.projectItem.getMediaPath();
                        } catch (e) {}
                    }
                }
            }
        }

        if (count === 0) {
            return null;
        }

        return {
            start: minStart,
            end: maxEnd,
            count: count,
            sourcePath: selectedPath
        };
    } catch (e) {
        log("Error getting selected clips: " + e.toString());
        return null;
    }
}

function findFirstClipWithMedia(sequence) {
    var numVideoTracks = sequence.videoTracks.numTracks;
    for (var v = 0; v < numVideoTracks; v++) {
        var track = sequence.videoTracks[v];
        var numClips = track.clips.numItems;

        for (var c = 0; c < numClips; c++) {
            var clip = track.clips[c];
            if (!clip || !clip.projectItem) continue;

            var mediaPath = null;
            try {
                if (typeof clip.projectItem.getMediaPath === "function") {
                    mediaPath = clip.projectItem.getMediaPath();
                }
            } catch (e) {
                continue;
            }

            if (!mediaPath || mediaPath.length === 0) continue;

            var startSec = getTimeInSeconds(clip.start);
            var endSec = getTimeInSeconds(clip.end);
            var inPointSec = getTimeInSeconds(clip.inPoint);
            var outPointSec = getTimeInSeconds(clip.outPoint);

            if (endSec <= startSec) continue;

            return {
                sourcePath: mediaPath,
                startInSequence: startSec,
                endInSequence: endSec,
                inPoint: inPointSec,
                outPoint: outPointSec,
                duration: endSec - startSec,
                trackType: "video",
                trackIndex: v
            };
        }
    }

    var numAudioTracks = sequence.audioTracks.numTracks;
    for (var a = 0; a < numAudioTracks; a++) {
        var track = sequence.audioTracks[a];
        var numClips = track.clips.numItems;

        for (var c = 0; c < numClips; c++) {
            var clip = track.clips[c];
            if (!clip || !clip.projectItem) continue;

            var mediaPath = null;
            try {
                if (typeof clip.projectItem.getMediaPath === "function") {
                    mediaPath = clip.projectItem.getMediaPath();
                }
            } catch (e) {
                continue;
            }

            if (!mediaPath || mediaPath.length === 0) continue;

            var startSec = getTimeInSeconds(clip.start);
            var endSec = getTimeInSeconds(clip.end);
            var inPointSec = getTimeInSeconds(clip.inPoint);
            var outPointSec = getTimeInSeconds(clip.outPoint);

            if (endSec <= startSec) continue;

            return {
                sourcePath: mediaPath,
                startInSequence: startSec,
                endInSequence: endSec,
                inPoint: inPointSec,
                outPoint: outPointSec,
                duration: endSec - startSec,
                trackType: "audio",
                trackIndex: a
            };
        }
    }

    return null;
}

function getFirstClipSourcePath() {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) return null;
        var clipInfo = findFirstClipWithMedia(sequence);
        return clipInfo ? clipInfo.sourcePath : null;
    } catch (e) {
        return null;
    }
}

// ============================================
// Process Segments - with duplicate execution protection
// ============================================
var _processSegmentsCallCount = 0;
var _lastProcessTime = 0;
var _lastProcessHash = "";
var PROCESS_COOLDOWN_MS = 5000; // 5 second cooldown between calls

function processSegments(optionsJson) {
    try {
        _processSegmentsCallCount++;
        var callId = _processSegmentsCallCount;
        var currentTime = new Date().getTime();

        var options = JSON.parse(optionsJson);

        var segments = options.segments || [];
        var paddingBefore = options.paddingBefore || 0.2;
        var paddingAfter = options.paddingAfter || 0.2;
        var silenceAction = options.silenceAction || "delete";
        var batchIndex = options.batchIndex || 0;
        var totalBatches = options.totalBatches || 1;
        var isLastBatch = options.isLastBatch || (totalBatches === 1);
        var isBatchMode = totalBatches > 1;

        log("========== processSegments v19.0 (Batch Support) ==========");
        log("### CALL #" + callId + " | Batch " + (batchIndex + 1) + "/" + totalBatches + " ###");

        // Only apply duplicate protection for first batch or non-batch mode
        if (batchIndex === 0) {
            var timeSinceLastProcess = currentTime - _lastProcessTime;
            if (_lastProcessTime > 0 && timeSinceLastProcess < PROCESS_COOLDOWN_MS) {
                log("!!! BLOCKED: Duplicate call within cooldown period !!!");
                log("Time since last: " + timeSinceLastProcess + "ms (cooldown: " + PROCESS_COOLDOWN_MS + "ms)");
                return JSON.stringify({
                    success: false,
                    error: "DUPLICATE_BLOCKED",
                    blocked: true,
                    timeSinceLastProcess: timeSinceLastProcess
                });
            }

            // Create a hash of the call to detect exact duplicates
            var callHash = segments.length + "_" + paddingBefore + "_" + paddingAfter + "_" + silenceAction;
            if (segments.length > 0) {
                callHash += "_" + segments[0].start.toFixed(3) + "_" + segments[segments.length-1].end.toFixed(3);
            }

            log("Call hash: " + callHash);
            log("Last hash: " + _lastProcessHash);

            // Check for exact duplicate call (same parameters)
            if (callHash === _lastProcessHash && timeSinceLastProcess < PROCESS_COOLDOWN_MS * 2) {
                log("!!! BLOCKED: Exact duplicate call with same parameters !!!");
                return JSON.stringify({
                    success: false,
                    error: "EXACT_DUPLICATE_BLOCKED",
                    blocked: true
                });
            }

            // Mark as processing BEFORE the actual work (only first batch)
            _lastProcessTime = currentTime;
            _lastProcessHash = callHash;
        }

        log("Segments in this batch: " + segments.length);
        log("Action: " + silenceAction);
        log("Padding: " + paddingBefore + " / " + paddingAfter);

        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        var originalDuration = getSequenceDuration(sequence);
        log("Original duration: " + originalDuration.toFixed(2) + "s");

        if (segments.length === 0) {
            return JSON.stringify({
                success: true,
                segmentsFound: 0,
                segmentsProcessed: 0,
                originalDuration: originalDuration,
                newDuration: originalDuration,
                savedPercent: 0
            });
        }

        var processedCount = 0;

        if (silenceAction === "delete") {
            processedCount = deleteSegmentsUsingTimeCode(sequence, segments, paddingBefore, paddingAfter);
        } else if (silenceAction === "keep") {
            addMarkersForSegments(sequence, segments);
            processedCount = segments.length;
        }

        var newDuration = getSequenceDuration(sequence);
        var savedPercent = originalDuration > 0 ? ((originalDuration - newDuration) / originalDuration) * 100 : 0;

        log("New duration: " + newDuration.toFixed(2) + "s");
        log("Saved: " + savedPercent.toFixed(1) + "%");

        // Update last process time AFTER completion (only on last batch or non-batch mode)
        if (isLastBatch) {
            _lastProcessTime = new Date().getTime();
            log("Cooldown started (last batch complete)");
        }

        return JSON.stringify({
            success: true,
            segmentsFound: segments.length,
            segmentsProcessed: processedCount,
            originalDuration: originalDuration,
            newDuration: newDuration,
            savedPercent: savedPercent,
            action: silenceAction,
            callId: callId,
            batchIndex: batchIndex,
            totalBatches: totalBatches,
            debugLog: getDebugLog()
        });

    } catch (e) {
        log("ERROR: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString(), debugLog: getDebugLog() });
    }
}

// Global counter to detect if function is called multiple times
var _deleteCallCount = 0;

/**
 * Delete segments using setInPoint/setOutPoint + extract
 * v16.4 - Batch mode support with progress display
 */
function deleteSegmentsUsingTimeCode(sequence, segments, paddingBefore, paddingAfter) {
    _deleteCallCount++;
    var callId = _deleteCallCount;

    log("=== deleteSegmentsUsingTimeCode v16.4 (batch support) ===");
    log("Input segments count: " + segments.length);
    log("Padding: before=" + paddingBefore + ", after=" + paddingAfter);

    // Log segments (already sorted descending by CEP in batch mode)
    log("--- Segments to process (already sorted by CEP): ---");
    for (var j = 0; j < segments.length; j++) {
        log("  [" + j + "] " + segments[j].start.toFixed(2) + "s - " + segments[j].end.toFixed(2) + "s");
    }

    // Sort descending by start time (delete from end first)
    // This is redundant if CEP already sorted, but ensures correctness
    segments.sort(function(a, b) { return b.start - a.start; });

    // Enable QE
    app.enableQE();
    var qeSeq = qe.project.getActiveSequence();
    if (!qeSeq) {
        log("ERROR: No QE sequence");
        return 0;
    }

    var deletedCount = 0;
    var skippedCount = 0;
    var extractCallCount = 0;

    // Process each segment
    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];

        // Apply padding
        var cutStart = seg.start + paddingBefore;
        var cutEnd = seg.end - paddingAfter;

        // Validate segment
        if (cutEnd <= cutStart) {
            log("Skip seg " + (i+1) + "/" + segments.length + ": end <= start after padding");
            skippedCount++;
            continue;
        }

        var cutDuration = cutEnd - cutStart;
        if (cutDuration < 0.1) {
            log("Skip seg " + (i+1) + "/" + segments.length + ": too short (" + cutDuration.toFixed(3) + "s)");
            skippedCount++;
            continue;
        }

        if (cutStart < 0) cutStart = 0;

        // Get current sequence duration (changes after each cut)
        var seqDur = getSequenceDuration(sequence);

        // Skip if segment is beyond current sequence
        if (cutStart >= seqDur) {
            log("Skip seg " + (i+1) + "/" + segments.length + ": beyond sequence (" + cutStart.toFixed(2) + "s >= " + seqDur.toFixed(2) + "s)");
            skippedCount++;
            continue;
        }

        // Clamp end to sequence duration
        if (cutEnd > seqDur) {
            cutEnd = seqDur - 0.001;
            cutDuration = cutEnd - cutStart;
        }

        // Align to frame boundary to prevent video/audio desync
        // sequence.timebase returns ticks per frame directly
        var ticksPerFrame = TICKS_PER_SECOND / 30; // Default 30fps
        try {
            var timebase = sequence.timebase;
            if (timebase) {
                ticksPerFrame = parseFloat(timebase);
                var actualFps = TICKS_PER_SECOND / ticksPerFrame;
                log("  Sequence fps: " + actualFps.toFixed(3) + " (timebase: " + ticksPerFrame + ")");
            }
        } catch (e) {
            log("  Using default 30fps timebase");
        }

        var startTicks = Math.round(cutStart * TICKS_PER_SECOND / ticksPerFrame) * ticksPerFrame;
        var endTicks = Math.round(cutEnd * TICKS_PER_SECOND / ticksPerFrame) * ticksPerFrame;

        // Convert back to seconds (frame-aligned)
        var alignedStart = startTicks / TICKS_PER_SECOND;
        var alignedEnd = endTicks / TICKS_PER_SECOND;

        log("CUT " + (extractCallCount+1) + " | Seg " + (i+1) + "/" + segments.length + ": " + alignedStart.toFixed(3) + "s - " + alignedEnd.toFixed(3) + "s (frame-aligned from " + cutStart.toFixed(3) + "s - " + cutEnd.toFixed(3) + "s)");

        var durBefore = seqDur;

        try {
            // Set in/out points using frame-aligned seconds
            sequence.setInPoint(alignedStart);
            sequence.setOutPoint(alignedEnd);

            // Extract using QE API (ripple delete)
            qeSeq.extract();
            extractCallCount++;

            // Clear in/out points using QE API
            try {
                qeSeq.setInPoint("");
                qeSeq.setOutPoint("");
            } catch (clearErr) {
                log("  Note: Could not clear in/out points via QE");
            }

            // Verify result
            var durAfter = getSequenceDuration(sequence);
            var deleted = durBefore - durAfter;

            log("  -> Deleted: " + deleted.toFixed(3) + "s | Seq now: " + durAfter.toFixed(3) + "s");

            // Count as successful if extract was called (regardless of duration change)
            deletedCount++;

        } catch (e) {
            log("  ERROR: " + e.toString());
            try {
                qeSeq.setInPoint("");
                qeSeq.setOutPoint("");
            } catch (e2) {}
        }
    }

    log("--- Batch complete ---");
    log("Segments in batch: " + segments.length);
    log("Extract() calls: " + extractCallCount);
    log("Deleted: " + deletedCount + ", Skipped: " + skippedCount);

    return deletedCount;
}

/**
 * Remove clips in time range (seconds)
 * Wrapper for removeClipsBetween that takes seconds instead of ticks
 */
function removeClipsInTimeRange(sequence, startSec, endSec) {
    var startTicks = Math.round(startSec * TICKS_PER_SECOND);
    var endTicks = Math.round(endSec * TICKS_PER_SECOND);
    return removeClipsBetween(sequence, startTicks, endTicks);
}

/**
 * Remove clips that fall between start and end ticks
 * After razor cuts, clips should be split at exact boundaries
 */
function removeClipsBetween(sequence, startTicks, endTicks) {
    var removed = 0;
    var tolerance = TICKS_PER_SECOND * 0.05; // 50ms tolerance

    log("    Looking for clips between " + (startTicks/TICKS_PER_SECOND).toFixed(3) + "s and " + (endTicks/TICKS_PER_SECOND).toFixed(3) + "s");

    // Collect clips to remove from all tracks
    var clipsToRemove = [];

    // Check video tracks
    for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
        var track = sequence.videoTracks[v];
        log("    Video track " + v + ": " + track.clips.numItems + " clips");

        for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];
            if (!clip) continue;

            var clipStart = getTicksNum(clip.start);
            var clipEnd = getTicksNum(clip.end);

            log("      Clip " + c + ": " + (clipStart/TICKS_PER_SECOND).toFixed(3) + "s - " + (clipEnd/TICKS_PER_SECOND).toFixed(3) + "s");

            // Clip starts at or after cut start AND ends at or before cut end
            if (clipStart >= (startTicks - tolerance) && clipEnd <= (endTicks + tolerance)) {
                log("        -> MATCH: will remove");
                clipsToRemove.push({ clip: clip, type: "video", track: v });
            }
        }
    }

    // Check audio tracks
    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        var track = sequence.audioTracks[a];
        log("    Audio track " + a + ": " + track.clips.numItems + " clips");

        for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];
            if (!clip) continue;

            var clipStart = getTicksNum(clip.start);
            var clipEnd = getTicksNum(clip.end);

            log("      Clip " + c + ": " + (clipStart/TICKS_PER_SECOND).toFixed(3) + "s - " + (clipEnd/TICKS_PER_SECOND).toFixed(3) + "s");

            if (clipStart >= (startTicks - tolerance) && clipEnd <= (endTicks + tolerance)) {
                log("        -> MATCH: will remove");
                clipsToRemove.push({ clip: clip, type: "audio", track: a });
            }
        }
    }

    log("    Found " + clipsToRemove.length + " clips to remove");

    // Remove clips with ripple delete
    for (var i = 0; i < clipsToRemove.length; i++) {
        var info = clipsToRemove[i];
        try {
            info.clip.remove(true, true); // ripple=true, alignToVideo=true
            removed++;
        } catch (e) {
            log("    Remove failed: " + e);
        }
    }

    return removed;
}

/**
 * Close all gaps in the sequence
 */
function closeAllGaps(sequence) {
    // Move all clips to close gaps
    // Process from beginning to end
    for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
        closeGapsOnTrack(sequence.videoTracks[v]);
    }
    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        closeGapsOnTrack(sequence.audioTracks[a]);
    }
}

/**
 * Close gaps on a single track
 */
function closeGapsOnTrack(track) {
    if (!track || track.clips.numItems === 0) return;

    // Collect clips and sort by start time
    var clips = [];
    for (var i = 0; i < track.clips.numItems; i++) {
        var clip = track.clips[i];
        if (clip) {
            clips.push({
                clip: clip,
                start: getTicksNum(clip.start),
                end: getTicksNum(clip.end)
            });
        }
    }

    // Sort by start time
    clips.sort(function(a, b) { return a.start - b.start; });

    // Move clips to close gaps
    var expectedStart = 0;
    for (var i = 0; i < clips.length; i++) {
        var info = clips[i];
        if (info.start > expectedStart) {
            // Gap found, move clip
            var gap = info.start - expectedStart;
            try {
                // Move clip by negative gap (move it earlier)
                info.clip.move(-gap / TICKS_PER_SECOND);
                info.start = expectedStart;
                info.end = info.end - gap;
            } catch (e) {
                log("  Move failed: " + e);
            }
        }
        expectedStart = info.end;
    }
}

/**
 * Find clips in range and ripple delete them
 * After razor, clips should be split at exact boundaries
 */
function rippleDeleteClipsInRange(sequence, startTicks, endTicks) {
    var removed = 0;
    var tolerance = TICKS_PER_SECOND * 0.1; // 100ms tolerance

    // Collect ALL clips to remove first (don't modify while iterating)
    var clipsToRemove = [];

    // Check video tracks
    for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
        var track = sequence.videoTracks[v];
        for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];
            if (!clip) continue;

            var clipStart = getTicksNum(clip.start);
            var clipEnd = getTicksNum(clip.end);

            // Clip is inside the cut range (with tolerance)
            if (clipStart >= (startTicks - tolerance) && clipEnd <= (endTicks + tolerance)) {
                clipsToRemove.push({
                    clip: clip,
                    type: "video",
                    track: v,
                    start: clipStart,
                    end: clipEnd
                });
            }
        }
    }

    // Check audio tracks
    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        var track = sequence.audioTracks[a];
        for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];
            if (!clip) continue;

            var clipStart = getTicksNum(clip.start);
            var clipEnd = getTicksNum(clip.end);

            if (clipStart >= (startTicks - tolerance) && clipEnd <= (endTicks + tolerance)) {
                clipsToRemove.push({
                    clip: clip,
                    type: "audio",
                    track: a,
                    start: clipStart,
                    end: clipEnd
                });
            }
        }
    }

    log("    Found " + clipsToRemove.length + " clips to remove");

    // Remove clips (process from end to maintain indices)
    // Sort by start time descending
    clipsToRemove.sort(function(a, b) { return b.start - a.start; });

    for (var i = 0; i < clipsToRemove.length; i++) {
        var info = clipsToRemove[i];
        try {
            log("    Removing " + info.type + " clip at " + (info.start / TICKS_PER_SECOND).toFixed(2) + "s");
            info.clip.remove(true, true); // ripple=true, alignToVideo=true
            removed++;
        } catch (e) {
            log("    Remove failed: " + e);
        }
    }

    return removed;
}

/**
 * Remove clips that fall within a time range (after razor cuts)
 */
function removeClipsInRange(sequence, startTicks, endTicks) {
    var removed = 0;
    var tolerance = TICKS_PER_SECOND * 0.05; // 50ms tolerance

    // Process video tracks
    for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
        var track = sequence.videoTracks[v];
        // Iterate backwards to safely remove
        for (var c = track.clips.numItems - 1; c >= 0; c--) {
            var clip = track.clips[c];
            if (!clip) continue;

            var clipStart = getTicksNum(clip.start);
            var clipEnd = getTicksNum(clip.end);

            // Check if clip is within the cut range (with tolerance)
            if (clipStart >= (startTicks - tolerance) && clipEnd <= (endTicks + tolerance)) {
                log("    Removing video clip: " + clipStart + " - " + clipEnd);
                try {
                    clip.remove(true, true); // ripple delete
                    removed++;
                } catch (e) {
                    log("    Remove error: " + e);
                }
            }
        }
    }

    // Process audio tracks
    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        var track = sequence.audioTracks[a];
        for (var c = track.clips.numItems - 1; c >= 0; c--) {
            var clip = track.clips[c];
            if (!clip) continue;

            var clipStart = getTicksNum(clip.start);
            var clipEnd = getTicksNum(clip.end);

            if (clipStart >= (startTicks - tolerance) && clipEnd <= (endTicks + tolerance)) {
                log("    Removing audio clip: " + clipStart + " - " + clipEnd);
                try {
                    clip.remove(true, true); // ripple delete
                    removed++;
                } catch (e) {
                    log("    Remove error: " + e);
                }
            }
        }
    }

    return removed;
}

/**
 * Get ticks as number from Time object
 */
function getTicksNum(timeObj) {
    if (!timeObj) return 0;
    var t = timeObj.ticks;
    if (t === undefined) {
        if (typeof timeObj.seconds === "number") {
            return Math.round(timeObj.seconds * TICKS_PER_SECOND);
        }
        return 0;
    }
    return (typeof t === "string") ? parseFloat(t) : t;
}

/**
 * Convert seconds to ticks - ALWAYS returns a string
 * This is the safe version that works for all durations
 */
function secondsToTicksSafe(seconds) {
    // Always use string-based approach to avoid any precision issues
    var whole = Math.floor(seconds);
    var frac = seconds - whole;

    // For fractional part, we can safely multiply since frac < 1
    // frac * 254016000000 is always < 254016000000, which is safe
    var fracTicks = Math.round(frac * TICKS_PER_SECOND);

    if (whole === 0) {
        return String(fracTicks);
    }

    // For whole seconds, use string-based multiplication
    var ticksPerSecStr = "254016000000";
    var result = multiplyStringByInt(ticksPerSecStr, whole);

    // Add fractional ticks
    if (fracTicks > 0) {
        result = addStrings(result, String(fracTicks));
    }

    return result;
}

/**
 * Convert seconds to ticks using string arithmetic
 * This avoids JavaScript's number precision issues for large values
 *
 * TICKS_PER_SECOND = 254016000000
 * We break this into: 254016 * 1000000
 */
function secondsToTicks(seconds) {
    // For small values (< 35 seconds), use direct calculation
    if (seconds < 35) {
        return Math.round(seconds * TICKS_PER_SECOND);
    }

    // For larger values, use string-based approach
    // Split seconds into whole and fractional parts
    var whole = Math.floor(seconds);
    var frac = seconds - whole;

    // Calculate ticks for fractional part (always small, safe)
    var fracTicks = Math.round(frac * TICKS_PER_SECOND);

    // For whole seconds, build the string manually
    // 1 second = 254016000000 ticks
    // We multiply using smaller numbers to avoid overflow
    var ticksPerSecStr = "254016000000";
    var result = multiplyStringByInt(ticksPerSecStr, whole);

    // Add fractional ticks
    result = addStrings(result, String(fracTicks));

    return result;
}

/**
 * Multiply a numeric string by an integer
 */
function multiplyStringByInt(numStr, multiplier) {
    if (multiplier === 0) return "0";
    if (multiplier === 1) return numStr;

    var result = "0";
    for (var i = 0; i < multiplier; i++) {
        result = addStrings(result, numStr);
    }
    return result;
}

/**
 * Add two numeric strings
 */
function addStrings(a, b) {
    // Pad to same length
    while (a.length < b.length) a = "0" + a;
    while (b.length < a.length) b = "0" + b;

    var result = "";
    var carry = 0;

    for (var i = a.length - 1; i >= 0; i--) {
        var sum = parseInt(a[i], 10) + parseInt(b[i], 10) + carry;
        carry = Math.floor(sum / 10);
        result = String(sum % 10) + result;
    }

    if (carry > 0) {
        result = String(carry) + result;
    }

    return result;
}

/**
 * Convert seconds to timecode string (HH:MM:SS:FF)
 */
function secondsToTimecode(seconds, frameRate) {
    var totalFrames = Math.round(seconds * frameRate);
    var frames = totalFrames % Math.round(frameRate);
    var totalSeconds = Math.floor(totalFrames / frameRate);
    var secs = totalSeconds % 60;
    var mins = Math.floor(totalSeconds / 60) % 60;
    var hours = Math.floor(totalSeconds / 3600);

    return pad(hours, 2) + ":" + pad(mins, 2) + ":" + pad(secs, 2) + ":" + pad(frames, 2);
}

function pad(num, size) {
    var s = String(num);
    while (s.length < size) s = "0" + s;
    return s;
}

// ============================================
// Marker Functions
// ============================================
function addMarkersForSegments(sequence, segments) {
    var markers = sequence.markers;
    var count = 0;

    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];
        try {
            var ticks = secondsToTicks(seg.start);
            var marker = markers.createMarker(ticks);
            marker.name = "Silence " + (i + 1);
            marker.comments = "Duration: " + seg.duration.toFixed(2) + "s";
            marker.setColorByIndex(3);
            count++;
        } catch (e) {
            log("Marker error: " + e);
        }
    }

    return count;
}

function addSilenceMarkers(segmentsJson) {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No sequence" });
        }
        var segments = JSON.parse(segmentsJson);
        var count = addMarkersForSegments(sequence, segments);
        return JSON.stringify({ success: true, markerCount: count });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function clearAllMarkers() {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No sequence" });
        }
        var markers = sequence.markers;
        var count = 0;
        while (markers.numMarkers > 0) {
            markers.deleteMarker(markers.getFirstMarker());
            count++;
        }
        return JSON.stringify({ success: true, deletedCount: count });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

// ============================================
// Preview Functions
// ============================================
function previewWithOptions(optionsJson) {
    try {
        var options = JSON.parse(optionsJson);
        return JSON.stringify({
            success: true,
            message: "Preview requested",
            threshold: options.threshold || -35,
            minSilenceDuration: options.minSilenceDuration || 0.3
        });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

function getAudioLevels(numSamples) {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No sequence" });
        }

        var duration = getSequenceDuration(sequence);
        var levels = [];
        for (var i = 0; i < numSamples; i++) {
            levels.push(Math.random() * 0.5 + 0.2);
        }

        return JSON.stringify({
            success: true,
            levels: levels,
            duration: duration
        });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.toString() });
    }
}
