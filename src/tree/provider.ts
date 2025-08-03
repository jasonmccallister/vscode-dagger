import * as vscode from "vscode";
import { FunctionInfo } from "../types/types";
import { COMMAND as REFRESH_COMMAND } from "../commands/refreshFunctions";
import { DaggerSettings } from "../settings";
import { DaggerCLI } from "../cli";

type ItemType = "function" | "argument" | "empty" | "action" | "module";

interface TreeViewConfig {
  workspacePath?: string;
  daggerCli: DaggerCLI;
  registerTreeCommands?: boolean; // Flag to control command registration
  settings: DaggerSettings;
}

// Constants to eliminate magic strings and numbers
const TREE_VIEW_ID = "daggerTreeView";
const FUNCTION_ICON_NAME = "symbol-namespace";
const ARGUMENT_ICON_NAME = "symbol-parameter";
const ACTION_ICON_NAME = "arrow-right";
const MODULE_ICON_NAME = "package"; // Icon for module (package represents something modular)
const TREE_VIEW_OPTIONS = {
  SHOW_COLLAPSE_ALL: true,
  CAN_SELECT_MANY: false,
} as const;

export const registerTreeView = (
  context: vscode.ExtensionContext,
  config: TreeViewConfig,
): void => {
  const workspacePath =
    config.workspacePath ??
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ??
    "";
  const daggerCli = config.daggerCli;

  // Pass the extension context to the data provider
  const dataProvider = new DataProvider(daggerCli, workspacePath);

  const treeView = vscode.window.createTreeView(TREE_VIEW_ID, {
    treeDataProvider: dataProvider,
    showCollapseAll: TREE_VIEW_OPTIONS.SHOW_COLLAPSE_ALL,
    canSelectMany: TREE_VIEW_OPTIONS.CAN_SELECT_MANY,
  });

  // register the refresh command here so we can access the tree view and data provider in the callback
  const refreshCommand = vscode.commands.registerCommand(
    REFRESH_COMMAND,
    async () => {
      try {
        dataProvider.reloadFunctions();
      } catch (error) {
        console.error("Failed to reload Dagger functions:", error);
        vscode.window.showErrorMessage(
          "Failed to reload Dagger functions. Check the console for details",
        );
      }
    },
  );

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
  readonly functionInfo?: FunctionInfo;

  constructor(
    labelOrFunctionInfo: string | FunctionInfo,
    type: ItemType,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.None,
    command?: vscode.Command,
    moduleName?: string,
    functionId?: string,
  ) {
    // Handle both string labels and FunctionInfo objects
    let label: string;
    let derivedFunctionInfo: FunctionInfo | undefined;

    if (typeof labelOrFunctionInfo === "string") {
      // Handle string label (for backward compatibility)
      label = labelOrFunctionInfo;

      // Create a minimal FunctionInfo if moduleName or functionId are provided
      if (moduleName || functionId) {
        derivedFunctionInfo = {
          name: labelOrFunctionInfo,
          id: functionId || "",
          module: moduleName || "",
          returnType: "",
          args: [],
        };
      }
    } else {
      // Handle FunctionInfo object
      derivedFunctionInfo = labelOrFunctionInfo;
      label = derivedFunctionInfo.name;
    }

    // Call super with the label and collapsible state
    super(label, collapsibleState);

    // Set properties after calling super
    this.type = type;
    this.originalName = label;
    this.functionInfo = derivedFunctionInfo;

    // Generate a unique ID for this item based on its type
    if (type === "function" && this.functionInfo?.id) {
      // Use function ID from API for uniqueness
      this.id = this.functionInfo.id;
    } else if (type === "module" && this.functionInfo?.module) {
      // Use module name for module items
      this.id = `module:${this.functionInfo.module}`;
    }

    // Set command if provided
    if (command) {
      this.command = command;
    }

    // Set icons based on type
    switch (type) {
      case "function":
        this.iconPath = new vscode.ThemeIcon(FUNCTION_ICON_NAME);

        // If we have a FunctionInfo object, set a more detailed tooltip
        if (this.functionInfo) {
          let tooltip: string = "";
          if (this.functionInfo.description) {
            tooltip += `${this.functionInfo.description}`;
          }
          tooltip += `\nReturns: ${this.functionInfo.returnType || "unknown"}`;
          this.tooltip = tooltip;
        }

        this.contextValue = "function";
        break;
      case "module":
        this.iconPath = new vscode.ThemeIcon(MODULE_ICON_NAME);
        this.tooltip = `Module: ${label}`;
        this.contextValue = "module";
        break;
      case "argument":
        this.iconPath = new vscode.ThemeIcon(ARGUMENT_ICON_NAME);
        this.tooltip = `Argument: ${label}`;
        this.contextValue = "argument";
        break;
      case "action":
        this.iconPath = new vscode.ThemeIcon(ACTION_ICON_NAME);
        this.contextValue = "action";
        this.tooltip = command?.title ?? label;
        break;
      default:
        this.iconPath = new vscode.ThemeIcon("info");
        this.contextValue = "empty";
        break;
    }
  }
}

