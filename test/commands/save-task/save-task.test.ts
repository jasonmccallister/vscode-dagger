import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import Cli, { FunctionInfo } from '../../../src/dagger';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { COMMAND, registerSaveTaskCommand, saveTaskToTasksJson } from '../../../src/commands/save-task';
import { buildCommandArgs } from '../../../src/utils/function-helpers';

// Mock modules and functions
const mockWorkspacePath = '/mock/workspace/path';
const mockSubmoduleFunction: FunctionInfo = {
    name: 'test-function',
    functionId: 'test-function-id',
    module: 'test-module',
    args: [],  // Function with no arguments
    description: 'Test function',
    isParentModule: false,
    parentModule: undefined
};

const mockParentModuleFunction: FunctionInfo = {
    name: 'parent-function',
    functionId: 'parent-function-id',
    module: '', // Empty string for parent modules
    args: [],  // Function with no arguments
    description: 'Parent module function',
    isParentModule: true,
    parentModule: undefined
};

describe('Save Task Command', () => {
    let sandbox: sinon.SinonSandbox;
    let mockCli: sinon.SinonStubbedInstance<Cli>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Create mocked Cli instance
        mockCli = sandbox.createStubInstance(Cli);
        mockCli.functionsList.resolves([mockSubmoduleFunction, mockParentModuleFunction]);
        
        // Mock VS Code APIs
        sandbox.stub(vscode.window, 'showInputBox').resolves('dagger-test-task');
        sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);

        // Use proper mocking for vscode.workspace.fs APIs
        sandbox.stub(vscode.workspace.fs, 'stat').resolves();
        sandbox.stub(vscode.workspace.fs, 'createDirectory').resolves();
        sandbox.stub(vscode.workspace.fs, 'writeFile').resolves();
        sandbox.stub(vscode.workspace.fs, 'readFile').rejects(new Error('File not found'));

        // Mock vscode.workspace.getWorkspaceFolder
        sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns({
            uri: vscode.Uri.file(mockWorkspacePath),
            name: 'mock',
            index: 0
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should build correct command for submodule function', async () => {
        // Test the buildCommandArgs function directly
        const args = buildCommandArgs('test-function', {}, 'test-module');
        assert.deepStrictEqual(args, ['dagger', 'call', 'test-module', 'test-function']);
    });

    it('should build correct command for parent module function', async () => {
        // Test the buildCommandArgs function directly
        const args = buildCommandArgs('parent-function', {}, '');
        assert.deepStrictEqual(args, ['dagger', 'call', 'parent-function']);
    });

    it('should build correct command with arguments', async () => {
        // Test with some arguments
        const argValues = { 'arg1': 'value1', 'arg2': 'value with spaces' };
        const args = buildCommandArgs('test-function', argValues, 'test-module');
        
        // Verify the command structure
        assert.strictEqual(args[0], 'dagger');
        assert.strictEqual(args[1], 'call');
        assert.strictEqual(args[2], 'test-module');
        assert.strictEqual(args[3], 'test-function');
        // Arguments should follow
        assert.strictEqual(args.includes('--arg1'), true);
        assert.strictEqual(args.includes('value1'), true);
        assert.strictEqual(args.includes('--arg2'), true);
    });

    it('should save task to tasks.json', async () => {
        // Test the saveTaskToTasksJson function
        const writeFileSpy = sandbox.spy(vscode.workspace.fs, 'writeFile');
        
        await saveTaskToTasksJson('test-task', 'dagger call test-function', mockWorkspacePath);
        
        // Verify writeFile was called with the correct parameters
        assert.strictEqual(writeFileSpy.calledOnce, true);
    });
});
