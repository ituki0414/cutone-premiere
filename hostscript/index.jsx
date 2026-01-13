/**
 * CutOne - Premiere Pro Extension
 * ExtendScript for Premiere Pro API interaction
 * Version 21.0 - True J-Cut/L-Cut and Constant Power transitions
 *
 * Key change: Use Time objects instead of raw ticks to avoid precision issues
 * v21.0: Proper J-Cut/L-Cut (separate video/audio timing) and Constant Power transitions
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
        message: "ExtendScript v21.1 (Caption Track Debug)",
        os: $.os
    });
}

/**
 * Debug function to inspect Caption API availability
 * Call from CEP: CEP.callExtendScript("debugCaptionAPI")
 */
function debugCaptionAPI() {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        log("=== debugCaptionAPI ===");

        var result = {
            success: true,
            premiereVersion: app.version,
            sequenceName: sequence.name
        };

        // Check captionTracks property
        result.hasCaptionTracks = (sequence.captionTracks !== undefined);
        log("hasCaptionTracks: " + result.hasCaptionTracks);

        if (sequence.captionTracks) {
            result.captionTracksType = typeof sequence.captionTracks;
            log("captionTracks type: " + result.captionTracksType);

            // List all properties of captionTracks
            var props = [];
            for (var key in sequence.captionTracks) {
                props.push(key);
            }
            result.captionTracksProps = props;
            log("captionTracks props: " + props.join(", "));

            // Check numTracks
            try {
                result.numTracks = sequence.captionTracks.numTracks;
                log("numTracks: " + result.numTracks);
            } catch (e) {
                result.numTracksError = e.toString();
                log("numTracks error: " + e.toString());
            }

            // Check if we can get a track
            if (result.numTracks > 0) {
                try {
                    var track = sequence.captionTracks[0];
                    result.hasFirstTrack = (track !== undefined);
                    log("hasFirstTrack: " + result.hasFirstTrack);

                    if (track) {
                        var trackProps = [];
                        for (var tkey in track) {
                            trackProps.push(tkey);
                        }
                        result.trackProps = trackProps;
                        log("track props: " + trackProps.join(", "));

                        // Check for addCaption method
                        result.hasAddCaption = (typeof track.addCaption === "function");
                        result.hasInsertCaption = (typeof track.insertCaption === "function");
                        log("hasAddCaption: " + result.hasAddCaption);
                        log("hasInsertCaption: " + result.hasInsertCaption);
                    }
                } catch (e) {
                    result.getTrackError = e.toString();
                    log("getTrack error: " + e.toString());
                }
            }
        }

        // Check createCaptionTrack method
        result.hasCreateCaptionTrack = (typeof sequence.createCaptionTrack === "function");
        log("hasCreateCaptionTrack: " + result.hasCreateCaptionTrack);

        // Check for alternative APIs
        result.hasProjectItem = (sequence.projectItem !== undefined);

        // Check app.project methods for captions
        var projectMethods = [];
        for (var pk in app.project) {
            if (pk.toLowerCase().indexOf("caption") >= 0) {
                projectMethods.push(pk);
            }
        }
        result.projectCaptionMethods = projectMethods;

        return JSON.stringify(result);
    } catch (e) {
        log("debugCaptionAPI error: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString() });
    }
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

        // Get sequence start timecode (zeroPoint)
        var zeroPointSeconds = 0;
        try {
            zeroPointSeconds = ticksToSeconds(sequence.zeroPoint);
            log("Sequence zeroPoint: " + zeroPointSeconds.toFixed(2) + "s");
        } catch (e) {
            log("Could not get zeroPoint: " + e.toString());
        }

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
            selectedClips: selectedClipsInfo,
            // Sequence start timecode
            zeroPoint: zeroPointSeconds
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
        var videoPaddingBefore = options.videoPaddingBefore || paddingBefore;
        var videoPaddingAfter = options.videoPaddingAfter || paddingAfter;
        var audioPaddingBefore = options.audioPaddingBefore || paddingBefore;
        var audioPaddingAfter = options.audioPaddingAfter || paddingAfter;
        var silenceAction = options.silenceAction || "delete";
        var transition = options.transition || "none";
        var selectedTracks = options.selectedTracks || ["A1", "A2", "A3"];
        var batchIndex = options.batchIndex || 0;
        var totalBatches = options.totalBatches || 1;
        var isLastBatch = options.isLastBatch || (totalBatches === 1);
        var isBatchMode = totalBatches > 1;

        log("========== processSegments v21.0 (J/L-Cut + Constant Power) ==========");
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

        // Log transition info
        if (transition !== "none") {
            log("Transition: " + transition);
            log("Video padding: " + videoPaddingBefore + " / " + videoPaddingAfter);
            log("Audio padding: " + audioPaddingBefore + " / " + audioPaddingAfter);
        }

        // Log selected tracks
        log("Selected tracks: " + selectedTracks.join(", "));

        if (silenceAction === "delete") {
            if (transition === "jcut" || transition === "lcut" || transition === "both") {
                // For J-Cut/L-Cut, use different padding for video and audio
                processedCount = deleteSegmentsWithTransition(sequence, segments, videoPaddingBefore, videoPaddingAfter, audioPaddingBefore, audioPaddingAfter, transition);
            } else if (transition === "constantPower") {
                // For Constant Power, cut normally first then add transitions
                processedCount = deleteSegmentsUsingTimeCode(sequence, segments, videoPaddingBefore, videoPaddingAfter);
                // Add constant power transition after cutting
                addConstantPowerTransitions(sequence);
            } else {
                // No transition - use standard cut
                processedCount = deleteSegmentsUsingTimeCode(sequence, segments, videoPaddingBefore, videoPaddingAfter);
            }
        } else if (silenceAction === "keep") {
            addMarkersForSegments(sequence, segments);
            processedCount = segments.length;
        } else if (silenceAction === "disable") {
            processedCount = disableSegments(sequence, segments, paddingBefore, paddingAfter, selectedTracks);
        } else if (silenceAction === "deleteKeepSpace") {
            processedCount = deleteSegmentsKeepSpace(sequence, segments, paddingBefore, paddingAfter);
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
 * Delete segments with J-Cut/L-Cut transition effect
 * v21.0 - True J-Cut/L-Cut implementation
 *
 * J-Cut: Audio comes before video (audio of next clip starts earlier)
 *   - In silence cutting: Cut audio earlier, leaving video longer
 *   - Result: Video extends into silence while audio has already cut
 *
 * L-Cut: Video comes before audio (video of next clip starts earlier)
 *   - In silence cutting: Cut video earlier, leaving audio longer
 *   - Result: Audio extends into silence while video has already cut
 *
 * Implementation: Process tracks separately using lift + selective trim
 */
function deleteSegmentsWithTransition(sequence, segments, videoPaddingBefore, videoPaddingAfter, audioPaddingBefore, audioPaddingAfter, transition) {
    log("=== deleteSegmentsWithTransition v21.0 (True J/L-Cut) ===");
    log("Transition type: " + transition);
    log("Video padding: " + videoPaddingBefore + " / " + videoPaddingAfter);
    log("Audio padding: " + audioPaddingBefore + " / " + audioPaddingAfter);

    // Sort segments descending (process from end first)
    segments.sort(function(a, b) { return b.start - a.start; });

    app.enableQE();
    var qeSeq = qe.project.getActiveSequence();
    if (!qeSeq) {
        log("ERROR: No QE sequence");
        return 0;
    }

    var deletedCount = 0;
    var ticksPerFrame = TICKS_PER_SECOND / 30;
    try {
        var timebase = sequence.timebase;
        if (timebase) {
            ticksPerFrame = parseFloat(timebase);
        }
    } catch (e) {}

    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];

        // Calculate video and audio cut points separately
        var videoCutStart = seg.start + videoPaddingBefore;
        var videoCutEnd = seg.end - videoPaddingAfter;
        var audioCutStart = seg.start + audioPaddingBefore;
        var audioCutEnd = seg.end - audioPaddingAfter;

        // Validate
        if (videoCutEnd <= videoCutStart && audioCutEnd <= audioCutStart) {
            log("Skip segment " + (i+1) + ": too short after padding");
            continue;
        }

        // Get current sequence duration
        var seqDur = getSequenceDuration(sequence);

        // Skip if beyond sequence
        if (videoCutStart >= seqDur && audioCutStart >= seqDur) {
            log("Skip segment " + (i+1) + ": beyond sequence");
            continue;
        }

        // Clamp to sequence
        if (videoCutEnd > seqDur) videoCutEnd = seqDur - 0.001;
        if (audioCutEnd > seqDur) audioCutEnd = seqDur - 0.001;

        log("Segment " + (i+1) + "/" + segments.length + ":");
        log("  Video cut: " + videoCutStart.toFixed(3) + "s - " + videoCutEnd.toFixed(3) + "s");
        log("  Audio cut: " + audioCutStart.toFixed(3) + "s - " + audioCutEnd.toFixed(3) + "s");

        // If video and audio cuts are the same, use normal extract
        if (Math.abs(videoCutStart - audioCutStart) < 0.01 && Math.abs(videoCutEnd - audioCutEnd) < 0.01) {
            log("  Same timing - using normal extract");
            var effectiveStart = videoCutStart;
            var effectiveEnd = videoCutEnd;

            if (effectiveEnd > effectiveStart + 0.1) {
                // Align to frame
                var startTicks = Math.round(effectiveStart * TICKS_PER_SECOND / ticksPerFrame) * ticksPerFrame;
                var endTicks = Math.round(effectiveEnd * TICKS_PER_SECOND / ticksPerFrame) * ticksPerFrame;
                var alignedStart = startTicks / TICKS_PER_SECOND;
                var alignedEnd = endTicks / TICKS_PER_SECOND;

                try {
                    sequence.setInPoint(alignedStart);
                    sequence.setOutPoint(alignedEnd);
                    qeSeq.extract();
                    qeSeq.setInPoint("");
                    qeSeq.setOutPoint("");
                    deletedCount++;
                } catch (e) {
                    log("  Error: " + e.toString());
                }
            }
        } else {
            // Different timing - use track-specific processing
            log("  Different timing - processing tracks separately");

            // Use the longer cut range for the main extract
            var mainCutStart = Math.min(videoCutStart, audioCutStart);
            var mainCutEnd = Math.max(videoCutEnd, audioCutEnd);

            if (mainCutEnd > mainCutStart + 0.1) {
                // Calculate offset times for adjusting after main cut
                var videoOffset = videoCutStart - mainCutStart;  // How much to extend video at start
                var audioOffset = audioCutStart - mainCutStart;  // How much to extend audio at start

                // Align to frame
                var startTicks = Math.round(mainCutStart * TICKS_PER_SECOND / ticksPerFrame) * ticksPerFrame;
                var endTicks = Math.round(mainCutEnd * TICKS_PER_SECOND / ticksPerFrame) * ticksPerFrame;
                var alignedStart = startTicks / TICKS_PER_SECOND;
                var alignedEnd = endTicks / TICKS_PER_SECOND;

                try {
                    // Main cut (affects all tracks)
                    sequence.setInPoint(alignedStart);
                    sequence.setOutPoint(alignedEnd);
                    qeSeq.extract();
                    qeSeq.setInPoint("");
                    qeSeq.setOutPoint("");

                    // After extract, clips have been removed and timeline shifted
                    // The cut point is now at alignedStart
                    // We can adjust clip edges to create J/L cut effect
                    var cutPointTicks = Math.round(alignedStart * TICKS_PER_SECOND);

                    // Adjust video clips (extend/shrink start of next clip)
                    if (Math.abs(videoOffset) > 0.01) {
                        adjustClipsAtCutPoint(sequence.videoTracks, cutPointTicks, videoOffset, ticksPerFrame);
                    }

                    // Adjust audio clips (extend/shrink start of next clip)
                    if (Math.abs(audioOffset) > 0.01) {
                        adjustClipsAtCutPoint(sequence.audioTracks, cutPointTicks, audioOffset, ticksPerFrame);
                    }

                    deletedCount++;
                } catch (e) {
                    log("  Error: " + e.toString());
                    try {
                        qeSeq.setInPoint("");
                        qeSeq.setOutPoint("");
                    } catch (e2) {}
                }
            }
        }
    }

    log("Processed " + deletedCount + " segments with transition");
    return deletedCount;
}

