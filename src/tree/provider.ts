import * as vscode from 'vscode';
import Cli from '../dagger';
import { COMMAND as INIT_COMMAND } from '../commands/init';
import { COMMAND as REFRESH_COMMAND } from '../commands/refresh';

type ItemType = 'function' | 'argument' | 'empty' | 'action' | 'module';

interface TreeViewConfig {
    workspacePath?: string;
    cli?: Cli;
    registerTreeCommands?: boolean; // Flag to control command registration
}

// Constants to eliminate magic strings and numbers
const TREE_VIEW_ID = 'daggerTreeView';
const FUNCTION_ICON_NAME = 'symbol-function';
const ARGUMENT_ICON_NAME = 'symbol-parameter';
const ACTION_ICON_NAME = 'arrow-right';
const MODULE_ICON_NAME = 'package'; // Icon for module (package represents something modular)
const TREE_VIEW_OPTIONS = {
    SHOW_COLLAPSE_ALL: true,
    CAN_SELECT_MANY: false
} as const;

export const registerTreeView = (
    context: vscode.ExtensionContext,
    config: TreeViewConfig
): void => {
    const workspacePath = config.workspacePath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const cli = config.cli!;

    // Pass the extension context to the data provider
    const dataProvider = new DataProvider(cli, workspacePath);

    const treeView = vscode.window.createTreeView(TREE_VIEW_ID, {
        treeDataProvider: dataProvider,
        showCollapseAll: TREE_VIEW_OPTIONS.SHOW_COLLAPSE_ALL,
        canSelectMany: TREE_VIEW_OPTIONS.CAN_SELECT_MANY
    });

    // register the refresh command here so we can access the tree view and data provider in the callback
    const refreshCommand = vscode.commands.registerCommand(REFRESH_COMMAND, async () => {
        try {
            dataProvider.reloadFunctions();
        } catch (error) {
            console.error('Failed to reload Dagger functions:', error);
            vscode.window.showErrorMessage('Failed to reload Dagger functions. Check the console for details');
        }
    });

    context.subscriptions.push(treeView, refreshCommand);
};

/**
 * Custom TreeItem class for Dagger functions and arguments
 * Extends the standard VS Code TreeItem with additional properties
 */
export class DaggerTreeItem extends vscode.TreeItem {
    children?: DaggerTreeItem[];
    readonly type: ItemType;
    readonly originalName: string;
    readonly moduleName?: string;
    readonly functionId?: string;

    constructor(
        label: string,
        type: ItemType,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        command?: vscode.Command,
        moduleName?: string,
        functionId?: string
    ) {
        super(label, collapsibleState);
        this.type = type;
        this.originalName = label;
        this.moduleName = moduleName;
        this.functionId = functionId;

        // Generate a unique ID for this item based on its type
        if (type === 'function' && functionId) {
            // Use function ID from API for uniqueness
            this.id = functionId;
        } else if (type === 'module' && moduleName) {
            // Use module name for module items
            this.id = `module:${moduleName}`;
        }

        // Set command if provided
        if (command) {
            this.command = command;
        }

        // Set icons based on type
        switch (type) {
            case 'function':
                this.iconPath = new vscode.ThemeIcon(FUNCTION_ICON_NAME);
                this.tooltip = `Function: ${label}`;
                this.contextValue = 'function';
                break;
            case 'module':
                this.iconPath = new vscode.ThemeIcon(MODULE_ICON_NAME);
                this.tooltip = `Module: ${label}`;
                this.contextValue = 'module';
                break;
            case 'argument':
                this.iconPath = new vscode.ThemeIcon(ARGUMENT_ICON_NAME);
                this.tooltip = `Argument: ${label}`;
                this.contextValue = 'argument';
                break;
            case 'action':
                this.iconPath = new vscode.ThemeIcon(ACTION_ICON_NAME);
                this.contextValue = 'action';
                this.tooltip = command?.title ?? label;
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('info');
                this.contextValue = 'empty';
                break;
        }
    }
}

