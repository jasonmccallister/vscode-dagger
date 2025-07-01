import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'mocha';
import Cli, { FunctionInfo } from '../../dagger';
import sinon from 'sinon';

describe('Dagger CLI Wrapper', () => {
    let cli: Cli;

    beforeEach(() => {
        cli = new Cli();
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

    describe('getFunctionArgsByName', () => {
        it('should return function arguments by name', async () => {
            // Arrange: Create a stub for functionsList
            const testFunctions: FunctionInfo[] = [
                {
                    name: 'test-function',
                    description: 'A test function',
                    args: [
                        { name: 'arg1', type: 'string', required: true },
                        { name: 'arg2', type: 'number', required: false }
                    ]
                },
                {
                    name: 'another-function',
                    description: 'Another function',
                    args: [
                        { name: 'arg3', type: 'boolean', required: true }
                    ]
                }
            ];

            // Use a path that exists for testing
            const workspacePath = __dirname;
            const functionsListStub = sinon.stub(cli, 'functionsList').resolves(testFunctions);

            // Act: Call getFunctionArgsByName with a test function name
            const args = await cli.getFunctionArgsByName('test-function', workspacePath);

            // Assert: Verify the returned arguments
            assert.ok(args, 'Arguments should be returned');
            assert.strictEqual(args?.length, 2, 'Should return 2 arguments');
            assert.strictEqual(args?.[0].name, 'arg1', 'First argument name should match');
            assert.strictEqual(args?.[0].type, 'string', 'First argument type should match');
            assert.strictEqual(args?.[0].required, true, 'First argument required flag should match');
            assert.strictEqual(args?.[1].name, 'arg2', 'Second argument name should match');
            assert.strictEqual(args?.[1].type, 'number', 'Second argument type should match');
            assert.strictEqual(args?.[1].required, false, 'Second argument required flag should match');

            // Verify functionsList was called with the correct workspace path
            assert.ok(functionsListStub.calledWith(workspacePath), 'functionsList should be called with the provided workspace path');
        });

        it('should return undefined for non-existent function', async () => {
            // Arrange: Create a stub for functionsList
            const testFunctions: FunctionInfo[] = [
                { name: 'existing-function', description: 'An existing function' }
            ];

            // Use a path that exists for testing
            const workspacePath = __dirname;
            sinon.stub(cli, 'functionsList').resolves(testFunctions);

            // Act: Call getFunctionArgsByName with a non-existent function name
            const args = await cli.getFunctionArgsByName('non-existent-function', workspacePath);

            // Assert: Verify the result is undefined
            assert.strictEqual(args, undefined, 'Should return undefined for non-existent function');
        });

        it('should throw an error when no workspace path is provided and not set', async () => {
            // Act & Assert: Verify it throws an error when no workspace path is provided or set
            await assert.rejects(
                async () => await cli.getFunctionArgsByName('test-function'),
                /Workspace path is not set/,
                'Should throw an error when no workspace path is provided or set'
            );
        });

        it('should use the instance workspace path when available', async () => {
            // Arrange: Create stub for functionsList
            const functionsListStub = sinon.stub(cli, 'functionsList').resolves([]);

            // Use real path and manually update the workspacePath property
            const workspacePath = __dirname;
            (cli as any).workspacePath = workspacePath; // Access private property for test

            // Act: Call getFunctionArgsByName without providing a workspace path
            await cli.getFunctionArgsByName('test-function');

            // Assert: Verify functionsList was called with the instance's workspace path
            assert.ok(functionsListStub.calledWith(workspacePath), 'functionsList should be called with the instance workspace path');
        });
    });
});
