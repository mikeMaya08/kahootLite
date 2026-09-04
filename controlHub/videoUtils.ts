import fs from 'fs';
import { Readable } from 'stream';
import { api } from './apiUtils';

// How many videos are uploaded to S3 in parallel.
//
// Each "worker" streams one .webm file to S3 via a presigned URL using
// fs.createReadStream → fetch (no buffering). Higher values finish faster
// on fast networks but hold more open sockets and file descriptors at once.
// Lower values (1–2) are gentler on memory and network — useful on
// constrained CI runners.
//
// Trade-off (per concurrent worker, approx):
//   - 1 open HTTPS socket to S3 (TLS state ~1–2 MB)
//   - 1 open file descriptor + small read-stream buffer (~64 KB)
//
// Default: 10 (good balance for typical CI). Override with
// AMIKOO_VIDEO_UPLOAD_CONCURRENCY=<n>.
const VIDEO_UPLOAD_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.AMIKOO_VIDEO_UPLOAD_CONCURRENCY || '', 10) || 10
);

/**
 * Extracts the local filesystem path of the video recorded by Playwright
 * for a given test result.
 *
 * Playwright stores videos as attachments on the TestResult. We look for an
 * attachment explicitly named 'video', and fall back to any attachment whose
 * path ends in `.webm` (older Playwright versions or custom setups).
 *
 * @param result - Playwright TestResult object (typed as `any` to avoid a hard
 *                 dependency on Playwright's reporter types here).
 * @returns Absolute path to the video file, or an empty string if no video
 *          attachment exists for this test.
 */
export function getVideoPath(result: any): string {
  const attachment = result.attachments?.find((a: any) => a.name === 'video' || a.path?.endsWith('.webm'));
  return attachment?.path || '';
}

/**
 * Prepares the video list for upload and asks the backend for presigned S3
 * upload URLs in a single batch request.
 *
 * Steps:
 *   1. Filter out videos whose local file no longer exists on disk.
 *   2. Compute a deterministic S3 filename per video:
 *        `<executionNumber>_<testId>.webm`
 *   3. Call `/execution/batch_upload_urls` once for all videos (single API
 *      round-trip instead of one per file).
 *
 * @param videos          - Raw entries collected during the run, each with
 *                          `{ path, testId }`.
 * @param organizationId  - Used as the S3 folder prefix: `videos/<orgId>`.
 * @param executionNumber - Current run's execution number (prefix in S3 key).
 * @param token           - Amikoo API access token.
 * @returns An object with the processed video metadata (`localPath` +
 *          `s3FileName`) and the matching presigned upload URLs. `uploadUrls`
 *          is `null` if the backend request failed or no videos were eligible.
 */
export async function processVideos(
  videos: any[],
  organizationId: string,
  executionNumber: number,
  token: string
): Promise<{ videos: any[]; uploadUrls: any[] | null }> {
  let processed: any[] = [];
  let uploadUrls: any[] | null = null;

  if (videos.length && organizationId && executionNumber) {
    // Map videos to their S3 filenames (no local rename)
    processed = videos.filter(v => v.path && fs.existsSync(v.path))
      .map(v => ({
        localPath: v.path,
        s3FileName: `${executionNumber}_${v.testId}.webm`,
      }));

    if (processed.length) {
      // Request presigned URLs with desired S3 filenames
      const response = await api.post('/execution/batch_upload_urls', token, {
        files: processed.map(v => ({ fileName: v.s3FileName, contentType: 'video/webm', folder: `videos/${organizationId}` })),
      });
      uploadUrls = response.success ? response.data : null;
    } else {
      console.log('  ℹ No videos found to process');
    }
  } else {
    const missing = [
      !videos.length && 'videos (none captured)',
      !organizationId && 'could not get organization ID',
      !executionNumber && 'could not get execution number',
    ].filter(Boolean).join(', ');
    console.log(`  ℹ Missing required parameters for video processing: ${missing}`);
  }

  return { videos: processed, uploadUrls };
}

