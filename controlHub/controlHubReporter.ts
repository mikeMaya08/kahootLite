import { Reporter } from '@playwright/test/reporter';
import { getGitContext } from './gitUtils';
import { api } from './apiUtils';
import { getVideoPath, processVideos, uploadVideosToS3 } from './videoUtils';
import { isSetupTest, getSuiteNames, checkForUpdates, extractErrorDetails, getExecutionNumber, getTestsInfo, findTest } from './utils';
import { uploadAmikooArtifacts, AmikooArtifact, collectAmikooArtifacts, detectAmikooKeySource } from './amikooArtifacts';
import { checkReporterOrder } from './reporterOrder';
import { maybeReportCanaryStarted } from './auditCanary';
import path from 'path';
import crypto from 'crypto';

class MyReporter implements Reporter {

  testExecutionData: any[] = [];
  videos: any[] = [];
  amikooFiles: AmikooArtifact[] = [];
  authInfo: any;
  organizationId: string = '';
  executionNumber: number = 0;
  hashIds: any[] = [];
  startExecutionTime: number = 0;
  browser: String = 'chromeTest';
  compilationError: boolean = false;
  filesWithCompilationError: any[] = [];
  // Set by onTestBegin. Discriminates a load-phase failure (a real compilation error) from every
  // other thing Playwright routes through onError — see the comment there.
  anyTestStarted: boolean = false;
  url: any;
  testEndPromises: any[] = [];

  private repositoryId!: string;
  private branch!: string;
  private repositoryName!: string;
  private access_token!: string;
  private owner!: string;
  private key!: string;
  private testsInfo: any[] = [];
  // Project names that appear as another project's `dependencies` entry — i.e. Playwright setup
  // projects (auth bootstrap, storage-state minting, etc.). Populated once in onBegin from the
  // FullConfig, consulted in onTestEnd to short-circuit feedback for these tests.
  private setupProjectNames = new Set<string>();
  private initPromise: Promise<void> | null = null;

  async onBegin(config: any, suite: any) {
    checkReporterOrder(config);

    // Setup projects are declared by having their name listed in another project's `dependencies`.
    // That is the only reliable, config-driven signal Playwright gives us; the `setup(...)` symbol
    // is just `test` re-exported, so it does not survive to the reporter.
    for (const project of (config?.projects ?? [])) {
      for (const dep of (project?.dependencies ?? [])) {
        this.setupProjectNames.add(dep);
      }
    }

    // Store initialization work as a single promise that onTestEnd will await
    this.initPromise = (async () => {
      try {
        // We need to obtain a token from control hub so we can send API requests. 
        this.key = process.env.AMIKOO_KEY || '';
        const tokenResponse = await api.post('/validate_key', '', {"key": this.key});
        if(tokenResponse.success && tokenResponse.data){
          this.access_token = tokenResponse.data.access_token;
        }

        const context = await getGitContext(this.access_token);
        this.repositoryId = context.repositoryId;
        this.repositoryName = context.repositoryName;
        this.branch = context.branch;
        this.owner = context.owner;

        if (!this.access_token) {
          const keySource = detectAmikooKeySource(this.key);
          console.warn('\n⚠ Warning: Failed to obtain access token');
          if(keySource) {
            console.warn(`  We tried to get AMIKOO_KEY from (best effort): ${keySource}`);
          }
          if (this.key) {
            console.warn('  AMIKOO_KEY is set but failed to obtain access token. Verify the key is correct.');
          }
          else {
            console.warn('  AMIKOO_KEY is not set (or still has default value). Set it in .env.amikoo file or .env file and retry.');
          }
          console.warn('  Feedback data will not be sent to amikoo-reporter, and execution data will not be saved.\n');
        }
        else{
          // Get execution number and test information in parallel
          const [executionData, testsInfo] = await Promise.all([
            getExecutionNumber(this.access_token),
            getTestsInfo(suite, this.access_token)
          ]);

          if (executionData && testsInfo) {
            this.executionNumber = executionData.executionNumber;
            this.organizationId = executionData.organizationId;
            this.testsInfo = testsInfo;
          }

          console.log(`\n🚀 Starting test run`);
          console.log(`   Repository: ${this.repositoryName}`);
          console.log(`   Branch: ${this.branch}\n`);
        }
      } catch (error) {
        console.error('\n✖ Error during reporter initialization:', error);
      }
    })();
  }

