import { isIP } from 'node:net';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

const productionDomain = 'shopademia.store';
const reservedDomains = ['example.com', 'example.net', 'example.org'];
const reservedSuffixes = ['.example', '.test', '.invalid', '.localhost'];

function isLoopback(hostname) {
    const host = normalizeHostname(hostname);
    return host === 'localhost' || host.endsWith('.localhost') || isIP(host) === 4 && host.startsWith('127.') || host === '::1';
}

function isWithin(parent, child) {
    const relative = path.relative(parent, child);
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function normalizeHostname(hostname) {
    return hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

function resolveThroughExistingAncestor(value) {
    let current = path.resolve(value);
    const missingParts = [];
    while (!existsSync(current)) {
        const parent = path.dirname(current);
        if (parent === current) return path.resolve(current, ...missingParts);
        missingParts.unshift(path.basename(current));
        current = parent;
    }
    return path.resolve(realpathSync(current), ...missingParts);
}

export function validatePlaywrightTarget(env = process.env, repositoryRoot = process.cwd()) {
    const errors = [];
    const rawTarget = env.PLAYWRIGHT_BASE_URL || '';
    let target;
    try {
        target = new URL(rawTarget);
    } catch {
        return ['Set PLAYWRIGHT_BASE_URL to a valid local or authorized staging URL.'];
    }
    const authority = rawTarget.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1] || '';
    if (authority.includes('@') || target.username || target.password || target.hash) {
        errors.push('PLAYWRIGHT_BASE_URL must not contain credentials or a fragment.');
    }
    if (target.search) {
        errors.push('PLAYWRIGHT_BASE_URL must not contain query parameters.');
    }
    if (target.pathname !== '/') {
        errors.push('PLAYWRIGHT_BASE_URL must identify the application origin without a path.');
    }

    if (isLoopback(target.hostname)) {
        if (!['http:', 'https:'].includes(target.protocol)) {
            errors.push('Local Playwright targets must use HTTP or HTTPS.');
        }
    } else {
        const stagingHost = (env.PLAYWRIGHT_STAGING_HOST || '').trim().toLowerCase();
        const targetHost = normalizeHostname(target.hostname);
        const approvedHost = normalizeHostname(stagingHost);
        if (target.protocol !== 'https:') {
            errors.push('Remote Playwright targets must use HTTPS.');
        }
        if (target.port && target.port !== '443') {
            errors.push('Remote Playwright targets must use the standard HTTPS port.');
        }
        if (isIP(target.hostname.replace(/^\[|\]$/g, ''))) {
            errors.push('Remote Playwright targets must use the verified staging hostname, not an IP address.');
        }
        if (targetHost === productionDomain || targetHost.endsWith(`.${productionDomain}`)) {
            errors.push('Playwright refuses to target the production hostname.');
        }
        if (targetHost.split('.').some((label) => ['prod', 'production'].includes(label))) {
            errors.push('Playwright refuses hostnames containing a production label.');
        }
        if (reservedDomains.some((domain) => targetHost === domain || targetHost.endsWith(`.${domain}`))
            || reservedSuffixes.some((suffix) => targetHost.endsWith(suffix))) {
            errors.push('Remote Playwright targets must not use reserved example or test hostnames.');
        }
        if (env.PLAYWRIGHT_TARGET_ENV !== 'staging' || !approvedHost
            || targetHost !== approvedHost) {
            errors.push('Remote browser tests require PLAYWRIGHT_TARGET_ENV=staging and an exact PLAYWRIGHT_STAGING_HOST match.');
        }

        const output = env.PLAYWRIGHT_OUTPUT_DIR;
        const report = env.PLAYWRIGHT_REPORT_DIR;
        const artifactsRoot = env.PLAYWRIGHT_ARTIFACTS_ROOT;
        const runId = env.PLAYWRIGHT_RUN_ID || '';
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/.test(runId)) {
            errors.push('Remote browser tests require a unique PLAYWRIGHT_RUN_ID.');
        }
        if (!artifactsRoot || !path.isAbsolute(artifactsRoot)
            || !output || !report || !path.isAbsolute(output) || !path.isAbsolute(report)) {
            errors.push('Remote browser tests require absolute PLAYWRIGHT_ARTIFACTS_ROOT, PLAYWRIGHT_OUTPUT_DIR, and PLAYWRIGHT_REPORT_DIR paths.');
        } else {
            const repositoryPath = resolveThroughExistingAncestor(repositoryRoot);
            const artifactsPath = path.resolve(artifactsRoot);
            const outputPath = path.resolve(output);
            const reportPath = path.resolve(report);
            if (path.resolve(artifactsPath, runId, 'test-results') !== outputPath
                || path.resolve(artifactsPath, runId, 'playwright-report') !== reportPath) {
                errors.push('Remote browser artifact paths must be the test-results and playwright-report folders for this run under PLAYWRIGHT_ARTIFACTS_ROOT.');
            } else {
                const canonicalArtifactsPath = resolveThroughExistingAncestor(artifactsPath);
                const canonicalOutputPath = resolveThroughExistingAncestor(outputPath);
                const canonicalReportPath = resolveThroughExistingAncestor(reportPath);
                if (isWithin(repositoryPath, canonicalArtifactsPath)) {
                    errors.push('Remote browser artifacts root must be stored outside the repository.');
                }
                if (!isWithin(canonicalArtifactsPath, canonicalOutputPath)
                    || !isWithin(canonicalArtifactsPath, canonicalReportPath)) {
                    errors.push('Remote browser artifact paths must remain within PLAYWRIGHT_ARTIFACTS_ROOT.');
                }
            }
        }
    }

    return errors;
}

export function validatePrivilegedPlaywrightTarget(env = process.env, repositoryRoot = process.cwd()) {
    const errors = validatePlaywrightTarget(env, repositoryRoot);
    if (env.PLAYWRIGHT_ALLOW_PRIVILEGED_E2E !== '1') {
        errors.push('Privileged browser tests require PLAYWRIGHT_ALLOW_PRIVILEGED_E2E=1.');
    }

    try {
        const target = new URL(env.PLAYWRIGHT_BASE_URL || '');
        if (isLoopback(target.hostname)) {
            errors.push('Privileged browser tests cannot target a local or loopback server.');
        }
    } catch {
        // validatePlaywrightTarget reports an invalid or missing base URL.
    }

    return errors;
}
