import { nameToPascalCase, nameToKebabCase } from "../../src/utils/modules";
import assert from "assert";

describe("modules utils", () => {
    describe("nameToPascalCase", () => {
        it("should convert kebab-case to PascalCase", () => {
            assert.strictEqual(nameToPascalCase("my-module-name"), "MyModuleName");
        });

        it("should convert snake_case to PascalCase", () => {
            assert.strictEqual(nameToPascalCase("my_module_name"), "MyModuleName");
        });

        it("should handle mixed separators", () => {
            assert.strictEqual(nameToPascalCase("my-module_name"), "MyModuleName");
        });

        it("should handle already PascalCase input", () => {
            assert.strictEqual(nameToPascalCase("MyModuleName"), "MyModuleName");
        });

        it("should handle empty string", () => {
            assert.strictEqual(nameToPascalCase(""), "");
        });
    });

    describe("nameToKebabCase", () => {
        it("should convert PascalCase to kebab-case", () => {
            assert.strictEqual(nameToKebabCase("MyModuleName"), "my-module-name");
        });

        it("should handle already kebab-case input", () => {
            assert.strictEqual(nameToKebabCase("my-module-name"), "my-module-name");
        });

        it("should handle empty string", () => {
            assert.strictEqual(nameToKebabCase(""), "");
        });
    });
});