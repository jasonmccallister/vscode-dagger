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
    };
  });

  it("should load data with test items on construction", async () => {
    // Arrange: mock getFunctions to return test items
    const testFunctions: FunctionInfo[] = [
      {
        name: "testFunc1",
        description: "desc1",
        functionId: "func1",
        module: "default",
        args: [],
        parentModule: undefined,
        returnType: "container",
      },
      {
        name: "testFunc2",
        description: "desc2",
        functionId: "func2",
        module: "default",
        args: [],
        parentModule: undefined,
        returnType: "container",
      },
    ];
    mockCli.getFunctions = async () => testFunctions;

    // Act
    dataProvider = new DataProvider(mockCli as DaggerCLI, "");
    // Wait for async loadData to finish
    await new Promise((resolve) => setTimeout(resolve, 10));
    const children = await dataProvider.getChildren();

    // Assert
    assert.strictEqual(children.length, 2);
    assert.strictEqual(children[0].label, "testFunc1");
    assert.strictEqual(children[1].label, "testFunc2");
  });

  it("should display root module functions at top level with multiple modules", async () => {
    // Arrange: mock functionsList to return multiple modules including root module
    const testFunctions: FunctionInfo[] = [
      // Root module functions (empty module name)
      {
        name: "rootFunc1",
        description: "Root function 1",
        functionId: "root1",
        module: "",
        args: [],
        parentModule: undefined,
        returnType: "container",
      },
      {
        name: "rootFunc2",
        description: "Root function 2",
        functionId: "root2",
        module: "",
        args: [],
        parentModule: undefined,
        returnType: "container",
      },
      // Submodule functions
      {
        name: "subFunc1",
        description: "Sub function 1",
        functionId: "sub1",
        module: "submodule1",
        args: [],
        parentModule: undefined,
        returnType: "container",
      },
      {
        name: "subFunc2",
        description: "Sub function 2",
        functionId: "sub2",
        module: "submodule1",
        args: [],
        parentModule: undefined,
        returnType: "container",
      },
      {
        name: "otherFunc",
        description: "Other function",
        functionId: "other1",
        module: "other-module",
        args: [],
        parentModule: undefined,
        returnType: "container",
      },
    ];
    mockCli.getFunctions = async () => testFunctions;

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
});