export class DataProvider implements vscode.TreeDataProvider<DaggerTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    DaggerTreeItem | DaggerTreeItem[] | void | null | undefined
  > = new vscode.EventEmitter<
    DaggerTreeItem | DaggerTreeItem[] | void | null | undefined
  >();
  readonly onDidChangeTreeData: vscode.Event<
    DaggerTreeItem | DaggerTreeItem[] | void | null | undefined
  > = this._onDidChangeTreeData.event;

  private items: DaggerTreeItem[] = [];
  private daggerCli: DaggerCLI;
  private workspacePath: string;

  constructor(daggerCli: DaggerCLI, workspacePath: string) {
    this.daggerCli = daggerCli;
    this.workspacePath = workspacePath;
    // Show loading state immediately
    this.items = [new DaggerTreeItem("Loading Dagger functions...", "empty")];
    // Load data asynchronously without blocking
    this.loadData();
  }

  private async loadData(): Promise<void> {
    try {
      // Show progress while loading functions
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Dagger`,
          cancellable: false,
        },
        async (progress) => {
          try {
            progress.report({ message: "Fetching functions..." });

            // Set up a timeout to show a notice if loading takes too long
            let timeoutNoticeShown = false;
            const timeoutHandle = setTimeout(() => {
              if (!timeoutNoticeShown) {
                timeoutNoticeShown = true;
                progress.report({
                  message:
                    "Loading... Depending on your project initial load could take a while. Subsequent response times will be cached and updated in the background.",
                });
              }
            }, 3000); // Show notice after 3 seconds

            try {
              // Get functions grouped by module using the new getFunctionsAsTree method
              const moduleMap = await this.daggerCli.getFunctionsAsTree(
                this.workspacePath,
              );

              // Clear the timeout since we're done loading
              clearTimeout(timeoutHandle);

              // Check if we have any functions at all
              const totalFunctions = Array.from(moduleMap.values()).reduce(
                (sum, functions) => sum + functions.length,
                0,
              );

              if (totalFunctions === 0) {
                this.items = [
                  new DaggerTreeItem("No functions found", "empty"),
                  new DaggerTreeItem(
                    "Learn how to create functions",
                    "action",
                    vscode.TreeItemCollapsibleState.None,
                    {
                      command: "vscode.open",
                      title: "Learn about Dagger functions",
                      arguments: [
                        vscode.Uri.parse("https://docs.dagger.io/quickstart"),
                      ],
                    },
                  ),
                ];
                this.refresh();
                return;
              }

              this.items = [];

              // Report progress
              progress.report({
                message: `Processing ${totalFunctions} functions...`,
                increment: 50,
              });

              progress.report({ message: "Building tree view..." });

              // Build the tree items from the module map
              await this.buildTreeItems(moduleMap);

              // Refresh the tree view with the new items
              this.refresh();
            } catch (error) {
              // Make sure to clear the timeout in case of error
              clearTimeout(timeoutHandle);
              throw error;
            }
          } catch (error) {
            console.error("Error loading Dagger functions:", error);
            this.items = [
              new DaggerTreeItem("Error loading functions", "empty"),
            ];
            this.refresh();
            throw error; // Re-throw to be caught by the outer try-catch
          }

          // Final progress report to indicate completion
          progress.report({ message: "Dagger functions loaded successfully" });
        },
      );
    } catch (error) {
      console.error("Failed to load Dagger functions:", error);
      this.items = [new DaggerTreeItem("Failed to load functions", "empty")];
      this.refresh();
    }
  }

  /**
   * Builds the tree items from the module map
   * @param moduleMap Map of module names to function arrays
   */
  private async buildTreeItems(
    moduleMap: Map<string, Array<{ fn: FunctionInfo; index: number }>>,
  ): Promise<void> {
    // If there's only one module, don't nest under module
    if (moduleMap.size === 1) {
      const moduleEntries = [...moduleMap.entries()][0];
      const moduleName = moduleEntries[0]; // Get the module name
      const moduleFunctions = moduleEntries[1];

      // Create function items directly
      for (const { fn } of moduleFunctions) {
        const functionName = fn.name.trim();
        const functionId = fn.id; // Use the function ID directly

        if (!functionId) {
          console.warn(`Function ${functionName} has no ID, skipping`);
          continue;
        }

        // Create function item with FunctionInfo
        const functionItem = new DaggerTreeItem(
          fn, // Pass the FunctionInfo object directly
          "function",
          fn.args && fn.args.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
        );

        // Set the command after creating the item so we can pass the item itself
        functionItem.command = {
          command: "dagger.call",
          title: "Call Function",
          arguments: [functionItem], // Pass the tree item itself
        };

        // Pre-load function arguments as children
        if (fn.args && fn.args.length > 0) {
          functionItem.children = fn.args.map(
            (arg: { name: string; type: string; required: boolean }) =>
              new DaggerTreeItem(
                `--${arg.name} (${arg.type})${
                  arg.required ? " [required]" : ""
                }`,
                "argument",
              ),
          );
        }

        this.items.push(functionItem);
      }
    } else {
      // Multiple modules - handle root module separately and nest other functions under module tree items

      // First, add root module functions (empty module name) at the top level
      const rootModuleFunctions = moduleMap.get("") || [];
      if (rootModuleFunctions.length > 0) {
        for (const { fn } of rootModuleFunctions) {
          const functionName = fn.name.trim();
          const functionId = fn.id;

          if (!functionId) {
            console.warn(
              `Root module function ${functionName} has no ID, skipping`,
            );
            continue;
          }

          // Create function item for root module with FunctionInfo
          const functionItem = new DaggerTreeItem(
            fn, // Pass FunctionInfo directly
            "function",
            fn.args && fn.args.length > 0
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
          );

          // Set the command
          functionItem.command = {
            command: "dagger.call",
            title: "Call Function",
            arguments: [functionItem],
          };

          // Pre-load function arguments as children
          if (fn.args && fn.args.length > 0) {
            functionItem.children = fn.args.map(
              (arg: { name: string; type: string; required: boolean }) =>
                new DaggerTreeItem(
                  `--${arg.name} (${arg.type})${
                    arg.required ? " [required]" : ""
                  }`,
                  "argument",
                ),
            );
          }

          this.items.push(functionItem);
        }

        // Remove the root module from the map so we don't process it again
        moduleMap.delete("");
      }

      // Then handle the remaining modules
      for (const [moduleName, moduleFunctions] of moduleMap.entries()) {
        // Skip empty module name as we've already handled it
        if (moduleName === "") {
          continue;
        }

        // Create module tree item
        const moduleItem = new DaggerTreeItem(
          moduleName,
          "module",
          vscode.TreeItemCollapsibleState.Expanded,
          undefined, // No command for module
          moduleName, // Pass module name
        );

        // Add functions as children of the module
        moduleItem.children = moduleFunctions.map(({ fn }) => {
          // For display, use the function name as-is since it should already be clean
          const displayName = fn.name.trim();
          const functionId = fn.id; // Use the function ID directly

          if (!functionId) {
            console.warn(
              `Function ${displayName} in module ${moduleName} has no ID, skipping`,
            );
            return new DaggerTreeItem(`${displayName} (error: no ID)`, "empty");
          }

          // Create function item with FunctionInfo
          const functionItem = new DaggerTreeItem(
            fn, // Pass FunctionInfo directly
            "function",
            fn.args && fn.args.length > 0
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
          );

          // Set the command after creating the item so we can pass the item itself
          functionItem.command = {
            command: "dagger.call",
            title: "Call Function",
            arguments: [functionItem], // Pass the tree item itself
          };

          // Set tooltip with full information
          let tooltip = `Function: ${fn.name.trim()}`;
          if (fn.description) {
            tooltip += `\n\nDescription:\n${fn.description}`;
          }
          tooltip += `\n\nReturns: ${fn.returnType || "unknown"}`;
          functionItem.tooltip = tooltip;

          // Pre-load function arguments as children
          if (fn.args && fn.args.length > 0) {
            functionItem.children = fn.args.map(
              (arg: { name: string; type: string; required: boolean }) =>
                new DaggerTreeItem(
                  `--${arg.name} (${arg.type})${
                    arg.required ? " [required]" : ""
                  }`,
                  "argument",
                ),
            );
          }

          return functionItem;
        });

        this.items.push(moduleItem);
      }
    }
  }

  async reloadFunctions(): Promise<void> {
    // Show loading state
    this.items = [new DaggerTreeItem("Reloading Dagger functions...", "empty")];
    this.refresh();

    try {
      // Reload data asynchronously with progress already handled in loadData
      await this.loadData();
    } catch (error) {
      console.error("Failed to reload Dagger functions:", error);
      this.items = [new DaggerTreeItem("Failed to reload functions", "empty")];
      this.refresh();

      // Show error notification
      vscode.window.showErrorMessage(
        `Failed to reload Dagger functions: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
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
    if (element.type === "function" && element.functionInfo?.module) {
      // Find module with matching name
      return this.items.find(
        (item) =>
          item.type === "module" &&
          item.originalName === element.functionInfo?.module,
      );
    }

    // For argument items - find their function parent
    if (element.type === "argument") {
      // Search all items and their children
      for (const item of this.items) {
        // Direct child of root function
        if (item.type === "function" && item.children?.includes(element)) {
          return item;
        }

        // Child of a function under a module
        if (item.type === "module" && item.children) {
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
