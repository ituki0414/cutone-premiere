/**
 * CutOne - Premiere Pro Extension
 * ExtendScript for Premiere Pro API interaction
 * Version 2.0 - Complete rewrite for reliability
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
function formatTime(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = Math.floor(seconds % 60);
    var ms = Math.floor((seconds % 1) * 1000);
    return pad(h, 2) + ":" + pad(m, 2) + ":" + pad(s, 2) + "." + pad(ms, 3);
}

function pad(num, size) {
    var s = "000" + num;
    return s.substr(s.length - size);
}

function ticksToSeconds(ticks) {
    return ticks / TICKS_PER_SECOND;
}

function secondsToTicks(seconds) {
    return Math.round(seconds * TICKS_PER_SECOND);
}

// ============================================
// Test Functions
// ============================================
function testExtendScript() {
    return JSON.stringify({
        success: true,
        message: "ExtendScript loaded successfully",
        os: $.os,
        hasGetActiveSequence: typeof getActiveSequence === "function",
        hasProcessSegments: typeof processSegments === "function"
    });
}

// ============================================
// Sequence Functions
// ============================================
function getActiveSequence() {
    try {
        var sequence = app.project.activeSequence;

        if (!sequence) {
            return JSON.stringify({
                success: false,
                error: "No active sequence"
            });
        }

        var durationTicks = sequence.end - sequence.zeroPoint;
        var durationSeconds = ticksToSeconds(durationTicks);

        return JSON.stringify({
            success: true,
            name: sequence.name,
            videoTracks: sequence.videoTracks.numTracks,
            audioTracks: sequence.audioTracks.numTracks,
            duration: durationSeconds,
            durationFormatted: formatTime(durationSeconds)
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: "getActiveSequence error: " + e.toString()
        });
    }
}

/**
 * Get detailed sequence and clip information for processing
 * This is the key function that provides all timing info for FFmpeg
 */
function getSequenceInfo() {
    try {
        $.writeln("[CutOne] ========== getSequenceInfo START ==========");
        var sequence = app.project.activeSequence;

        if (!sequence) {
            $.writeln("[CutOne] ERROR: No active sequence");
            return JSON.stringify({
                success: false,
                error: "アクティブなシーケンスがありません。シーケンスを開いてから再度お試しください。"
            });
        }

        $.writeln("[CutOne] Sequence: " + sequence.name);

        // Calculate sequence duration
        var sequenceDurationTicks = sequence.end - sequence.zeroPoint;
        var sequenceDuration = ticksToSeconds(sequenceDurationTicks);
        $.writeln("[CutOne] Sequence duration: " + sequenceDuration.toFixed(2) + "s");

        // Find the first clip with media
        var clipInfo = findFirstClipWithMedia(sequence);

        if (!clipInfo) {
            $.writeln("[CutOne] ERROR: No clips with media found");
            return JSON.stringify({
                success: false,
                error: "シーケンスにクリップがありません。動画クリップを配置してください。"
            });
        }

        $.writeln("[CutOne] Found clip:");
        $.writeln("[CutOne]   Source: " + clipInfo.sourcePath);
        $.writeln("[CutOne]   Clip in sequence: " + clipInfo.startInSequence.toFixed(2) + "s - " + clipInfo.endInSequence.toFixed(2) + "s");
        $.writeln("[CutOne]   Source in/out: " + clipInfo.inPoint.toFixed(2) + "s - " + clipInfo.outPoint.toFixed(2) + "s");
        $.writeln("[CutOne]   Clip duration: " + clipInfo.duration.toFixed(2) + "s");
        $.writeln("[CutOne] ========== getSequenceInfo END ==========");

        return JSON.stringify({
            success: true,
            name: sequence.name,
            sequenceDuration: sequenceDuration,
            // Clip timing info
            sourcePath: clipInfo.sourcePath,
            clipStartInSequence: clipInfo.startInSequence,
            clipEndInSequence: clipInfo.endInSequence,
            clipInPoint: clipInfo.inPoint,
            clipOutPoint: clipInfo.outPoint,
            clipDuration: clipInfo.duration,
            // For backwards compatibility
            duration: sequenceDuration
        });

    } catch (e) {
        $.writeln("[CutOne] ERROR in getSequenceInfo: " + e.toString());
        return JSON.stringify({
            success: false,
            error: "シーケンス情報の取得に失敗: " + e.toString()
        });
    }
}

