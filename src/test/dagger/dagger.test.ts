import * as assert from 'assert';
import * as fs from 'fs';
import * as sinon from 'sinon';
import Cli from '../../dagger/dagger';

describe('Dagger CLI', () => {
    let cli: Cli;
    let existsSyncStub: sinon.SinonStub;

    beforeEach(() => {
        cli = new Cli();
        existsSyncStub = sinon.stub(fs, 'existsSync');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('isDaggerProject method', () => {
        it('should return true when dagger.json exists', async () => {
            existsSyncStub.returns(true);

            const result = await cli.isDaggerProject();

            assert.strictEqual(result, true);
        });

        it('should return false when dagger.json does not exist', async () => {
            existsSyncStub.returns(false);

            const result = await cli.isDaggerProject();

            assert.strictEqual(result, false);
        });
    });
});