/**
 * Adjust clip edges at cut point to create J/L cut effect
 * offset > 0: Extend clip at this point (revealing more content)
 * offset < 0: Shrink clip at this point (hiding content)
 */
function adjustClipsAtCutPoint(tracks, cutPointTicks, offsetSeconds, ticksPerFrame) {
    var offsetTicks = Math.round(offsetSeconds * TICKS_PER_SECOND / ticksPerFrame) * ticksPerFrame;
    var tolerance = ticksPerFrame * 2; // 2 frame tolerance

    for (var t = 0; t < tracks.numTracks; t++) {
        var track = tracks[t];
        for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];
            if (!clip) continue;

            var clipStart = getTicksNum(clip.start);

            // Find clip that starts at or near the cut point
            if (Math.abs(clipStart - cutPointTicks) < tolerance) {
                try {
                    // Extend or shrink the clip's in point
                    var currentInPoint = getTimeInSeconds(clip.inPoint);
                    var newInPoint = currentInPoint - offsetSeconds; // Negative offset extends

                    if (newInPoint >= 0) {
                        // Use Time object for precision
                        var newInPointTicks = Math.round(newInPoint * TICKS_PER_SECOND);
                        clip.inPoint = { seconds: newInPoint };

                        log("  Adjusted clip in point by " + offsetSeconds.toFixed(3) + "s on track " + t);
                    }
                } catch (e) {
                    log("  Could not adjust clip: " + e.toString());
                }
            }
        }
    }
}

