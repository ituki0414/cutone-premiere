/**
 * CutOne - Premiere Pro Extension
 * ExtendScript for Premiere Pro API interaction
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

// Global variable to store extension path (set during initialization)
var _extensionPath = "";

function getExtensionPath() {
    // If we already have the path, return it
    if (_extensionPath && _extensionPath.length > 0) {
        return _extensionPath;
    }

    // Try multiple methods to get the extension path
    try {
        // Method 1: Use $.fileName (works when script is loaded directly)
        if ($.fileName && $.fileName.length > 0) {
            var scriptFile = new File($.fileName);
            if (scriptFile.exists) {
                _extensionPath = scriptFile.parent.parent.fsName;
                return _extensionPath;
            }
        }
    } catch (e) {}

    try {
        // Method 2: Check common CEP extension locations on Mac
        var macPaths = [
            "/Users/" + $.getenv("USER") + "/Library/Application Support/Adobe/CEP/extensions/com.cutone.premiere",
            Folder.userData.fsName + "/Adobe/CEP/extensions/com.cutone.premiere",
            "/Library/Application Support/Adobe/CEP/extensions/com.cutone.premiere"
        ];

        for (var i = 0; i < macPaths.length; i++) {
            var testFolder = new Folder(macPaths[i]);
            if (testFolder.exists) {
                _extensionPath = macPaths[i];
                return _extensionPath;
            }
        }
    } catch (e) {}

    try {
        // Method 3: Windows paths
        if ($.os.indexOf("Windows") !== -1) {
            var winPaths = [
                $.getenv("APPDATA") + "/Adobe/CEP/extensions/com.cutone.premiere",
                "C:/Program Files (x86)/Common Files/Adobe/CEP/extensions/com.cutone.premiere"
            ];

            for (var i = 0; i < winPaths.length; i++) {
                var testFolder = new Folder(winPaths[i]);
                if (testFolder.exists) {
                    _extensionPath = winPaths[i];
                    return _extensionPath;
                }
            }
        }
    } catch (e) {}

    return "";
}

function getFFmpegPath() {
    var basePath = getExtensionPath();

    if (!basePath || basePath.length === 0) {
        // Fallback: try to find FFmpeg in known locations
        var fallbackPaths = [];

        if ($.os.indexOf("Windows") !== -1) {
            fallbackPaths = [
                Folder.userData.fsName + "/Adobe/CEP/extensions/com.cutone.premiere/bin/ffmpeg-win.exe"
            ];
        } else {
            // Mac
            var user = "";
            try { user = $.getenv("USER"); } catch(e) { user = "itsukiokamoto"; }
            fallbackPaths = [
                "/Users/" + user + "/Library/Application Support/Adobe/CEP/extensions/com.cutone.premiere/bin/ffmpeg-mac",
                "/Users/" + user + "/cutone-premiere/bin/ffmpeg-mac"
            ];
        }

        for (var i = 0; i < fallbackPaths.length; i++) {
            var testFile = new File(fallbackPaths[i]);
            if (testFile.exists) {
                return fallbackPaths[i];
            }
        }
    }

    if ($.os.indexOf("Windows") !== -1) {
        return basePath + "/bin/ffmpeg-win.exe";
    }
    return basePath + "/bin/ffmpeg-mac";
}

function executeCommand(cmd) {
    try {
        if ($.os.indexOf("Windows") !== -1) {
            return system.callSystem('cmd /c "' + cmd + '"');
        } else {
            // Mac: use shell script file approach (app.doScript doesn't exist in Premiere Pro)
            var tempFile = Folder.temp.fsName + "/cmd_out_" + Date.now() + ".txt";
            var scriptFile = Folder.temp.fsName + "/cmd_script_" + Date.now() + ".sh";

            var sf = new File(scriptFile);
            sf.open("w");
            sf.write('#!/bin/bash\n' + cmd + ' > "' + tempFile + '" 2>&1\n');
            sf.close();

            system.callSystem('chmod +x "' + scriptFile + '"');
            system.callSystem('"' + scriptFile + '"');

            // Clean up script file
            var scriptF = new File(scriptFile);
            if (scriptF.exists) scriptF.remove();

            // Read output
            var output = "";
            var f = new File(tempFile);
            if (f.exists) {
                f.open("r");
                output = f.read();
                f.close();
                f.remove();
            }

            return output;
        }
    } catch (e) {
        return "ERROR: " + e.toString();
    }
}

// Execute command and capture stderr to temp file
function executeCommandWithStderr(cmd) {
    try {
        var timestamp = new Date().getTime();
        var tempFile = "/tmp/ffmpeg_out_" + timestamp + ".txt";
        var scriptFile = "/tmp/ffmpeg_script_" + timestamp + ".command";

        if ($.os.indexOf("Windows") !== -1) {
            // Windows: use batch file
            tempFile = Folder.temp.fsName + "\\ffmpeg_out_" + timestamp + ".txt";
            scriptFile = Folder.temp.fsName + "\\ffmpeg_script_" + timestamp + ".bat";

            var sf = new File(scriptFile);
            sf.open("w");
            sf.writeln("@echo off");
            sf.writeln(cmd + ' 2>"' + tempFile + '"');
            sf.close();

            sf.execute();
            $.sleep(5000);
        } else {
            // Mac: write shell script and execute with File.execute()
            var sf = new File(scriptFile);
            sf.open("w");
            sf.writeln("#!/bin/bash");
            sf.writeln(cmd + ' 2>"' + tempFile + '"');
            sf.close();

            // Use osascript to run the script with proper permissions
            var osaScript = new File("/tmp/run_ffmpeg_" + timestamp + ".scpt");
            osaScript.open("w");
            osaScript.writeln('do shell script "chmod +x \'' + scriptFile + '\' && \'' + scriptFile + '\'"');
            osaScript.close();
            osaScript.execute();

            // Wait for FFmpeg to complete (depends on file length)
            $.sleep(5000);

            // Clean up osascript file
            osaScript.remove();
        }

        // Clean up script file
        var scriptF = new File(scriptFile);
        if (scriptF.exists) scriptF.remove();

        // Read output file
        var output = "";
        var f = new File(tempFile);
        if (f.exists) {
            f.open("r");
            output = f.read();
            f.close();
            f.remove();
        }

        return output;
    } catch (e) {
        return "ERROR: " + e.toString();
    }
}

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

// ============================================
// Test Functions
// ============================================
function testExtendScript() {
    var ffmpegPath = getFFmpegPath();
    var ffmpegExists = false;
    try {
        var f = new File(ffmpegPath);
        ffmpegExists = f.exists;
    } catch(e) {}

    return JSON.stringify({
        success: true,
        message: "ExtendScript loaded successfully",
        ffmpegPath: ffmpegPath,
        ffmpegExists: ffmpegExists,
        extensionPath: getExtensionPath(),
        os: $.os,
        hasProcessWithOptions: typeof processWithOptions === "function",
        hasGetActiveSequence: typeof getActiveSequence === "function"
    });
}

function testFFmpeg() {
    var ffmpegPath = getFFmpegPath();
    var ffmpegFile = new File(ffmpegPath);

    if (!ffmpegFile.exists) {
        return JSON.stringify({
            success: false,
            error: "FFmpeg not found",
            testedPath: ffmpegPath,
            extensionPath: getExtensionPath()
        });
    }

    // Try to run FFmpeg version
    try {
        var cmd = '"' + ffmpegPath + '" -version';
        var result = executeCommand(cmd);
        return JSON.stringify({
            success: true,
            ffmpegPath: ffmpegPath,
            versionOutput: result.substring(0, 200)
        });
    } catch(e) {
        return JSON.stringify({
            success: false,
            error: "FFmpeg execution failed: " + e.toString(),
            ffmpegPath: ffmpegPath
        });
    }
}

// Full debug test function
function debugFullTest() {
    var debug = {
        step: "start",
        ffmpegPath: "",
        ffmpegExists: false,
        sourcePath: "",
        sourceExists: false,
        cmdExecuted: "",
        rawOutput: "",
        rawOutputLength: 0,
        segmentsFound: 0,
        error: ""
    };

    try {
        // Step 1: Check FFmpeg
        debug.step = "ffmpeg_check";
        debug.ffmpegPath = getFFmpegPath();
        var ffmpegFile = new File(debug.ffmpegPath);
        debug.ffmpegExists = ffmpegFile.exists;

        if (!debug.ffmpegExists) {
            debug.error = "FFmpeg not found";
            return JSON.stringify(debug);
        }

        // Step 2: Get source path
        debug.step = "source_check";
        debug.sourcePath = getFirstClipSourcePath();

        if (!debug.sourcePath) {
            debug.error = "No source clip found in sequence";
            return JSON.stringify(debug);
        }

        var sourceFile = new File(debug.sourcePath);
        debug.sourceExists = sourceFile.exists;

        if (!debug.sourceExists) {
            debug.error = "Source file does not exist: " + debug.sourcePath;
            return JSON.stringify(debug);
        }

        // Step 3: Run FFmpeg
        debug.step = "ffmpeg_run";
        var cmd = '"' + debug.ffmpegPath + '" -i "' + debug.sourcePath + '" -af silencedetect=noise=-35dB:d=0.3 -f null /dev/null';
        debug.cmdExecuted = cmd;

        var output = executeCommandWithStderr(cmd);
        debug.rawOutput = output.substring(0, 1000);
        debug.rawOutputLength = output.length;

        // Step 4: Parse output
        debug.step = "parse";
        var segments = parseSilenceOutput(output);
        debug.segmentsFound = segments.length;

        debug.step = "complete";
        return JSON.stringify(debug);

    } catch (e) {
        debug.error = e.toString();
        return JSON.stringify(debug);
    }
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

        var duration = sequence.end - sequence.zeroPoint;
        var durationSeconds = duration / TICKS_PER_SECOND;

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

function getFirstClipSourcePath() {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) return null;

        // Check video tracks
        for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
            var track = sequence.videoTracks[v];
            if (track.clips.numItems > 0) {
                var clip = track.clips[0];
                if (clip.projectItem && clip.projectItem.getMediaPath) {
                    return clip.projectItem.getMediaPath();
                }
            }
        }

        // Check audio tracks
        for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
            var track = sequence.audioTracks[a];
            if (track.clips.numItems > 0) {
                var clip = track.clips[0];
                if (clip.projectItem && clip.projectItem.getMediaPath) {
                    return clip.projectItem.getMediaPath();
                }
            }
        }

        return null;
    } catch (e) {
        return null;
    }
}

// Get sequence info including source path (for Node.js FFmpeg)
function getSequenceInfo() {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({
                success: false,
                error: "No active sequence"
            });
        }

        var duration = (sequence.end - sequence.zeroPoint) / TICKS_PER_SECOND;
        var sourcePath = getFirstClipSourcePath();

        return JSON.stringify({
            success: true,
            name: sequence.name,
            duration: duration,
            sourcePath: sourcePath
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: "getSequenceInfo error: " + e.toString()
        });
    }
}

// Process segments received from Node.js FFmpeg
function processSegments(optionsJson) {
    try {
        var options = JSON.parse(optionsJson);
        var segments = options.segments;
        var paddingBefore = options.paddingBefore || 0.2;
        var paddingAfter = options.paddingAfter || 0.2;
        var silenceAction = options.silenceAction || "delete";

        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({
                success: false,
                error: "No active sequence"
            });
        }

        var originalDuration = (sequence.end - sequence.zeroPoint) / TICKS_PER_SECOND;
        var processedCount = 0;

        if (silenceAction === "delete") {
            processedCount = deleteSegments(sequence, segments, paddingBefore, paddingAfter);
        } else if (silenceAction === "keep") {
            addSilenceMarkersFromSegments(sequence, segments);
            processedCount = segments.length;
        }

        var newDuration = (sequence.end - sequence.zeroPoint) / TICKS_PER_SECOND;
        var savedPercent = ((originalDuration - newDuration) / originalDuration) * 100;

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
        return JSON.stringify({
            success: false,
            error: "processSegments error: " + e.toString()
        });
    }
}

// ============================================
// Silence Detection
// ============================================
function detectSilence(audioPath, threshold, minDuration) {
    try {
        var ffmpegPath = getFFmpegPath();
        var ffmpegFile = new File(ffmpegPath);

        if (!ffmpegFile.exists) {
            return JSON.stringify({
                success: false,
                error: "FFmpeg not found at: " + ffmpegPath
            });
        }

        // Check if audio file exists
        var audioFile = new File(audioPath);
        if (!audioFile.exists) {
            return JSON.stringify({
                success: false,
                error: "Audio file not found: " + audioPath
            });
        }

        // Build FFmpeg command
        var cmd = '"' + ffmpegPath + '" -i "' + audioPath +
                  '" -af silencedetect=noise=' + threshold +
                  'dB:d=' + minDuration + ' -f null /dev/null';

        // Execute and capture stderr (where FFmpeg outputs silencedetect info)
        var result = executeCommandWithStderr(cmd);

        var segments = parseSilenceOutput(result);

        return JSON.stringify({
            success: true,
            segments: segments,
            count: segments.length,
            debug: {
                audioPath: audioPath,
                ffmpegPath: ffmpegPath,
                outputLength: result.length,
                outputSample: result.substring(0, 500)
            }
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: "detectSilence error: " + e.toString()
        });
    }
}

function parseSilenceOutput(output) {
    var segments = [];
    var lines = output.split("\n");
    var currentStart = null;

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        var startMatch = line.match(/silence_start:\s*([\d.]+)/);
        if (startMatch) {
            currentStart = parseFloat(startMatch[1]);
        }

        var endMatch = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);
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

// ============================================
// Main Process Function
// ============================================
function processWithOptions(optionsJson) {
    try {
        // Parse options
        var options = JSON.parse(optionsJson);

        // Get sequence
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({
                success: false,
                error: "No active sequence"
            });
        }

        // Extract options with defaults
        var threshold = options.threshold || -35;
        var minSilenceDuration = options.minSilenceDuration || 0.3;
        var paddingBefore = options.paddingBefore || 0.2;
        var paddingAfter = options.paddingAfter || 0.2;
        var silenceAction = options.silenceAction || "delete";

        // Get source file
        var sourcePath = getFirstClipSourcePath();
        if (!sourcePath) {
            return JSON.stringify({
                success: false,
                error: "Could not find source media file"
            });
        }

        // Detect silence
        var silenceResultStr = detectSilence(sourcePath, threshold, minSilenceDuration);
        var silenceResult = JSON.parse(silenceResultStr);

        if (!silenceResult.success) {
            return silenceResultStr;
        }

        var segments = silenceResult.segments;

        if (segments.length === 0) {
            var seqDuration = (sequence.end - sequence.zeroPoint) / TICKS_PER_SECOND;
            return JSON.stringify({
                success: true,
                segmentsFound: 0,
                segmentsProcessed: 0,
                originalDuration: seqDuration,
                newDuration: seqDuration,
                savedPercent: 0,
                message: "No silence segments found",
                debug: silenceResult.debug
            });
        }

        // Calculate original duration
        var originalDuration = (sequence.end - sequence.zeroPoint) / TICKS_PER_SECOND;

        // Process based on action
        var processedCount = 0;

        if (silenceAction === "delete") {
            processedCount = deleteSegments(sequence, segments, paddingBefore, paddingAfter);
        } else if (silenceAction === "keep") {
            addSilenceMarkersFromSegments(sequence, segments);
            processedCount = segments.length;
        }

        // Calculate new duration
        var newDuration = (sequence.end - sequence.zeroPoint) / TICKS_PER_SECOND;
        var savedPercent = ((originalDuration - newDuration) / originalDuration) * 100;

        return JSON.stringify({
            success: true,
            segmentsFound: silenceResult.count,
            segmentsProcessed: processedCount,
            originalDuration: originalDuration,
            newDuration: newDuration,
            savedPercent: savedPercent,
            action: silenceAction
        });

    } catch (e) {
        return JSON.stringify({
            success: false,
            error: "processWithOptions error: " + e.toString() + " (line: " + (e.line || "unknown") + ")"
        });
    }
}

// ============================================
// Delete Segments
// ============================================
function deleteSegments(sequence, segments, paddingBefore, paddingAfter) {
    // Sort descending to avoid index issues (delete from end first)
    segments.sort(function(a, b) { return b.start - a.start; });

    var deletedCount = 0;
    var skippedCount = 0;

    // Enable QE
    app.enableQE();
    var qeSequence = qe.project.getActiveSequence();

    if (!qeSequence) {
        return 0;
    }

    // Get sequence duration for safety check
    var seqDuration = (sequence.end - sequence.zeroPoint) / TICKS_PER_SECOND;

    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];
        var startTime = seg.start + paddingBefore;
        var endTime = seg.end - paddingAfter;
        var segDuration = endTime - startTime;

        // Skip if segment is invalid
        if (endTime <= startTime) {
            skippedCount++;
            continue;
        }

        // Skip very short segments (less than 0.15 seconds)
        if (segDuration < 0.15) {
            skippedCount++;
            continue;
        }

        // Safety: skip if segment is too long (more than 5 seconds for safety)
        if (segDuration > 5) {
            skippedCount++;
            continue;
        }

        // Safety: segment must be within bounds
        if (startTime < 0 || endTime > seqDuration + 1) {
            skippedCount++;
            continue;
        }

        try {
            // QE API uses ticks as strings
            var startTicks = Math.round(startTime * TICKS_PER_SECOND);
            var endTicks = Math.round(endTime * TICKS_PER_SECOND);

            // Set in/out points using QE
            qeSequence.setInPoint(startTicks.toString());
            qeSequence.setOutPoint(endTicks.toString());

            // Ripple delete the selection
            qeSequence.extract();

            deletedCount++;

        } catch (e) {
            skippedCount++;
        }
    }

    // Clear in/out points
    try {
        qeSequence.setInPoint("-1");
        qeSequence.setOutPoint("-1");
    } catch (e) {}

    return deletedCount;
}

// ============================================
// Marker Functions
// ============================================
function addSilenceMarkersFromSegments(sequence, segments) {
    var markers = sequence.markers;

    for (var i = 0; i < segments.length; i++) {
        var seg = segments[i];
        var startTicks = Math.round(seg.start * TICKS_PER_SECOND);

        try {
            var marker = markers.createMarker(startTicks);
            marker.name = "Silence " + (i + 1);
            marker.comments = "Duration: " + seg.duration.toFixed(2) + "s";
            marker.setColorByIndex(3);
        } catch (e) {}
    }
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
        addSilenceMarkersFromSegments(sequence, segments);

        return JSON.stringify({
            success: true,
            markerCount: segments.length
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
function previewSilence(threshold, minDuration) {
    try {
        var sourcePath = getFirstClipSourcePath();
        if (!sourcePath) {
            return JSON.stringify({
                success: false,
                error: "Could not find source media file"
            });
        }

        var silenceResultStr = detectSilence(sourcePath, threshold, minDuration);
        var silenceResult = JSON.parse(silenceResultStr);

        if (!silenceResult.success) {
            return silenceResultStr;
        }

        clearAllMarkers();
        addSilenceMarkers(JSON.stringify(silenceResult.segments));

        var silenceDuration = 0;
        for (var i = 0; i < silenceResult.segments.length; i++) {
            silenceDuration += silenceResult.segments[i].duration;
        }

        return JSON.stringify({
            success: true,
            segments: silenceResult.segments,
            totalSilence: silenceDuration,
            count: silenceResult.segments.length
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: "previewSilence error: " + e.toString()
        });
    }
}

function previewWithOptions(optionsJson) {
    try {
        var options = JSON.parse(optionsJson);
        var threshold = options.threshold || -35;
        var minSilenceDuration = options.minSilenceDuration || 0.3;

        return previewSilence(threshold, minSilenceDuration);
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: "previewWithOptions error: " + e.toString()
        });
    }
}

// ============================================
// Audio Levels for Waveform
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

        var duration = (sequence.end - sequence.zeroPoint) / TICKS_PER_SECOND;

        // Generate simple waveform data
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

// ============================================
// Legacy Functions
// ============================================
function processSequence(threshold, minDuration, margin, addMarkersFlag) {
    try {
        var seqResultStr = getActiveSequence();
        var seqResult = JSON.parse(seqResultStr);

        if (!seqResult.success) {
            return seqResultStr;
        }

        var sourcePath = getFirstClipSourcePath();
        if (!sourcePath) {
            return JSON.stringify({
                success: false,
                error: "Could not find source media file"
            });
        }

        var silenceResultStr = detectSilence(sourcePath, threshold, minDuration);
        var silenceResult = JSON.parse(silenceResultStr);

        if (!silenceResult.success) {
            return silenceResultStr;
        }

        var originalDuration = seqResult.duration;
        var silenceDuration = 0;
        for (var i = 0; i < silenceResult.segments.length; i++) {
            silenceDuration += silenceResult.segments[i].duration;
        }

        if (addMarkersFlag) {
            addSilenceMarkers(JSON.stringify(silenceResult.segments));
        }

        var sequence = app.project.activeSequence;
        var cutCount = deleteSegments(sequence, silenceResult.segments, margin, margin);

        var newDuration = originalDuration - silenceDuration + (margin * 2 * silenceResult.segments.length);
        var savedPercent = ((originalDuration - newDuration) / originalDuration) * 100;

        return JSON.stringify({
            success: true,
            originalDuration: originalDuration,
            newDuration: newDuration,
            savedPercent: savedPercent,
            segmentsFound: silenceResult.segments.length,
            segmentsCut: cutCount
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: "processSequence error: " + e.toString()
        });
    }
}

function rippleDeleteSegments(segmentsJson, margin) {
    try {
        var sequence = app.project.activeSequence;
        if (!sequence) {
            return JSON.stringify({
                success: false,
                error: "No active sequence"
            });
        }

        var segments = JSON.parse(segmentsJson);
        var deletedCount = deleteSegments(sequence, segments, margin, margin);

        return JSON.stringify({
            success: true,
            deletedCount: deletedCount
        });
    } catch (e) {
        return JSON.stringify({
            success: false,
            error: "rippleDeleteSegments error: " + e.toString()
        });
    }
}
