import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'mocha';
import Cli, { FunctionInfo } from '../../src/dagger';
import sinon from 'sinon';
import { DaggerSettings } from '../../src/settings';
import * as vscode from 'vscode';

describe('Dagger CLI Wrapper', () => {
    let cli: Cli;
    let mockSettings: DaggerSettings;

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

    beforeEach(() => {
        mockSettings = new MockDaggerSettings();
        cli = new Cli(mockSettings);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('getFriendlyTypeName', () => {
        it('should convert GraphQL type names to friendly type names', async () => {
            const testCases = [
                { input: 'OBJECT_STRING', expected: 'string' },
                { input: 'OBJECT_INT', expected: 'number' },
                { input: 'OBJECT_FLOAT', expected: 'number' },
                { input: 'OBJECT_BOOLEAN', expected: 'boolean' },
                { input: 'OBJECT_OBJECT', expected: 'object' },
                { input: 'OBJECT_ARRAY', expected: 'array' },
                { input: 'OBJECT_LIST', expected: 'array' },
                { input: 'OBJECT_MAP', expected: 'object' },
                { input: 'OBJECT_CUSTOM', expected: 'custom' },
                { input: 'STRING', expected: 'string' },
                { input: 'INT', expected: 'number' },
                { input: 'BOOLEAN', expected: 'boolean' },
                { input: 'ID', expected: 'string' },
                { input: 'CustomType', expected: 'customtype' },
                { input: '', expected: 'unknown' },
                { input: null as any, expected: 'unknown' }
            ];

            for (const testCase of testCases) {
                // Access the private method for testing
                const result = (cli as any).getFriendlyTypeName(testCase.input);
                assert.strictEqual(result, testCase.expected, `Failed for input: ${testCase.input}`);
            }
        });
    });

    // Additional test cases
    
    describe('fetchFunctionsList module relationship detection', () => {
        it('should correctly identify parent-child module relationships', async () => {
            // Create a mock for queryModuleFunctions to return test data
            const mockQueryModuleFunctions = sinon.stub(cli, 'queryModuleFunctions');
            
            // Mock response with parent-child module hierarchy
            mockQueryModuleFunctions.resolves([
                {
                    name: 'DaggerDev',
                    asObject: {
                        name: 'DaggerDev',
                        functions: [
                            {
                                id: 'func1',
                                name: 'buildImage',
                                description: 'Builds an image',
                                args: []
                            },
                            {
                                id: 'func4',
                                name: 'generateDocs',
                                description: 'Generates documentation in the parent module',
                                args: []
                            }
                        ]
                    }
                },
                {
                    name: 'DaggerDevCli',
                    asObject: {
                        name: 'DaggerDevCli',
                        functions: [
                            {
                                id: 'func2',
                                name: 'installBinary',
                                description: 'Installs CLI binary',
                                args: []
                            }
                        ]
                    }
                },
                {
                    name: 'DaggerDevDocs',
                    asObject: {
                        name: 'DaggerDevDocs',
                        functions: [
                            {
                                id: 'func3',
                                name: 'generateDocs',
                                description: 'Generates documentation',
                                args: []
                            }
                        ]
                    }
                }
            ]);
            
            // Mock queryDirectoryId to return a test ID
            const mockQueryDirectoryId = sinon.stub(cli, 'queryDirectoryId');
            mockQueryDirectoryId.resolves('dir-123');
            
            // Call the method under test
            const functions = await (cli as any).fetchFunctionsList('/test/workspace');
            
            // Verify the results
            assert.strictEqual(functions.length, 4, 'Should return 4 function objects');
            
            // Check parent module detection - parent modules now have empty module name
            const parentModule = functions.find((f: FunctionInfo) => 
                f.isParentModule && f.name.includes('generate'));
            assert.ok(parentModule, 'Should find the parent module function');
            assert.strictEqual(parentModule?.module, '', 'Parent module should have an empty string as module name');
            assert.strictEqual(parentModule?.isParentModule, true, 'Parent module should be identified as a parent module');
            assert.strictEqual(parentModule?.parentModule, undefined, 'Parent module should not have a parent');
            
            // Check submodules - they should have clean names now (without the parent prefix)
            // Note: The module name is now expected to be 'cli' and 'docs' not 'dagger-dev-cli' and 'dagger-dev-docs'
            const cliModule = functions.find((f: FunctionInfo) => f.module === 'cli');
            assert.ok(cliModule, 'Should find the cli module function');
            assert.strictEqual(cliModule?.isParentModule, false, 'Cli should not be a parent module');
            assert.strictEqual(cliModule?.parentModule, 'dagger-dev', 'Cli should have dagger-dev as parent');
            
            const docsModule = functions.find((f: FunctionInfo) => f.module === 'docs');
            assert.ok(docsModule, 'Should find the docs module function');
            assert.strictEqual(docsModule?.isParentModule, false, 'Docs should not be a parent module');
            assert.strictEqual(docsModule?.parentModule, 'dagger-dev', 'Docs should have dagger-dev as parent');
        });
    });
});
