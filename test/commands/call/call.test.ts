import { describe, it, beforeEach, afterEach } from "mocha";
import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { registerCallCommand } from "../../../src/commands/call";
import Cli from "../../../src/dagger";
import { DaggerTreeItem } from "../../../src/tree/provider";
import { FunctionInfo } from "../../../src/dagger";
import { DaggerSettings } from "../../../src/settings";

// Mock the utils module
const mockUtils = {
  collectAndRunFunction: sinon.stub(),
  showSaveTaskPrompt: sinon.stub(),
};

// Mock the prompt module
const mockPrompt = {
  showProjectSetupPrompt: sinon.stub(),
};

// Create a simple mock settings class for testing
class MockDaggerSettings implements DaggerSettings {
  readonly enableCache: boolean = true;
  readonly installMethod: "brew" | "curl" = "brew";
  readonly cloudNotificationDismissed: boolean = false;
  readonly saveTaskPromptDismissed: boolean = false;
  readonly runFunctionCallsInBackground: boolean = false;

  reload(): void {
    /* no-op */
  }

  update<T>(
    _section: string,
    _value: T,
    _target: vscode.ConfigurationTarget,
  ): Thenable<void> {
    return Promise.resolve();
  }
}

describe("Call Command Tests", () => {
  let mockCli: sinon.SinonStubbedInstance<Cli>;
  let mockContext: Partial<vscode.ExtensionContext>;
  let workspacePath: string;
  let commandCallback: any;
  let sandbox: sinon.SinonSandbox;
  let mockSettings: DaggerSettings;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    workspacePath = "/mock/workspace";

    // Initialize mock settings
    mockSettings = new MockDaggerSettings();

    // Create mock CLI
    mockCli = sandbox.createStubInstance(Cli);

    // Reset mocks
    mockUtils.collectAndRunFunction.reset();
    mockUtils.showSaveTaskPrompt.reset();
    mockPrompt.showProjectSetupPrompt.reset();

    // Set up utils module mocks first
    sandbox
      .stub(
        require("../../../src/utils/function-helpers"),
        "collectAndRunFunction",
      )
      .callsFake(mockUtils.collectAndRunFunction);
    sandbox
      .stub(
        require("../../../src/utils/function-helpers"),
        "showSaveTaskPrompt",
      )
      .callsFake(mockUtils.showSaveTaskPrompt);
    sandbox
      .stub(require("../../../src/prompt"), "showProjectSetupPrompt")
      .callsFake(mockPrompt.showProjectSetupPrompt);

    // Mock vscode.commands.registerCommand to capture the callback
    let capturedCallback: any;
    const mockDisposable = { dispose: sandbox.stub() };
    sandbox
      .stub(vscode.commands, "registerCommand")
      .callsFake((_, callback: any) => {
        capturedCallback = callback;
        return mockDisposable;
      });

    // Create simplified mock context
    mockContext = {
      subscriptions: [],
    };

    // Register the command to capture the callback
    registerCallCommand(
      mockContext as vscode.ExtensionContext,
      mockCli as any,
      workspacePath,
      mockSettings,
    );
    commandCallback = capturedCallback;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("Condition 1: Direct command call should show quick pick", () => {
    it("should show quick pick when no input is provided", async () => {
      // Setup
      mockCli.isDaggerProject.resolves(true);
      mockCli.setWorkspacePath.returns();

      const mockFunctions: FunctionInfo[] = [
        {
          name: "test-function-1",
          description: "Test function 1",
          functionId: "func1",
          module: "test-module",
          args: [],
          isParentModule: false,
          parentModule: undefined,
          returnType: "container",
        },
        {
          name: "test-function-2",
          description: "Test function 2",
          functionId: "func2",
          module: "test-module",
          args: [],
          isParentModule: false,
          parentModule: undefined,
          returnType: "directory",
        },
      ];

      mockCli.functionsList.resolves(mockFunctions);
      mockCli.queryFunctionByID.resolves({
        name: "test-function-1",
        functionId: "func1",
        module: "test-module",
        args: [],
        isParentModule: false,
        parentModule: undefined,
        returnType: "container",
      });

      // Mock VS Code APIs
      const showQuickPickStub = sandbox.stub(vscode.window, "showQuickPick");
      const withProgressStub = sandbox.stub(vscode.window, "withProgress");

      // Mock user selecting first function
      const mockQuickPickItem = {
        label: "test-function-1",
        description: "Test function 1",
        functionId: "func1",
        moduleName: "test-module",
      };
      showQuickPickStub.resolves(mockQuickPickItem as any);

      // Mock progress callback
      withProgressStub.callsFake(async (_, task) => {
        const mockProgress = {
          report: sandbox.stub(),
        };
        return await task(mockProgress, {} as vscode.CancellationToken);
      });

      // Mock collectAndRunFunction
      mockUtils.collectAndRunFunction.resolves({
        Result: { success: true, exitCode: 0, execution: undefined },
        commandArgs: ["dagger", "call", "test-function"],
        argValues: {},
      });
      mockUtils.showSaveTaskPrompt.resolves();

      // Execute command with no input
      await commandCallback();

      // Verify quick pick was shown
      assert.ok(showQuickPickStub.calledOnce, "Quick pick should be shown");

      // Verify functionsList was called to populate quick pick
      assert.ok(
        mockCli.functionsList.calledWith(workspacePath),
        "functionsList should be called",
      );
    });

    it("should handle empty function list gracefully", async () => {
      // Setup
      mockCli.isDaggerProject.resolves(true);
      mockCli.setWorkspacePath.returns();
      mockCli.functionsList.resolves([]);

      const showInformationMessageStub = sandbox.stub(
        vscode.window,
        "showInformationMessage",
      );

      // Execute command
      await commandCallback();

      // Verify information message was shown
      assert.ok(
        showInformationMessageStub.calledWith(
          "No Dagger functions found in this project.",
        ),
        "Should show no functions message",
      );
    });
  });

  describe("Condition 2: Command called with TreeItem input", () => {
    it("should call showSaveTaskPrompt with correct module name", async () => {
      // Setup
      mockCli.isDaggerProject.resolves(true);
      mockCli.setWorkspacePath.returns();

      const mockFunction: FunctionInfo = {
        name: "test-function",
        description: "Test function",
        functionId: "func1",
        module: "test-module",
        args: [],
        isParentModule: false,
        parentModule: undefined,
        returnType: "container",
      };

      // Create a mock TreeItem
      const mockTreeItem = new DaggerTreeItem(
        "test-function",
        "function",
        vscode.TreeItemCollapsibleState.None,
        undefined,
        "test-module",
        "func1",
      );

      mockCli.getFunction.resolves(mockFunction);

      // Mock VS Code APIs
      const withProgressStub = sandbox.stub(vscode.window, "withProgress");

      // Mock progress callback
      withProgressStub.callsFake(async (_, task) => {
        const mockProgress = {
          report: sandbox.stub(),
        };
        return await task(mockProgress, {} as vscode.CancellationToken);
      });

      // Mock collectAndRunFunction
      mockUtils.collectAndRunFunction.resolves({
        Result: { success: true, exitCode: 0, execution: undefined },
        commandArgs: ["dagger", "call", "test-function", "--arg1", "value1"],
        argValues: { arg1: "value1" },
      });
      mockUtils.showSaveTaskPrompt.resolves();

      // Execute command with TreeItem input
      await commandCallback(mockTreeItem);

      // Verify showSaveTaskPrompt was called with the correct parameters
      assert.ok(
        mockUtils.showSaveTaskPrompt.calledOnce,
        "showSaveTaskPrompt should be called",
      );

      // Check that the module name was passed
      const callArgs = mockUtils.showSaveTaskPrompt.getCall(0).args;
      assert.strictEqual(
        callArgs[0],
        "test-function",
        "Function name should match",
      );
      assert.deepStrictEqual(
        callArgs[1],
        { arg1: "value1" },
        "Arg values should match",
      );
      assert.strictEqual(
        callArgs[2],
        workspacePath,
        "Workspace path should match",
      );
      assert.strictEqual(
        callArgs[4],
        "test-module",
        "Module name should be passed correctly",
      );
    });

    it("should call showSaveTaskPrompt with empty module name for parent modules", async () => {
      // Setup
      mockCli.isDaggerProject.resolves(true);
      mockCli.setWorkspacePath.returns();

      const mockFunction: FunctionInfo = {
        name: "parent-function",
        description: "Parent module function",
        functionId: "parent1",
        module: "", // Empty module name for parent modules
        args: [],
        isParentModule: true,
        parentModule: undefined,
        returnType: "string",
      };

      // Create a mock TreeItem
      const mockTreeItem = new DaggerTreeItem(
        "parent-function",
        "function",
        vscode.TreeItemCollapsibleState.None,
        undefined,
        "", // Empty module name
        "parent1",
      );

      mockCli.getFunction.resolves(mockFunction);

      // Mock VS Code APIs
      const withProgressStub = sandbox.stub(vscode.window, "withProgress");

      // Mock progress callback
      withProgressStub.callsFake(async (_, task) => {
        const mockProgress = {
          report: sandbox.stub(),
        };
        return await task(mockProgress, {} as vscode.CancellationToken);
      });

      // Mock collectAndRunFunction
      mockUtils.collectAndRunFunction.resolves({
        Result: { success: true, exitCode: 0, execution: undefined },
        commandArgs: ["dagger", "call", "parent-function"],
        argValues: {},
      });
      mockUtils.showSaveTaskPrompt.resolves();

      // Execute command with TreeItem input
      await commandCallback(mockTreeItem);

      // Verify showSaveTaskPrompt was called with the correct parameters
      assert.ok(
        mockUtils.showSaveTaskPrompt.calledOnce,
        "showSaveTaskPrompt should be called",
      );

      // Check that the module name was passed as empty string
      const callArgs = mockUtils.showSaveTaskPrompt.getCall(0).args;
      assert.strictEqual(
        callArgs[0],
        "parent-function",
        "Function name should match",
      );
      assert.strictEqual(
        callArgs[4],
        "",
        "Module name should be empty for parent modules",
      );
    });

    it("should use tree item args without fetching function when it has argument children", async () => {
      // Setup
      mockCli.isDaggerProject.resolves(true);
      mockCli.setWorkspacePath.returns();

      // Create a function info object for the tree item
      const treeItemFunctionInfo: FunctionInfo = {
        name: "test-function",
        description: "Test function with arguments",
        functionId: "func1",
        module: "test-module",
        isParentModule: false,
        parentModule: undefined,
        returnType: "container",
        args: [
          {
            name: "arg1",
            type: "string",
            required: true,
          },
          {
            name: "arg2",
            type: "number",
            required: false,
          },
        ],
      };

      // Create a mock TreeItem with argument children
      const mockTreeItem = new DaggerTreeItem(
        treeItemFunctionInfo,
        "function",
        vscode.TreeItemCollapsibleState.Collapsed,
      );

      // Add argument children (even though not used directly now, we keep them for test clarity)
      mockTreeItem.children = [
        new DaggerTreeItem("--arg1 (string) [required]", "argument"),
        new DaggerTreeItem("--arg2 (number)", "argument"),
      ];

      // Mock VS Code APIs
      const withProgressStub = sandbox.stub(vscode.window, "withProgress");

      // Mock progress callback
      withProgressStub.callsFake(async (_, task) => {
        const mockProgress = {
          report: sandbox.stub(),
        };
        return await task(mockProgress, {} as vscode.CancellationToken);
      });

      // Mock collectAndRunFunction
      mockUtils.collectAndRunFunction.resolves({
        Result: { success: true, exitCode: 0, execution: undefined },
        commandArgs: ["dagger", "call", "test-function", "--arg1", "value1"],
        argValues: { arg1: "value1" },
      });
      mockUtils.showSaveTaskPrompt.resolves();

      // Execute command with TreeItem input that has children
      await commandCallback(mockTreeItem);

      // Verify that getFunction was NOT called
      assert.strictEqual(
        mockCli.getFunction.called,
        false,
        "getFunction should not be called when tree item has argument children",
      );

      // Verify collectAndRunFunction was called with the expected arguments
      assert.ok(
        mockUtils.collectAndRunFunction.called,
        "collectAndRunFunction should be called",
      );

      const callArgs = mockUtils.collectAndRunFunction.getCall(0).args;
      assert.strictEqual(
        callArgs[1],
        mockContext,
        "Second arg should be the context",
      );

      // Check the constructed functionInfo object from the tree item
      const functionInfo = callArgs[4];
      assert.strictEqual(
        functionInfo.name,
        "test-function",
        "Function name should match",
      );
      assert.strictEqual(
        functionInfo.module,
        "test-module",
        "Module name should match",
      );
      assert.strictEqual(
        functionInfo.functionId,
        "func1",
        "Function ID should match",
      );
      assert.strictEqual(
        functionInfo.args.length,
        2,
        "Should have 2 arguments",
      );
      assert.strictEqual(
        functionInfo.args[0].name,
        "arg1",
        "First arg name should match",
      );
      assert.strictEqual(
        functionInfo.args[0].type,
        "string",
        "First arg type should match",
      );
      assert.strictEqual(
        functionInfo.args[0].required,
        true,
        "First arg required should match",
      );
      assert.strictEqual(
        functionInfo.args[1].name,
        "arg2",
        "Second arg name should match",
      );
      assert.strictEqual(
        functionInfo.args[1].type,
        "number",
        "Second arg type should match",
      );
      assert.strictEqual(
        functionInfo.args[1].required,
        false,
        "Second arg required should match",
      );
    });

    it("should use tree item functionInfo without fetching function when it is available", async () => {
      // Setup
      mockCli.isDaggerProject.resolves(true);
      mockCli.setWorkspacePath.returns();

      // Create a function info object to attach to the tree item
      const treeItemFunctionInfo: FunctionInfo = {
        name: "test-function",
        description: "Test function",
        functionId: "func1",
        module: "test-module",
        isParentModule: false,
        parentModule: undefined,
        returnType: "container",
        args: [
          {
            name: "arg1",
            type: "string",
            required: true,
          },
          {
            name: "arg2",
            type: "number",
            required: false,
          },
        ],
      };

      // Create a mock TreeItem with direct functionInfo
      const mockTreeItem = new DaggerTreeItem(
        treeItemFunctionInfo,
        "function",
        vscode.TreeItemCollapsibleState.Collapsed,
      );

      // No need to add argument children as this test verifies using the functionInfo directly

      // Mock VS Code APIs
      const withProgressStub = sandbox.stub(vscode.window, "withProgress");

      // Mock progress callback
      withProgressStub.callsFake(async (_, task) => {
        const mockProgress = {
          report: sandbox.stub(),
        };
        return await task(mockProgress, {} as vscode.CancellationToken);
      });

      // Mock collectAndRunFunction
      mockUtils.collectAndRunFunction.resolves({
        Result: { success: true, exitCode: 0, execution: undefined },
        commandArgs: ["dagger", "call", "test-function", "--arg1", "value1"],
        argValues: { arg1: "value1" },
      });
      mockUtils.showSaveTaskPrompt.resolves();

      // Execute command with TreeItem input that has functionInfo
      await commandCallback(mockTreeItem);

      // Verify that getFunction was NOT called
      assert.strictEqual(
        mockCli.getFunction.called,
        false,
        "getFunction should not be called when tree item has functionInfo",
      );

      // Verify collectAndRunFunction was called with the expected arguments
      assert.ok(
        mockUtils.collectAndRunFunction.called,
        "collectAndRunFunction should be called",
      );

      const callArgs = mockUtils.collectAndRunFunction.getCall(0).args;
      assert.strictEqual(
        callArgs[1],
        mockContext,
        "Second arg should be the context",
      );

      // Check that the function info object was passed directly
      const functionInfo = callArgs[4];
      assert.strictEqual(
        functionInfo,
        treeItemFunctionInfo,
        "FunctionInfo object should be passed directly",
      );
    });
  });
});
