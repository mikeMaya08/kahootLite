import { getControlHubUrl } from './apiUtils';

// Read once at module load rather than per step: onStepEnd fires for every step of every test, and
// on normal user runs AMIKOO_AUDIT_CANARY is never set, so this gate is all they ever pay.
// Safe at module scope because apiUtils calls dotenv.config() on import, above.
const IS_CANARY = process.env.AMIKOO_AUDIT_CANARY === '1';

let startedPinged = false;

/**
 * Early "it runs" signal for the Auditor's canary ONLY.
 *
 * The executor tags a canary with AMIKOO_AUDIT_CANARY=1; user runs never carry it, so they never
 * ping. We fire once, when the first Playwright API step (category 'pw:api') COMPLETES without
 * error. That first step is "Launch browser", so a clean completion proves install + config compile
 * + webServer + globalSetup + browser launch have all passed and the run is genuinely executing —
 * letting the Auditor unblock immediately instead of waiting the full 2-3 min for the (irrelevant)
 * rest of the test.
 *
 * Must be onStepEnd, not onStepBegin: "Launch browser" is itself the first pw:api step, so firing
 * on its *begin* reports success before the browser has launched — a repo whose browser cannot
 * start would be audited as healthy, the exact failure this check exists to catch. Waiting for the
 * step to end costs only the launch duration (well under a second) and makes the signal true.
 * onTestBegin would be even worse — it fires before the browser launches at all, proving nothing
 * more than `--list` already did.
 *
 * Best-effort and fully non-blocking: a failed ping only costs the Auditor its shortcut, never the
 * run. It falls back to waiting for the execution to finish normally.
 */
export function maybeReportCanaryStarted(step: any): void {
  if (!IS_CANARY) return;
  if (startedPinged) return;
  if (step?.category !== 'pw:api') return;
  if (step?.error) return; // the step failed — proves nothing, stay quiet and let the audit wait
  startedPinged = true;
  // Fire-and-forget: never await in the step hook, never let a failure touch the test.
  void pingCanaryStarted();
}

async function pingCanaryStarted(): Promise<void> {
  const runId = process.env.RUN_ID;
  const key = process.env.AMIKOO_KEY;
  if (!runId || !key) return; // outside the executor (no run to mark) — nothing to do
  try {
    const response = await fetch(`${getControlHubUrl()}/execution/started`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-amikoo-key': key },
      body: JSON.stringify({ runId }),
      signal: AbortSignal.timeout(5000),
    });
    // Rejections are ignored by design — logged only so that a ping which never lands (route not
    // deployed, key rejected) is visible instead of looking like success.
    if (!response.ok) {
      console.error(`  ⚠ Canary started ping rejected: ${response.status} ${response.statusText} (continuing)`);
      return;
    }
    console.log('  ⚡ Canary browser started — reported to amikoo (audit can unblock now)');
  } catch (error) {
    console.error('  ⚠ Failed to report canary started (continuing):', error instanceof Error ? error.message : error);
  }
}
