import * as assert from "assert";
import { describe, it, beforeEach, afterEach } from "mocha";
import Cli, { FunctionInfo } from "../../src/dagger";
import sinon from "sinon";
import { DaggerSettings } from "../../src/settings";
import * as vscode from "vscode";

describe("Dagger CLI Wrapper", () => {
  let cli: Cli;
  let mockSettings: DaggerSettings;

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

  beforeEach(() => {
    mockSettings = new MockDaggerSettings();
    cli = new Cli(mockSettings);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getReturnTypeName and getArgumentTypeName", () => {
    it("should convert GraphQL type names to friendly type names", async () => {
      // Import the utility functions directly
      const { getReturnTypeName, getArgumentTypeName } = require("../../src/dagger/type-helpers");
      
      const testCases = [
        { input: "OBJECT_STRING", expectedReturn: "String", expectedArg: "String" },
        { input: "OBJECT_INT", expectedReturn: "Int", expectedArg: "Int" },
        { input: "OBJECT_FLOAT", expectedReturn: "Float", expectedArg: "Float" },
        { input: "OBJECT_BOOLEAN", expectedReturn: "Boolean", expectedArg: "Boolean" },
        { input: "OBJECT_OBJECT", expectedReturn: "Object", expectedArg: "Object" },
        { input: "OBJECT_ARRAY", expectedReturn: "Array", expectedArg: "Array" },
        { input: "OBJECT_LIST", expectedReturn: "Array", expectedArg: "Array" },
        { input: "OBJECT_MAP", expectedReturn: "Object", expectedArg: "Object" },
        { input: "OBJECT_CUSTOM", expectedReturn: "custom", expectedArg: "custom" },
        { input: "STRING", expectedReturn: "String", expectedArg: "String" },
        { input: "INT", expectedReturn: "Int", expectedArg: "Int" },
        { input: "BOOLEAN", expectedReturn: "Boolean", expectedArg: "Boolean" },
        { input: "ID", expectedReturn: "String", expectedArg: "String" },
        { input: "CustomType", expectedReturn: "CustomType", expectedArg: "CustomType" },
        { input: "", expectedReturn: "unknown", expectedArg: "unknown" },
        { input: null as any, expectedReturn: "unknown", expectedArg: "unknown" },
      ];

      for (const testCase of testCases) {
        // Test both functions with string input
        const returnResult = getReturnTypeName(testCase.input);
        const argResult = getArgumentTypeName(testCase.input);
        
        assert.strictEqual(
          returnResult,
          testCase.expectedReturn,
          `getReturnTypeName failed for input: ${testCase.input}`
        );
        
        assert.strictEqual(
          argResult,
          testCase.expectedArg,
          `getArgumentTypeName failed for input: ${testCase.input}`
        );
        
        // Test with object input
        const returnResultObj = getReturnTypeName({ kind: testCase.input });
        const argResultObj = getArgumentTypeName({ kind: testCase.input });
        
        assert.strictEqual(
          returnResultObj,
          testCase.expectedReturn,
          `getReturnTypeName failed for object input with kind: ${testCase.input}`
        );
        
        assert.strictEqual(
          argResultObj,
          testCase.expectedArg,
          `getArgumentTypeName failed for object input with kind: ${testCase.input}`
        );
      }
    });
  });

  // Additional test cases

  describe("fetchFunctionsList module relationship detection", () => {
    it("should correctly identify parent-child module relationships", async () => {
      // Create a mock for queryModuleFunctions to return test data
      const mockQueryModuleFunctions = sinon.stub(cli, "queryModuleFunctions");

      // Mock response with parent-child module hierarchy
      mockQueryModuleFunctions.resolves([
        {
          name: "DaggerDev",
          asObject: {
            name: "DaggerDev",
            functions: [
              {
                id: "func1",
                name: "buildImage",
                description: "Builds an image",
                returnType: { kind: "OBJECT_CONTAINER", optional: false },
                args: [],
              },
              {
                id: "func4",
                name: "generateDocs",
                description: "Generates documentation in the parent module",
                returnType: { kind: "OBJECT_DIRECTORY", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "DaggerDevCli",
          asObject: {
            name: "DaggerDevCli",
            functions: [
              {
                id: "func2",
                name: "installBinary",
                description: "Installs CLI binary",
                returnType: { kind: "OBJECT_FILE", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "DaggerDevDocs",
          asObject: {
            name: "DaggerDevDocs",
            functions: [
              {
                id: "func3",
                name: "generateDocs",
                description: "Generates documentation",
                returnType: { kind: "OBJECT_STRING", optional: false },
                args: [],
              },
            ],
          },
        },
      ]);

      // Mock queryDirectoryId to return a test ID
      const mockQueryDirectoryId = sinon.stub(cli, "queryDirectoryId");
      mockQueryDirectoryId.resolves("dir-123");

      // Call the method under test
      const functions = await (cli as any).fetchFunctionsList(
        "/test/workspace",
      );

      // Verify the results
      assert.strictEqual(
        functions.length,
        4,
        "Should return 4 function objects",
      );

      // Check parent module detection - parent modules now have empty module name
      const parentModule = functions.find(
        (f: FunctionInfo) => f.isParentModule && f.name.includes("generate"),
      );
      assert.ok(parentModule, "Should find the parent module function");
      assert.strictEqual(
        parentModule?.module,
        "",
        "Parent module should have an empty string as module name",
      );
      assert.strictEqual(
        parentModule?.isParentModule,
        true,
        "Parent module should be identified as a parent module",
      );
      assert.strictEqual(
        parentModule?.parentModule,
        undefined,
        "Parent module should not have a parent",
      );

      // Check submodules - they should have clean names now (without the parent prefix)
      // Note: The module name is now expected to be 'cli' and 'docs' not 'dagger-dev-cli' and 'dagger-dev-docs'
      const cliModule = functions.find((f: FunctionInfo) => f.module === "cli");
      assert.ok(cliModule, "Should find the cli module function");
      assert.strictEqual(
        cliModule?.isParentModule,
        false,
        "Cli should not be a parent module",
      );
      assert.strictEqual(
        cliModule?.parentModule,
        "dagger-dev",
        "Cli should have dagger-dev as parent",
      );

      const docsModule = functions.find(
        (f: FunctionInfo) => f.module === "docs",
      );
      assert.ok(docsModule, "Should find the docs module function");
      assert.strictEqual(
        docsModule?.isParentModule,
        false,
        "Docs should not be a parent module",
      );
      assert.strictEqual(
        docsModule?.parentModule,
        "dagger-dev",
        "Docs should have dagger-dev as parent",
      );
    });

    it("should handle single module without nesting", async () => {
      const mockQueryModuleFunctions = sinon.stub(cli, "queryModuleFunctions");

      // Mock response with only a single module
      mockQueryModuleFunctions.resolves([
        {
          name: "SimpleModule",
          asObject: {
            name: "SimpleModule",
            functions: [
              {
                id: "func1",
                name: "buildImage",
                description: "Builds an image",
                returnType: { kind: "OBJECT_CONTAINER", optional: false },
                args: [],
              },
              {
                id: "func2",
                name: "runTests",
                description: "Runs tests",
                returnType: { kind: "OBJECT_STRING", optional: false },
                args: [],
              },
            ],
          },
        },
      ]);

      const mockQueryDirectoryId = sinon.stub(cli, "queryDirectoryId");
      mockQueryDirectoryId.resolves("dir-456");

      const functions = await (cli as any).fetchFunctionsList(
        "/test/workspace",
      );

      // Verify the results
      assert.strictEqual(
        functions.length,
        2,
        "Should return 2 function objects",
      );

      // Single module: since there are no other modules to compare against,
      // these should be treated as standalone functions (not parent modules in the hierarchical sense)
      functions.forEach((func: FunctionInfo) => {
        assert.strictEqual(
          func.isParentModule,
          false,
          "Single module functions should not be marked as parent modules",
        );
        assert.strictEqual(
          func.module,
          "simple-module",
          "Single module functions should have the module name",
        );
        assert.strictEqual(
          func.parentModule,
          undefined,
          "Single module functions should not have a parent",
        );
      });
    });

    it("should ensure root module is never nested even with multiple modules", async () => {
      const mockQueryModuleFunctions = sinon.stub(cli, "queryModuleFunctions");

      // Mock response with complex hierarchy
      mockQueryModuleFunctions.resolves([
        {
          name: "App",
          asObject: {
            name: "App",
            functions: [
              {
                id: "func1",
                name: "build",
                description: "Builds the app",
                returnType: { kind: "OBJECT_CONTAINER", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "AppCli",
          asObject: {
            name: "AppCli",
            functions: [
              {
                id: "func2",
                name: "install",
                description: "Installs CLI",
                returnType: { kind: "OBJECT_FILE", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "AppTesting",
          asObject: {
            name: "AppTesting",
            functions: [
              {
                id: "func3",
                name: "runTests",
                description: "Runs tests",
                returnType: { kind: "OBJECT_STRING", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "Database",
          asObject: {
            name: "Database",
            functions: [
              {
                id: "func4",
                name: "migrate",
                description: "Runs database migrations",
                returnType: { kind: "OBJECT_STRING", optional: false },
                args: [],
              },
            ],
          },
        },
      ]);

      const mockQueryDirectoryId = sinon.stub(cli, "queryDirectoryId");
      mockQueryDirectoryId.resolves("dir-789");

      const functions = await (cli as any).fetchFunctionsList(
        "/test/workspace",
      );

      // Verify the results
      assert.strictEqual(
        functions.length,
        4,
        "Should return 4 function objects",
      );

      // Check that the root module (App) is treated as parent and not nested
      const rootModuleFunctions = functions.filter(
        (f: FunctionInfo) => f.isParentModule,
      );
      assert.ok(
        rootModuleFunctions.length > 0,
        "Should have parent module functions",
      );

      const rootBuildFunction = functions.find(
        (f: FunctionInfo) => f.name === "build",
      );
      assert.ok(rootBuildFunction, "Should find the root build function");
      assert.strictEqual(
        rootBuildFunction?.isParentModule,
        true,
        "Root function should be parent module",
      );
      assert.strictEqual(
        rootBuildFunction?.module,
        "",
        "Root function should have empty module name",
      );
      assert.strictEqual(
        rootBuildFunction?.parentModule,
        undefined,
        "Root function should not have a parent",
      );

      // Check submodules are properly nested under root
      const cliFunction = functions.find(
        (f: FunctionInfo) => f.name === "install",
      );
      assert.ok(cliFunction, "Should find the CLI install function");
      assert.strictEqual(
        cliFunction?.isParentModule,
        false,
        "CLI function should not be parent module",
      );
      assert.strictEqual(
        cliFunction?.module,
        "cli",
        'CLI function should have "cli" as module name',
      );
      assert.strictEqual(
        cliFunction?.parentModule,
        "app",
        'CLI function should have "app" as parent',
      );

      const testingFunction = functions.find(
        (f: FunctionInfo) => f.name === "run-tests",
      );
      assert.ok(testingFunction, "Should find the testing function");
      assert.strictEqual(
        testingFunction?.isParentModule,
        false,
        "Testing function should not be parent module",
      );
      assert.strictEqual(
        testingFunction?.module,
        "testing",
        'Testing function should have "testing" as module name',
      );
      assert.strictEqual(
        testingFunction?.parentModule,
        "app",
        'Testing function should have "app" as parent',
      );

      // Check independent module (Database) is treated as standalone (since it has no submodules)
      const databaseFunction = functions.find(
        (f: FunctionInfo) => f.name === "migrate",
      );
      assert.ok(databaseFunction, "Should find the database migrate function");
      assert.strictEqual(
        databaseFunction?.isParentModule,
        false,
        "Independent module function should not be parent module when other hierarchy exists",
      );
      assert.strictEqual(
        databaseFunction?.module,
        "database",
        "Independent module function should have its module name",
      );
      assert.strictEqual(
        databaseFunction?.parentModule,
        undefined,
        "Independent module function should not have a parent",
      );
    });

    it("should handle complex nested module hierarchies correctly", async () => {
      const mockQueryModuleFunctions = sinon.stub(cli, "queryModuleFunctions");

      // Mock response with deeply nested modules
      mockQueryModuleFunctions.resolves([
        {
          name: "Platform",
          asObject: {
            name: "Platform",
            functions: [
              {
                id: "func1",
                name: "deploy",
                description: "Deploys the platform",
                returnType: { kind: "OBJECT_STRING", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "PlatformBackend",
          asObject: {
            name: "PlatformBackend",
            functions: [
              {
                id: "func2",
                name: "buildApi",
                description: "Builds API",
                returnType: { kind: "OBJECT_CONTAINER", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "PlatformBackendDb",
          asObject: {
            name: "PlatformBackendDb",
            functions: [
              {
                id: "func3",
                name: "setupDatabase",
                description: "Sets up database",
                returnType: { kind: "OBJECT_STRING", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "PlatformFrontend",
          asObject: {
            name: "PlatformFrontend",
            functions: [
              {
                id: "func4",
                name: "buildApp",
                description: "Builds frontend app",
                returnType: { kind: "OBJECT_CONTAINER", optional: false },
                args: [],
              },
            ],
          },
        },
      ]);

      const mockQueryDirectoryId = sinon.stub(cli, "queryDirectoryId");
      mockQueryDirectoryId.resolves("dir-complex");

      const functions = await (cli as any).fetchFunctionsList(
        "/test/workspace",
      );

      // Verify the results
      assert.strictEqual(
        functions.length,
        4,
        "Should return 4 function objects",
      );

      // Root module function should never be nested
      const rootFunction = functions.find(
        (f: FunctionInfo) => f.name === "deploy",
      );
      assert.ok(rootFunction, "Should find the root deploy function");
      assert.strictEqual(
        rootFunction?.isParentModule,
        true,
        "Root function should be parent module",
      );
      assert.strictEqual(
        rootFunction?.module,
        "",
        "Root function should have empty module name",
      );
      assert.strictEqual(
        rootFunction?.parentModule,
        undefined,
        "Root function should not have a parent",
      );

      // First level submodules
      const backendFunction = functions.find(
        (f: FunctionInfo) => f.name === "build-api",
      );
      assert.ok(backendFunction, "Should find the backend function");
      assert.strictEqual(
        backendFunction?.isParentModule,
        true,
        "Backend function should be parent module (has submodules)",
      );
      assert.strictEqual(
        backendFunction?.module,
        "",
        "Parent module function should have empty module name",
      );
      assert.strictEqual(
        backendFunction?.parentModule,
        undefined,
        "Backend function should not have a parent (is itself a parent)",
      );

      const frontendFunction = functions.find(
        (f: FunctionInfo) => f.name === "build-app",
      );
      assert.ok(frontendFunction, "Should find the frontend function");
      assert.strictEqual(
        frontendFunction?.isParentModule,
        false,
        "Frontend function should not be parent module (has no submodules)",
      );
      assert.strictEqual(
        frontendFunction?.module,
        "frontend",
        'Frontend function should have "frontend" as module name',
      );
      assert.strictEqual(
        frontendFunction?.parentModule,
        "platform",
        'Frontend function should have "platform" as parent',
      );

      // Deeply nested module (PlatformBackendDb should be treated as submodule of PlatformBackend)
      const dbFunction = functions.find(
        (f: FunctionInfo) => f.name === "setup-database",
      );
      assert.ok(dbFunction, "Should find the database function");
      assert.strictEqual(
        dbFunction?.isParentModule,
        false,
        "Database function should not be parent module",
      );
      assert.strictEqual(
        dbFunction?.module,
        "db",
        'Database function should have "db" as module name (suffix after Backend)',
      );
      assert.strictEqual(
        dbFunction?.parentModule,
        "platform-backend",
        'Database function should have "platform-backend" as parent',
      );
    });

    it("should ensure root module functions never have non-empty module names (tree view requirement)", async () => {
      const mockQueryModuleFunctions = sinon.stub(cli, "queryModuleFunctions");

      // Mock response with various module hierarchies
      mockQueryModuleFunctions.resolves([
        {
          name: "DaggerDev",
          asObject: {
            name: "DaggerDev",
            functions: [
              {
                id: "func1",
                name: "buildImage",
                description: "Builds an image",
                returnType: { kind: "OBJECT_CONTAINER", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "DaggerDevCli",
          asObject: {
            name: "DaggerDevCli",
            functions: [
              {
                id: "func2",
                name: "installBinary",
                description: "Installs CLI binary",
                returnType: { kind: "OBJECT_FILE", optional: false },
                args: [],
              },
            ],
          },
        },
      ]);

      // Call functionsList to get processed functions
      const functions = await cli.functionsList("/test/workspace");
      
      // Find the root module function
      const rootFunction = functions.find(f => f.name === "build-image");

      // Verify the results
      assert.ok(rootFunction, "Should find root module function");
      assert.strictEqual(
        rootFunction.module,
        "",
        "Root module function should have empty module name for tree view compatibility",
      );
      assert.strictEqual(
        rootFunction.isParentModule,
        true,
        "Root module function should be marked as parent module",
      );
    });

    it("should ensure multiple root module functions have correct structure", async () => {
      const mockQueryModuleFunctions = sinon.stub(cli, "queryModuleFunctions");

      // Mock response with various module hierarchies
      mockQueryModuleFunctions.resolves([
        {
          name: "MainApp",
          asObject: {
            name: "MainApp",
            functions: [
              {
                id: "func1",
                name: "deploy",
                description: "Deploys the main app",
                returnType: { kind: "OBJECT_STRING", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "MainAppBackend",
          asObject: {
            name: "MainAppBackend",
            functions: [
              {
                id: "func2",
                name: "buildBackend",
                description: "Builds backend",
                returnType: { kind: "OBJECT_CONTAINER", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "MainAppFrontend",
          asObject: {
            name: "MainAppFrontend",
            functions: [
              {
                id: "func3",
                name: "buildFrontend",
                description: "Builds frontend",
                returnType: { kind: "OBJECT_CONTAINER", optional: false },
                args: [],
              },
            ],
          },
        },
        {
          name: "StandaloneService",
          asObject: {
            name: "StandaloneService",
            functions: [
              {
                id: "func4",
                name: "runService",
                description: "Runs standalone service",
                returnType: { kind: "OBJECT_STRING", optional: false },
                args: [],
              },
            ],
          },
        },
      ]);

      const mockQueryDirectoryId = sinon.stub(cli, "queryDirectoryId");
      mockQueryDirectoryId.resolves("dir-tree-test");

      const functions = await (cli as any).fetchFunctionsList(
        "/test/workspace",
      );

      // Verify the results
      assert.strictEqual(
        functions.length,
        4,
        "Should return 4 function objects",
      );

      // Find all functions that are marked as parent modules
      const parentModuleFunctions = functions.filter(
        (f: FunctionInfo) => f.isParentModule,
      );

      // CRITICAL: All parent module functions must have empty module names for proper tree view display
      parentModuleFunctions.forEach((func: FunctionInfo) => {
        assert.strictEqual(
          func.module,
          "",
          `Parent module function "${func.name}" must have empty module name for tree view root display, got: "${func.module}"`,
        );
        assert.strictEqual(
          func.parentModule,
          undefined,
          `Parent module function "${func.name}" must not have a parent module`,
        );
      });

      // Verify that root module (MainApp) is identified correctly
      const rootFunction = functions.find(
        (f: FunctionInfo) => f.name === "deploy",
      );
      assert.ok(rootFunction, "Should find the root deploy function");
      assert.strictEqual(
        rootFunction.isParentModule,
        true,
        "Root function should be marked as parent module",
      );
      assert.strictEqual(
        rootFunction.module,
        "",
        "Root function must have empty module name for tree view",
      );

      // Verify that submodules have proper module names (non-empty)
      const submoduleFunctions = functions.filter(
        (f: FunctionInfo) => !f.isParentModule,
      );
      submoduleFunctions.forEach((func: FunctionInfo) => {
        assert.notStrictEqual(
          func.module,
          "",
          `Submodule function "${func.name}" must have non-empty module name, got: "${func.module}"`,
        );
      });

      // Verify specific submodule functions
      const backendFunction = functions.find(
        (f: FunctionInfo) => f.name === "build-backend",
      );
      assert.ok(backendFunction, "Should find the backend function");
      assert.strictEqual(
        backendFunction.isParentModule,
        false,
        "Backend function should not be parent module",
      );
      assert.strictEqual(
        backendFunction.module,
        "backend",
        'Backend function should have "backend" as module name',
      );

      const frontendFunction = functions.find(
        (f: FunctionInfo) => f.name === "build-frontend",
      );
      assert.ok(frontendFunction, "Should find the frontend function");
      assert.strictEqual(
        frontendFunction.isParentModule,
        false,
        "Frontend function should not be parent module",
      );
      assert.strictEqual(
        frontendFunction.module,
        "frontend",
        'Frontend function should have "frontend" as module name',
      );

      // Verify standalone service (should be treated as a regular module, not parent, since MainApp is the parent)
      const standaloneFunction = functions.find(
        (f: FunctionInfo) => f.name === "run-service",
      );
      assert.ok(
        standaloneFunction,
        "Should find the standalone service function",
      );
      assert.strictEqual(
        standaloneFunction.isParentModule,
        false,
        "Standalone service should not be parent module when other hierarchy exists",
      );
      assert.strictEqual(
        standaloneFunction.module,
        "standalone-service",
        "Standalone service should have its module name",
      );
    });
  });
});
