import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';
import { DataProvider, Item } from '../tree/provider';
import Cli, { FunctionInfo } from '../dagger/dagger';

describe('Tree Provider Function Name Validation', () => {
    let mockCli: Partial<Cli>;
    let dataProvider: DataProvider;

    beforeEach(() => {
        mockCli = {
            isInstalled: async () => true,
            isDaggerProject: async () => true,
            functionsList: async () => [],
            getFunctionArguments: async () => []
        };
    });

    it('should handle valid function names correctly', async () => {
        const validFunctions: FunctionInfo[] = [
            { name: 'valid-function', description: 'A valid function' },
            { name: 'another-function' },
            { name: 'function_with_underscores' }
        ];

        mockCli.functionsList = async () => validFunctions;
        dataProvider = new DataProvider(mockCli as Cli, '/test/path');

        // Wait for initial load
        await new Promise(resolve => setTimeout(resolve, 100));

        // All functions should be loaded correctly
        const children = dataProvider.getChildren();
        assert.ok(Array.isArray(children), 'getChildren should return an array');
        assert.strictEqual(children.length, 3);
        
        const items = children as Item[];
        assert.strictEqual(items[0].label, 'valid-function');
        assert.strictEqual(items[0].id, 'valid-function');
        assert.strictEqual(items[1].label, 'another-function');
        assert.strictEqual(items[1].id, 'another-function');
    });

    it('should handle invalid function names gracefully', async () => {
        const invalidFunctions = [
            { name: '', description: 'Empty name' },
            { name: '   ', description: 'Whitespace only' },
            { name: 'valid-function', description: 'Valid function' }
        ] as FunctionInfo[];

        mockCli.functionsList = async () => invalidFunctions;
        dataProvider = new DataProvider(mockCli as Cli, '/test/path');

        // Wait for initial load
        await new Promise(resolve => setTimeout(resolve, 100));

        const children = dataProvider.getChildren();
        assert.ok(Array.isArray(children), 'getChildren should return an array');
        const items = children as Item[];
        
        // Should filter out invalid names and handle the valid one
        assert.strictEqual(items.length, 1);
        assert.strictEqual(items[0].label, 'valid-function');
        assert.strictEqual(items[0].id, 'valid-function');
    });

    it('should handle function name truncation', async () => {
        const longNameFunction: FunctionInfo[] = [
            { 
                name: 'this-is-a-very-long-function-name-that-should-be-truncated', 
                description: 'A function with a very long name' 
            }
        ];

        mockCli.functionsList = async () => longNameFunction;
        dataProvider = new DataProvider(mockCli as Cli, '/test/path');

        // Wait for initial load
        await new Promise(resolve => setTimeout(resolve, 100));

        const children = dataProvider.getChildren();
        assert.ok(Array.isArray(children), 'getChildren should return an array');
        const items = children as Item[];
        assert.strictEqual(items.length, 1);
        
        // Display name should be truncated
        assert.strictEqual(items[0].label, 'this-is-a-very-long-function...');
        
        // But ID should be the full name
        assert.strictEqual(items[0].id, 'this-is-a-very-long-function-name-that-should-be-truncated');
    });
});
