# Cursor Debug Chat Extension

This VS Code extension adds a command to switch chat mode to debug mode in Cursor.

## Features

- **Switch to Debug Chat Mode**: Opens a new chat (or creates one if a chat is already open) and switches it to debug mode
- **Configurable Model**: Uses a model slug from configuration settings
- **Smart Chat Handling**: Automatically opens a new chat if none exists, or creates a new one if a chat is already open

## Usage

1. **Configure the debug model slug**:
   - Open VS Code/Cursor settings
   - Search for `cursor.debugChat.modelSlug`
   - Set your desired debug model slug (e.g., `gpt-4-debug`, `claude-debug`, etc.)

2. **Run the command**:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Switch Chat to Debug Mode"
   - Press Enter

Alternatively, you can bind a keyboard shortcut to this command in your keybindings.json:

```json
{
  "command": "cursor.switchToDebugChat",
  "key": "ctrl+shift+d",
  "when": "editorTextFocus"
}
```

## Configuration

### `cursor.debugChat.modelSlug`

- **Type**: `string`
- **Default**: `""`
- **Description**: The model slug to use when switching to debug chat mode. This references the same pattern used by `cursor.switchToModel` command which uses a config var for the model slug.

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

## Notes

- This extension references the `cursor.switchToModel` command pattern which uses a configuration variable for the model slug
- The extension attempts to detect if a chat is already open, but may need adjustment based on Cursor's specific API
- Chat mode switching commands may vary depending on Cursor's implementation
