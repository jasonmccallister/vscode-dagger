import * as vscode from 'vscode';

/**
 * Interface defining the Dagger extension settings
 */
export interface DaggerSettings {
    /**
     * Whether to enable caching of Dagger functions
     * Default: true (caching enabled)
     */
    readonly enableCache: boolean;

    /**
     * Reload settings from VS Code configuration
     */
    reload(): void;
}

/**
 * Implementation of DaggerSettings that reads from VS Code configuration
 */
export class DaggerSettingsProvider implements DaggerSettings {
    private _enableCache: boolean = true;

    constructor() {
        this.reload();
    }

    /**
     * Whether to enable caching of Dagger functions
     */
    public get enableCache(): boolean {
        return this._enableCache;
    }

    /**
     * Reloads settings from the VS Code configuration
     */
    public reload(): void {
        const config = vscode.workspace.getConfiguration('dagger');
        this._enableCache = config.get<boolean>('enableCache', true);
    }
}