/**
 * Find the first clip that has media (video or audio)
 */
function findFirstClipWithMedia(sequence) {
    // Check video tracks first
    for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
        var track = sequence.videoTracks[v];
        $.writeln("[CutOne] Checking video track " + (v + 1) + ": " + track.clips.numItems + " clips");

        for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];

            if (clip.projectItem && clip.projectItem.getMediaPath) {
                var mediaPath = clip.projectItem.getMediaPath();

                if (mediaPath && mediaPath.length > 0) {
                    return {
                        sourcePath: mediaPath,
                        startInSequence: clip.start.seconds,
                        endInSequence: clip.end.seconds,
                        inPoint: clip.inPoint.seconds,
                        outPoint: clip.outPoint.seconds,
                        duration: clip.end.seconds - clip.start.seconds,
                        trackType: "video",
                        trackIndex: v
                    };
                }
            }
        }
    }

    // Check audio tracks
    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        var track = sequence.audioTracks[a];
        $.writeln("[CutOne] Checking audio track " + (a + 1) + ": " + track.clips.numItems + " clips");

        for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];

            if (clip.projectItem && clip.projectItem.getMediaPath) {
                var mediaPath = clip.projectItem.getMediaPath();

                if (mediaPath && mediaPath.length > 0) {
                    return {
                        sourcePath: mediaPath,
                        startInSequence: clip.start.seconds,
                        endInSequence: clip.end.seconds,
                        inPoint: clip.inPoint.seconds,
                        outPoint: clip.outPoint.seconds,
                        duration: clip.end.seconds - clip.start.seconds,
                        trackType: "audio",
                        trackIndex: a
                    };
                }
            }
        }
    }

    return null;
}

/**
 * Get first clip source path (legacy function for compatibility)
 */
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
// Process Segments (Main processing function)
// ============================================
/**
 * Process silence segments received from Node.js FFmpeg
 * @param {string} optionsJson - JSON string with segments and options
 */
function processSegments(optionsJson) {
    try {
        $.writeln("[CutOne] ========== processSegments START ==========");
        var options = JSON.parse(optionsJson);

        var segments = options.segments || [];
        var paddingBefore = options.paddingBefore || 0.2;
        var paddingAfter = options.paddingAfter || 0.2;
        var silenceAction = options.silenceAction || "delete";

        $.writeln("[CutOne] Received " + segments.length + " segments");
        $.writeln("[CutOne] Action: " + silenceAction);
        $.writeln("[CutOne] Padding: before=" + paddingBefore + "s, after=" + paddingAfter + "s");

        // Get sequence
        var sequence = app.project.activeSequence;
        if (!sequence) {
            $.writeln("[CutOne] ERROR: No active sequence");
            return JSON.stringify({
                success: false,
                error: "アクティブなシーケンスがありません"
            });
        }

        // IMPORTANT: Calculate original duration BEFORE any modifications
        var originalDuration = ticksToSeconds(sequence.end - sequence.zeroPoint);
        $.writeln("[CutOne] Original duration (before processing): " + originalDuration.toFixed(2) + "s");

        // Validate segments
        if (segments.length === 0) {
            $.writeln("[CutOne] No segments to process");
            return JSON.stringify({
                success: true,
                segmentsFound: 0,
                segmentsProcessed: 0,
                originalDuration: originalDuration,
                newDuration: originalDuration,
                savedPercent: 0,
                message: "無音区間が見つかりませんでした"
            });
        }

        // Log first few segments for debugging
        for (var i = 0; i < Math.min(5, segments.length); i++) {
            $.writeln("[CutOne] Segment " + (i + 1) + ": " +
                      segments[i].start.toFixed(2) + "s - " + segments[i].end.toFixed(2) + "s " +
                      "(duration: " + segments[i].duration.toFixed(2) + "s)");
        }
        if (segments.length > 5) {
            $.writeln("[CutOne] ... and " + (segments.length - 5) + " more segments");
        }

        // Process based on action
        var processedCount = 0;

        if (silenceAction === "delete") {
            $.writeln("[CutOne] Calling deleteSegmentsRipple...");
            processedCount = deleteSegmentsRipple(sequence, segments, paddingBefore, paddingAfter);
        } else if (silenceAction === "keep") {
            $.writeln("[CutOne] Adding markers only (keep mode)...");
            addMarkersForSegments(sequence, segments);
            processedCount = segments.length;
        }

        // Calculate new duration AFTER modifications
        var newDuration = ticksToSeconds(sequence.end - sequence.zeroPoint);
        var savedPercent = originalDuration > 0 ? ((originalDuration - newDuration) / originalDuration) * 100 : 0;

        $.writeln("[CutOne] New duration (after processing): " + newDuration.toFixed(2) + "s");
        $.writeln("[CutOne] Saved: " + savedPercent.toFixed(1) + "%");
        $.writeln("[CutOne] ========== processSegments END ==========");

        return JSON.stringify({
            success: true,
            segmentsFound: segments.length,
            segmentsProcessed: processedCount,
            originalDuration: originalDuration,
            newDuration: newDuration,
            savedPercent: savedPercent,
            action: silenceAction
        });

    } catch (e) {
        $.writeln("[CutOne] ERROR in processSegments: " + e.toString());
        return JSON.stringify({
            success: false,
            error: "処理中にエラーが発生: " + e.toString()
        });
    }
}