  async onTestBegin(test: any) {
    this.anyTestStarted = true;
    console.log(`  ▶ Starting execution of test : ${test.title}`);
  }

  // Early "it runs" signal for the Auditor's canary — see auditCanary.ts. Best-effort, non-blocking.
  onStepEnd(_test: any, _result: any, step: any) {
    maybeReportCanaryStarted(step);
  }

  // Playwright calls onError for ANY error not attributable to a single test — its own docs say
  // "some global error, for example unhandled exception in the worker process". There are five
  // producers in playwright/lib and only one of them is a compilation error:
  //
  //   runner/taskRunner.js  task setup threw     <- load/transpile failures. THIS one.
  //   runner/taskRunner.js  globalTimeout exceeded
  //   runner/dispatcher.js  worker teardownErrors
  //   runner/dispatcher.js  worker crashed mid-run
  //   runner/dispatcher.js  "Testing stopped early after N maximum allowed failures."
  //
  // Labelling all five "Compilation error" was actively harmful, not just untidy. The last one is
  // emitted from _reportTestEnd AFTER a test has run and failed, and the Executor passes
  // --max-failures 1 on every run, so it fired on 100% of failing tests. The Executor then grepped
  // its own stdout for "Compilation error", concluded no test had run, reported a setup failure and
  // triggered an Auditor run that blocked the whole organization. (2026-08-19.)
  //
  // A compilation error is a load-phase failure, so it cannot arrive once a test has begun — every
  // non-compilation producer above fires during or after execution. That ordering is the signal.
  async onError(error: any){
    const message = error?.message?.replace(/^(.*: )+/, '').trim();
    if(this.anyTestStarted){
      console.error(`\n⚠ Run notice: ${message}`);
      return;
    }
    this.compilationError = true;
    console.error(`\n✖ Compilation error: ${message}`);
    if(error?.location?.file){
      console.error(`  File: ${error.location.file}\n`);
      this.filesWithCompilationError.push({
        "file": error.location.file,
        "message": message,
      });
    }
  }

  async onTestEnd(test: any, result: any) {
    // Wait for onBegin to complete before processing test results
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (error) {
        console.error('  ✖ Error waiting for initialization:', error);
      }
    }

    const statusIcon = result.status === 'passed' ? '✔' : '✖';
    const statusText = result.status === 'passed' ? 'Passed' : 'Failed';
    console.log(`  ${statusIcon} Finished: ${test.title} (${statusText})`);

    // Setup projects (auth bootstrap etc.) exist to satisfy another project's `dependencies`; their
    // results carry no product-test signal and their titles/paths collide with real test rows on
    // the backend's unique index. Skip feedback — the test still runs and gates the dependents.
    if (isSetupTest(test, this.setupProjectNames)) {
      console.log(`  ↳ Skipping feedback for setup test "${test.title}" (project not user-facing)`);
      return;
    }

    const promise = (async () => {
      try {
      // Normalize paths once for cross-platform compatibility (Windows backslashes → forward slashes)
      const normalizedFullPath = test.location.file.replace(/\\/g, '/');
      const normalizedRelativePath = path.relative(process.cwd(), test.location.file).replace(/\\/g, '/');
      
      // Get clean title path without project name and empty strings
      const filePath = path.basename(test.location.file);      

      // Get the full test title including parent suites
      const fullTitle = await getSuiteNames(test);

      // Look up the test from API results by file path and title
      const matchedTest = findTest(this.testsInfo, normalizedFullPath, fullTitle);
      // Use matched test filePath, or fall back to repo-relative path to avoid leaking absolute paths
      const fileLocation = matchedTest ? matchedTest.filePath : normalizedRelativePath;

      // Create a unique hash ID for the test using repository ID, file path, full title, and commit SHA
      const rawIdentity = `${this.owner}/${this.repositoryId}:${fileLocation}:${fullTitle}`;  
      const testId = crypto.createHash('sha256').update(rawIdentity).digest('hex');

      // Get the error message if the test failed
      let errorData = {};
      try {
        errorData = extractErrorDetails(result) || {};
      } catch {
        // Silently ignore errors extracting error details - don't fail the reporter
      }

      const duration = parseInt(result.duration) / 1000;
      const payload = {
        hashId: testId,
        hashObject: {
          owner: this.owner,
          repositoryId: this.repositoryId,
          fileLocation: fileLocation,
          fullTitle: fullTitle,
        },
        name: test.title,
        filePath,
        fullTitle,
        duration: duration,
        executionAt: new Date().toISOString(),
        result: result.status === "passed" ? true : false,
        error: errorData
      };

      this.testExecutionData.push(payload);

      // Collect video for later batch processing
      const videoPath = getVideoPath(result);
      if (videoPath) {
        this.videos.push({ path: videoPath, testId });
      }

      this.amikooFiles.push(...collectAmikooArtifacts(result, testId, fullTitle, test.location.file));
      } catch (error) {
        console.error(`  ✖ Error processing test "${test.title}":`, error);
      }
    })();