/**
 * Add constant power audio transitions at cut points
 * v21.0 - Actually adds transitions using QE API
 *
 * Uses qe.project.getActiveSequence() methods to add audio transitions
 */
function addConstantPowerTransitions(sequence) {
    log("=== addConstantPowerTransitions v21.0 ===");

    app.enableQE();
    var qeSeq = qe.project.getActiveSequence();
    if (!qeSeq) {
        log("ERROR: No QE sequence");
        return false;
    }

    var transitionsAdded = 0;
    var transitionDuration = 0.1; // 100ms transition duration (frames)
    var ticksPerFrame = TICKS_PER_SECOND / 30;
    try {
        var timebase = sequence.timebase;
        if (timebase) {
            ticksPerFrame = parseFloat(timebase);
        }
    } catch (e) {}

    // Calculate transition duration in frames (typically 4-6 frames)
    var framesPerSecond = TICKS_PER_SECOND / ticksPerFrame;
    var transitionFrames = Math.round(transitionDuration * framesPerSecond);
    if (transitionFrames < 2) transitionFrames = 2;
    if (transitionFrames > 10) transitionFrames = 10;

    log("Transition duration: " + transitionFrames + " frames");

    // Find edit points in audio tracks
    var editPoints = findAudioEditPoints(sequence);
    log("Found " + editPoints.length + " audio edit points");

    // Add transitions at each edit point
    for (var i = 0; i < editPoints.length; i++) {
        var editPoint = editPoints[i];
        try {
            // Get the QE audio track
            var qeAudioTrack = qeSeq.getAudioTrackAt(editPoint.trackIndex);
            if (qeAudioTrack) {
                // Try to add audio transition at the clip index
                // The addTransition method uses clip index, not time
                var clipIndex = editPoint.clipIndex;

                // Use addTransition to add Constant Power (default audio transition)
                // Parameters: transitionName, clipIndex, alignment, duration
                // Alignment: 0 = center, 1 = start, 2 = end
                try {
                    qeAudioTrack.addTransition(clipIndex, "Constant Power");
                    transitionsAdded++;
                    log("  Added transition on track " + editPoint.trackIndex + " at clip " + clipIndex);
                } catch (transErr) {
                    // Try alternative method
                    log("  Could not add transition at clip " + clipIndex + ": " + transErr);
                }
            }
        } catch (e) {
            log("  Error adding transition: " + e.toString());
        }
    }

    log("Added " + transitionsAdded + " Constant Power transitions");

    // If automated transitions failed, provide guidance
    if (transitionsAdded === 0 && editPoints.length > 0) {
        log("Note: Automated transitions may not have been applied.");
        log("To add transitions manually:");
        log("  1. Select all clips (Cmd/Ctrl + A)");
        log("  2. Go to Sequence > Apply Default Transitions");
        log("  3. Or right-click between clips and add 'Constant Power'");
    }

    return transitionsAdded > 0;
}