/**
 * Uploads a single video file to S3 using a presigned URL.
 *
 * Memory note: the file is **streamed** from disk via `fs.createReadStream`
 * and converted to a Web ReadableStream for `fetch`. This keeps RAM usage
 * flat (a small ~64 KB internal buffer) regardless of file size — important
 * because `.webm` recordings can be tens of MB each and we may have hundreds
 * of them in a single run.
 *
 * The `duplex: 'half'` option is required by Node's undici-based fetch
 * implementation whenever the request body is a stream.
 *
 * @param filePath  - Absolute path to the local video file.
 * @param uploadUrl - Presigned S3 PUT URL returned by `processVideos`.
 * @returns `true` if S3 responded with a 2xx status, `false` otherwise (the
 *          caller logs and continues — one failed upload does not abort the
 *          batch).
 */
async function uploadVideoToS3(filePath: string, uploadUrl: string): Promise<boolean> {
  let success = false;

  if (fs.existsSync(filePath)) {
    // Stream the file instead of buffering it in memory. This keeps RAM flat
    // even when there are hundreds of large .webm files.
    const stat = fs.statSync(filePath);
    const nodeStream = fs.createReadStream(filePath);
    // undici/fetch requires a Web ReadableStream for streamed bodies and
    // `duplex: 'half'` when the body is a stream.
    const body = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body,
      headers: {
        'Content-Type': 'video/webm',
        'Content-Length': String(stat.size),
      },
      // duplex is required by undici when the request body is a stream.
      // Cast to any because not all TS lib versions include this field yet.
      duplex: 'half',
    } as any);
    success = response.ok;
    if (!success) {
      console.log(`  ✖ Upload failed with status: ${response.status}`);
    }
  } else {
    console.log(`  ✖ Video file not found: ${filePath}`);
  }

  return success;
}

/**
 * Uploads every processed video to S3 in parallel, bounded by
 * `VIDEO_UPLOAD_CONCURRENCY`.
 *
 * Implementation:
 *   - Builds a `Map<s3FileName, presignedUrl>` for O(1) lookup.
 *   - Spawns up to N "worker" promises that pull from a shared cursor; as
 *     soon as a worker finishes one upload, it grabs the next pending video.
 *     This keeps the connection pipeline saturated without ever holding more
 *     than N file streams open at once.
 *   - Failures are recorded per-video; one failed upload does not abort the
 *     rest. A summary line is printed at the end.
 *
 * @param videos     - Processed video entries from `processVideos`.
 * @param uploadUrls - Presigned URLs from the backend, keyed by `fileName`.
 * @returns Per-video results: `{ fileName, success, error? }`.
 */
export async function uploadVideosToS3(videos: any[], uploadUrls: any[]): Promise<any[]> {
  const results: any[] = [];

  console.log(`📹 Uploading ${videos.length} video(s) to S3 (concurrency=${VIDEO_UPLOAD_CONCURRENCY})...`);
  if (videos.length && uploadUrls?.length) {
    // Create a map for quick lookup by S3 filename
    const urlMap = new Map(uploadUrls.map(u => [u.fileName, u.uploadUrl]));

    // Upload in bounded-concurrency batches so we never hold more than
    // VIDEO_UPLOAD_CONCURRENCY file streams open at once.
    let cursor = 0;
    const worker = async () => {
      while (cursor < videos.length) {
        const index = cursor++;
        const video = videos[index];
        const uploadUrl = urlMap.get(video.s3FileName);
        if (uploadUrl) {
          const success = await uploadVideoToS3(video.localPath, uploadUrl);
          results.push({ fileName: video.s3FileName, success });
        }
        else {
          console.log(`  ✖ No upload URL found for: ${video.s3FileName}`);
          results.push({ fileName: video.s3FileName, success: false, error: 'No upload URL' });
        }
      }
    };

    const workerCount = Math.min(VIDEO_UPLOAD_CONCURRENCY, videos.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    const successCount = results.filter(r => r.success).length;
    console.log(`✔ Uploaded ${successCount}/${results.length} video(s) to S3`);
  } else {
    console.log('  ℹ No videos or upload URLs provided');
  }

  return results;
}
