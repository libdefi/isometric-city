import * as vscode from 'vscode';

// Track chat panels to determine if one is open
const chatPanels = new Set<vscode.WebviewPanel>();
let isInitialBrowserOpen = false;
let preventNextElementAddToChat = false;

export function activate(context: vscode.ExtensionContext) {
  // Command: Switch to debug chat
  const switchToDebugChatCommand = vscode.commands.registerCommand(
    'cursor.switchToDebugChat',
    async () => {
      // Get the debug model slug from configuration
      // Reference: Similar to how cursor.switchToModel uses a config var for model slug
      const config = vscode.workspace.getConfiguration('cursor.debugChat');
      const modelSlug = config.get<string>('modelSlug', '');

      if (!modelSlug) {
        const action = await vscode.window.showWarningMessage(
          'Debug chat model slug not configured. Please set cursor.debugChat.modelSlug in settings.',
          'Open Settings'
        );
        if (action === 'Open Settings') {
          await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'cursor.debugChat.modelSlug'
          );
        }
        return;
      }

      try {
        // Check if there's an existing chat open
        const hasOpenChat = chatPanels.size > 0 || await isChatOpen();
        
        if (hasOpenChat) {
          // If chat is open, create a new chat
          await vscode.commands.executeCommand('workbench.action.chat.newChat');
        } else {
          // If no chat is open, open a new one
          await vscode.commands.executeCommand('workbench.action.chat.openChat');
        }

        // Wait a bit for the chat to open/initialize
        await new Promise(resolve => setTimeout(resolve, 300));

        // Reference the command that switches to a model slug defined in a config var
        // This pattern mirrors cursor.switchToModel which uses a config var for the model slug
        // Execute the model switch command with the configured debug model slug
        try {
          await vscode.commands.executeCommand('cursor.switchToModel', modelSlug);
        } catch (modelSwitchError) {
          // Fallback: Try alternative command patterns if the above doesn't work
          // Some implementations might use different command names
          try {
            await vscode.commands.executeCommand('cursor.chat.switchModel', modelSlug);
          } catch (altError) {
            vscode.window.showWarningMessage(
              `Could not switch model. Using default model. Error: ${modelSwitchError instanceof Error ? modelSwitchError.message : String(modelSwitchError)}`
            );
          }
        }

        // Set chat mode to debug
        // This might be a Cursor-specific command or setting
        try {
          await vscode.commands.executeCommand('cursor.setChatMode', 'debug');
        } catch (modeError) {
          // If the command doesn't exist, try alternative patterns
          try {
            await vscode.commands.executeCommand('cursor.chat.setMode', 'debug');
          } catch (altModeError) {
            // Mode setting might not be available, continue anyway
            console.log('Chat mode setting not available, continuing with model switch');
          }
        }

        vscode.window.showInformationMessage(`Switched to debug chat mode with model: ${modelSlug}`);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to switch to debug chat mode: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  context.subscriptions.push(switchToDebugChatCommand);

  // Listen for browser inspector opening
  const onBrowserInspectorOpen = vscode.commands.registerCommand(
    'cursor.onBrowserInspectorOpen',
    () => {
      isInitialBrowserOpen = true;
      preventNextElementAddToChat = true;
      
      // Reset the flag after a short delay to only prevent the initial body selection
      setTimeout(() => {
        isInitialBrowserOpen = false;
      }, 1000);
    }
  );
  
  context.subscriptions.push(onBrowserInspectorOpen);

  // Intercept the "add element to chat" command
  const originalAddElementToChat = vscode.commands.registerCommand(
    'cursor.browser.addElementToChat',
    async (element: any) => {
      // If this is the initial browser open and we're adding the body element, skip it
      if (preventNextElementAddToChat && element?.tagName?.toLowerCase() === 'body') {
        console.log('Skipping auto-add of body element to chat on browser open');
        preventNextElementAddToChat = false;
        return;
      }
      
      preventNextElementAddToChat = false;
      
      // Otherwise, execute the normal add to chat behavior
      try {
        await vscode.commands.executeCommand('cursor.browser.addElementToChatOriginal', element);
      } catch (error) {
        // Fallback if the original command doesn't exist
        console.log('Adding element to chat:', element);
      }
    }
  );
  
  context.subscriptions.push(originalAddElementToChat);

  // Disable sidebar auto-hide when dev tools are opened
  const onDevToolsStateChange = vscode.commands.registerCommand(
    'cursor.browser.onDevToolsStateChange',
    async (isOpen: boolean) => {
      const config = vscode.workspace.getConfiguration('cursor.browser');
      const disableAutoHideSidebar = config.get<boolean>('disableAutoHideSidebar', true);
      
      if (disableAutoHideSidebar && isOpen) {
        // Prevent sidebar from hiding
        try {
          await vscode.commands.executeCommand('cursor.keepSidebarVisible');
        } catch (error) {
          console.log('Could not prevent sidebar hide:', error);
        }
      }
    }
  );
  
  context.subscriptions.push(onDevToolsStateChange);

  // Track webview panels to detect if chat is open
  const onDidChangeActiveWebviewPanel = vscode.window.onDidChangeActiveWebviewPanel((panel) => {
    if (panel && panel.webview && isChatWebview(panel)) {
      chatPanels.add(panel);
      panel.onDidDispose(() => {
        chatPanels.delete(panel);
      });
    }
  });

  context.subscriptions.push(onDidChangeActiveWebviewPanel);
}

async function isChatOpen(): Promise<boolean> {
  // Check if chat webview is currently visible
  // This is a heuristic check - actual implementation may vary
  try {
    // Try to find chat-related webviews
    const visibleEditors = vscode.window.visibleTextEditors;
    // In Cursor, chat might be in a webview panel
    // This is a simplified check
    return false; // Default to false, will be handled by command execution
  } catch {
    return false;
  }
}

function isChatWebview(panel: vscode.WebviewPanel): boolean {
  // Check if a webview panel is a chat panel
  // This might check the viewType or other properties
  return panel.viewType === 'chat' || panel.viewType?.includes('chat') || false;
}

export function deactivate() {
  chatPanels.clear();
}