/**
 * Find edit points (cut points) in audio tracks
 * Returns array of {trackIndex, clipIndex, time} for each edit point
 */
function findAudioEditPoints(sequence) {
    var editPoints = [];
    var tolerance = TICKS_PER_SECOND * 0.05; // 50ms tolerance

    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        var track = sequence.audioTracks[a];
        var clips = [];

        // Collect clip info
        for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];
            if (clip) {
                clips.push({
                    index: c,
                    start: getTicksNum(clip.start),
                    end: getTicksNum(clip.end)
                });
            }
        }

        // Sort by start time
        clips.sort(function(a, b) { return a.start - b.start; });

        // Find adjacent clips (edit points)
        for (var i = 0; i < clips.length - 1; i++) {
            var currentClip = clips[i];
            var nextClip = clips[i + 1];

            // Check if clips are adjacent (gap < tolerance)
            var gap = nextClip.start - currentClip.end;
            if (Math.abs(gap) < tolerance) {
                editPoints.push({
                    trackIndex: a,
                    clipIndex: currentClip.index,
                    time: currentClip.end / TICKS_PER_SECOND
                });
            }
        }
    }

    return editPoints;
}

/**
 * Disable (mute) segments without deleting them
 * v20.2 - Split clips at segment boundaries and disable the silence parts
 * Now supports selectedTracks parameter
 */
function disableSegments(sequence, segments, paddingBefore, paddingAfter, selectedTracks) {
    log("=== disableSegments v20.2 ===");
    log("Input segments count: " + segments.length);

    // Default to all tracks if not specified
    if (!selectedTracks || selectedTracks.length === 0) {
        selectedTracks = ["A1", "A2", "A3"];
    }
    log("Selected tracks: " + selectedTracks.join(", "));

    // Sort segments by start time ascending
    segments.sort(function(a, b) { return a.start - b.start; });

    var disabledCount = 0;

    // Get frame duration for alignment
    var ticksPerFrame = TICKS_PER_SECOND / 30;
    try {
        var timebase = sequence.timebase;
        if (timebase) {
            ticksPerFrame = parseFloat(timebase);
        }
    } catch (e) {}

    // Process each segment
    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];

        // Apply padding
        var cutStart = seg.start + paddingBefore;
        var cutEnd = seg.end - paddingAfter;

        if (cutEnd <= cutStart || (cutEnd - cutStart) < 0.1) {
            log("Skip segment " + (i+1) + ": too short after padding");
            continue;
        }

        // Align to frame boundary
        var startTicks = Math.round(cutStart * TICKS_PER_SECOND / ticksPerFrame) * ticksPerFrame;
        var endTicks = Math.round(cutEnd * TICKS_PER_SECOND / ticksPerFrame) * ticksPerFrame;

        log("Disabling segment " + (i+1) + ": " + (startTicks/TICKS_PER_SECOND).toFixed(3) + "s - " + (endTicks/TICKS_PER_SECOND).toFixed(3) + "s");

        // Find and disable clips that overlap with this segment
        var disabled = disableClipsInRange(sequence, startTicks, endTicks, selectedTracks);
        if (disabled > 0) {
            disabledCount++;
        }
    }

    log("Disabled " + disabledCount + " segments");
    return disabledCount;
}

/**
 * Convert track index to track name (A1, A2, A3, etc.)
 */
function getTrackName(trackIndex) {
    return "A" + (trackIndex + 1);
}

/**
 * Check if a track is in the selected tracks list
 */
function isTrackSelected(trackIndex, selectedTracks) {
    var trackName = getTrackName(trackIndex);
    for (var i = 0; i < selectedTracks.length; i++) {
        if (selectedTracks[i] === trackName) {
            return true;
        }
    }
    return false;
}

/**
 * Find clips in time range and disable them (selected audio tracks only)
 */
function disableClipsInRange(sequence, startTicks, endTicks, selectedTracks) {
    var disabled = 0;
    var tolerance = TICKS_PER_SECOND * 0.05;

    // Process selected audio tracks only
    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        // Skip if track is not selected
        if (!isTrackSelected(a, selectedTracks)) {
            continue;
        }

        var track = sequence.audioTracks[a];

        for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];
            if (!clip) continue;

            var clipStart = getTicksNum(clip.start);
            var clipEnd = getTicksNum(clip.end);

            // Check if clip overlaps with the segment
            if (clipEnd > startTicks && clipStart < endTicks) {
                try {
                    // Disable the clip (mute it)
                    clip.disabled = true;
                    log("  Disabled audio clip on " + getTrackName(a) + " at " + (clipStart/TICKS_PER_SECOND).toFixed(2) + "s");
                    disabled++;
                } catch (e) {
                    log("  Error disabling clip: " + e.toString());
                }
            }
        }
    }

    return disabled;
}

/**
 * Delete segments but keep the space (no ripple)
 * v20.0 - Uses lift instead of extract
 */
