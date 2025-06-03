# Intelligent Lookup - YouTube Video Search Extension

This extension allows you to search for specific words or phrases within YouTube videos.

## Structure
```
├── manifest.json        # Extension manifest file
├── popup.html          # Popup interface
├── styles/
│   └── popup.css       # Styles for the popup
├── scripts/
│   ├── popup.js        # Popup logic
│   └── content.js      # Content script for YouTube interaction
└── icons/              # Directory for extension icons
```

## Development Setup

### Required Tools
1. Chrome Browser
2. Text Editor (VS Code recommended)

### Recommended Chrome Extensions for Development
1. [Chrome Extensions Reloader](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid) - Quick reload extensions
2. [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi) - If adding React later
3. [Redux DevTools](https://chrome.google.com/webstore/detail/redux-devtools/lmhkpmbekcpmknklioeibfkpmmfibljd) - If adding state management
4. [Chrome Extensions Developer Tool](https://chrome.google.com/webstore/detail/chrome-extensions-developer/ohmmkhmmmpcnpikjeljgnaoabkaalbgc) - Debug extensions

### VS Code Extensions
1. "Chrome Debugger" extension
2. "ESLint" for code linting
3. "Prettier" for code formatting

## Development Workflow
1. Load the extension:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select this directory
   - The extension should appear in your browser toolbar

2. Make changes to code:
   - Edit files in your preferred editor
   - After changes, either:
     - Click the reload button on the extension card in `chrome://extensions/`
     - Or use the Extensions Reloader extension
   - If changing the manifest.json, always reload the extension

3. Debugging:
   - Right-click the extension icon and select "Inspect popup" for popup debugging
   - Use Chrome DevTools console on YouTube pages for content script debugging
   - Check the "Errors" button in `chrome://extensions/` for any loading errors

4. Testing:
   - Test on different YouTube videos
   - Test with various search queries
   - Verify timestamp jumping functionality
   - Check console for any errors

## Common Development Commands
```bash
# Install Extensions Reloader (one-time setup)
# Visit Chrome Web Store and install recommended extensions

# To debug popup
Right-click extension icon -> Inspect popup

# To debug content script
1. Open YouTube
2. Press F12 for DevTools
3. Check console for content script logs
```

## Troubleshooting
- If extension doesn't load, check manifest.json for syntax errors
- If content script doesn't work, verify permissions in manifest.json
- Check Chrome's developer console for errors
- Ensure you're on a YouTube page for content script functionality 