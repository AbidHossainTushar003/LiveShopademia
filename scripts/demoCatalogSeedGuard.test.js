import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDemoCatalogSeedTarget } from './demoCatalogSeedGuard.js';

const validTarget = {
    args: ['--apply'],
    env: {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://demo:demo@127.0.0.1:5432/shopademia'
    }
};

test('demo seed requires explicit apply and a loopback development database', () => {
    assert.doesNotThrow(() => validateDemoCatalogSeedTarget(validTarget));
    for (const change of [
        { args: [] },
        { env: { NODE_ENV: 'production' } },
        { env: { SHOPADEMIA_READ_ONLY_PREVIEW: '1' } },
        { env: { DATABASE_URL: 'postgresql://demo:demo@db.example.com/shopademia' } },
        { env: { DATABASE_URL: 'postgresql://demo:demo@127.0.0.1/shopademia?host=db.example.com' } },
        { env: { DATABASE_URL: 'postgresql://demo:demo@localhost/shopademia?sslmode=require' } },
        { env: { DATABASE_SSL: 'true' } }
    ]) {
        assert.throws(() => validateDemoCatalogSeedTarget({
            args: change.args ?? validTarget.args,
            env: { ...validTarget.env, ...change.env }
        }));
    }
});
