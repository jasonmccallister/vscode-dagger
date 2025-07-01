import * as vscode from 'vscode';
import Cli from '../dagger';
import { COMMAND as INIT_COMMAND } from '../commands/init';
import { COMMAND as REFRESH_COMMAND } from '../commands/refresh';

type ItemType = 'function' | 'argument' | 'empty' | 'action';

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

    constructor(cli: Cli, workspacePath: string) {
        this.cli = cli;
        this.workspacePath = workspacePath;
        // Show loading state immediately
        this.items = [new Item('🔄 Loading Dagger functions...', 'empty')];
        // Load data asynchronously without blocking
        this.loadData();
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
                        '🚀 Install Dagger CLI',
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
                            command: INIT_COMMAND,
                            title: 'Initialize Dagger Project'
                        }
                    )
                ];
                this.refresh();
                return;
            }

            const functions = await this.cli.functionsList(this.workspacePath);

            if (functions.length === 0) {
                this.items = [
                    new Item('📭 No functions found', 'empty'),
                    new Item(
                        '🚀 Learn how to create functions',
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

            this.items = functions.map(fn => {
                const functionName = fn.name.trim();
                const functionItem = new Item(
                    functionName,
                    'function',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    {
                        command: 'dagger.saveTask',
                        title: 'Save as VS Code Task',
                        arguments: [functionName]
                    }
                );

                // Store the original function name for command execution
                functionItem.id = functionName;

                // Set tooltip with full information
                let tooltip = `Function: ${functionName}`;
                if (fn.description) {
                    tooltip += `\n\nDescription:\n${fn.description}`;
                }
                functionItem.tooltip = tooltip;

                // Pre-load function arguments as children
                if (fn.args && fn.args.length > 0) {
                    functionItem.children = fn.args.map(arg => 
                        new Item(
                            `--${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`, 
                            'argument'
                        )
                    );
                } else {
                    functionItem.children = [new Item('No arguments', 'empty')];
                }

                return functionItem;
            });

            this.refresh();
        } catch (error) {
            console.error('Failed to load Dagger functions:', error);
            this.items = [new Item('Failed to load functions', 'empty')];
            this.refresh();
        }
    }

    async reloadFunctions(): Promise<void> {
        // Show loading state
        this.items = [new Item('Reloading Dagger functions...', 'empty')];
        this.refresh();

        // Reload data asynchronously
        await this.loadData();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Item): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: Item): Promise<Item[]> {
        if (!element) {
            return this.items;
        }

        // Return the pre-loaded children if available
        return element.children ?? [];
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
