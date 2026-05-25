import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_JSON_SEARCH_DEPTH = 5;

interface PackageMetadata {
  version?: unknown;
}

export const PACKAGE_VERSION = readPackageVersion();

function readPackageVersion(): string {
  let currentDir = dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < PACKAGE_JSON_SEARCH_DEPTH; depth += 1) {
    const packageJsonPath = join(currentDir, 'package.json');

    if (existsSync(packageJsonPath)) {
      const metadata = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageMetadata;

      if (typeof metadata.version === 'string' && metadata.version.length > 0) {
        return metadata.version;
      }

      throw new Error(`Invalid package version in ${packageJsonPath}`);
    }

    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  throw new Error('Unable to locate package.json for CORD version resolution');
}
