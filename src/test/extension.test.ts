import * as assert from 'assert';
import * as vscode from 'vscode';
// import * as myExtension from '../extension';

describe('Extension Test Suite', () => {
	before(() => {
		vscode.window.showInformationMessage('Start all tests.');
	});

	it('should find expected values in array using indexOf', () => {
		// Test negative cases - values not in array should return -1
		const testArray = [1, 2, 3];
		const expectedIndex = -1;
		
		assert.strictEqual(expectedIndex, testArray.indexOf(5));
		assert.strictEqual(expectedIndex, testArray.indexOf(0));
	});

	it('should find expected values in array using indexOf (positive cases)', () => {
		// Test positive cases - values in array should return correct index
		const testArray = [1, 2, 3];
		
		assert.strictEqual(0, testArray.indexOf(1));
		assert.strictEqual(1, testArray.indexOf(2));
		assert.strictEqual(2, testArray.indexOf(3));
	});

	// Add a more comprehensive test for future extension functionality
	it('should have vscode API available', () => {
		assert.ok(vscode, 'vscode API should be available');
		assert.ok(vscode.window, 'vscode.window should be available');
		assert.ok(vscode.commands, 'vscode.commands should be available');
	});
});
