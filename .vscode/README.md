# Cursor Browser DevTools Extension

This VS Code extension customizes the behavior of Cursor's browser dev tools to improve the development experience.

## Features

### 1. **Prevent Body Element Auto-Add to Chat**
When the browser dev tools auto-open and initially select the root `<body>` element, this extension prevents that element from being automatically added to the chat. This keeps your chat clean while still maintaining the auto-select behavior for visual feedback.

**How it works:**
- When the browser inspector opens, the extension tracks that this is an initial open
- If the next element added to chat is the `<body>` element within a short time window, it's skipped
- All subsequent element selections work normally

### 2. **Disable Sidebar Auto-Hide on Dev Tools Open**
By default, Cursor may hide the unified agent sidebar when browser dev tools are opened to maximize screen space. This extension disables that auto-hide behavior so your sidebar remains visible.

**How it works:**
- Listens for dev tools open/close events
- Prevents the sidebar from auto-hiding when dev tools are opened
- Keeps your agent chat and other sidebar features accessible while inspecting

## Configuration

### `cursor.browser.disableAutoHideSidebar`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Prevent sidebar from auto-hiding when browser dev tools are opened

### `cursor.browser.preventBodyElementAutoAdd`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Prevent the body element from being automatically added to chat when browser dev tools open

### `cursor.debugChat.modelSlug`

- **Type**: `string`
- **Default**: `""`
- **Description**: Model slug to use when switching to debug chat mode

## Commands

- **Switch Chat to Debug Mode**: Opens a new chat (or creates one if a chat is already open) and switches it to debug mode

## Development

To compile the extension:

```bash
cd .vscode
npm install
npm run compile
```

To watch for changes:

```bash
npm run watch
```

## Implementation Notes

This extension hooks into Cursor's browser dev tools events to customize behavior:

1. **Element Selection Tracking**: Monitors when the browser inspector opens and tracks the initial body element selection
2. **Command Interception**: Intercepts the "add element to chat" command to filter out unwanted auto-adds
3. **Sidebar Visibility**: Listens for dev tools state changes and prevents sidebar auto-hide

The extension is designed to work seamlessly with Cursor's existing dev tools while providing fine-grained control over specific behaviors.
