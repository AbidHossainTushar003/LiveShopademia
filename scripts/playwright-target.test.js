import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { validatePlaywrightTarget } from './playwright-target.js';

const root = path.resolve('repository');
const artifactsRoot = path.resolve(root, '..', 'playwright-artifacts');
const localTarget = {
    PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3000'
};

function stagingTarget(overrides = {}) {
    const runId = 'stage-test-001';
    return {
        PLAYWRIGHT_BASE_URL: 'https://stage.shopademia.dev',
        PLAYWRIGHT_TARGET_ENV: 'staging',
        PLAYWRIGHT_STAGING_HOST: 'stage.shopademia.dev',
        PLAYWRIGHT_RUN_ID: runId,
        PLAYWRIGHT_ARTIFACTS_ROOT: artifactsRoot,
        PLAYWRIGHT_OUTPUT_DIR: path.join(artifactsRoot, runId, 'test-results'),
        PLAYWRIGHT_REPORT_DIR: path.join(artifactsRoot, runId, 'playwright-report'),
        ...overrides
    };
}

test('Playwright allows local loopback targets without remote artifact settings', () => {
    assert.deepEqual(validatePlaywrightTarget(localTarget, root), []);
    assert.ok(validatePlaywrightTarget({}, root).some((error) => error.includes('Set PLAYWRIGHT_BASE_URL')));
});

test('Playwright blocks known production hostnames', () => {
    const errors = validatePlaywrightTarget({
        PLAYWRIGHT_BASE_URL: 'https://shopademia.store',
        PLAYWRIGHT_TARGET_ENV: 'staging',
        PLAYWRIGHT_STAGING_HOST: 'shopademia.store',
        PLAYWRIGHT_RUN_ID: 'run-test-001',
        PLAYWRIGHT_ARTIFACTS_ROOT: artifactsRoot,
        PLAYWRIGHT_OUTPUT_DIR: path.resolve(root, '..', 'shopademia-output'),
        PLAYWRIGHT_REPORT_DIR: path.resolve(root, '..', 'shopademia-report')
    }, root);
    assert.ok(errors.some((error) => error.includes('production hostname')));
});

test('Playwright requires exact HTTPS staging host and external artifact paths', () => {
    const valid = stagingTarget();
    assert.deepEqual(validatePlaywrightTarget(valid, root), []);
    assert.ok(validatePlaywrightTarget({
        ...valid,
        PLAYWRIGHT_BASE_URL: 'https://other.example.org'
    }, root).some((error) => error.includes('exact')));
    assert.ok(validatePlaywrightTarget({
        ...valid,
        PLAYWRIGHT_BASE_URL: 'https://stage.example.org',
        PLAYWRIGHT_STAGING_HOST: 'stage.example.org'
    }, root).some((error) => error.includes('reserved')));
    assert.ok(validatePlaywrightTarget({
        ...valid,
        PLAYWRIGHT_BASE_URL: 'https://prod.stage.shopademia.dev',
        PLAYWRIGHT_STAGING_HOST: 'prod.stage.shopademia.dev'
    }, root).some((error) => error.includes('production label')));
    const repositoryArtifacts = stagingTarget({
        PLAYWRIGHT_ARTIFACTS_ROOT: path.join(root, 'artifacts'),
        PLAYWRIGHT_OUTPUT_DIR: path.join(root, 'artifacts', 'stage-test-001', 'test-results'),
        PLAYWRIGHT_REPORT_DIR: path.join(root, 'artifacts', 'stage-test-001', 'playwright-report')
    });
    assert.ok(validatePlaywrightTarget(repositoryArtifacts, root)
        .some((error) => error.includes('outside the repository')));
    assert.ok(validatePlaywrightTarget({
        ...valid,
        PLAYWRIGHT_BASE_URL: 'https://192.0.2.10',
        PLAYWRIGHT_STAGING_HOST: '192.0.2.10'
    }, root).some((error) => error.includes('not an IP address')));
});

test('Playwright rejects staging URLs with credentials, query, path, unsupported scheme, or nonstandard port', () => {
    const valid = stagingTarget();
    for (const [url, message] of [
        ['https://user:password@stage.shopademia.dev', 'credentials'],
        ['https://@stage.shopademia.dev', 'credentials'],
        ['https://stage.shopademia.dev/?shop=main', 'query parameters'],
        ['https://stage.shopademia.dev/admin', 'without a path'],
        ['http://stage.shopademia.dev', 'HTTPS'],
        ['https://stage.shopademia.dev:8443', 'standard HTTPS port'],
        ['ftp://stage.shopademia.dev', 'HTTPS']
    ]) {
        assert.ok(validatePlaywrightTarget({ ...valid, PLAYWRIGHT_BASE_URL: url }, root)
            .some((error) => error.includes(message)), url);
    }
});

test('Playwright normalizes a trailing hostname dot before exact staging comparison', () => {
    const valid = stagingTarget({ PLAYWRIGHT_BASE_URL: 'https://stage.shopademia.dev.' });
    assert.deepEqual(validatePlaywrightTarget(valid, root), []);
});

test('Playwright keeps per-run artifact paths inside an external approved root', () => {
    const valid = stagingTarget();
    assert.ok(validatePlaywrightTarget({
        ...valid,
        PLAYWRIGHT_OUTPUT_DIR: path.resolve(artifactsRoot, '..', 'escaped', 'stage-test-001', 'test-results')
    }, root).some((error) => error.includes('under PLAYWRIGHT_ARTIFACTS_ROOT')));
    const repositoryRoot = path.resolve(root, 'artifacts');
    assert.ok(validatePlaywrightTarget({
        ...valid,
        PLAYWRIGHT_ARTIFACTS_ROOT: repositoryRoot,
        PLAYWRIGHT_OUTPUT_DIR: path.join(repositoryRoot, 'stage-test-001', 'test-results'),
        PLAYWRIGHT_REPORT_DIR: path.join(repositoryRoot, 'stage-test-001', 'playwright-report')
    }, root).some((error) => error.includes('outside the repository')));
    assert.ok(validatePlaywrightTarget({
        ...valid,
        PLAYWRIGHT_ARTIFACTS_ROOT: undefined
    }, root).some((error) => error.includes('PLAYWRIGHT_ARTIFACTS_ROOT')));
});
