import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';
import { DataProvider } from '../../src/tree/provider';
import Cli, { FunctionInfo } from '../../src/dagger';

describe('Tree Provider', () => {
    let mockCli: Partial<Cli>;
    let dataProvider: DataProvider;

    beforeEach(() => {
        mockCli = {
            isInstalled: async () => true,
            isDaggerProject: async () => true,
            functionsList: async () => [],
            getFunction(functionId: string, _workspacePath: string): Promise<FunctionInfo> {
                return Promise.resolve({ name: 'mockFunction', description: 'Mock function description', id: functionId });
            },
        };
    });

    it('should load data with test items on construction', async () => {
        // Arrange: mock functionsList to return test items
        const testFunctions: FunctionInfo[] = [
            { name: 'testFunc1', description: 'desc1', functionId: 'func1' },
            { name: 'testFunc2', description: 'desc2', functionId: 'func2' }
        ];
        mockCli.functionsList = async () => testFunctions;
        mockCli.isInstalled = async () => true;
        mockCli.isDaggerProject = async () => true;

        // Act
        dataProvider = new DataProvider(mockCli as Cli, '');
        // Wait for async loadData to finish
        await new Promise(resolve => setTimeout(resolve, 10));
        const children = await dataProvider.getChildren();

        // Assert
        assert.strictEqual(children.length, 2);
        assert.strictEqual(children[0].label, 'testFunc1');
        assert.strictEqual(children[1].label, 'testFunc2');
    });
});
