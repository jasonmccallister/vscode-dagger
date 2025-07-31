import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { registerClearCacheCommand } from "../../../src/commands/clearCache";
import { DaggerCLI } from "../../../src/cli";

interface ClearCacheMessageItem extends vscode.MessageItem {
  title: string;
}

describe("Clear Cache Command", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockCli: sinon.SinonStubbedInstance<DaggerCLI>;
  let commandCallback: (...args: any[]) => any;
  let commandSpy: sinon.SinonSpy;
  const YES_OPTION: ClearCacheMessageItem = { title: "Yes" };
  const NO_OPTION: ClearCacheMessageItem = { title: "No" };

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create a simplified mock extension context with just what we need
    mockContext = {
      subscriptions: [],
    };

    // Create a stubbed CLI instance
    mockCli = sinon.createStubInstance(DaggerCLI);

    // Stub vscode.commands.registerCommand to capture the command handler
    commandSpy = sandbox
      .stub(vscode.commands, "registerCommand")
      .callsFake((command: string, callback: any) => {
        if (command === "dagger.clearCache") {
          commandCallback = callback;
        }
        return { dispose: () => {} };
      });

    // Stub window.showWarningMessage to simulate user response
    sandbox.stub(vscode.window, "showWarningMessage").resolves(YES_OPTION);

    // Stub window.showInformationMessage
    sandbox.stub(vscode.window, "showInformationMessage");

    // Stub window.showErrorMessage
    sandbox.stub(vscode.window, "showErrorMessage");

    // Register the command
    registerClearCacheCommand(mockContext, mockCli as unknown as DaggerCLI);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should register the clear cache command", () => {
    assert.ok(
      commandSpy.calledWith("dagger.clearCache"),
      "Command should be registered",
    );
  });

  it("should call cli.clearCache when confirmed", async () => {
    // Simulate command execution
    await commandCallback();

    // Verify the CLI clearCache method was called
    assert.ok(mockCli.clearCache.calledOnce, "CLI clearCache should be called");

    // Verify information message was shown
    assert.ok(
      (vscode.window.showInformationMessage as sinon.SinonStub).calledWith(
        "Dagger cache has been cleared successfully.",
      ),
      "Success message should be shown",
    );
  });

  it("should not clear cache when not confirmed", async () => {
    // Restore the original stub and create a new one that returns 'No'
    (vscode.window.showWarningMessage as sinon.SinonStub).restore();
    sandbox.stub(vscode.window, "showWarningMessage").resolves(NO_OPTION);

    // Simulate command execution
    await commandCallback();

    // Verify the CLI clearCache method was not called
    assert.ok(
      mockCli.clearCache.notCalled,
      "CLI clearCache should not be called",
    );
  });

  it("should not clear cache when dialog is dismissed", async () => {
    // Restore the original stub and create a new one that returns undefined (dialog dismissed)
    (vscode.window.showWarningMessage as sinon.SinonStub).restore();
    sandbox.stub(vscode.window, "showWarningMessage").resolves(undefined);

    // Simulate command execution
    await commandCallback();

    // Verify the CLI clearCache method was not called
    assert.ok(
      mockCli.clearCache.notCalled,
      "CLI clearCache should not be called when dialog dismissed",
    );
  });
});
