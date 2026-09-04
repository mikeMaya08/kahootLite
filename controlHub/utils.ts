import https from 'https';
import path from 'path';
import fs from 'fs';
import { TestStep } from '@playwright/test/reporter';
import { api } from './apiUtils';

// Module-level constant for ANSI escape code regex (avoids recompilation on each call)
const ANSI_REGEX = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;


// getExecutionNumber
// Fetches the execution number and organization ID from the API
// Parameters:
//   accessToken: string - The access token for API authentication
// Returns: Promise<{ executionNumber: number; organizationId: string } | null>
export async function getExecutionNumber(accessToken: string): Promise<{ executionNumber: number; organizationId: string } | null> {
  let result: { executionNumber: number; organizationId: string } | null = null;
  
  const response = await api.get('/execution/execution_number', accessToken);
  if (response.success && response.data) {
    console.log(`✔ Retrieved execution number: ${response.data.executionNumber}`);
    result = {
      executionNumber: response.data.executionNumber,
      organizationId: response.data.organizationId
    };
  }
  else {
    console.error('\n✖ Failed to retrieve execution number');
    console.error(`  ${response.error}`);
    console.error('  Could not communicate with Amikoo backend.');
    console.error('  Test execution data will not be reported.\n');
  }
  
  return result;
}


// getTestsInfo
// Fetches test information from API based on suite files
// Parameters:
//   suite: any - Playwright suite object
//   accessToken: string - The access token for API authentication
// Returns: Promise<any[]> - Array of test objects from API
export async function getTestsInfo(suite: any, accessToken: string): Promise<any[]> {
  let result: any[] = [];
  
  const testData = await buildTestData(suite);
  const response = await api.post('/tests/get_by_file_and_name', accessToken, { testData });
  if (response.success && response.data) {
    result = response.data;
  }

  console.log(`✔ Found ${response?.data?.length || 0} matching tests in Amikoo`);
  
  return result;
}


// buildTestData
// Builds an array of test data objects from Playwright suite for API lookup
// Parameters:
//   suite: any - Playwright suite object containing allTests()
// Returns: Promise<Array<{ file: string; name: string }>> - Array of test data with file and name
export async function buildTestData(suite: any): Promise<Array<{ file: string; name: string }>> {
  const testData: Array<{ file: string; name: string }> = [];
  
  for (const test of suite.allTests()) {
    const file = path.basename(test.location.file);
    const name = await getSuiteNames(test);
    testData.push({ file, name });
  }
  
  return testData;
}


// Determines whether a Playwright TestCase belongs to a "setup" project — one whose name appears
// in another project's `dependencies` array. Walks up the suite chain until a suite exposes
// .project() (only the project root suite does). A null project resolution returns false so
// Playwright API drift degrades gracefully (treat as a normal test) rather than silently dropping
// real tests.
// Parameters:
//   test: any - Playwright TestCase
//   setupProjectNames: Set<string> - project names that other projects declare as dependencies
//   maxDepth: number - hard cap on suite-chain traversal (matches findDeepestFailedStep's guard)
// Returns: boolean - true iff the test's project is a setup project
export function isSetupTest(test: any, setupProjectNames: Set<string>, maxDepth = 20): boolean {
  let suite: any = test?.parent;
  let isSetup = false;
  let depth = 0;
  while (suite && depth < maxDepth) {
    if (typeof suite.project === 'function') {
      const project = suite.project();
      if (project?.name && setupProjectNames.has(project.name)) {
        isSetup = true;
      }
      break;
    }
    suite = suite.parent;
    depth++;
  }
  return isSetup;
}

// Finds a test from the API results array matching file path and fullTitlePath
// Parameters:
//   tests: any[] - Array of test objects from API (paths already normalized by backend)
//   fullFilePath: string - The full test file path, already normalized with forward slashes
//   fullTitlePath: string - The full test title path (e.g., "Login > tests")
// Returns: object | undefined - The matching test object with hash, filePath, branch, fullTitlePath
export function findTest(
  tests: any[],
  fullFilePath: string,
  fullTitlePath: string
): any | undefined {
  let result: any | undefined = undefined;
  
  if (tests && tests.length > 0) {
    // Find the test where both fullTitlePath matches and execution file path ends with API's filePath
    result = tests.find(test => 
      test.fullTitlePath === fullTitlePath && fullFilePath.endsWith(test.filePath)
    );
  }
  
  return result;
}


