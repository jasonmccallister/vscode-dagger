import * as vscode from 'vscode';
import Cli from '../cli';

// Implement TreeItem for Dagger functions and arguments
export class Item extends vscode.TreeItem {
    children?: Item[];
    type: 'function' | 'argument' | 'empty' | 'action';

    constructor(
        label: string,
        type: 'function' | 'argument' | 'empty' | 'action',
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
        if (type === 'function') {
            this.iconPath = new vscode.ThemeIcon('symbol-function');
            this.tooltip = `Function: ${label}`;
            this.contextValue = 'function';
        } else if (type === 'argument') {
            this.iconPath = new vscode.ThemeIcon('symbol-parameter');
            this.tooltip = `Argument: ${label}`;
            this.contextValue = 'argument';
        } else if (type === 'action') {
            this.iconPath = new vscode.ThemeIcon('arrow-right');
            this.contextValue = 'action';
            // Make action items look more like buttons
            this.tooltip = command ? command.title : label;
        } else {
            this.iconPath = new vscode.ThemeIcon('info');
            this.contextValue = 'empty';
        }
    }
}

// Implement TreeDataProvider for Dagger functions
export class DataProvider implements vscode.TreeDataProvider<Item> {
    private _onDidChangeTreeData: vscode.EventEmitter<Item | Item[] | void | null | undefined> = new vscode.EventEmitter<Item | Item[] | void | null | undefined>();
    readonly onDidChangeTreeData: vscode.Event<Item | Item[] | void | null | undefined> = this._onDidChangeTreeData.event;

    private items: Item[] = [];
    private cli: Cli;
    private workspacePath: string;

    constructor(cli: Cli, workspacePath: string) {
        this.cli = cli;
        this.workspacePath = workspacePath;
        this.loadFunctions();
    }

    private async loadFunctions(): Promise<void> {
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

            // Load functions
            const functions = await this.cli.functionsList(this.workspacePath);

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

            // Create tree items for functions with their arguments as children
            this.items = await Promise.all(functions.map(async (fn) => {
                // Truncate function name for display if it's too long
                const displayName = fn.name.length > 30 ? fn.name.substring(0, 27) + '...' : fn.name;

                const functionItem = new Item(
                    displayName,
                    'function',
                    vscode.TreeItemCollapsibleState.Collapsed
                );

                // Store the original function name for command execution
                functionItem.id = fn.name;

                // Build children array
                const children: Item[] = [];

                try {
                    // Get function arguments
                    const args = await this.cli.getFunctionArguments(fn.name, this.workspacePath);

                    if (args.length > 0) {
                        // Add a separator if we have description
                        if (children.length > 0) {
                            children.push(new Item('─── Arguments ───', 'empty'));
                        }

                        const argItems = args.map(arg => {
                            const argLabel = `--${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`;
                            return new Item(argLabel, 'argument');
                        });
                        children.push(...argItems);
                    } else if (children.length === 0) {
                        children.push(new Item('No arguments', 'empty'));
                    }
                } catch (error) {
                    console.error(`Failed to get arguments for function ${fn.name}:`, error);
                    children.push(new Item('Failed to load arguments', 'empty'));
                }

                functionItem.children = children;

                // Set tooltip with full information
                let tooltip = `Function: ${fn.name}`;
                if (fn.description) {
                    tooltip += `\n\nDescription:\n${fn.description}`;
                }
                functionItem.tooltip = tooltip;

                return functionItem;
            }));

            this.refresh();
        } catch (error) {
            console.error('Failed to load Dagger functions:', error);
            this.items = [new Item('Failed to load functions', 'empty')];
            this.refresh();
        }
    }

    private truncateDescription(description: string, maxLength: number = 60): string {
        if (description.length <= maxLength) {
            return description;
        }

        // Try to break at a word boundary
        const truncated = description.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');

        if (lastSpace > maxLength * 0.7) { // If we can break at a reasonable word boundary
            return truncated.substring(0, lastSpace) + '...';
        }

        return truncated + '...';
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async reloadFunctions(): Promise<void> {
        await this.loadFunctions();
    }

    getTreeItem(element: Item): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Item): Item[] {
        if (!element) {
            return this.items;
        }
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