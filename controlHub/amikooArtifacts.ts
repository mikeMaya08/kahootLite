import fs from 'fs';
import path from 'path';
import os from 'os';
import { api, getControlHubUrl } from './apiUtils';
import { buildZipForTest } from './zipUtils';
import { requestSignedUrl, uploadZipToS3 } from './s3Upload';

function readAmikooKeyFromEnvFile(filePath: string, ignorePlaceholder = false): string {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf8');
  const keyMatch = content.match(/^\s*(?:export\s+)?AMIKOO_KEY\s*=\s*(.*)$/m);
  const value = keyMatch ? keyMatch[1].trim() : '';
  if (!value) return '';
  if (ignorePlaceholder && value === 'your_amikoo_key_here') return '';
  return value;
}

export function detectAmikooKeySource(resolvedKey: string): string {
  if (!resolvedKey) return '';

  const amikooKey = readAmikooKeyFromEnvFile(path.resolve(process.cwd(), '.env.amikoo'), true);
  if (amikooKey && amikooKey === resolvedKey) return '.env.amikoo';

  const dotEnvKey = readAmikooKeyFromEnvFile(path.resolve(process.cwd(), '.env'));
  if (dotEnvKey && dotEnvKey === resolvedKey) return '.env';

  return 'environment variable';
}


// How many artifact zips are built + uploaded to S3 in parallel.
//
// Each "worker" does: build zip on disk → request signed URL → PUT stream to S3.
// Higher values finish faster on fast networks but hold more open sockets,
// more `archiver` deflate state, and more disk I/O at once.
// Lower values (1–2) are gentler on memory and network — useful on
// constrained CI runners.
//
// Trade-off (per concurrent worker, approx):
//   - 1 open HTTPS socket to S3 (TLS state ~1–2 MB)
//   - 1 active `archiver` zip stream (small, but allocates deflate buffers)
//   - 1 temp zip file open on disk (streamed, not buffered)
//
// Default: 10 (good balance for typical CI). Override with
// AMIKOO_ARTIFACT_UPLOAD_CONCURRENCY=<n>.
const ARTIFACT_UPLOAD_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.AMIKOO_ARTIFACT_UPLOAD_CONCURRENCY || '', 10) || 10
);

export interface AmikooArtifact {
  hash: string;
  testTitle: string;
  localPath: string;
  attachmentName: string;
  specFile: string;
}

interface UploadOptions {
  token: string;
  amikooKey: string;
  signedUrlEndpoint?: string;
  repoRoot: string;
}

const SIGNED_URL_ENDPOINTS = {
  prod: 'https://prgm4fborb.execute-api.us-east-2.amazonaws.com/prod/mcp/getSignedUrl',
  staging: 'https://prgm4fborb.execute-api.us-east-2.amazonaws.com/staging/mcp/getSignedUrl',
};

/**
 * Resolves the endpoint that hands out presigned S3 URLs for artifact uploads.
 *
 * Resolution order:
 *   1. `AMIKOO_SIGNED_URL_ENDPOINT` env var, if set. Use this to point the
 *      reporter at a localhost endpoint (e.g. `http://localhost:3000/mcp/getSignedUrl`)
 *      or any custom deployment during development.
 *   2. Otherwise, picks prod vs staging automatically based on which Control
 *      Hub URL the reporter is talking to (`getControlHubUrl()`).
 *
 * @returns Fully-qualified endpoint that returns a presigned S3 URL for
 *          uploading an artifact zip. May be localhost, staging, or prod.
 */
function resolveSignedUrlEndpoint(): string {
  if (process.env.AMIKOO_SIGNED_URL_ENDPOINT) return process.env.AMIKOO_SIGNED_URL_ENDPOINT;
  return getControlHubUrl() === 'https://app.amikoo.ai'
    ? SIGNED_URL_ENDPOINTS.prod
    : SIGNED_URL_ENDPOINTS.staging;
}

/**
 * Scans a Playwright TestResult for attachments tagged as amikoo artifacts
 * and converts them into `AmikooArtifact` records the uploader understands.
 *
 * Convention: any attachment whose `name` starts with `amikoo-` is treated as
 * a failure-data artifact. The `amikoo-` prefix is stripped from the name so
 * the file lands in the zip with its "real" name (e.g. `amikoo-trace.json`
 * becomes `failure-data/trace.json`).
 *
 * @param result    - Playwright TestResult with `attachments`.
 * @param testId    - Hash identifying the test (used as the grouping key when
 *                    multiple artifacts belong to the same test).
 * @param fullTitle - Full test title including parent describe blocks; used
 *                    to derive a human-readable slug for the S3 path.
 * @param specFile  - Absolute path to the .spec file; included so the
 *                    uploader can also zip the test source + its imports.
 * @returns Zero or more artifact records ready to be queued for upload.
 */
export function collectAmikooArtifacts(
  result: { attachments?: Array<{ name?: string; path?: string }> },
  testId: string,
  fullTitle: string,
  specFile: string,
): AmikooArtifact[] {
  const out: AmikooArtifact[] = [];
  for (const att of result.attachments || []) {
    if (typeof att?.name === 'string' && att.name.startsWith('amikoo-') && att.path) {
      out.push({
        hash: testId,
        testTitle: fullTitle,
        localPath: att.path,
        attachmentName: att.name.slice('amikoo-'.length),
        specFile,
      });
    }
  }
  return out;
}

