import * as assert from 'assert';
import { describe, it, beforeEach, afterEach } from 'mocha';
import Cli, { FunctionInfo } from '../../src/dagger';
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
});
