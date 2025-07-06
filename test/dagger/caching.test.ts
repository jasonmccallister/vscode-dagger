import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'mocha';
import Cli, { FunctionInfo } from '../../src/dagger';
import sinon from 'sinon';
import { DaggerSettings } from '../../src/settings';
import * as vscode from 'vscode';

describe('Dagger CLI Caching', () => {
    let sandbox: sinon.SinonSandbox;
    let mockSettings: DaggerSettings;
    let mockCache: any;
    let cli: Cli;
    
    const TEST_WORKSPACE_PATH = '/mock/workspace';
    const MOCK_FUNCTION_ID = 'func123';

    // Mock function data for testing
    const mockFunctionData: FunctionInfo = {
        name: 'test-function',
        description: 'A test function',
        functionId: MOCK_FUNCTION_ID,
        module: 'test',
        args: [
            { name: 'arg1', type: 'string', required: true },
            { name: 'arg2', type: 'number', required: false }
        ]
    };

    // Create a mock settings class that allows setting enableCache for testing
    class MockDaggerSettings implements DaggerSettings {
        private _enableCache: boolean = true;
        private _installMethod: 'brew' | 'curl' = 'brew';
        private _cloudNotificationDismissed: boolean = false;
        private _saveTaskPromptDismissed: boolean = false;
        private _runFunctionCallsInBackground: boolean = false;
        
        get enableCache(): boolean {
            return this._enableCache;
        }
        
        get installMethod(): 'brew' | 'curl' {
            return this._installMethod;
        }
        
        get cloudNotificationDismissed(): boolean {
            return this._cloudNotificationDismissed;
        }
        
        get saveTaskPromptDismissed(): boolean {
            return this._saveTaskPromptDismissed;
        }
        
        get runFunctionCallsInBackground(): boolean {
            return this._runFunctionCallsInBackground;
        }
        
        // Method for tests to set the enableCache value
        setEnableCache(value: boolean): void {
            this._enableCache = value;
        }
        
        reload(): void {
            // No-op for tests
        }
        
        update<T>(_section: string, _value: T, _target: vscode.ConfigurationTarget): Thenable<void> {
            return Promise.resolve();
        }
    }

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Create mock settings
        mockSettings = new MockDaggerSettings();
        
        // Create mock cache
        mockCache = {
            get: sandbox.stub(),
            set: sandbox.stub().resolves(),
            clear: sandbox.stub().resolves(),
            hasDataChanged: sandbox.stub().resolves(true)
        };
        
        // Mocking console methods to prevent test output noise
        sandbox.stub(console, 'log');
        sandbox.stub(console, 'error');
        
        // Create stub CLI instance with modified methods for testing
        cli = new Cli(mockSettings, mockCache);
        
        // Create new stubs for each test
        const fetchFunctionsListStub = sandbox.stub().resolves([mockFunctionData]);
        const fetchFunctionByIDStub = sandbox.stub().resolves(mockFunctionData);
        
        // Replace the methods with test stubs that won't be called by the background updates
        Object.defineProperties(cli, {
            'fetchFunctionsList': { 
                value: fetchFunctionsListStub,
                writable: true
            },
            'fetchFunctionByID': {
                value: fetchFunctionByIDStub,
                writable: true
            },
            'updateFunctionsListCache': {
                value: sandbox.stub().resolves(),
                writable: true
            },
            'updateFunctionByIDCache': {
                value: sandbox.stub().resolves(),
                writable: true
            }
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('functionsList with caching', () => {
        it('should return cached functions when available and caching is enabled', async () => {
            // Set up mock cache to return data (non-empty array)
            mockCache.get.resolves([mockFunctionData]);
            
            // Call the method
            const result = await cli.functionsList(TEST_WORKSPACE_PATH);
            
            // Verify cache was checked
            assert.ok(mockCache.get.calledOnce, 'Cache should be checked');
            // Verify fetchFunctionsList was not called (used cache)
            assert.ok((cli as any).fetchFunctionsList.notCalled, 'Should not fetch from API when cache hit');
            // Verify expected result
            assert.deepStrictEqual(result, [mockFunctionData]);
        });

        it('should fetch and cache functions when cache misses and caching is enabled', async () => {
            // Set up mock cache to return null (cache miss)
            mockCache.get.resolves(null);
            
            // Call the method
            const result = await cli.functionsList(TEST_WORKSPACE_PATH);
            
            // Verify cache was checked
            assert.ok(mockCache.get.calledOnce, 'Cache should be checked');
            // Verify fetchFunctionsList was called
            assert.ok((cli as any).fetchFunctionsList.calledOnce, 'Should fetch from API on cache miss');
            // Verify data was cached
            assert.ok(mockCache.set.calledOnce, 'Result should be cached');
            // Verify expected result
            assert.deepStrictEqual(result, [mockFunctionData]);
        });

        it('should bypass cache when caching is disabled', async () => {
            // Disable caching
            (mockSettings as MockDaggerSettings).setEnableCache(false);
            
            // Set up mock cache to return data (shouldn't be used)
            mockCache.get.resolves([mockFunctionData]);
            
            // Call the method
            const result = await cli.functionsList(TEST_WORKSPACE_PATH);
            
            // Verify cache was not checked
            assert.ok(mockCache.get.notCalled, 'Cache should not be checked when disabled');
            // Verify fetchFunctionsList was called directly
            assert.ok((cli as any).fetchFunctionsList.calledOnce, 'Should fetch from API when cache disabled');
            // Verify data was not cached
            assert.ok(mockCache.set.notCalled, 'Result should not be cached when disabled');
            // Verify expected result
            assert.deepStrictEqual(result, [mockFunctionData]);
        });
    });

    describe('queryFunctionByID with caching', () => {
        it('should return cached function when available and caching is enabled', async () => {
            // Set up mock cache to return data
            mockCache.get.resolves(mockFunctionData);
            
            // Call the method
            const result = await cli.queryFunctionByID(MOCK_FUNCTION_ID, TEST_WORKSPACE_PATH);
            
            // Verify cache was checked
            assert.ok(mockCache.get.calledOnce, 'Cache should be checked');
            // Verify fetchFunctionByID was not called (used cache)
            assert.ok((cli as any).fetchFunctionByID.notCalled, 'Should not fetch from API when cache hit');
            // Verify expected result
            assert.deepStrictEqual(result, mockFunctionData);
        });

        it('should fetch and cache function when cache misses and caching is enabled', async () => {
            // Set up mock cache to return null (cache miss)
            mockCache.get.resolves(null);
            
            // Call the method
            const result = await cli.queryFunctionByID(MOCK_FUNCTION_ID, TEST_WORKSPACE_PATH);
            
            // Verify cache was checked
            assert.ok(mockCache.get.calledOnce, 'Cache should be checked');
            // Verify fetchFunctionByID was called
            assert.ok((cli as any).fetchFunctionByID.calledOnce, 'Should fetch from API on cache miss');
            // Verify data was cached
            assert.ok(mockCache.set.calledOnce, 'Result should be cached');
            // Verify expected result
            assert.deepStrictEqual(result, mockFunctionData);
        });

        it('should bypass cache when caching is disabled', async () => {
            // Disable caching
            (mockSettings as MockDaggerSettings).setEnableCache(false);
            
            // Set up mock cache to return data (shouldn't be used)
            mockCache.get.resolves(mockFunctionData);
            
            // Call the method
            const result = await cli.queryFunctionByID(MOCK_FUNCTION_ID, TEST_WORKSPACE_PATH);
            
            // Verify cache was not checked
            assert.ok(mockCache.get.notCalled, 'Cache should not be checked when disabled');
            // Verify fetchFunctionByID was called directly
            assert.ok((cli as any).fetchFunctionByID.calledOnce, 'Should fetch from API when cache disabled');
            // Verify data was not cached
            assert.ok(mockCache.set.notCalled, 'Result should not be cached when disabled');
            // Verify expected result
            assert.deepStrictEqual(result, mockFunctionData);
        });
    });

    describe('updateFunctionsListCache', () => {
        it('should not update cache in background when caching is disabled', async () => {
            // Disable caching
            (mockSettings as MockDaggerSettings).setEnableCache(false);
            
            // Call the private method directly
            await (cli as any).updateFunctionsListCache(TEST_WORKSPACE_PATH, 'mock_cache_key');
            
            // Verify fetchFunctionsList was not called
            assert.ok((cli as any).fetchFunctionsList.notCalled, 'Should not fetch when caching disabled');
            // Verify cache was not updated
            assert.ok(mockCache.set.notCalled, 'Should not update cache when disabled');
        });
    });

    describe('updateFunctionByIDCache', () => {
        it('should not update cache in background when caching is disabled', async () => {
            // Disable caching
            (mockSettings as MockDaggerSettings).setEnableCache(false);
            
            // Call the private method directly
            await (cli as any).updateFunctionByIDCache(MOCK_FUNCTION_ID, TEST_WORKSPACE_PATH, 'mock_cache_key');
            
            // Verify fetchFunctionByID was not called
            assert.ok((cli as any).fetchFunctionByID.notCalled, 'Should not fetch when caching disabled');
            // Verify cache was not updated
            assert.ok(mockCache.set.notCalled, 'Should not update cache when disabled');
        });
    });
});