/**
 * Top-level entry point: groups artifacts by test, then uploads each group
 * to S3 in parallel (bounded by `ARTIFACT_UPLOAD_CONCURRENCY`).
 *
 * Flow:
 *   1. Bail out early if there's nothing to upload or no `AMIKOO_KEY`.
 *   2. Group artifacts by `hash` so all files for one test land in a single
 *      zip (one S3 object per test, not per attachment).
 *   3. Spawn N worker promises that pull from a shared cursor; each worker
 *      processes one test's group end-to-end (zip → signed URL → upload →
 *      upsert backend record).
 *   4. Collect per-test results and print a single summary line. Individual
 *      failures are logged but do not abort the batch.
 *
 * @param files - All artifacts collected across the whole run.
 * @param opts  - Backend token, amikoo key, optional endpoint override, and
 *                the repo root used when zipping test source files.
 */
export async function uploadAmikooArtifacts(
  files: AmikooArtifact[],
  opts: UploadOptions
): Promise<void> {
  if (!files.length) return;

  if (!opts.amikooKey) {
    console.warn('⚠ AMIKOO_KEY missing; skipping artifact upload');
    return;
  }

  const groups = new Map<string, AmikooArtifact[]>();
  for (const f of files) {
    const bucket = groups.get(f.hash) || [];
    bucket.push(f);
    groups.set(f.hash, bucket);
  }

  console.log(`📁 Uploading ${groups.size} artifact(s) to S3 (concurrency=${ARTIFACT_UPLOAD_CONCURRENCY})...`);

  const entries = Array.from(groups.entries());
  const results: PromiseSettledResult<void>[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < entries.length) {
      const index = cursor++;
      const [hash, group] = entries[index];
      try {
        await uploadSingleTest(hash, group, opts);
        results.push({ status: 'fulfilled', value: undefined });
      }
      catch (reason) {
        results.push({ status: 'rejected', reason });
      }
    }
  };

  const workerCount = Math.min(ARTIFACT_UPLOAD_CONCURRENCY, entries.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.length - succeeded;
  if (failed) {
    console.warn(`⚠ Uploaded ${succeeded}/${results.length} artifact(s) to S3 (${failed} failed)`);
  } else {
    console.log(`✔ Uploaded ${succeeded}/${results.length} artifact(s) to S3`);
  }
}

/**
 * Builds a zip for a single test's artifacts, uploads it to S3, and records
 * the resulting S3 path on the backend via `/test_execution_data/upsert`.
 *
 * Steps:
 *   1. Build a zip in the OS temp dir containing:
 *        - `failure-data/*`  → the amikoo artifact files
 *        - `test-files/*`    → the spec file and its local imports
 *   2. Request a fresh presigned S3 URL scoped to this test slug.
 *   3. Stream the zip to S3 (see `uploadZipToS3` — streaming, not buffered).
 *   4. Tell the backend where the zip landed so the UI can link to it.
 *   5. Always delete the temp zip in `finally`, even on failure.
 *
 * Errors are logged with a clear per-test message and re-thrown so the
 * parent batcher records the failure in its summary.
 *
 * @param hash  - Test hash, used as the grouping key and S3 key fragment.
 * @param group - All artifacts belonging to this test.
 * @param opts  - Upload options (token, amikoo key, repo root, endpoint).
 */
async function uploadSingleTest(
  hash: string,
  group: AmikooArtifact[],
  opts: UploadOptions
): Promise<void> {
  const testTitle = group[0].testTitle;
  const specFile = group[0].specFile;
  const slug = sanitizeSlug(testTitle);

  const zipPath = path.join(os.tmpdir(), `amikoo-${hash.slice(0, 8)}-${Date.now()}.zip`);
  try {
    await buildZipForTest(zipPath, specFile, group, opts.repoRoot);

    const endpoint = opts.signedUrlEndpoint ?? resolveSignedUrlEndpoint();
    const { sourcePath, signedUrl } = await requestSignedUrl(
      endpoint,
      opts.amikooKey,
      slug
    );

    await uploadZipToS3(zipPath, signedUrl);

    const upsertResponse = await api.post('/test_execution_data/upsert', opts.token, {
      hash,
      failureFilesPathInS3: sourcePath,
    });

    if (!upsertResponse.success) {
      throw new Error(`upsert failed: ${upsertResponse.error}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  ✖ Artifact upload failed for ${slug}: ${msg}`);
    throw error;
  } finally {
    try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
  }
}

/**
 * Converts a free-form test title into an S3-safe slug.
 *
 * Rules:
 *   - lowercase
 *   - spaces → underscores
 *   - anything that isn't `[a-z0-9_-]` → underscore
 *   - collapse runs of underscores and trim leading/trailing ones
 *
 * Used as a path segment in the S3 key so artifacts are easy to spot when
 * browsing the bucket.
 */
function sanitizeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}