/**
 * Delete segments using ripple delete (QE API)
 * Segments must be sorted in DESCENDING order by start time
 */
function deleteSegmentsRipple(sequence, segments, paddingBefore, paddingAfter) {
    // Sort segments by start time DESCENDING (delete from end first to preserve indices)
    segments.sort(function(a, b) { return b.start - a.start; });

    var deletedCount = 0;
    var skippedCount = 0;

    // Enable QE
    try {
        app.enableQE();
    } catch (e) {
        $.writeln("[CutOne] Warning: Could not enable QE: " + e.toString());
    }

    var qeSequence = qe.project.getActiveSequence();

    if (!qeSequence) {
        $.writeln("[CutOne] ERROR: No QE sequence available");
        return 0;
    }

    // Get current sequence duration for validation
    var seqDuration = ticksToSeconds(sequence.end - sequence.zeroPoint);
    $.writeln("[CutOne] deleteSegmentsRipple: " + segments.length + " segments, seqDuration=" + seqDuration.toFixed(2) + "s");

    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];

        // Apply padding to get actual cut points
        var cutStart = seg.start + paddingBefore;
        var cutEnd = seg.end - paddingAfter;
        var cutDuration = cutEnd - cutStart;

        $.writeln("[CutOne] Processing segment " + (i + 1) + "/" + segments.length);
        $.writeln("[CutOne]   Original: " + seg.start.toFixed(2) + "s - " + seg.end.toFixed(2) + "s");
        $.writeln("[CutOne]   Cut region: " + cutStart.toFixed(2) + "s - " + cutEnd.toFixed(2) + "s (" + cutDuration.toFixed(2) + "s)");

        // Validate segment
        if (cutEnd <= cutStart) {
            $.writeln("[CutOne]   SKIP: Invalid (end <= start after padding)");
            skippedCount++;
            continue;
        }

        if (cutDuration < 0.05) {
            $.writeln("[CutOne]   SKIP: Too short (" + cutDuration.toFixed(3) + "s < 0.05s)");
            skippedCount++;
            continue;
        }

        if (cutStart < 0) {
            $.writeln("[CutOne]   SKIP: Start before 0");
            skippedCount++;
            continue;
        }

        // Recalculate sequence duration (it changes after each delete)
        seqDuration = ticksToSeconds(sequence.end - sequence.zeroPoint);

        if (cutStart >= seqDuration) {
            $.writeln("[CutOne]   SKIP: Start (" + cutStart.toFixed(2) + ") >= sequence duration (" + seqDuration.toFixed(2) + ")");
            skippedCount++;
            continue;
        }

        // Clamp cutEnd to sequence duration
        if (cutEnd > seqDuration) {
            $.writeln("[CutOne]   Clamping cutEnd from " + cutEnd.toFixed(2) + " to " + seqDuration.toFixed(2));
            cutEnd = seqDuration;
            cutDuration = cutEnd - cutStart;
        }

        // Skip if segment would delete too much (safety check)
        if (cutDuration > 30) {
            $.writeln("[CutOne]   SKIP: Too long (" + cutDuration.toFixed(2) + "s > 30s max)");
            skippedCount++;
            continue;
        }

        // Perform the ripple delete using QE API
        try {
            var startTicks = secondsToTicks(cutStart);
            var endTicks = secondsToTicks(cutEnd);

            $.writeln("[CutOne]   Extracting: " + startTicks + " - " + endTicks + " ticks");

            // Set in/out points
            qeSequence.setInPoint(startTicks.toString());
            qeSequence.setOutPoint(endTicks.toString());

            // Perform extraction (ripple delete)
            qeSequence.extract();

            deletedCount++;
            $.writeln("[CutOne]   SUCCESS: Deleted segment");

        } catch (e) {
            $.writeln("[CutOne]   ERROR: " + e.toString());
            skippedCount++;
        }
    }

    // Clear in/out points after processing
    try {
        qeSequence.setInPoint("-1");
        qeSequence.setOutPoint("-1");
    } catch (e) {
        // Ignore errors when clearing points
    }

    $.writeln("[CutOne] deleteSegmentsRipple complete: " + deletedCount + " deleted, " + skippedCount + " skipped");
    return deletedCount;
}

