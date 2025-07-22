import * as vscode from "vscode";
import { execFileSync } from "child_process";
import { ICON_PATH_BLACK, ICON_PATH_WHITE } from "../const";

/**
 * Function type for finding the Dagger binary path
 */
export type DaggerPathFinder = () => string;

/**
 * Default implementation of the Dagger path finder
 * @returns The path to the Dagger binary or empty string if not found
 */
export const findDaggerPath = (): string => {
  try {
    const shell = process.env.SHELL || '/bin/bash';
    const isFish = shell.includes('fish');
    
    if (isFish) {
      // For fish shell, use the shell directly with login context
      return execFileSync(shell, ['-l', '-c', 'which dagger'], { 
        encoding: "utf8" 
      }).trim();
    } else {
      // For other shells, try which command directly first
      try {
        return execFileSync("which", ["dagger"], { encoding: "utf8" }).trim();
      } catch {
        // Fallback to using login shell for other shells too
        return execFileSync(shell, ['-l', '-c', 'which dagger'], { 
          encoding: "utf8" 
        }).trim();
      }
    }
  } catch (err) {
    console.error("Failed to find dagger binary path:", err);
    return "";
  }
};

/**
 * Registers a terminal profile provider for Dagger.
 * This allows users to create a terminal with a specific profile.
 *
 * @param context - The extension context provided by VS Code.
 * @param pathFinder - Optional function to find the Dagger binary path
 */
export const registerTerminalProvider = (
  context: vscode.ExtensionContext,
  pathFinder: DaggerPathFinder = findDaggerPath,
): void => {
  // Create properly formatted URIs for the icon paths
  const iconPath = {
    light: vscode.Uri.file(context.asAbsolutePath(ICON_PATH_BLACK)),
    dark: vscode.Uri.file(context.asAbsolutePath(ICON_PATH_WHITE)),
  };

  const daggerPath = pathFinder();

  if (!daggerPath) {
    vscode.window.showWarningMessage(
      "Dagger binary not found in PATH. The Dagger Shell will not launch.",
    );
    return;
  }

  // Create the terminal provider that returns a terminal options object
  // instead of using TerminalProfile directly
  const terminalProvider: vscode.TerminalProfileProvider = {
    provideTerminalProfile: async (_token: vscode.CancellationToken) => {
      // Return a plain object that VS Code will use to create a terminal
      // This avoids using vscode.TerminalProfile which requires the nativeWindowHandle API
      return {
        options: {
          name: "Dagger",
          iconPath, // Use the ThemeIcon object with both light and dark variants

          isTransient: true,
          shellPath: daggerPath,
        },
      } as any; // Cast to any to avoid type errors
    },
  };

  context.subscriptions.push(
    vscode.window.registerTerminalProfileProvider(
      "dagger.terminal-profile",
      terminalProvider,
    ),
  );
};
