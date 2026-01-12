# AutoCut - Premiere Pro Extension

AI-powered silence detection and automatic cutting for Adobe Premiere Pro.

## Features

- Automatic silence detection using FFmpeg
- Direct timeline editing (ripple delete)
- Marker placement for preview
- Adjustable threshold and duration settings
- 14-day free trial + license key activation

## Installation

### 1. Enable Debug Mode (Required for unsigned extensions)

**macOS:**
```bash
defaults write com.adobe.CSXS.9 PlayerDebugMode 1
defaults write com.adobe.CSXS.10 PlayerDebugMode 1
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

**Windows (Run as Administrator):**
```cmd
reg add HKEY_CURRENT_USER\Software\Adobe\CSXS.9 /v PlayerDebugMode /t REG_SZ /d 1 /f
reg add HKEY_CURRENT_USER\Software\Adobe\CSXS.10 /v PlayerDebugMode /t REG_SZ /d 1 /f
reg add HKEY_CURRENT_USER\Software\Adobe\CSXS.11 /v PlayerDebugMode /t REG_SZ /d 1 /f
```

### 2. Install Extension

Copy or symlink `autocut-premiere` folder to:

**macOS:**
```bash
~/Library/Application Support/Adobe/CEP/extensions/
```

**Windows:**
```
C:\Users\{username}\AppData\Roaming\Adobe\CEP\extensions\
```

### 3. Install FFmpeg

Download FFmpeg static build and place in the `bin/` folder:

**macOS:**
1. Download from https://evermeet.cx/ffmpeg/
2. Extract and rename to `ffmpeg-mac`
3. Make executable: `chmod +x bin/ffmpeg-mac`

**Windows:**
1. Download from https://www.gyan.dev/ffmpeg/builds/
2. Extract `ffmpeg.exe` and rename to `ffmpeg-win.exe`

### 4. Restart Premiere Pro

Close and reopen Premiere Pro.

### 5. Open Extension

Go to **Window > Extensions > AutoCut**

## Usage

1. Open a sequence in Premiere Pro
2. Launch AutoCut from Window > Extensions
3. Adjust settings:
   - **Silence Threshold**: Lower values detect quieter sounds (-60 to -10 dB)
   - **Minimum Duration**: Ignore silences shorter than this (0.1 to 3.0 seconds)
   - **Cut Margin**: Padding around cuts (0 to 0.5 seconds)
4. Enable **Preview only** to add markers without cutting
5. Click **Cut Silence**

## Development

### Debug Panel

Open Chrome DevTools at `http://localhost:8088` while Premiere Pro is running.

### File Structure

```
autocut-premiere/
├── CSXS/
│   └── manifest.xml          # CEP configuration
├── hostscript/
│   └── index.jsx             # ExtendScript (Premiere Pro API)
├── panel/
│   ├── index.html            # UI entry point
│   ├── css/styles.css        # Light theme styles
│   └── js/
│       ├── CSInterface.js    # Adobe CEP library
│       ├── license.js        # License management
│       ├── cep.js            # CEP communication
│       └── app.js            # Main application
├── bin/
│   ├── ffmpeg-mac            # FFmpeg for macOS
│   └── ffmpeg-win.exe        # FFmpeg for Windows
└── .debug                    # Debug configuration
```

## Troubleshooting

### Extension not visible
- Ensure PlayerDebugMode is enabled
- Restart Premiere Pro
- Check extension folder location

### FFmpeg errors
- Verify FFmpeg binary exists in `bin/` folder
- Check file permissions (macOS: `chmod +x`)
- Ensure path has no special characters

### No sequence detected
- Open a sequence before launching extension
- Click the refresh button in the header

## License

Contact for licensing information.

## Support

- Email: support@autocut-app.com
- Issues: https://github.com/autocut/autocut-premiere/issues