function deleteSegmentsKeepSpace(sequence, segments, paddingBefore, paddingAfter) {
    log("=== deleteSegmentsKeepSpace v20.0 ===");
    log("Input segments count: " + segments.length);

    // Sort segments by start time descending (process from end first)
    segments.sort(function(a, b) { return b.start - a.start; });

    app.enableQE();
    var qeSeq = qe.project.getActiveSequence();
    if (!qeSeq) {
        log("ERROR: No QE sequence");
        return 0;
    }

    var deletedCount = 0;

    // Get frame duration for alignment
    var ticksPerFrame = TICKS_PER_SECOND / 30;
    try {
        var timebase = sequence.timebase;
        if (timebase) {
            ticksPerFrame = parseFloat(timebase);
        }
    } catch (e) {}

    // Process each segment
    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];

        // Apply padding
        var cutStart = seg.start + paddingBefore;
        var cutEnd = seg.end - paddingAfter;

        if (cutEnd <= cutStart || (cutEnd - cutStart) < 0.1) {
            log("Skip segment " + (i+1) + ": too short after padding");
            continue;
        }

        // Align to frame boundary
        var startTicks = Math.round(cutStart * TICKS_PER_SECOND / ticksPerFrame) * ticksPerFrame;
        var endTicks = Math.round(cutEnd * TICKS_PER_SECOND / ticksPerFrame) * ticksPerFrame;
        var alignedStart = startTicks / TICKS_PER_SECOND;
        var alignedEnd = endTicks / TICKS_PER_SECOND;

        log("Lift segment " + (i+1) + ": " + alignedStart.toFixed(3) + "s - " + alignedEnd.toFixed(3) + "s");

        try {
            // Set in/out points
            sequence.setInPoint(alignedStart);
            sequence.setOutPoint(alignedEnd);

            // Use lift instead of extract (keeps the gap)
            qeSeq.lift();
            deletedCount++;

            // Clear in/out points
            try {
                qeSeq.setInPoint("");
                qeSeq.setOutPoint("");
            } catch (e2) {}

        } catch (e) {
            log("  Error lifting segment: " + e.toString());
            try {
                qeSeq.setInPoint("");
                qeSeq.setOutPoint("");
            } catch (e2) {}
        }
    }

    log("Lifted " + deletedCount + " segments (keeping space)");
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

// ============================================
// Transcription Functions
// ============================================

/**
 * Get all clip paths in the sequence with timing info
 * Used to extract and combine audio for full sequence transcription
 */
