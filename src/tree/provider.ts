import * as vscode from 'vscode';
import Cli, { FunctionArgument, FunctionInfo } from '../dagger/dagger';
import { registerTreeCommands } from '../commands';

type ItemType = 'function' | 'argument' | 'empty' | 'action';

interface TreeViewConfig {
    workspacePath?: string;
    cli?: Cli;
    registerCommands?: boolean; // Flag to control command registration
}

// Global references to tree view and data provider for expand all functionality
let globalTreeView: vscode.TreeView<Item> | undefined;
let globalDataProvider: DataProvider | undefined;

export const getTreeView = (): vscode.TreeView<Item> | undefined => globalTreeView;
export const getDataProvider = (): DataProvider | undefined => globalDataProvider;

// Constants to eliminate magic strings and numbers
const TREE_VIEW_ID = 'daggerTreeView';
const FUNCTION_ICON_NAME = 'symbol-function';
const ARGUMENT_ICON_NAME = 'symbol-parameter';
const ACTION_ICON_NAME = 'arrow-right';

const TREE_VIEW_OPTIONS = {
    SHOW_COLLAPSE_ALL: true,
    CAN_SELECT_MANY: false
} as const;

const COMMANDS = {
    REFRESH: 'dagger.refresh',
    VIEW_FUNCTIONS: 'dagger.viewFunctions'
} as const;

const MESSAGES = {
    NO_FUNCTIONS: 'No functions available.',
    FAILED_TO_LOAD: 'Failed to load functions'
} as const;

export class Item extends vscode.TreeItem {
    children?: Item[];
    readonly type: ItemType;