// ============================================
// Marker Functions
// ============================================
function addMarkersForSegments(sequence, segments) {
    var markers = sequence.markers;

    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];
        var startTicks = secondsToTicks(seg.start);

        try {
            var marker = markers.createMarker(startTicks);
            marker.name = "Silence " + (i + 1);
            marker.comments = "Duration: " + seg.duration.toFixed(2) + "s";
            marker.setColorByIndex(3); // Yellow
        } catch (e) {
            $.writeln("[CutOne] Could not create marker " + (i + 1) + ": " + e.toString());
        }
    }

    return segments.length;
}

function addSilenceMarkers(segmentsJson) {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({
                success: false,
                error: "No active sequence"
            });
        }

        var segments = JSON.parse(segmentsJson);
        var count = addMarkersForSegments(sequence, segments);

        return JSON.stringify({
            success: true,
            markerCount: count
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: "addSilenceMarkers error: " + e.toString()
        });
    }
}

function clearAllMarkers() {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({
                success: false,
                error: "No active sequence"
            });
        }

        var markers = sequence.markers;
        var count = 0;

        while (markers.numMarkers > 0) {
            markers.deleteMarker(markers.getFirstMarker());
            count++;
        }

        return JSON.stringify({
            success: true,
            deletedCount: count
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: "clearAllMarkers error: " + e.toString()
        });
    }
}

// ============================================
// Preview Functions
// ============================================
function previewWithOptions(optionsJson) {
    try {
        var options = JSON.parse(optionsJson);
        var threshold = options.threshold || -35;
        var minSilenceDuration = options.minSilenceDuration || 0.3;

        // For preview, we just return a placeholder
        // The actual silence detection is done via Node.js FFmpeg
        return JSON.stringify({
            success: true,
            message: "Preview requested",
            threshold: threshold,
            minSilenceDuration: minSilenceDuration
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: "previewWithOptions error: " + e.toString()
        });
    }
}

// ============================================
// Audio Levels (for waveform visualization)
// ============================================
function getAudioLevels(numSamples) {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({
                success: false,
                error: "No active sequence"
            });
        }

        var duration = ticksToSeconds(sequence.end - sequence.zeroPoint);

        // Generate placeholder waveform data
        // Real waveform would require audio analysis
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
        return JSON.stringify({
            success: false,
            error: "getAudioLevels error: " + e.toString()
        });
    }
}
