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
                // Truncate function name for display if it's too long
                const displayName = fn.name.length > 30 ? fn.name.substring(0, 27) + '...' : fn.name;
                
                const functionItem = new DaggerTreeItem(
                    displayName, 
                    'function', 
                    vscode.TreeItemCollapsibleState.Collapsed
                );
                
                // Store the original function name for command execution
                functionItem.id = fn.name;
                
                // Build children array
                const children: DaggerTreeItem[] = [];
                
                try {
                    // Get function arguments
                    const args = await this.cli.getFunctionArguments(fn.name, this.workspacePath);
                    
                    if (args.length > 0) {
                        // Add a separator if we have description
                        if (children.length > 0) {
                            children.push(new DaggerTreeItem('─── Arguments ───', 'empty'));
                        }
                        
                        const argItems = args.map(arg => {
                            const argLabel = `--${arg.name} (${arg.type})${arg.required ? ' [required]' : ''}`;
                            return new DaggerTreeItem(argLabel, 'argument');
                        });
                        children.push(...argItems);
                    } else if (children.length === 0) {
                        children.push(new DaggerTreeItem('No arguments', 'empty'));
                    }
                } catch (error) {
                    console.error(`Failed to get arguments for function ${fn.name}:`, error);
                    children.push(new DaggerTreeItem('Failed to load arguments', 'empty'));
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
            this.items = [new DaggerTreeItem('Failed to load functions', 'empty')];
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