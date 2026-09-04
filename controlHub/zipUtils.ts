import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { AmikooArtifact } from './amikooArtifacts';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];

interface TsconfigPaths {
  baseUrl: string;
  paths: Record<string, string[]>;
}

export async function buildZipForTest(
  zipPath: string,
  specFile: string,
  artifacts: AmikooArtifact[],
  repoRoot: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);

    for (const art of artifacts) {
      if (!fs.existsSync(art.localPath)) continue;
      archive.file(art.localPath, { name: `failure-data/${art.attachmentName}` });
    }

    if (specFile && fs.existsSync(specFile)) {
      const tsconfigPaths = loadTsconfigPaths(repoRoot);
      const testFiles = collectTestFiles(specFile, repoRoot, tsconfigPaths);
      for (const absPath of testFiles) {
        const relPath = path.relative(repoRoot, absPath).split(path.sep).join('/');
        archive.file(absPath, { name: `test-files/${relPath}` });
      }
    } else if (specFile) {
      console.warn(`[amikoo-upload] spec file not found on disk: ${specFile}`);
    }

    archive.finalize();
  });
}

function collectTestFiles(
  specFile: string,
  repoRoot: string,
  tsconfigPaths: TsconfigPaths | null
): string[] {
  const visited = new Set<string>();
  const queue: string[] = [path.resolve(specFile)];

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    if (!isInsideRepo(current, repoRoot)) continue;
    if (!fs.existsSync(current)) continue;
    visited.add(current);

    let source: string;
    try {
      source = fs.readFileSync(current, 'utf8');
    } catch {
      continue;
    }

    for (const specifier of extractImportSpecifiers(source)) {
      const resolved = resolveSpecifier(specifier, current, repoRoot, tsconfigPaths);
      if (resolved && !visited.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  return Array.from(visited);
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /(?:^|\s)import\s+(?:[^'"`;]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /(?:^|[^.\w])import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /(?:^|[^.\w])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      specifiers.push(m[1]);
    }
  }
  return specifiers;
}

function resolveSpecifier(
  specifier: string,
  fromFile: string,
  repoRoot: string,
  tsconfigPaths: TsconfigPaths | null
): string | null {
  if (specifier.startsWith('@playwright/') || specifier.startsWith('@muuktest/')) {
    return null;
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return resolveFile(path.resolve(path.dirname(fromFile), specifier), repoRoot);
  }

  if (tsconfigPaths) {
    const aliased = resolveWithTsconfigPaths(specifier, tsconfigPaths, repoRoot);
    if (aliased) return aliased;
  }

  return null;
}

function resolveFile(candidatePath: string, repoRoot: string): string | null {
  if (!isInsideRepo(candidatePath, repoRoot)) return null;

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return candidatePath;
  }

  for (const ext of SOURCE_EXTENSIONS) {
    const withExt = candidatePath + ext;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) return withExt;
  }

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
    for (const ext of SOURCE_EXTENSIONS) {
      const indexFile = path.join(candidatePath, 'index' + ext);
      if (fs.existsSync(indexFile)) return indexFile;
    }
  }

  return null;
}

function isInsideRepo(absPath: string, repoRoot: string): boolean {
  const normalized = path.resolve(absPath);
  const root = path.resolve(repoRoot);
  if (!normalized.startsWith(root + path.sep) && normalized !== root) return false;
  return !normalized.split(path.sep).includes('node_modules');
}

function resolveWithTsconfigPaths(
  specifier: string,
  tsconfig: TsconfigPaths,
  repoRoot: string
): string | null {
  for (const [pattern, targets] of Object.entries(tsconfig.paths)) {
    const match = matchAliasPattern(pattern, specifier);
    if (match === null) continue;
    for (const target of targets) {
      const candidate = path.resolve(tsconfig.baseUrl, target.replace('*', match));
      const resolved = resolveFile(candidate, repoRoot);
      if (resolved) return resolved;
    }
  }
  return null;
}

function matchAliasPattern(pattern: string, specifier: string): string | null {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1);
    if (specifier.startsWith(prefix)) return specifier.slice(prefix.length);
    return null;
  }
  return pattern === specifier ? '' : null;
}

function loadTsconfigPaths(repoRoot: string): TsconfigPaths | null {
  const tsconfigPath = path.join(repoRoot, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) return null;

  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf8');
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const parsed = JSON.parse(stripped);
    const baseUrl = parsed?.compilerOptions?.baseUrl;
    const paths = parsed?.compilerOptions?.paths;
    if (!paths) return null;
    return {
      baseUrl: path.resolve(repoRoot, baseUrl || '.'),
      paths,
    };
  } catch {
    return null;
  }
}