function getAllClipPaths() {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        log("=== getAllClipPaths ===");

        var clips = [];
        var processedPaths = {}; // Track unique paths

        // Get frame rate for time conversion
        var frameRate = sequence.getSettings().videoFrameRate.seconds;
        if (!frameRate || frameRate <= 0) frameRate = 1/29.97;

        // Collect all video clips with audio
        for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
            var track = sequence.videoTracks[v];
            for (var c = 0; c < track.clips.numItems; c++) {
                var clip = track.clips[c];
                if (clip && clip.projectItem) {
                    var mediaPath = clip.projectItem.getMediaPath();
                    if (mediaPath && mediaPath.length > 0) {
                        var startTime = clip.start.seconds;
                        var endTime = clip.end.seconds;
                        var inPoint = clip.inPoint ? clip.inPoint.seconds : 0;
                        var outPoint = clip.outPoint ? clip.outPoint.seconds : (endTime - startTime);

                        clips.push({
                            path: mediaPath,
                            sequenceStart: startTime,
                            sequenceEnd: endTime,
                            sourceIn: inPoint,
                            sourceOut: outPoint,
                            duration: endTime - startTime,
                            type: "video"
                        });
                        processedPaths[mediaPath + "_" + startTime] = true;
                        log("Video clip: " + mediaPath + " @ " + startTime + "-" + endTime);
                    }
                }
            }
        }

        // Collect audio-only clips (not linked to video)
        for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
            var aTrack = sequence.audioTracks[a];
            for (var ac = 0; ac < aTrack.clips.numItems; ac++) {
                var aClip = aTrack.clips[ac];
                if (aClip && aClip.projectItem) {
                    var aMediaPath = aClip.projectItem.getMediaPath();
                    var aStartTime = aClip.start.seconds;
                    var key = aMediaPath + "_" + aStartTime;

                    // Skip if already processed (linked audio)
                    if (processedPaths[key]) continue;

                    if (aMediaPath && aMediaPath.length > 0) {
                        var aEndTime = aClip.end.seconds;
                        var aInPoint = aClip.inPoint ? aClip.inPoint.seconds : 0;
                        var aOutPoint = aClip.outPoint ? aClip.outPoint.seconds : (aEndTime - aStartTime);

                        clips.push({
                            path: aMediaPath,
                            sequenceStart: aStartTime,
                            sequenceEnd: aEndTime,
                            sourceIn: aInPoint,
                            sourceOut: aOutPoint,
                            duration: aEndTime - aStartTime,
                            type: "audio"
                        });
                        log("Audio clip: " + aMediaPath + " @ " + aStartTime + "-" + aEndTime);
                    }
                }
            }
        }

        // Sort by sequence start time
        clips.sort(function(a, b) {
            return a.sequenceStart - b.sequenceStart;
        });

        log("Total clips found: " + clips.length);

        return JSON.stringify({
            success: true,
            clips: clips,
            sequenceDuration: sequence.end.seconds
        });

    } catch (e) {
        log("getAllClipPaths error: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

/**
 * Get the file path of the first clip in the sequence
 * Used to extract audio for transcription
 */
function getFirstClipPath() {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        log("=== getFirstClipPath ===");

        // Try to find a clip with a valid media path
        // Check video tracks first
        for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
            var track = sequence.videoTracks[v];
            for (var c = 0; c < track.clips.numItems; c++) {
                var clip = track.clips[c];
                if (clip && clip.projectItem) {
                    var mediaPath = clip.projectItem.getMediaPath();
                    if (mediaPath && mediaPath.length > 0) {
                        log("Found video clip path: " + mediaPath);
                        return JSON.stringify({
                            success: true,
                            path: mediaPath,
                            type: "video",
                            name: clip.name || clip.projectItem.name
                        });
                    }
                }
            }
        }

        // Check audio tracks
        for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
            var aTrack = sequence.audioTracks[a];
            for (var ac = 0; ac < aTrack.clips.numItems; ac++) {
                var aClip = aTrack.clips[ac];
                if (aClip && aClip.projectItem) {
                    var aMediaPath = aClip.projectItem.getMediaPath();
                    if (aMediaPath && aMediaPath.length > 0) {
                        log("Found audio clip path: " + aMediaPath);
                        return JSON.stringify({
                            success: true,
                            path: aMediaPath,
                            type: "audio",
                            name: aClip.name || aClip.projectItem.name
                        });
                    }
                }
            }
        }

        return JSON.stringify({ success: false, error: "No clips with media found in sequence" });
    } catch (e) {
        log("getFirstClipPath error: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

/**
 * Get clip mapping information for timestamp conversion
 * Returns all audio clips with their sequence position and source in/out points
 * Used to convert Whisper timestamps (source-based) to sequence timeline positions
 */
function getClipMapping() {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        log("=== getClipMapping ===");

        var clips = [];
        var sourceMediaPath = null;

        // Collect all audio clips from track 1 (primary audio)
        if (sequence.audioTracks.numTracks > 0) {
            var audioTrack = sequence.audioTracks[0];
            log("Audio track clips count: " + audioTrack.clips.numItems);

            for (var i = 0; i < audioTrack.clips.numItems; i++) {
                var clip = audioTrack.clips[i];
                if (!clip) continue;

                // Get clip times
                var seqStart = getTimeInSeconds(clip.start);
                var seqEnd = getTimeInSeconds(clip.end);
                var sourceIn = getTimeInSeconds(clip.inPoint);
                var sourceOut = getTimeInSeconds(clip.outPoint);

                // Get media path
                var mediaPath = "";
                if (clip.projectItem) {
                    mediaPath = clip.projectItem.getMediaPath() || "";
                    if (!sourceMediaPath && mediaPath.length > 0) {
                        sourceMediaPath = mediaPath;
                    }
                }

                log("Clip " + i + ": seq=" + seqStart.toFixed(3) + "-" + seqEnd.toFixed(3) +
                    ", src=" + sourceIn.toFixed(3) + "-" + sourceOut.toFixed(3));

                clips.push({
                    index: i,
                    sequenceStart: seqStart,
                    sequenceEnd: seqEnd,
                    sourceIn: sourceIn,
                    sourceOut: sourceOut,
                    duration: seqEnd - seqStart,
                    mediaPath: mediaPath
                });
            }
        }

        log("Total clips mapped: " + clips.length);
        log("Source media path: " + sourceMediaPath);

        return JSON.stringify({
            success: true,
            clips: clips,
            sourceMediaPath: sourceMediaPath,
            clipCount: clips.length
        });
    } catch (e) {
        log("getClipMapping error: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

/**
 * Add captions to sequence as actual caption track
 * Uses Premiere Pro's Caption API to create proper subtitles
 * @param {string} segmentsJson - JSON array of {start, end, text} segments
 * v21.2 - Enhanced debug info and fix marker timing
 */
function addCaptionsToSequence(segmentsJson) {
    try {
        var segments = JSON.parse(segmentsJson);
        var sequence = app.project.activeSequence;

        if (!sequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        log("=== addCaptionsToSequence v21.2 (Enhanced Debug) ===");
        log("Premiere version: " + app.version);
        log("Adding " + segments.length + " caption segments");

        var addedCount = 0;
        var debugInfo = {
            premiereVersion: app.version,
            hasCaptionTracks: false,
            captionTracksNumTracks: -1,
            hasCreateCaptionTrack: false,
            captionTrackMethods: [],
            captionApiError: null,
            graphicsError: null
        };

        // Try to use Caption API (Premiere Pro 2021+)
        try {
            debugInfo.hasCaptionTracks = (sequence.captionTracks !== undefined);
            log("captionTracks exists: " + debugInfo.hasCaptionTracks);

            // Check if captionTracks exists and has numTracks
            if (sequence.captionTracks) {
                // Try to get numTracks
                try {
                    debugInfo.captionTracksNumTracks = sequence.captionTracks.numTracks;
                    log("captionTracks.numTracks: " + debugInfo.captionTracksNumTracks);
                } catch (numErr) {
                    log("Could not get numTracks: " + numErr);
                    debugInfo.captionApiError = "numTracks error: " + numErr;
                }

                debugInfo.hasCreateCaptionTrack = (typeof sequence.createCaptionTrack === "function");
                log("createCaptionTrack exists: " + debugInfo.hasCreateCaptionTrack);

                if (debugInfo.captionTracksNumTracks >= 0) {
                    var captionTrack = null;

                    // Get or create caption track
                    if (debugInfo.captionTracksNumTracks > 0) {
                        captionTrack = sequence.captionTracks[0];
                        log("Using existing caption track");
                    } else if (debugInfo.hasCreateCaptionTrack) {
                        try {
                            captionTrack = sequence.createCaptionTrack();
                            log("Created new caption track");
                        } catch (createErr) {
                            log("Could not create caption track: " + createErr);
                            debugInfo.captionApiError = "createCaptionTrack error: " + createErr;
                        }
                    }

                    if (captionTrack) {
                        // List available methods on captionTrack
                        for (var key in captionTrack) {
                            if (typeof captionTrack[key] === "function") {
                                debugInfo.captionTrackMethods.push(key);
                            }
                        }
                        log("Caption track methods: " + debugInfo.captionTrackMethods.join(", "));

                        // Add captions to the track
                        for (var i = 0; i < segments.length; i++) {
                            var seg = segments[i];
                            try {
                                // Try different method signatures
                                if (typeof captionTrack.addCaption === "function") {
                                    // Try with Time objects (ticks)
                                    var startTicks = Math.round(seg.start * TICKS_PER_SECOND);
                                    var durationTicks = Math.round((seg.end - seg.start) * TICKS_PER_SECOND);
                                    captionTrack.addCaption(startTicks, durationTicks, seg.text);
                                    addedCount++;
                                    log("Added caption " + (i + 1) + " via addCaption (ticks)");
                                } else if (typeof captionTrack.insertCaption === "function") {
                                    var startTicks = Math.round(seg.start * TICKS_PER_SECOND);
                                    var endTicks = Math.round(seg.end * TICKS_PER_SECOND);
                                    captionTrack.insertCaption(startTicks, endTicks, seg.text);
                                    addedCount++;
                                    log("Inserted caption " + (i + 1) + " via insertCaption");
                                } else {
                                    log("No addCaption or insertCaption method found");
                                    if (i === 0) {
                                        debugInfo.captionApiError = "No add/insert method";
                                    }
                                    break;
                                }
                            } catch (capErr) {
                                log("Caption API error for segment " + (i + 1) + ": " + capErr);
                                if (i === 0) {
                                    debugInfo.captionApiError = capErr.toString();
                                }
                                // Try seconds format as fallback
                                try {
                                    if (typeof captionTrack.addCaption === "function") {
                                        captionTrack.addCaption(seg.start, seg.end - seg.start, seg.text);
                                        addedCount++;
                                        log("Added caption " + (i + 1) + " via addCaption (seconds)");
                                    }
                                } catch (secErr) {
                                    log("Seconds format also failed: " + secErr);
                                }
                            }
                        }
                    }

                    if (addedCount > 0) {
                        return JSON.stringify({
                            success: true,
                            count: addedCount,
                            total: segments.length,
                            method: "captionTrack",
                            debug: debugInfo
                        });
                    }
                }
            }
        } catch (captionErr) {
            log("Caption API error: " + captionErr);
            debugInfo.captionApiError = captionErr.toString();
        }

        // Fallback: Create Graphics Text clips as subtitles on V2 track
        log("Caption API failed, trying Graphics Text fallback");

        try {
            addedCount = createTextGraphicsForCaptions(sequence, segments);

            if (addedCount > 0) {
                return JSON.stringify({
                    success: true,
                    count: addedCount,
                    total: segments.length,
                    method: "graphicsText",
                    debug: debugInfo
                });
            }
        } catch (gfxErr) {
            log("Graphics text error: " + gfxErr);
            debugInfo.graphicsError = gfxErr.toString();
        }

        // Final fallback: Use markers (original method)
        log("Falling back to markers method");

        var markers = sequence.markers;
        addedCount = 0;

        for (var i = 0; i < segments.length; i++) {
            var seg = segments[i];
            try {
                // FIXED: Convert seconds to ticks for createMarker
                var startTicks = Math.round(seg.start * TICKS_PER_SECOND);
                var endTicks = Math.round(seg.end * TICKS_PER_SECOND);

                var marker = markers.createMarker(startTicks);
                if (marker) {
                    marker.name = seg.text.substring(0, 50);
                    marker.comments = seg.text;
                    marker.end = { ticks: String(endTicks) };
                    marker.setColorByIndex(3); // Yellow
                    addedCount++;
                }
            } catch (markerErr) {
                log("Marker error: " + markerErr);
            }
        }

        return JSON.stringify({
            success: true,
            count: addedCount,
            total: segments.length,
            method: "markers",
            note: "Caption API not available. Markers created instead. Import the SRT file manually for proper subtitles.",
            debug: debugInfo
        });
    } catch (e) {
        log("addCaptionsToSequence error: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

/**
 * Create text graphics clips for captions (fallback method)
 * Creates essential graphics text clips on a video track
 */
function createTextGraphicsForCaptions(sequence, segments) {
    log("=== createTextGraphicsForCaptions ===");

    // Get or create a video track for captions
    var targetTrackIndex = 1; // V2 track (0-indexed)

    // Ensure we have enough video tracks
    while (sequence.videoTracks.numTracks <= targetTrackIndex) {
        try {
            // Can't easily add tracks via API, use existing
            targetTrackIndex = sequence.videoTracks.numTracks - 1;
            break;
        } catch (e) {
            break;
        }
    }

    if (targetTrackIndex < 0) targetTrackIndex = 0;

    var targetTrack = sequence.videoTracks[targetTrackIndex];
    log("Using video track: V" + (targetTrackIndex + 1));

    var addedCount = 0;
    var ticksPerSecond = TICKS_PER_SECOND;

    // Try to find a text/title mogrt or template in the project
    var mogrtTemplate = findMogrtTemplate();

    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];

        try {
            // Calculate position in ticks
            var startTicks = Math.round(seg.start * ticksPerSecond);
            var endTicks = Math.round(seg.end * ticksPerSecond);
            var durationTicks = endTicks - startTicks;

            // Method 1: Try to insert from mogrt template
            if (mogrtTemplate) {
                var clip = targetTrack.insertClip(mogrtTemplate, startTicks / ticksPerSecond);
                if (clip) {
                    // Try to modify text
                    if (clip.components) {
                        for (var c = 0; c < clip.components.numItems; c++) {
                            var comp = clip.components[c];
                            if (comp.properties) {
                                for (var p = 0; p < comp.properties.numItems; p++) {
                                    var prop = comp.properties[p];
                                    if (prop.displayName && prop.displayName.toLowerCase().indexOf("text") >= 0) {
                                        prop.setValue(seg.text);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    // Set duration
                    clip.end = endTicks / ticksPerSecond;
                    addedCount++;
                    log("Added text clip " + (i + 1));
                }
            }
        } catch (clipErr) {
            log("Could not create text clip " + (i + 1) + ": " + clipErr);
        }
    }

    return addedCount;
}

/**
 * Find a motion graphics template for text
 */
function findMogrtTemplate() {
    try {
        var rootItem = app.project.rootItem;

        // Search for text mogrt in project
        for (var i = 0; i < rootItem.children.numItems; i++) {
            var item = rootItem.children[i];
            if (item && item.type === ProjectItemType.FILE) {
                var name = item.name.toLowerCase();
                if (name.indexOf("text") >= 0 || name.indexOf("title") >= 0 || name.indexOf("caption") >= 0) {
                    log("Found template: " + item.name);
                    return item;
                }
            }
        }
    } catch (e) {
        log("Could not find mogrt template: " + e);
    }

    return null;
}

/**
 * Import SRT file as captions
 * @param {string} srtPath - Path to SRT file
 */
function importSRTCaptions(srtPath) {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        log("=== importSRTCaptions ===");
        log("Importing: " + srtPath);

        // Try to import the SRT file using the project importer
        var importResult = app.project.importFiles([srtPath], true, app.project.rootItem, false);

        if (importResult) {
            log("SRT file imported successfully");
            return JSON.stringify({ success: true, message: "SRT imported" });
        } else {
            return JSON.stringify({ success: false, error: "Import failed" });
        }
    } catch (e) {
        log("importSRTCaptions error: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

/**
 * Show save dialog for SRT file
 * @param {string} defaultName - Default filename (without extension)
 * @param {string} defaultPath - Default directory path
 */
function showSaveDialog(defaultName, defaultPath) {
    try {
        log("=== showSaveDialog ===");
        log("defaultName: " + defaultName);
        log("defaultPath: " + defaultPath);

        var defaultFile;
        if (defaultPath && defaultPath.length > 0) {
            defaultFile = new File(defaultPath + "/" + defaultName + ".srt");
        } else {
            defaultFile = new File("~/" + defaultName + ".srt");
        }

        var saveFile = defaultFile.saveDlg("SRTファイルを保存", "SRT Files:*.srt");

        if (saveFile) {
            log("User selected: " + saveFile.fsName);
            return JSON.stringify({
                success: true,
                path: saveFile.fsName
            });
        } else {
            log("User cancelled save dialog");
            return JSON.stringify({
                success: false,
                cancelled: true
            });
        }
    } catch (e) {
        log("showSaveDialog error: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

/**
 * Set player position (jump to time)
 * @param {number} seconds - Time in seconds
 */
function setPlayerPosition(seconds) {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        log("=== setPlayerPosition ===");
        log("Jumping to: " + seconds + " seconds");

        // Convert seconds to ticks
        var ticks = Math.round(seconds * TICKS_PER_SECOND);

        // Set player position
        sequence.setPlayerPosition(String(ticks));

        return JSON.stringify({ success: true, time: seconds });
    } catch (e) {
        log("setPlayerPosition error: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString() });
    }
}

/**
 * Add SRT to caption track automatically
 * @param {string} srtPath - Path to SRT file
 */
function addSRTToCaptionTrack(srtPath) {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({ success: false, error: "No active sequence" });
        }

        log("=== addSRTToCaptionTrack ===");
        log("SRT path: " + srtPath);

        // Import SRT file to project
        var importResult = app.project.importFiles([srtPath], true, app.project.rootItem, false);

        if (!importResult) {
            return JSON.stringify({ success: false, error: "Failed to import SRT file" });
        }

        // Find the imported SRT in project
        var srtItem = null;
        var fileName = srtPath.split("/").pop().split("\\").pop();
        var nameWithoutExt = fileName.replace(/\.srt$/i, "");

        log("Looking for imported file: " + nameWithoutExt);

        // Search in root item
        for (var i = 0; i < app.project.rootItem.children.numItems; i++) {
            var item = app.project.rootItem.children[i];
            if (item.name === nameWithoutExt || item.name === fileName) {
                srtItem = item;
                log("Found SRT item: " + item.name);
                break;
            }
        }

        if (!srtItem) {
            log("SRT item not found in project, returning success with import only");
            return JSON.stringify({
                success: true,
                method: "importOnly",
                message: "SRTファイルをインポートしました。キャプショントラックにドラッグしてください。"
            });
        }

        // Try to add to caption track
        // Note: Premiere Pro's ExtendScript API doesn't have direct caption track manipulation
        // The SRT is imported and user needs to drag it to caption track

        return JSON.stringify({
            success: true,
            method: "imported",
            projectItem: srtItem.name,
            message: "SRTファイルをプロジェクトにインポートしました。キャプショントラックにドラッグしてください。"
        });

    } catch (e) {
        log("addSRTToCaptionTrack error: " + e.toString());
        return JSON.stringify({ success: false, error: e.toString() });
    }
}
