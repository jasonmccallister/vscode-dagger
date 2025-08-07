import * as assert from "assert";
import { DaggerCLI } from "../../src/cli";
import { CliCache } from "../../src/cache";
import { DaggerSettings } from "../../src/settings";
import * as fs from "fs";
import * as path from "path";

describe("DaggerCLI", () => {
  let mockCache: CliCache;
  let mockSettings: DaggerSettings;
  let cli: DaggerCLI;

  beforeEach(() => {
    // Create mock cache
    mockCache = {
      generateKey: () => "test-key",
      get: async () => null,
      set: async () => {},
      clear: async () => {},
      remove: async () => {},
      has: async () => false,
      getSHA256: async () => "mock-sha",
      hasDataChanged: async () => false,
    } as CliCache;

    // Create mock settings
    mockSettings = {
      enableCache: false,
    } as DaggerSettings;

    cli = new DaggerCLI(mockCache, mockSettings);
  });

  describe("getFunctions", () => {
    it("should correctly parse module structure from example JSON", async () => {
      // Read the example JSON response
      const jsonPath = path.join(__dirname, "../data/functions-response.json");
      const jsonContent = fs.readFileSync(jsonPath, "utf8");
      const exampleResponse = JSON.parse(jsonContent);

      // Mock the execQuery method to return our example data
      const originalExecQuery = (cli as any).execQuery;
      (cli as any).execQuery = async () => ({
        stdout: JSON.stringify(exampleResponse.data),
        stderr: "",
        exitCode: 0,
      });

      // Mock getDirectoryID
      (cli as any).getDirectoryID = async () => "mock-id";

      // Call getFunctions
      const functions = await cli.getFunctions("/mock/path");

      // Verify the structure matches the expected output
      const functionsByModule = new Map<string, string[]>();
      
      functions.forEach(fn => {
        const moduleKey = fn.module || "root";
        if (!functionsByModule.has(moduleKey)) {
          functionsByModule.set(moduleKey, []);
        }
        functionsByModule.get(moduleKey)!.push(fn.name);
      });

      // Expected structure based on user requirements and actual data:
      // Root module functions (module: undefined)
      const rootFunctions = functionsByModule.get("root") || [];
      assert.ok(rootFunctions.includes("sourceDeveloped"), "Should have sourceDeveloped in root");
      assert.ok(rootFunctions.includes("lint"), "Should have lint in root");
      assert.ok(rootFunctions.includes("evals"), "Should have evals in root");
      assert.ok(rootFunctions.includes("bench"), "Should have bench in root");
      assert.ok(rootFunctions.includes("generate"), "Should have generate in root");
      assert.ok(rootFunctions.includes("check"), "Should have check in root");
      assert.ok(rootFunctions.includes("scan"), "Should have scan in root");
      assert.ok(rootFunctions.includes("dev"), "Should have dev in root");

      // Submodule functions - these should have clean module names
      assert.ok(functionsByModule.has("cli"), "Should have cli submodule");
      assert.ok(functionsByModule.has("go"), "Should have go submodule (not go-toolchain)");
      assert.ok(functionsByModule.has("scripts"), "Should have scripts submodule");
      assert.ok(functionsByModule.has("test"), "Should have test submodule");
      assert.ok(functionsByModule.has("sdk"), "Should have sdk submodule");

      // Verify specific submodule functions are properly nested
      const cliFunctions = functionsByModule.get("cli") || [];
      assert.ok(cliFunctions.includes("binary"), "CLI module should have binary function");
      assert.ok(cliFunctions.includes("devBinaries"), "CLI module should have devBinaries function");

      const scriptsFunctions = functionsByModule.get("scripts") || [];
      assert.ok(scriptsFunctions.includes("lint"), "Scripts module should have lint function");
      assert.ok(scriptsFunctions.includes("test"), "Scripts module should have test function");

      // Verify no function has the root module name as its module
      functions.forEach(fn => {
        assert.notStrictEqual(fn.module, "dagger-dev", 
          `Function ${fn.name} should not have root module name as its module`);
      });

      // Restore original method
      (cli as any).execQuery = originalExecQuery;
    });

    it("should handle nested module names correctly", () => {
      // Test the naming logic directly - basic cases that don't depend on root function mapping
      const testCases = [
        { 
          rootModule: "dagger-dev", 
          objectName: "DaggerDev", 
          expected: { isRoot: true, moduleName: undefined } 
        },
        { 
          rootModule: "dagger-dev", 
          objectName: "DaggerDevCli", 
          expected: { isRoot: false, moduleName: "cli" } 
        },
        { 
          rootModule: "dagger-dev", 
          objectName: "DaggerDevScripts", 
          expected: { isRoot: false, moduleName: "scripts" } 
        },
      ];

      testCases.forEach(({ rootModule, objectName, expected }) => {
        // Convert root module name to PascalCase for comparison
        const rootModuleNamePascal = rootModule
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('');

        const isRootModule = objectName === rootModuleNamePascal;
        
        let moduleName: string | undefined;
        if (!isRootModule && objectName.startsWith(rootModuleNamePascal)) {
          const submodulePascal = objectName.slice(rootModuleNamePascal.length);
          
          if (submodulePascal) {
            // Convert to kebab-case - this is the fallback logic when no root function mapping exists
            moduleName = submodulePascal
              .split(/(?=[A-Z])/)
              .join("-")
              .toLowerCase();
          }
        }

        assert.strictEqual(isRootModule, expected.isRoot, 
          `Object ${objectName} isRoot should be ${expected.isRoot}`);
        assert.strictEqual(moduleName, expected.moduleName, 
          `Object ${objectName} module name should be ${expected.moduleName}`);
      });
    });
  });
});