// getSuiteNames
// Builds the full test title path by traversing parent suites
// Parameters:
//   test: any - Playwright test object with parent references
// Returns: string - Full title path joined by ' > ' (e.g., "Suite > Nested > Test Name")
export async function getSuiteNames(test: any): Promise<string> {
  const suites: string[] = [];
  let parent = test.parent;

  while (parent) {
    if (parent._type === 'describe' && parent.title) suites.unshift(parent.title);
    parent = parent.parent;
  }

  return [...suites, test.title].join(' > ');
}


// checkForUpdates
// Checks npm registry for newer versions of @muuktest/amikoo-reporter and logs update notice
// Compares major and minor version numbers only (ignores patch versions)
// Parameters: none
// Returns: Promise<void> - resolves silently regardless of success/failure
export function checkForUpdates(): Promise<void> {
  const pkgPath = path.resolve(__dirname, '..', 'package.json');
  const currentVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;

  return new Promise((resolve) => {
    try {
      const [curMajor, curMinor] = currentVersion.split('.').map(Number);

      const req = https.get('https://registry.npmjs.org/@muuktest%2famikoo-reporter/latest', { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try {
            const latest = JSON.parse(data).version;
            if (!latest) { resolve(); return; }
            const [latMajor, latMinor] = latest.split('.').map(Number);

            if (latMajor > curMajor || (latMajor === curMajor && latMinor > curMinor)) {
              console.log(`\n  A new version of @muuktest/amikoo-reporter is available: ${currentVersion} → ${latest}`);
              console.log(`  Run "npm install @muuktest/amikoo-reporter@latest" to update.\n`);
            }
          } catch { /* ignore parse errors */ }
          resolve();
        });
      });
      req.on('error', () => resolve());
      req.on('timeout', () => { req.destroy(); resolve(); });
    } catch {
      resolve();
    }
  });
}

// stripAnsi
// Removes ANSI escape codes (colors, formatting) from a string
// Parameters:
//   str: string | undefined - Input string that may contain ANSI codes
// Returns: string - Clean string without ANSI escape sequences
export function stripAnsi(str: string | undefined): string {
    return str?.replace(ANSI_REGEX, '') || '';
}

// extractErrorDetails
// Extracts and formats error details from a test result, including the deepest failed step
// Parameters:
//   result: any - Playwright test result object containing error and steps
// Returns: object | null - Error details with message and failed step info, or null if no error
export function extractErrorDetails(result: any) {
  const error = result.error;
  if (!error) return null;

  const failedStep = findDeepestFailedStep(result.steps ?? []);

  return {
    message: stripAnsi(error.message),
    failedStep: failedStep ? {
      title: failedStep.title,
      location: failedStep.location,
      error: stripAnsi(failedStep.error?.message),
      stack: stripAnsi(failedStep.error?.stack),
    } : null,
  };
}

// findDeepestFailedStep
// Traverses step hierarchy using BFS to find the deepest step that has an error
// Parameters:
//   steps: TestStep[] - Array of top-level test steps to search
//   maxDepth: number - Maximum depth to traverse (default: 20, prevents infinite loops)
// Returns: TestStep | null - The deepest step with an error, or null if none found
function findDeepestFailedStep(steps: TestStep[], maxDepth = 20): TestStep | null {
  const queue: Array<{ step: TestStep; depth: number }> = steps.map(step => ({ step, depth: 0 }));
  let failedStep: TestStep | null = null;

  while (queue.length > 0) {
    const { step, depth } = queue.shift()!;

    if (depth > maxDepth) break;

    if (step.error) {
      failedStep = step;
    }
    if (step.steps?.length) {
      queue.unshift(...step.steps.map(s => ({ step: s, depth: depth + 1 })));
    }
  }

  return failedStep;
}