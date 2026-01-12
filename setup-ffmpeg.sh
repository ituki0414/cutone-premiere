#!/bin/bash

# AutoCut - FFmpeg Setup Script
# Downloads and configures FFmpeg for the extension

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${SCRIPT_DIR}/bin"

echo "==================================="
echo "AutoCut - FFmpeg Setup"
echo "==================================="

# Create bin directory if it doesn't exist
mkdir -p "${BIN_DIR}"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Detected: macOS"

    # Check if ffmpeg already exists
    if [[ -f "${BIN_DIR}/ffmpeg-mac" ]]; then
        echo "FFmpeg already installed at ${BIN_DIR}/ffmpeg-mac"
        exit 0
    fi

    # Check if Homebrew ffmpeg is available
    if command -v ffmpeg &> /dev/null; then
        FFMPEG_PATH=$(which ffmpeg)
        echo "Found system FFmpeg at: ${FFMPEG_PATH}"

        # Copy to bin directory
        cp "${FFMPEG_PATH}" "${BIN_DIR}/ffmpeg-mac"
        chmod +x "${BIN_DIR}/ffmpeg-mac"

        echo "Copied FFmpeg to: ${BIN_DIR}/ffmpeg-mac"
    else
        echo ""
        echo "FFmpeg not found. Please install it using one of these methods:"
        echo ""
        echo "Option 1: Using Homebrew (recommended)"
        echo "  brew install ffmpeg"
        echo ""
        echo "Option 2: Download static build"
        echo "  1. Visit: https://evermeet.cx/ffmpeg/"
        echo "  2. Download the latest ffmpeg-X.X.X.zip"
        echo "  3. Extract and move 'ffmpeg' to: ${BIN_DIR}/ffmpeg-mac"
        echo "  4. Run: chmod +x ${BIN_DIR}/ffmpeg-mac"
        echo ""
        exit 1
    fi

elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    echo "Detected: Windows"

    if [[ -f "${BIN_DIR}/ffmpeg-win.exe" ]]; then
        echo "FFmpeg already installed at ${BIN_DIR}/ffmpeg-win.exe"
        exit 0
    fi

    echo ""
    echo "Please download FFmpeg for Windows:"
    echo ""
    echo "1. Visit: https://www.gyan.dev/ffmpeg/builds/"
    echo "2. Download 'ffmpeg-release-essentials.zip'"
    echo "3. Extract ffmpeg.exe to: ${BIN_DIR}/ffmpeg-win.exe"
    echo ""
    exit 1

else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

echo ""
echo "==================================="
echo "Setup Complete!"
echo "==================================="
echo ""
echo "FFmpeg installed at: ${BIN_DIR}/"
echo ""
echo "Next steps:"
echo "1. Restart Premiere Pro"
echo "2. Open Window > Extensions > AutoCut"
echo ""