export class DataProvider implements vscode.TreeDataProvider<DaggerTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DaggerTreeItem | DaggerTreeItem[] | void | null | undefined> = new vscode.EventEmitter<DaggerTreeItem | DaggerTreeItem[] | void | null | undefined>();
    readonly onDidChangeTreeData: vscode.Event<DaggerTreeItem | DaggerTreeItem[] | void | null | undefined> = this._onDidChangeTreeData.event;

    private items: DaggerTreeItem[] = [];
    private cli: Cli;
    private workspacePath: string;

    constructor(cli: Cli, workspacePath: string) {
        this.cli = cli;
        this.workspacePath = workspacePath;
        // Show loading state immediately
        this.items = [new DaggerTreeItem('Loading Dagger functions...', 'empty')];
        // Load data asynchronously without blocking
        this.loadData();
    }

    private async loadData(): Promise<void> {
        try {
            // Check if Dagger is installed and workspace is a Dagger project
            if (!await this.cli.isInstalled()) {
                this.items = [
                    new DaggerTreeItem(
                        'Dagger CLI not installed',
                        'empty'
                    ),
                    new DaggerTreeItem(
                        'Install Dagger CLI',
                        'action',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'dagger.install',
                            title: 'Install Dagger CLI'
                        }
                    )
                ];
                this.refresh();
                return;
            }

            if (!await this.cli.isDaggerProject()) {
                this.items = [
                    new DaggerTreeItem(
                        'Not a Dagger project',
                        'empty'
                    ),
                    new DaggerTreeItem(
                        'Initialize Dagger Project',
                        'action',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: INIT_COMMAND,
                            title: 'Initialize Dagger Project'
                        }
                    )
                ];
                this.refresh();
                return;
            }

            // Show progress while loading functions
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Dagger`,
                cancellable: false,
            }, async (progress) => {
                try {
                    progress.report({ message: 'Fetching functions...' });

                    // Set up a timeout to show a notice if loading takes too long
                    let timeoutNoticeShown = false;
                    const timeoutHandle = setTimeout(() => {
                        if (!timeoutNoticeShown) {
                            timeoutNoticeShown = true;
                            progress.report({ 
                                message: 'Loading... Depending on your project initial load could take a while. Subsequent response times will be cached and updated in the background.' 
                            });
                        }
                    }, 3000); // Show notice after 3 seconds

                    try {
                        // Get all functions
                        const functions = await this.cli.functionsList(this.workspacePath);
                        
                        // Clear the timeout since we're done loading
                        clearTimeout(timeoutHandle);

                        if (functions.length === 0) {
                            this.items = [
                                new DaggerTreeItem('No functions found', 'empty'),
                                new DaggerTreeItem(
                                    'Learn how to create functions',
                                    'action',
                                    vscode.TreeItemCollapsibleState.None,
                                    {
                                        command: 'vscode.open',
                                        title: 'Learn about Dagger functions',
                                        arguments: [vscode.Uri.parse('https://docs.dagger.io/quickstart')]
                                    }
                                )
                            ];
                            this.refresh();
                            return;
                        }

                        this.items = [];

                        // Initialize progress tracking
                        const totalFunctions = functions.length;
                        const incrementPerFunction = 100 / totalFunctions;

                        // Group functions by their module
                        const moduleMap = new Map<string, Array<{ fn: any, index: number }>>();

                        // Process all functions at once
                        for (let i = 0; i < functions.length; i++) {
                            const fn = functions[i];

                            if (!fn.functionId) {
                                console.warn(`Function ${fn.name} has no ID, skipping`);
                                continue;
                            }

                            // Use the module property directly, which should be set correctly by functionsList
                            const moduleName = fn.module || 'default';

                            // Add function to its module group
                            if (!moduleMap.has(moduleName)) {
                                moduleMap.set(moduleName, []);
                            }
                            moduleMap.get(moduleName)!.push({ fn, index: i });

                            // Report progress for this function
                            progress.report({
                                message: `Processing ${i + 1}/${totalFunctions}: ${fn.name.trim()}`,
                                increment: incrementPerFunction
                            });
                        }

                        progress.report({ message: 'Building tree view...' });

                        // Build the tree items after all functions are processed
                        await this.buildTreeItems(moduleMap);

                        // Refresh the tree view with the new items
                        this.refresh();
                    } catch (error) {
                        // Make sure to clear the timeout in case of error
                        clearTimeout(timeoutHandle);
                        throw error;
                    }
                } catch (error) {
                    console.error('Error loading Dagger functions:', error);
                    this.items = [new DaggerTreeItem('Error loading functions', 'empty')];
                    this.refresh();
                    throw error; // Re-throw to be caught by the outer try-catch
                }
            });
        } catch (error) {
            console.error('Failed to load Dagger functions:', error);
            this.items = [new DaggerTreeItem('Failed to load functions', 'empty')];
            this.refresh();
        }
    }

    /**
     * Builds the tree items from the module map
     * @param moduleMap Map of module names to function arrays
     */
    private async buildTreeItems(moduleMap: Map<string, Array<{ fn: any, index: number }>>): Promise<void> {
        // If there's only one module, don't nest under module
        if (moduleMap.size === 1) {
            const moduleEntries = [...moduleMap.entries()][0];
            const moduleName = moduleEntries[0]; // Get the module name
            const moduleFunctions = moduleEntries[1];

            // Create function items directly
            for (const { fn } of moduleFunctions) {
                const functionName = fn.name.trim();
                const functionId = fn.functionId; // Use the function ID directly

                if (!functionId) {
                    console.warn(`Function ${functionName} has no ID, skipping`);
                    continue;
                }

                // Create function item with functionId for uniqueness
                const functionItem = new DaggerTreeItem(
                    functionName,
                    'function',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    undefined, // Don't set command here - we'll set it after creating the item
                    moduleName, // Pass module name
                    functionId  // Pass function ID
                );

                // Set the command after creating the item so we can pass the item itself
                functionItem.command = {
                    command: 'dagger.call',
                    title: 'Call Function',
                    arguments: [functionItem] // Pass the tree item itself
                };

                // Set tooltip with full information
                let tooltip = `Function: ${functionName}`;
                if (fn.description) {
                    tooltip += `\n\nDescription:\n${fn.description}`;
                }
                functionItem.tooltip = tooltip;

                // Pre-load function arguments as children
                if (fn.args && fn.args.length > 0) {
                    functionItem.children = fn.args.map((arg: { name: string; type: string; required: boolean }) =>
                        new DaggerTreeItem(
                            `--${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`,
                            'argument'
                        )
                    );
                } else {
                    functionItem.children = [new DaggerTreeItem('No arguments', 'empty')];
                }

                this.items.push(functionItem);
            }
        } else {
            // Multiple modules - nest functions under module tree items
            for (const [moduleName, moduleFunctions] of moduleMap.entries()) {
                // Create module tree item
                const moduleItem = new DaggerTreeItem(
                    moduleName,
                    'module',
                    vscode.TreeItemCollapsibleState.Expanded,
                    undefined, // No command for module
                    moduleName // Pass module name
                );

                // Add functions as children of the module
                moduleItem.children = moduleFunctions.map(({ fn }) => {
                    // For display, use the function name without module prefix
                    const displayName = fn.name.includes('.')
                        ? fn.name.substring(fn.name.indexOf('.') + 1)  // Remove module prefix from display
                        : fn.name.trim();

                    const functionId = fn.functionId; // Use the function ID directly

                    if (!functionId) {
                        console.warn(`Function ${displayName} in module ${moduleName} has no ID, skipping`);
                        return new DaggerTreeItem(`${displayName} (error: no ID)`, 'empty');
                    }

                    // Create function item with functionId for uniqueness
                    const functionItem = new DaggerTreeItem(
                        displayName,
                        'function',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        undefined, // Don't set command here - we'll set it after creating the item
                        moduleName,  // Pass module name
                        functionId   // Pass function ID
                    );

                    // Set the command after creating the item so we can pass the item itself
                    functionItem.command = {
                        command: 'dagger.call',
                        title: 'Call Function',
                        arguments: [functionItem] // Pass the tree item itself
                    };

                    // Set tooltip with full information
                    let tooltip = `Function: ${fn.name.trim()}`;
                    if (fn.description) {
                        tooltip += `\n\nDescription:\n${fn.description}`;
                    }
                    functionItem.tooltip = tooltip;

                    // Pre-load function arguments as children
                    if (fn.args && fn.args.length > 0) {
                        functionItem.children = fn.args.map((arg: { name: string; type: string; required: boolean }) =>
                            new DaggerTreeItem(
                                `--${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`,
                                'argument'
                            )
                        );
                    } else {
                        functionItem.children = [new DaggerTreeItem('No arguments', 'empty')];
                    }

                    return functionItem;
                });

                this.items.push(moduleItem);
            }
        }
    }

    async reloadFunctions(): Promise<void> {
        // Show loading state
        this.items = [new DaggerTreeItem('Reloading Dagger functions...', 'empty')];
        this.refresh();

        try {
            // Use the progress indicator for reloading
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Dagger`,
                cancellable: false
            }, async (progress) => {
                progress.report({ message: 'Reloading functions...' });
                // Reload data asynchronously with progress already handled in loadData
                await this.loadData();
            });
        } catch (error) {
            console.error('Failed to reload Dagger functions:', error);
            this.items = [new DaggerTreeItem('Failed to reload functions', 'empty')];
            this.refresh();

            // Show error notification
            vscode.window.showErrorMessage(`Failed to reload Dagger functions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DaggerTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: DaggerTreeItem): Promise<DaggerTreeItem[]> {
        if (!element) {
            return this.items;
        }

        // Return the pre-loaded children if available
        return element.children ?? [];
    }

    getParent(element: DaggerTreeItem): DaggerTreeItem | undefined {
        // For root items
        if (this.items.includes(element)) {
            return undefined;
        }

        // For function items - find their module parent
        if (element.type === 'function' && element.moduleName) {
            // Find module with matching name
            return this.items.find(item =>
                item.type === 'module' &&
                item.originalName === element.moduleName
            );
        }

        // For argument items - find their function parent
        if (element.type === 'argument') {
            // Search all items and their children
            for (const item of this.items) {
                // Direct child of root function
                if (item.type === 'function' && item.children?.includes(element)) {
                    return item;
                }

                // Child of a function under a module
                if (item.type === 'module' && item.children) {
                    for (const functionItem of item.children) {
                        if (functionItem.children?.includes(element)) {
                            return functionItem;
                        }
                    }
                }
            }
        }

        return undefined;
    }
}
