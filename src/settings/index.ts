import * as vscode from "vscode";

/**
 * Interface defining the Dagger extension settings
 */
export interface DaggerSettings {
  /**
   * Whether to always prompt before executing function actions (e.g., export, expose service)
   * Default: true
   */
  readonly alwaysPromptFunctionActions: boolean;

  /**
   * Whether to enable caching of Dagger functions
   * Default: true (caching enabled)
   */
  readonly enableCache: boolean;

  /**
   * Method to use when installing Dagger CLI
   * Default: 'brew'
   */
  readonly installMethod: "brew" | "curl";

  /**
   * Whether the Dagger Cloud setup notification has been permanently dismissed
   * Default: false
   */
  readonly cloudNotificationDismissed: boolean;

  /**
   * Whether the save task notification has been permanently dismissed
   * Default: false
   */
  readonly saveTaskPromptDismissed: boolean;

  /**
   * Reload settings from VS Code configuration
   */
  reload(): void;

  /**
   * Update a setting value
   * @param section The setting name to update
   * @param value The new value
   * @param target The configuration target (Global, Workspace, etc.)
   */
  update<T>(
    section: string,
    value: T,
    target: vscode.ConfigurationTarget,
  ): Thenable<void>;
}

/**
 * Implementation of DaggerSettings that reads from VS Code configuration
 */
export class DaggerSettingsProvider implements DaggerSettings {
  private _enableCache: boolean = true;
  private _installMethod: "brew" | "curl" = "brew";
  private _cloudNotificationDismissed: boolean = false;
  private _saveTaskPromptDismissed: boolean = false;
  private _alwaysPromptFunctionActions: boolean = true;

  constructor() {
    this.reload();
  }

  /**
   * Whether to always prompt before executing function actions (e.g., export, expose service)
   */
  public get alwaysPromptFunctionActions(): boolean {
    return this._alwaysPromptFunctionActions;
  }

  /**
   * Whether to enable caching of Dagger functions
   */
  public get enableCache(): boolean {
    return this._enableCache;
  }

  /**
   * Method to use when installing Dagger CLI
   */
  public get installMethod(): "brew" | "curl" {
    return this._installMethod;
  }

  /**
   * Whether the Dagger Cloud setup notification has been permanently dismissed
   */
  public get cloudNotificationDismissed(): boolean {
    return this._cloudNotificationDismissed;
  }

  /**
   * Whether the save task notification has been permanently dismissed
   */
  public get saveTaskPromptDismissed(): boolean {
    return this._saveTaskPromptDismissed;
  }

  /**
   * Reloads settings from the VS Code configuration
   */
  public reload(): void {
    const config = vscode.workspace.getConfiguration("dagger");
    this._enableCache = config.get<boolean>("enableCache", true);
    this._installMethod = config.get<"brew" | "curl">("installMethod", "brew");
    this._cloudNotificationDismissed = config.get<boolean>(
      "cloudNotificationDismissed",
      false,
    );
    this._saveTaskPromptDismissed = config.get<boolean>(
      "saveTaskPromptDismissed",
      false,
    );
    this._alwaysPromptFunctionActions = config.get<boolean>(
      "alwaysPromptFunctionActions",
      true,
    );
  }

  /**
   * Updates a setting value in the VS Code configuration
   * @param section The setting name to update
   * @param value The new value
   * @param target The configuration target (Global, Workspace, etc.)
   */
  public update<T>(
    section: string,
    value: T,
    target: vscode.ConfigurationTarget,
  ): Thenable<void> {
    const config = vscode.workspace.getConfiguration("dagger");
    return config.update(section, value, target).then(() => {
      this.reload(); // Reload settings after update
    });
  }
}

// Global instance for use throughout the codebase
let _globalSettings: DaggerSettings | undefined;

/**
 * Sets the global settings instance
 * @param settings The settings instance to use
 */
export function setGlobalSettings(settings: DaggerSettings): void {
  _globalSettings = settings;
}

/**
 * Gets the global settings instance
 * @returns The global settings instance, or undefined if not set
 */
export function getGlobalSettings(): DaggerSettings | undefined {
  return _globalSettings;
}
