import * as assert from "assert";
import { describe, it, beforeEach } from "mocha";
import { DataProvider, DaggerTreeItem } from "../../src/tree/provider";
import { DaggerCLI } from "../../src/cli";
import { FunctionInfo } from "../../src/types/types";

describe("Tree Provider", () => {
  let mockCli: Partial<DaggerCLI>;
  let dataProvider: DataProvider;

  beforeEach(() => {
    mockCli = {
      getFunctions: async () => [],
      getFunctionsAsTree: async () => new Map(),
    };
  });

  it("should load data with test items on construction", async () => {
    // Arrange: mock getFunctionsAsTree to return test items
    const testFunctions: FunctionInfo[] = [
      {
        name: "testFunc1",
        description: "desc1",
        id: "func1",
        args: [],
        returnType: "container",
      },
      {
        name: "testFunc2",
        description: "desc2",
        id: "func2",
        args: [],
        returnType: "container",
      },
    ];

    // Mock the getFunctionsAsTree method instead of getFunctions
    mockCli.getFunctionsAsTree = async () => {
      // Return a Map with an empty module name as the key
      const moduleMap = new Map<
        string,
        Array<{ fn: FunctionInfo; index: number }>
      >();
      moduleMap.set(
        "",
        testFunctions.map((fn, index) => ({ fn, index })),
      );
      return moduleMap;
    };

    // Act
    dataProvider = new DataProvider(mockCli as DaggerCLI, "");
    // Wait for async loadData to finish
    await new Promise((resolve) => setTimeout(resolve, 50));
    const children = await dataProvider.getChildren();

    // Assert
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0].label, "testFunc1");
    assert.strictEqual(children[1].label, "testFunc2");
  });

  it("should display root module functions at top level with multiple modules", async () => {
    // Arrange: mock getFunctionsAsTree to return multiple modules including root module

    // Create module map structure with root module and other modules
    const moduleMap = new Map<
      string,
      Array<{ fn: FunctionInfo; index: number }>
    >();

    // Root module functions (empty module name)
    moduleMap.set("", [
      {
        fn: {
          name: "rootFunc1",
          description: "Root function 1",
          id: "root1",
          module: "",
          args: [],
          returnType: "container",
        },
        index: 0,
      },
      {
        fn: {
          name: "rootFunc2",
          description: "Root function 2",
          id: "root2",
          module: "",
          args: [],
          returnType: "container",
        },
        index: 1,
      },
    ]);

    // Submodule1 functions
    moduleMap.set("submodule1", [
      {
        fn: {
          name: "subFunc1",
          description: "Sub function 1",
          id: "sub1",
          module: "submodule1",
          args: [],
          returnType: "container",
        },
        index: 2,
      },
      {
        fn: {
          name: "subFunc2",
          description: "Sub function 2",
          id: "sub2",
          module: "submodule1",
          args: [],
          returnType: "container",
        },
        index: 3,
      },
    ]);

    // Other module functions
    moduleMap.set("other-module", [
      {
        fn: {
          name: "otherFunc",
          description: "Other function",
          id: "other1",
          module: "other-module",
          args: [],
          returnType: "container",
        },
        index: 4,
      },
    ]);

    // Mock the getFunctionsAsTree method
    mockCli.getFunctionsAsTree = async () => moduleMap;

    // Act
    dataProvider = new DataProvider(mockCli as DaggerCLI, "");
    // Wait for async loadData to finish
    await new Promise((resolve) => setTimeout(resolve, 100));
    const children = await dataProvider.getChildren();

    // Assert - We should have 4 top-level items: 2 root functions and 2 module items
    assert.strictEqual(children.length, 4, "Should have 4 top-level items");

    // Find root functions and module items
    const rootFunctions = children.filter((item) => item.type === "function");
    const moduleItems = children.filter((item) => item.type === "module");

    // Verify root functions are at top level
    assert.strictEqual(
      rootFunctions.length,
      2,
      "Should have 2 root functions at top level",
    );
    assert.ok(
      rootFunctions.some((fn) => fn.label === "rootFunc1"),
      "Should find rootFunc1 at top level",
    );
    assert.ok(
      rootFunctions.some((fn) => fn.label === "rootFunc2"),
      "Should find rootFunc2 at top level",
    );

    // Verify module items exist
    assert.strictEqual(moduleItems.length, 2, "Should have 2 module items");
    assert.ok(
      moduleItems.some((mod) => mod.label === "submodule1"),
      "Should find submodule1",
    );
    assert.ok(
      moduleItems.some((mod) => mod.label === "other-module"),
      "Should find other-module",
    );

    // Verify module children
    const submodule = moduleItems.find(
      (mod) => mod.label === "submodule1",
    ) as DaggerTreeItem;
    if (submodule && submodule.children) {
      assert.strictEqual(
        submodule.children.length,
        2,
        "Submodule should have 2 functions",
      );
      const functionNames = submodule.children.map((item) => item.label);
      assert.ok(
        functionNames.includes("subFunc1"),
        "Should find subFunc1 in submodule",
      );
      assert.ok(
        functionNames.includes("subFunc2"),
        "Should find subFunc2 in submodule",
      );
    } else {
      assert.fail("Submodule should have children property");
    }
  });

  it("should display function arguments as children", async () => {
    // Arrange: mock getFunctionsAsTree to return a function with arguments
    const moduleMap = new Map<
      string,
      Array<{ fn: FunctionInfo; index: number }>
    >();
    moduleMap.set("", [
      {
        fn: {
          name: "functionWithArgs",
          description: "A function with arguments",
          id: "func-with-args",
          module: "",
          args: [
            {
              name: "stringArg",
              type: "string",
              required: true,
            },
            {
              name: "numberArg",
              type: "number",
              required: false,
            },
          ],
          returnType: "container",
        },
        index: 0,
      },
    ]);

    // Mock the getFunctionsAsTree method
    mockCli.getFunctionsAsTree = async () => moduleMap;

    // Act
    dataProvider = new DataProvider(mockCli as DaggerCLI, "");
    // Wait for async loadData to finish
    await new Promise((resolve) => setTimeout(resolve, 50));
    const children = await dataProvider.getChildren();

    // Assert: Should have one function
    assert.strictEqual(children.length, 1, "Should have 1 function");
    assert.strictEqual(children[0].label, "functionWithArgs");

    // The function should have children (arguments)
    const functionItem = children[0];
    const argChildren = await dataProvider.getChildren(functionItem);

    // Should have 2 argument children
    assert.strictEqual(
      argChildren.length,
      2,
      "Function should have 2 arguments",
    );

    // Check argument formatting
    assert.ok(
      argChildren.some((arg) => {
        const label = String(arg.label || "");
        return label.includes("--string-arg") && label.includes("[required]");
      }),
      "Should have required string argument with kebab case name",
    );
    assert.ok(
      argChildren.some((arg) => {
        const label = String(arg.label || "");
        return label.includes("--number-arg") && !label.includes("[required]");
      }),
      "Should have optional number argument with kebab case name",
    );
  });
});
