import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import proxyquire from "proxyquire";
import { describe, it, beforeEach, afterEach } from "mocha";
import { ICON_PATH_BLACK, ICON_PATH_WHITE } from "../../src/const";

// Skip all terminal tests for now due to nativeWindowHandle API issues
describe.skip("Terminal Provider", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: Partial<vscode.ExtensionContext>;
  let execFileStub: sinon.SinonStub;
  let registerTerminalProviderStub: sinon.SinonStub;
  let showWarningMessageStub: sinon.SinonStub;

  // Module we'll import via proxyquire with stubbed dependencies
  let terminalModule: {
    registerTerminalProvider: (
      context: vscode.ExtensionContext,
      pathFinder?: () => string,
    ) => void;
    findDaggerPath: () => string;
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock the extension context
    mockContext = {
      asAbsolutePath: (path: string) => path,
      subscriptions: [],
    };

    // Create exec stub that we'll pass to proxyquire
    execFileStub = sandbox.stub();
    execFileStub.returns("/usr/local/bin/dagger\n");

    // Mock vscode.window.showWarningMessage
    showWarningMessageStub = sandbox.stub(vscode.window, "showWarningMessage");

    // Mock vscode.window.registerTerminalProfileProvider
    registerTerminalProviderStub = sandbox.stub(
      vscode.window,
      "registerTerminalProfileProvider",
    );
    registerTerminalProviderStub.returns({
      dispose: () => {},
    });

    // Use proxyquire to replace dependencies
    terminalModule = proxyquire.load("../../src/terminal", {
      child_process: {
        execFileSync: execFileStub,
      },
      vscode: {
        ...vscode,
        window: {
          ...vscode.window,
          showWarningMessage: showWarningMessageStub,
          registerTerminalProfileProvider: registerTerminalProviderStub,
        },
      },
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should register terminal profile provider when Dagger is found", () => {
    // Act
    terminalModule.registerTerminalProvider(
      mockContext as vscode.ExtensionContext,
    );

    // Assert
    assert.ok(
      registerTerminalProviderStub.calledOnce,
      "Terminal profile provider should be registered",
    );
    assert.strictEqual(
      registerTerminalProviderStub.getCall(0).args[0],
      "dagger.terminal-profile",
      "Terminal profile provider should be registered with correct ID",
    );
  });

  it("should show warning and not register provider when Dagger is not found", () => {
    // Arrange: Make execFileSync throw an error
    execFileStub.throws(new Error("Command not found"));

    // Act
    terminalModule.registerTerminalProvider(
      mockContext as vscode.ExtensionContext,
    );

    // Assert
    assert.ok(
      showWarningMessageStub.calledOnce,
      "Warning message should be shown",
    );
    assert.ok(
      registerTerminalProviderStub.notCalled,
      "Terminal profile provider should not be registered",
    );
  });

  it("should create terminal profile with correct properties", async () => {
    // Arrange
    let capturedProvider: any;

    registerTerminalProviderStub.callsFake((_id: string, provider: any) => {
      capturedProvider = provider;
      return { dispose: () => {} };
    });

    // Act
    terminalModule.registerTerminalProvider(
      mockContext as vscode.ExtensionContext,
    );

    // Ensure provider was captured
    assert.ok(capturedProvider, "Profile provider should be captured");

    // Call the provider function
    const profile = await capturedProvider.provideTerminalProfile({});

    // Assert - check the profile options
    assert.ok(profile, "Terminal profile should be created");
    assert.ok(profile.options, "Terminal profile options should exist");
    assert.strictEqual(
      profile.options.name,
      "Dagger",
      "Terminal name should be correct",
    );
    assert.strictEqual(
      profile.options.isTransient,
      true,
      "Terminal should be transient",
    );
    assert.strictEqual(
      profile.options.shellPath,
      "/usr/local/bin/dagger",
      "Shell path should be set correctly",
    );
  });

  it("should use custom dagger path from the callback when provided", async () => {
    // Arrange
    const customPath = "/custom/path/to/dagger";
    let capturedProvider: any;

    registerTerminalProviderStub.callsFake((_id: string, provider: any) => {
      capturedProvider = provider;
      return { dispose: () => {} };
    });

    // Act - use the version with custom path finder
    terminalModule.registerTerminalProvider(
      mockContext as vscode.ExtensionContext,
      () => customPath,
    );

    // Ensure provider was captured
    assert.ok(capturedProvider, "Profile provider should be captured");

    // Call the provider function
    const profile = await capturedProvider.provideTerminalProfile({});

    // Assert - check the profile options
    assert.ok(profile, "Terminal profile should be created");
    assert.strictEqual(
      profile.options.shellPath,
      customPath,
      "Custom shell path should be used",
    );

    // Verify execFileSync wasn't called
    assert.ok(
      execFileStub.notCalled,
      "execFileSync should not be called when custom path finder is provided",
    );
  });

  it("should have findDaggerPath that returns empty string on error", () => {
    // Arrange: Make execFileSync throw an error
    execFileStub.throws(new Error("Command not found"));

    // Act
    const result = terminalModule.findDaggerPath();

    // Assert
    assert.strictEqual(
      result,
      "",
      "Should return empty string when command fails",
    );
  });

  it("should have findDaggerPath that returns path on success", () => {
    // Arrange: Make execFileStub return a path
    execFileStub.returns("/path/to/dagger\n");

    // Act
    const result = terminalModule.findDaggerPath();

    // Assert
    assert.strictEqual(result, "/path/to/dagger", "Should return trimmed path");
  });
});
