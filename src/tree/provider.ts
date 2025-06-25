import * as vscode from 'vscode';
import DaggerCli, { FunctionArgument } from '../cli';

// Implement TreeItem for Dagger functions and arguments
export class DaggerTreeItem extends vscode.TreeItem {
    children?: DaggerTreeItem[];
    type: 'function' | 'argument' | 'empty';

    constructor(
        label: string,
        type: 'function' | 'argument' | 'empty',
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(label, collapsibleState);
        this.type = type;
        
        // Set icons based on type
        if (type === 'function') {
            this.iconPath = new vscode.ThemeIcon('symbol-function');
            this.tooltip = `Function: ${label}`;
            this.contextValue = 'function';
        } else if (type === 'argument') {
            this.iconPath = new vscode.ThemeIcon('symbol-parameter');
            this.tooltip = `Argument: ${label}`;
            this.contextValue = 'argument';
        } else {
            this.iconPath = new vscode.ThemeIcon('info');
            this.contextValue = 'empty';
        }
    }
}

// Implement TreeDataProvider for Dagger functions
export class DaggerTreeDataProvider implements vscode.TreeDataProvider<DaggerTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DaggerTreeItem | DaggerTreeItem[] | void | null | undefined> = new vscode.EventEmitter<DaggerTreeItem | DaggerTreeItem[] | void | null | undefined>();
    readonly onDidChangeTreeData: vscode.Event<DaggerTreeItem | DaggerTreeItem[] | void | null | undefined> = this._onDidChangeTreeData.event;

    private items: DaggerTreeItem[] = [];
    private cli: DaggerCli;
    private workspacePath: string;

    constructor(cli: DaggerCli, workspacePath: string) {
        this.cli = cli;
        this.workspacePath = workspacePath;
        this.loadFunctions();
    }

    private async loadFunctions(): Promise<void> {
        try {
            // Check if Dagger is installed and workspace is a Dagger project
            if (!await this.cli.isInstalled()) {
                this.items = [new DaggerTreeItem('Dagger CLI not installed', 'empty')];
                this.refresh();
                return;
            }

            if (!await this.cli.isDaggerProject()) {
                this.items = [new DaggerTreeItem('Not a Dagger project', 'empty')];
                this.refresh();
                return;
            }

            // Load functions
            const functions = await this.cli.functionsList(this.workspacePath);
            
            if (functions.length === 0) {
                this.items = [new DaggerTreeItem('No functions found', 'empty')];
                this.refresh();
                return;
            }

            // Create tree items for functions with their arguments as children
            this.items = await Promise.all(functions.map(async (fn) => {
                const functionItem = new DaggerTreeItem(
                    fn.name, 
                    'function', 
                    vscode.TreeItemCollapsibleState.Collapsed
                );
                
                try {
                    // Get function arguments
                    const args = await this.cli.getFunctionArguments(fn.name, this.workspacePath);
                    
                    if (args.length > 0) {
                        functionItem.children = args.map(arg => {
                            const argLabel = `--${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`;
                            return new DaggerTreeItem(argLabel, 'argument');
                        });
                    } else {
                        functionItem.children = [new DaggerTreeItem('No arguments', 'empty')];
                    }
                } catch (error) {
                    console.error(`Failed to get arguments for function ${fn.name}:`, error);
                    functionItem.children = [new DaggerTreeItem('Failed to load arguments', 'empty')];
                }

                // Add description if available
                if (fn.description) {
                    functionItem.description = fn.description;
                    functionItem.tooltip = `${fn.name}\n${fn.description}`;
                }

                return functionItem;
            }));

            this.refresh();
        } catch (error) {
            console.error('Failed to load Dagger functions:', error);
            this.items = [new DaggerTreeItem('Failed to load functions', 'empty')];
            this.refresh();
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async reloadFunctions(): Promise<void> {
        await this.loadFunctions();
    }

    getTreeItem(element: DaggerTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DaggerTreeItem): DaggerTreeItem[] {
        if (!element) {
            return this.items;
        }
        return element.children ?? [];
    }

    getParent(element: DaggerTreeItem): DaggerTreeItem | undefined {
        // Find parent by searching through all function items
        for (const item of this.items) {
            if (item.children?.includes(element)) {
                return item;
            }
        }
        return undefined;
    }
}