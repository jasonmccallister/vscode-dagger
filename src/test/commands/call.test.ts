import { describe, it, beforeEach, afterEach } from 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { registerCallCommand } from '../../commands/call';
import Cli from '../../dagger';
import { DaggerTreeItem } from '../../tree/provider';
import { FunctionInfo } from '../../dagger';

// Mock the utils module
const mockUtils = {
    collectAndRunFunction: sinon.stub(),
    showSaveTaskPrompt: sinon.stub()
};

// Mock the prompt module
const mockPrompt = {
    showProjectSetupPrompt: sinon.stub()
};

describe('Call Command Tests', () => {
    let mockCli: sinon.SinonStubbedInstance<Cli>;
    let mockContext: Partial<vscode.ExtensionContext>;
    let workspacePath: string;
    let sandbox: sinon.SinonSandbox;
    let commandCallback: (input?: any) => Promise<void>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        workspacePath = '/test/workspace';
        
        // Create mock CLI
        mockCli = sandbox.createStubInstance(Cli);
        
        // Reset mocks
        mockUtils.collectAndRunFunction.reset();
        mockUtils.showSaveTaskPrompt.reset();
        mockPrompt.showProjectSetupPrompt.reset();
        
        // Set up utils module mocks first
        sandbox.stub(require('../../utils/function-helpers'), 'collectAndRunFunction')
            .callsFake(mockUtils.collectAndRunFunction);
        sandbox.stub(require('../../utils/function-helpers'), 'showSaveTaskPrompt')
            .callsFake(mockUtils.showSaveTaskPrompt);
        sandbox.stub(require('../../prompt'), 'showProjectSetupPrompt')
            .callsFake(mockPrompt.showProjectSetupPrompt);
        
        // Mock vscode.commands.registerCommand to capture the callback
        let capturedCallback: any;
        const mockDisposable = { dispose: sandbox.stub() };
        sandbox.stub(vscode.commands, 'registerCommand')
            .callsFake((_, callback: any) => {
                capturedCallback = callback;
                return mockDisposable;
            });
        
        // Create simplified mock context
        mockContext = {
            subscriptions: []
        };
        
        // Register the command to capture the callback
        registerCallCommand(mockContext as vscode.ExtensionContext, mockCli as any, workspacePath);
        commandCallback = capturedCallback;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Condition 1: Direct command call should show quick pick', () => {
        it('should show quick pick when no input is provided', async () => {
            // Setup
            mockCli.isDaggerProject.resolves(true);
            mockCli.setWorkspacePath.returns();
            
            const mockFunctions: FunctionInfo[] = [
                {
                    name: 'test-function-1',
                    description: 'Test function 1',
                    functionId: 'func1',
                    module: 'test-module',
                    args: []
                },
                {
                    name: 'test-function-2', 
                    description: 'Test function 2',
                    functionId: 'func2',
                    module: 'test-module',
                    args: []
                }
            ];

            mockCli.functionsList.resolves(mockFunctions);
            mockCli.queryFunctionByID.resolves({
                name: 'test-function-1',
                functionId: 'func1',
                module: 'test-module',
                args: []
            });

            // Mock VS Code APIs
            const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            const withProgressStub = sandbox.stub(vscode.window, 'withProgress');

            // Mock user selecting first function
            const mockQuickPickItem = {
                label: 'test-function-1',
                description: 'Test function 1',
                functionId: 'func1',
                moduleName: 'test-module'
            };
            showQuickPickStub.resolves(mockQuickPickItem as any);

            // Mock progress callback
            withProgressStub.callsFake(async (_, task) => {
                const mockProgress = {
                    report: sandbox.stub()
                };
                return await task(mockProgress, {} as vscode.CancellationToken);
            });

            // Mock collectAndRunFunction
            mockUtils.collectAndRunFunction.resolves({ success: true, argValues: {} });
            mockUtils.showSaveTaskPrompt.resolves();

            // Execute command with no input
            await commandCallback();

            // Verify quick pick was shown
            assert.ok(showQuickPickStub.calledOnce, 'Quick pick should be shown');
            
            // Verify functionsList was called to populate quick pick
            assert.ok(mockCli.functionsList.calledWith(workspacePath), 'functionsList should be called');
        });

        it('should handle empty function list gracefully', async () => {
            // Setup
            mockCli.isDaggerProject.resolves(true);
            mockCli.setWorkspacePath.returns();
            mockCli.functionsList.resolves([]);

            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');

            // Execute command
            await commandCallback();

            // Verify information message was shown
            assert.ok(showInformationMessageStub.calledWith('No Dagger functions found in this project.'), 
                'Should show no functions message');
        });
    });

    describe('Condition 2: DaggerTreeItem input should call function directly', () => {
        it('should call function directly when DaggerTreeItem is passed', async () => {
            // Setup
            mockCli.isDaggerProject.resolves(true);
            mockCli.setWorkspacePath.returns();
            
            // Mock that getFunction method doesn't exist, so it falls back to queryFunctionByID
            delete (mockCli as any).getFunction;
            
            mockCli.queryFunctionByID.resolves({
                name: 'test-function',
                functionId: 'func1',
                module: 'test-module',
                args: [
                    {
                        name: 'arg1',
                        type: 'string',
                        required: true
                    }
                ]
            });

            // Mock VS Code APIs
            const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            const withProgressStub = sandbox.stub(vscode.window, 'withProgress');

            // Mock progress callback
            withProgressStub.callsFake(async (_, task) => {
                const mockProgress = {
                    report: sandbox.stub()
                };
                return await task(mockProgress, {} as vscode.CancellationToken);
            });

            // Mock collectAndRunFunction
            mockUtils.collectAndRunFunction.resolves({ success: true, argValues: { arg1: 'test-value' } });
            mockUtils.showSaveTaskPrompt.resolves();

            // Create DaggerTreeItem
            const treeItem = new DaggerTreeItem(
                'test-function',
                'function',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                'test-module',
                'func1'
            );

            // Execute command with tree item
            await commandCallback(treeItem);

            // Verify quick pick was NOT shown (direct call)
            assert.ok(showQuickPickStub.notCalled, 'Quick pick should not be shown');
            
            // Verify function was called directly using the ID
            assert.ok(mockCli.queryFunctionByID.calledWith('func1', workspacePath), 
                'queryFunctionByID should be called with correct ID');

            // Verify functionsList was NOT called (no picker needed)
            assert.ok(mockCli.functionsList.notCalled, 'functionsList should not be called');

            // Verify collectAndRunFunction was called
            assert.ok(mockUtils.collectAndRunFunction.calledOnce, 'collectAndRunFunction should be called');
        });

        it('should handle string function ID input', async () => {
            // Setup
            mockCli.isDaggerProject.resolves(true);
            mockCli.setWorkspacePath.returns();
            
            // Mock that getFunction method doesn't exist, so it falls back to queryFunctionByID
            delete (mockCli as any).getFunction;
            
            mockCli.queryFunctionByID.resolves({
                name: 'test-function',
                functionId: 'func1',
                module: 'test-module',
                args: []
            });

            // Mock VS Code APIs
            const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            const withProgressStub = sandbox.stub(vscode.window, 'withProgress');

            // Mock progress callback
            withProgressStub.callsFake(async (_, task) => {
                const mockProgress = {
                    report: sandbox.stub()
                };
                return await task(mockProgress, {} as vscode.CancellationToken);
            });

            // Mock collectAndRunFunction
            mockUtils.collectAndRunFunction.resolves({ success: true, argValues: {} });
            mockUtils.showSaveTaskPrompt.resolves();

            // Execute command with string ID
            await commandCallback('func1');

            // Verify quick pick was NOT shown
            assert.ok(showQuickPickStub.notCalled, 'Quick pick should not be shown');
            
            // Verify function was called with string ID
            assert.ok(mockCli.queryFunctionByID.calledWith('func1', workspacePath), 
                'queryFunctionByID should be called with string ID');
        });
    });

    describe('Condition 3: Non-Dagger project should show setup prompt', () => {
        it('should show setup prompt when not a Dagger project', async () => {
            // Setup
            mockCli.isDaggerProject.resolves(false);

            // Execute command
            await commandCallback();

            // Verify isDaggerProject was called
            assert.ok(mockCli.isDaggerProject.calledOnce, 'isDaggerProject should be called');
            
            // Verify setup prompt was shown
            assert.ok(mockPrompt.showProjectSetupPrompt.calledOnce, 'showProjectSetupPrompt should be called');

            // Verify no other CLI methods were called
            assert.ok(mockCli.functionsList.notCalled, 'functionsList should not be called');
            assert.ok(mockCli.queryFunctionByID.notCalled, 'queryFunctionByID should not be called');
        });

        it('should show setup prompt even with DaggerTreeItem input when not a Dagger project', async () => {
            // Setup
            mockCli.isDaggerProject.resolves(false);

            // Create DaggerTreeItem
            const treeItem = new DaggerTreeItem(
                'test-function',
                'function',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                'test-module',
                'func1'
            );

            // Execute command with tree item
            await commandCallback(treeItem);

            // Verify setup prompt was shown regardless of input
            assert.ok(mockPrompt.showProjectSetupPrompt.calledOnce, 'showProjectSetupPrompt should be called');
            
            // Verify no function-related methods were called
            assert.ok(mockCli.functionsList.notCalled, 'functionsList should not be called');
            assert.ok(mockCli.queryFunctionByID.notCalled, 'queryFunctionByID should not be called');
        });
    });

    describe('Error handling', () => {
        it('should handle function loading errors gracefully', async () => {
            // Setup
            mockCli.isDaggerProject.resolves(true);
            mockCli.setWorkspacePath.returns();
            
            // Configure query to throw error directly in withProgress
            mockCli.queryFunctionByID.callsFake(() => {
                // Throw error synchronously within withProgress
                throw new Error('Function not found');
            });
            
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            const consoleErrorStub = sandbox.stub(console, 'error');
            
            // Don't stub withProgress, let it call the real function to trigger the error
            // This ensures the catch block is reached
            
            // Create DaggerTreeItem
            const treeItem = new DaggerTreeItem(
                'test-function',
                'function',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                'test-module',
                'func1'
            );

            // Execute command
            await commandCallback(treeItem);

            // Verify error message was shown
            assert.ok(showErrorMessageStub.called, 'Error message should be shown');
            
            // Handling catch clause should show one of these error messages
            // When getFunction/queryFunctionByID fails, handler shows function details error
            // When function isn't found, it shows the first message
            const expectedMessages = [
                'Failed to get details for function with ID func1',
                'Failed to get function details: Function not found'
            ];
            
            // Check if one of the expected messages was shown
            let messageMatched = false;
            if (showErrorMessageStub.args.length > 0) {
                const actualMessage = showErrorMessageStub.args[0][0];
                messageMatched = expectedMessages.some(msg => actualMessage === msg);
                assert.ok(messageMatched, `Error message should match one of the expected patterns. Actual: "${actualMessage}"`);
            }
        });

        it('should handle missing function details', async () => {
            // Setup
            mockCli.isDaggerProject.resolves(true);
            mockCli.setWorkspacePath.returns();
            mockCli.queryFunctionByID.resolves(undefined); // No function details returned

            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            const withProgressStub = sandbox.stub(vscode.window, 'withProgress');

            // Mock progress callback
            withProgressStub.callsFake(async (_, task) => {
                const mockProgress = {
                    report: sandbox.stub()
                };
                return await task(mockProgress, {} as vscode.CancellationToken);
            });

            // Create DaggerTreeItem
            const treeItem = new DaggerTreeItem(
                'test-function',
                'function',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                'test-module',
                'func1'
            );

            // Execute command
            await commandCallback(treeItem);

            // Verify error message was shown
            assert.ok(showErrorMessageStub.calledOnce, 'Error message should be shown');
            assert.ok(showErrorMessageStub.calledWith('Failed to get details for function with ID func1'), 
                'Should show function ID in error message');
        });
    });
});
