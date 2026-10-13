import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { validateStagingConfig } from './staging-config.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const envFile = resolve(root, '.env.staging');

try {
    const metadata = await lstat(envFile);
    if (!metadata.isFile()) {
        throw Object.assign(new Error('Expected a regular file.'), { code: 'INVALID_ENV_FILE' });
    }
    if (process.platform !== 'win32' && (metadata.mode & 0o077) !== 0) {
        throw Object.assign(new Error('Permissions must deny group and other access.'), { code: 'INVALID_ENV_PERMISSIONS' });
    }
    const contents = await readFile(envFile, 'utf8');
    const errors = validateStagingConfig(dotenv.parse(contents));
    if (errors.length) {
        for (const error of errors) console.error(`Staging configuration invalid: ${error}`);
        process.exitCode = 1;
    } else {
        console.info('Staging configuration passed local safety validation.');
    }
} catch (error) {
    if (error.code === 'ENOENT') {
        console.error('Staging configuration invalid: create .env.staging from .env.staging.example and replace every placeholder.');
    } else if (error.code === 'INVALID_ENV_FILE') {
        console.error('Staging configuration invalid: .env.staging must be a regular file, not a symlink or special file.');
    } else if (error.code === 'INVALID_ENV_PERMISSIONS') {
        console.error('Staging configuration invalid: .env.staging permissions must deny group and other access (for example, chmod 600).');
    } else {
        console.error('Staging configuration could not be read:', {
            name: error.name || 'Error',
            code: typeof error.code === 'string' ? error.code : undefined
        });
    }
    process.exitCode = 1;
}
