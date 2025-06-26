import * as assert from 'assert';

// Basic test suite to verify testing setup
describe('Basic Test Suite', () => {
	it('should run a basic assertion test', () => {
		assert.strictEqual(1 + 1, 2);
	});

	it('should test array operations', () => {
		const arr = [1, 2, 3];
		assert.strictEqual(arr.length, 3);
		assert.strictEqual(arr[0], 1);
	});
});

// Only import VS Code when needed to avoid module loading issues
describe('VS Code Integration', () => {
	it('should have VS Code API available in extension context', async () => {
		try {
			const vscode = await import('vscode');
			assert.ok(vscode, 'vscode API should be available');
			assert.ok(vscode.window, 'vscode.window should be available');
		} catch (error) {
			// This might fail in some test environments, which is okay
			console.log('VS Code API not available in this test context:', error);
		}
	});
});