    constructor(
        label: string,
        type: ItemType,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.type = type;

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

export class DataProvider implements vscode.TreeDataProvider<Item> {
    private _onDidChangeTreeData: vscode.EventEmitter<Item | Item[] | void | null | undefined> = new vscode.EventEmitter<Item | Item[] | void | null | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Item | Item[] | void | null | undefined> = this._onDidChangeTreeData.event;

    private items: Item[] = [];
    private cli: Cli;
    private workspacePath: string;
    private isLoading = false;
    private functionArgumentsCache = new Map<string, FunctionArgument[]>();
    private functionsCache: FunctionInfo[] | null = null;
    private lastRefreshTime = 0;
    private readonly cacheTimeout = 30000; // 30 seconds

    constructor(cli: Cli, workspacePath: string) {
        this.cli = cli;
        this.workspacePath = workspacePath;
        
        // Show loading state immediately
        this.items = [new Item('🔄 Loading Dagger functions...', 'empty')];
        
        // Load data asynchronously without blocking
        this.loadDataAsync();
    }

    private async loadDataAsync(): Promise<void> {
        // Prevent concurrent loading
        if (this.isLoading) {
            return;
        }
        this.isLoading = true;

        try {
            await this.loadData();
        } finally {
            this.isLoading = false;
        }
    }

    private async loadData(): Promise<void> {
        try {
            // Check if Dagger is installed and workspace is a Dagger project
            if (!await this.cli.isInstalled()) {
                this.items = [
                    new Item(
                        '❌ Dagger CLI not installed',
                        'empty'
                    ),
                    new Item(
                        '� Install Dagger CLI',
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
                    new Item(
                        '📁 Not a Dagger project',
                        'empty'
                    ),
                    new Item(
                        '🚀 Initialize Dagger Project',
                        'action',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'dagger.init',
                            title: 'Initialize Dagger Project'
                        }
                    )
                ];
                this.refresh();
                return;
            }

            // Load functions with caching
            const now = Date.now();
            let functions: FunctionInfo[];
            
            if (this.functionsCache && (now - this.lastRefreshTime) < this.cacheTimeout) {
                functions = this.functionsCache;
            } else {
                functions = await this.cli.functionsList(this.workspacePath);
                this.functionsCache = functions;
                this.lastRefreshTime = now;
            }
            
            // Debug logging to understand the structure
            console.log('Functions returned from CLI:', JSON.stringify(functions, null, 2));
            console.log('Function names and types:', functions.map(fn => ({ 
                name: fn.name, 
                type: typeof fn.name, 
                isString: typeof fn.name === 'string',
                trimmed: typeof fn.name === 'string' ? fn.name.trim() : 'N/A'
            })));

            if (functions.length === 0) {
                this.items = [
                    new Item('📭 No functions found', 'empty'),
                    new Item(
                        '� Learn how to create functions',
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

            // Create tree items for functions WITHOUT loading arguments immediately
            this.items = functions
                .map((fn) => {
                    // Ensure we have a valid function name string with better validation
                    let functionName: string;
                    if (typeof fn.name === 'string' && fn.name.trim()) {
                        functionName = fn.name.trim();
                    } else {
                        console.error('Invalid function name:', fn);
                        return null; // Filter out invalid functions
                    }
                    
                    // Truncate function name for display if it's too long (smart truncation at word boundaries)
                    const maxDisplayLength = 30;
                    let displayName: string;
                    if (functionName.length > maxDisplayLength) {
                        // Try to truncate at a reasonable word boundary
                        let truncateAt = maxDisplayLength;
                        const dashIndex = functionName.lastIndexOf('-', maxDisplayLength);
                        if (dashIndex > maxDisplayLength - 10) { // If dash is reasonably close to max length
                            truncateAt = dashIndex;
                        }
                        displayName = functionName.substring(0, truncateAt) + '...';
                    } else {
                        displayName = functionName;
                    }

                    const functionItem = new Item(
                        displayName,
                        'function',
                        vscode.TreeItemCollapsibleState.Collapsed
                    );

                    // Store the original function name for command execution
                    functionItem.id = functionName;

                    // Set tooltip with full information
                    let tooltip = `Function: ${functionName}`;
                    if (fn.description) {
                        tooltip += `\n\nDescription:\n${fn.description}`;
                    }
                    functionItem.tooltip = tooltip;

                    return functionItem;
                })
                .filter((item): item is Item => item !== null); // Filter out null items

            this.refresh();
            
            // Start background preloading of arguments (don't await - let it run in background)
            this.preloadArgumentsInBackground().catch(error => {
                console.warn('Background preloading failed:', error);
            });
        } catch (error) {
            console.error('Failed to load Dagger functions:', error);
            this.items = [new Item('Failed to load functions', 'empty')];
            this.refresh();
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async reloadFunctions(): Promise<void> {
        // Clear caches
        this.functionsCache = null;
        this.functionArgumentsCache.clear();
        this.lastRefreshTime = 0;
        
        // Show loading state
        this.items = [new Item('🔄 Reloading Dagger functions...', 'empty')];
        this.refresh();
        
        // Reload data
        await this.loadDataAsync();
    }

    /**
     * Clear only the arguments cache, keeping functions cache intact
     */
    clearArgumentsCache(): void {
        this.functionArgumentsCache.clear();
        
        // Clear children from existing function items to force reload
        this.items.forEach(item => {
            if (item.type === 'function') {
                item.children = undefined;
            }
        });
    }

    /**
     * Preload arguments for all functions in the background
     * This can be called after initial function loading to warm the cache
     */
    async preloadArgumentsInBackground(): Promise<void> {
        if (!this.functionsCache) {
            return;
        }

        console.log('Starting background preload of function arguments...');
        
        // Load arguments for all functions in parallel, but limit concurrency
        const batchSize = 3; // Limit concurrent CLI calls to avoid overwhelming the system
        const functionNames = this.functionsCache
            .map(fn => {
                if (typeof fn.name === 'string' && fn.name.trim()) {
                    return fn.name.trim();
                } else {
                    console.warn('Skipping invalid function name during preload:', fn);
                    return null;
                }
            })
            .filter((name): name is string => name !== null);

        for (let i = 0; i < functionNames.length; i += batchSize) {
            const batch = functionNames.slice(i, i + batchSize);
            
            const promises = batch.map(async (functionName) => {
                if (this.functionArgumentsCache.has(functionName)) {
                    return; // Already cached
                }

                try {
                    const args = await this.cli.getFunctionArguments(functionName, this.workspacePath);
                    this.functionArgumentsCache.set(functionName, args);
                    console.log(`Preloaded arguments for function: ${functionName}`);
                } catch (error) {
                    console.warn(`Failed to preload arguments for function ${functionName}:`, error);
                }
            });

            await Promise.all(promises);
            
            // Small delay between batches to avoid overwhelming the CLI
            if (i + batchSize < functionNames.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log('Background preload of function arguments completed');
    }

    getTreeItem(element: Item): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Item): Item[] | Promise<Item[]> {
        if (!element) {
            return this.items;
        }

        // Lazy load function arguments when function is expanded
        if (element.type === 'function' && element.id && !element.children) {
            return this.loadFunctionArguments(element);
        }

        return element.children ?? [];
    }

    private async loadFunctionArguments(functionItem: Item): Promise<Item[]> {
        const functionName = functionItem.id;
        
        // Validate function name
        if (!functionName || typeof functionName !== 'string' || !functionName.trim()) {
            console.error('Invalid function name for loading arguments:', functionName);
            const errorItem = new Item('❌ Invalid function name', 'empty');
            functionItem.children = [errorItem];
            this.refresh();
            return [errorItem];
        }
        
        const trimmedFunctionName = functionName.trim();
        
        // Check cache first
        if (this.functionArgumentsCache.has(trimmedFunctionName)) {
            const args = this.functionArgumentsCache.get(trimmedFunctionName)!;
            const children = this.createArgumentItems(args);
            functionItem.children = children;
            return children;
        }

        try {
            // Show loading state
            const loadingItem = new Item('🔄 Loading arguments...', 'empty');
            functionItem.children = [loadingItem];
            this.refresh();

            // Load arguments from CLI
            const args = await this.cli.getFunctionArguments(trimmedFunctionName, this.workspacePath);
            
            // Cache the result
            this.functionArgumentsCache.set(trimmedFunctionName, args);
            
            // Create argument items
            const children = this.createArgumentItems(args);
            functionItem.children = children;
            
            // Refresh to show the loaded arguments
            this.refresh();
            
            return children;
        } catch (error) {
            console.error(`Failed to get arguments for function ${trimmedFunctionName}:`, error);
            const errorItem = new Item('❌ Failed to load arguments', 'empty');
            functionItem.children = [errorItem];
            this.refresh();
            return [errorItem];
        }
    }

    private createArgumentItems(args: FunctionArgument[]): Item[] {
        if (args.length === 0) {
            return [new Item('No arguments', 'empty')];
        }

        const children: Item[] = [];
        
        // Add a separator 
        children.push(new Item('─── Arguments ───', 'empty'));

        const argItems = args.map(arg => {
            const argLabel = `--${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`;
            return new Item(argLabel, 'argument');
        });
        
        children.push(...argItems);
        return children;
    }

    getParent(element: Item): Item | undefined {
        // Find parent by searching through all function items
        for (const item of this.items) {
            if (item.children?.includes(element)) {
                return item;
            }
        }
        return undefined;
    }
}

export const registerTreeView = (context: vscode.ExtensionContext, config: TreeViewConfig = {}): void => {
    const {
        workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
        cli,
        registerCommands = true
    } = config;

    const dataProvider = new DataProvider(cli!, workspacePath);
    globalDataProvider = dataProvider;

    const treeView = vscode.window.createTreeView(TREE_VIEW_ID, {
        treeDataProvider: dataProvider,
        showCollapseAll: TREE_VIEW_OPTIONS.SHOW_COLLAPSE_ALL,
        canSelectMany: TREE_VIEW_OPTIONS.CAN_SELECT_MANY
    });
    globalTreeView = treeView;

    // Only register tree commands when explicitly requested (to avoid duplicates)
    if (registerCommands) {
        registerTreeCommands(context, () => dataProvider.reloadFunctions());
    }

    context.subscriptions.push(treeView);
};

/**
 * Preload tree data asynchronously
 * This can be called from outside to manually trigger preload
 */
export const preloadTreeDataAsync = (): void => {
    const dataProvider = getDataProvider();
    if (dataProvider) {
        dataProvider.preloadArgumentsInBackground().catch(error => {
            console.warn('Manual preload failed:', error);
        });
    }
};

/**
 * Clear tree cache
 * This can be called from outside to clear the arguments cache
 */
export const clearTreeCache = (): void => {
    const dataProvider = getDataProvider();
    if (dataProvider) {
        dataProvider.clearArgumentsCache();
    }
};