    // save the promise so the onEnd can wait for this code to complete. 
    this.testEndPromises.push(promise);
  }

  async onEnd(result: any) {
    console.log('\n⏳ Waiting for all tests to complete...');
    try {
      const pending: Promise<unknown>[] = [...this.testEndPromises];
      if (this.initPromise) pending.push(this.initPromise);
      await Promise.all(pending);
    } catch (error) {
      console.error('✖ Error waiting for test promises:', error);
    }
    console.log('✔ All tests completed\n');

    // Release references to large per-test data structures we no longer need
    this.testEndPromises = [];
    this.testsInfo = [];

    if(this.executionNumber){
      // Process videos and get presigned URLs
      const videoResult = await processVideos(this.videos, this.organizationId, this.executionNumber, this.access_token);

      // Upload videos to S3
      if (videoResult?.uploadUrls) {
        await uploadVideosToS3(videoResult.videos, videoResult.uploadUrls);
      }

      const feedbackData = {
        repositoryId: this.repositoryId,
        branch: this.branch,
        tests: this.testExecutionData,
        executionNumber: this.executionNumber,
        videos: videoResult?.videos.map(v => v.s3FileName) || [], // Include video file names in feedback
        ...(process.env.RUN_ID ? { runId: process.env.RUN_ID } : {}),
      };

      // Send API to BE here
      const feedbackResponse = await api.post('/execution/feedback', this.access_token, feedbackData);
      if (feedbackResponse.success) {
        console.log('✔ Execution report sent successfully\n');
        
        // Check for warnings about tests not found
        const responseData = feedbackResponse.data as any;
        if (responseData?.testsNotFound?.length) {
          console.warn(`⚠ ${responseData.warnings || 'Some tests were not found'}`);
          responseData.testsNotFound.forEach((test: any) => {
            console.warn(`  • ${test.testName}`);
          });
          console.warn('  Please sync your repository to register these tests.\n');
        }
      } else {
        const errorData = feedbackResponse.error as any;
        const errorMsg = !errorData
          ? 'Unknown error'
          : typeof errorData === 'string'
            ? errorData
            : errorData.message || JSON.stringify(errorData);
        console.error(`\n✖ Failed to send execution report\n`);
        console.error(`  ${errorMsg}\n`);

        if (errorData.activeRepositories?.length) {
          console.error(`  Available repositories:`);
          errorData.activeRepositories.forEach((repo: any) => {
            console.error(`    • ${repo.name} (${repo.id})`);
          });
          console.error('');
        }
        
        if (errorData.activeBranches?.length) {
          console.error(`  Available branches:`);
          errorData.activeBranches.forEach((branch: string) => {
            console.error(`    • ${branch}`);
          });
          console.error('');
        }
      }
    }
    else{
      console.warn('\n⚠ Execution number not available');
      console.warn('  Execution report will not be sent to amikoo-reporter.');
      console.warn('  Execution data will not be saved.\n');
    }

    if (this.access_token && this.amikooFiles.length) {
      await uploadAmikooArtifacts(this.amikooFiles, {
        token: this.access_token,
        amikooKey: this.key,
        repoRoot: process.cwd(),
      });
    }

    checkForUpdates();
  }

}
export default MyReporter;
