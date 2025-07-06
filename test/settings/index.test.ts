import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { DaggerSettingsProvider } from '../../src/settings';

describe('DaggerSettings', () => {
    let sandbox: sinon.SinonSandbox;
    let getConfigurationStub: sinon.SinonStub;
    let mockConfiguration: any;
    let settings: DaggerSettingsProvider;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Create mock configuration
        mockConfiguration = {
            get: sandbox.stub()
        };
        
        // Default setting values
        mockConfiguration.get.withArgs('enableCache', true).returns(true);
        
        // Stub vscode.workspace.getConfiguration
        getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration');
        getConfigurationStub.withArgs('dagger').returns(mockConfiguration);
        
        // Create settings provider
        settings = new DaggerSettingsProvider();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('enableCache setting', () => {
        it('should default to true when not configured', () => {
            assert.strictEqual(settings.enableCache, true);
        });

        it('should load enableCache setting from configuration', () => {
            mockConfiguration.get.withArgs('enableCache', true).returns(false);
            
            // Reload settings
            settings.reload();
            
            assert.strictEqual(settings.enableCache, false);
        });

        it('should reload settings when called', () => {
            // First it's true
            assert.strictEqual(settings.enableCache, true);
            
            // Change configuration value
            mockConfiguration.get.withArgs('enableCache', true).returns(false);
            
            // Reload settings
            settings.reload();
            
            // Now it should be false
            assert.strictEqual(settings.enableCache, false);
        });
    });
});
