import * as assert from "assert";
import { describe, it, beforeEach, afterEach } from "mocha";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { DaggerSettingsProvider } from "../../src/settings";

describe("DaggerSettings", () => {
  let sandbox: sinon.SinonSandbox;
  let getConfigurationStub: sinon.SinonStub;
  let mockConfiguration: any;
  let settings: DaggerSettingsProvider;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create mock configuration
    mockConfiguration = {
      get: sandbox.stub(),
      update: sandbox.stub().resolves(),
    };

    // Default setting values
    mockConfiguration.get.withArgs("enableCache", true).returns(true);
    mockConfiguration.get.withArgs("installMethod", "brew").returns("brew");
    mockConfiguration.get
      .withArgs("cloudNotificationDismissed", false)
      .returns(false);
    mockConfiguration.get
      .withArgs("saveTaskPromptDismissed", false)
      .returns(false);
    mockConfiguration.get
      .withArgs("functionCalls.runInBackground", false)
      .returns(false);

    // Stub vscode.workspace.getConfiguration
    getConfigurationStub = sandbox.stub(vscode.workspace, "getConfiguration");
    getConfigurationStub.withArgs("dagger").returns(mockConfiguration);

    // Create settings provider
    settings = new DaggerSettingsProvider();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("enableCache setting", () => {
    it("should default to true when not configured", () => {
      assert.strictEqual(settings.enableCache, true);
    });

    it("should load enableCache setting from configuration", () => {
      mockConfiguration.get.withArgs("enableCache", true).returns(false);

      // Reload settings
      settings.reload();

      assert.strictEqual(settings.enableCache, false);
    });
  });

  describe("installMethod setting", () => {
    it("should default to brew when not configured", () => {
      assert.strictEqual(settings.installMethod, "brew");
    });

    it("should load installMethod setting from configuration", () => {
      mockConfiguration.get.withArgs("installMethod", "brew").returns("curl");

      // Reload settings
      settings.reload();

      assert.strictEqual(settings.installMethod, "curl");
    });
  });

  describe("cloudNotificationDismissed setting", () => {
    it("should default to false when not configured", () => {
      assert.strictEqual(settings.cloudNotificationDismissed, false);
    });

    it("should load cloudNotificationDismissed setting from configuration", () => {
      mockConfiguration.get
        .withArgs("cloudNotificationDismissed", false)
        .returns(true);

      // Reload settings
      settings.reload();

      assert.strictEqual(settings.cloudNotificationDismissed, true);
    });
  });

  describe("saveTaskPromptDismissed setting", () => {
    it("should default to false when not configured", () => {
      assert.strictEqual(settings.saveTaskPromptDismissed, false);
    });

    it("should load saveTaskPromptDismissed setting from configuration", () => {
      mockConfiguration.get
        .withArgs("saveTaskPromptDismissed", false)
        .returns(true);

      // Reload settings
      settings.reload();

      assert.strictEqual(settings.saveTaskPromptDismissed, true);
    });
  });

  describe("runFunctionCallsInBackground setting", () => {
    it("should default to false when not configured", () => {
      assert.strictEqual(settings.runFunctionCallsInBackground, false);
    });

    it("should load runFunctionCallsInBackground setting from configuration", () => {
      mockConfiguration.get
        .withArgs("functionCalls.runInBackground", false)
        .returns(true);

      // Reload settings
      settings.reload();

      assert.strictEqual(settings.runFunctionCallsInBackground, true);
    });
  });

  describe("reload method", () => {
    it("should reload all settings when called", () => {
      // First check default values
      assert.strictEqual(settings.enableCache, true);
      assert.strictEqual(settings.installMethod, "brew");
      assert.strictEqual(settings.cloudNotificationDismissed, false);
      assert.strictEqual(settings.saveTaskPromptDismissed, false);
      assert.strictEqual(settings.runFunctionCallsInBackground, false);

      // Change configuration values
      mockConfiguration.get.withArgs("enableCache", true).returns(false);
      mockConfiguration.get.withArgs("installMethod", "brew").returns("curl");
      mockConfiguration.get
        .withArgs("cloudNotificationDismissed", false)
        .returns(true);
      mockConfiguration.get
        .withArgs("saveTaskPromptDismissed", false)
        .returns(true);
      mockConfiguration.get
        .withArgs("functionCalls.runInBackground", false)
        .returns(true);

      // Reload settings
      settings.reload();

      // Now they should all be updated
      assert.strictEqual(settings.enableCache, false);
      assert.strictEqual(settings.installMethod, "curl");
      assert.strictEqual(settings.cloudNotificationDismissed, true);
      assert.strictEqual(settings.saveTaskPromptDismissed, true);
      assert.strictEqual(settings.runFunctionCallsInBackground, true);
    });
  });

  describe("update method", () => {
    it("should update setting value in configuration", async () => {
      await settings.update(
        "cloudNotificationDismissed",
        true,
        vscode.ConfigurationTarget.Global,
      );

      sinon.assert.calledWith(
        mockConfiguration.update,
        "cloudNotificationDismissed",
        true,
        vscode.ConfigurationTarget.Global,
      );
    });

    it("should reload settings after update", async () => {
      // Setup spy on reload method
      const reloadSpy = sandbox.spy(settings, "reload");

      // Update a setting
      await settings.update(
        "enableCache",
        false,
        vscode.ConfigurationTarget.Global,
      );

      // Verify reload was called
      sinon.assert.calledOnce(reloadSpy);
    });
  });
});
