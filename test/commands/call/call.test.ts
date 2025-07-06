import { describe, it, beforeEach, afterEach } from 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { registerCallCommand } from '../../../src/commands/call';
import Cli from '../../../src/dagger';
import { DaggerTreeItem } from '../../../src/tree/provider';
import { FunctionInfo } from '../../../src/dagger';
import { DaggerSettings } from '../../../src/settings';

// Mock the utils module
const mockUtils = {
    collectAndRunFunction: sinon.stub(),
    showSaveTaskPrompt: sinon.stub()
};

// Mock the prompt module
const mockPrompt = {
    showProjectSetupPrompt: sinon.stub()
};

// Create a simple mock settings class for testing
class MockDaggerSettings implements DaggerSettings {
    readonly enableCache: boolean = true;
    readonly installMethod: 'brew' | 'curl' = 'brew';
    readonly cloudNotificationDismissed: boolean = false;
    readonly saveTaskPromptDismissed: boolean = false;
    readonly runFunctionCallsInBackground: boolean = false;
    
    reload(): void { /* no-op */ }
    
    update<T>(_section: string, _value: T, _target: vscode.ConfigurationTarget): Thenable<void> {
        return Promise.resolve();
    }
}

describe('Call Command Tests', () => {
    let mockCli: sinon.SinonStubbedInstance<Cli>;
    let mockContext: Partial<vscode.ExtensionContext>;
    let workspacePath: string;
    let commandCallback: any;
    let sandbox: sinon.SinonSandbox;
    let mockSettings: DaggerSettings;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        workspacePath = '/mock/workspace';
        
        // Initialize mock settings
        mockSettings = new MockDaggerSettings();
        
        // Create mock CLI
        mockCli = sandbox.createStubInstance(Cli);
        
        // Reset mocks
        mockUtils.collectAndRunFunction.reset();
        mockUtils.showSaveTaskPrompt.reset();
        mockPrompt.showProjectSetupPrompt.reset();
        
        // Set up utils module mocks first
        sandbox.stub(require('../../../src/utils/function-helpers'), 'collectAndRunFunction')
            .callsFake(mockUtils.collectAndRunFunction);
        sandbox.stub(require('../../../src/utils/function-helpers'), 'showSaveTaskPrompt')
            .callsFake(mockUtils.showSaveTaskPrompt);
        sandbox.stub(require('../../../src/prompt'), 'showProjectSetupPrompt')
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
        registerCallCommand(mockContext as vscode.ExtensionContext, mockCli as any, workspacePath, mockSettings);
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
});
