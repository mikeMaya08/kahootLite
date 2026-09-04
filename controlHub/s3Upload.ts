import fs from 'fs';
import { Readable } from 'stream';

/**
 * Requests a presigned S3 URL from the amikoo signed-URL service so we can
 * PUT an artifact zip directly to S3 without going through the backend.
 *
 * The service decides the final S3 key from `test_name` (slug) and returns
 * both the destination path we should record in our DB (`sourcePath`) and
 * the time-limited PUT URL.
 *
 * @param endpoint   - Full HTTPS URL of the signed-URL service
 *                     (prod/staging differ — see `resolveSignedUrlEndpoint`).
 * @param amikooKey  - User's amikoo key, used by the service to scope the
 *                     upload to the right organization.
 * @param testSlug   - URL-safe test name; becomes a path segment in S3.
 * @returns `{ sourcePath, signedUrl }` — throws on HTTP error or if the
 *          response is missing either field.
 */
export async function requestSignedUrl(
  endpoint: string,
  amikooKey: string,
  testSlug: string
): Promise<{ sourcePath: string; signedUrl: string }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: amikooKey, test_name: testSlug }),
  });

  if (!response.ok) {
    throw new Error(`Signed URL request failed: ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();
  if (!data?.sourcePath || !data?.signedUrl) {
    throw new Error('Signed URL response missing sourcePath or signedUrl');
  }

  return { sourcePath: data.sourcePath, signedUrl: data.signedUrl };
}

/**
 * Streams a local zip file to S3 via a presigned PUT URL.
 *
 * Memory note: we deliberately do **not** call `fs.readFileSync(zipPath)`
 * here. With concurrent uploads, buffering each zip would multiply RAM
 * usage by the concurrency factor. Instead we open a Node read stream,
 * convert it to a Web ReadableStream, and let undici/fetch send it in
 * chunks (~64 KB at a time). `Content-Length` is set explicitly so S3 can
 * validate the request and doesn't have to fall back to chunked encoding.
 *
 * The `duplex: 'half'` option is required by undici whenever the request
 * body is a stream.
 *
 * @param zipPath   - Absolute path to the zip on disk.
 * @param signedUrl - Presigned PUT URL from `requestSignedUrl`.
 * @throws If S3 responds with a non-2xx status.
 */
export async function uploadZipToS3(zipPath: string, signedUrl: string): Promise<void> {
  // Stream the zip from disk instead of buffering it in memory. With multiple
  // concurrent uploads this keeps RAM flat even for large zips.
  const stat = fs.statSync(zipPath);
  const nodeStream = fs.createReadStream(zipPath);
  const body = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

  const response = await fetch(signedUrl, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(stat.size),
      'x-amz-server-side-encryption': 'AES256',
      'x-amz-meta-purpose': 'muukmcp',
    },
    // duplex is required by undici when the request body is a stream.
    duplex: 'half',
  } as any);

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
  }
}
