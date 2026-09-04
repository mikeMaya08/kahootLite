const AMIKOO_PLAYWRIGHT_PACKAGE = '@muuktest/amikoo-playwright/reporter';
const CONTROLHUB_PACKAGE = '@muuktest/amikoo-reporter';

export function checkReporterOrder(config: any): void {
  const reporters = config?.reporter;
  if (!Array.isArray(reporters)) return;

  const describe = (r: any): string => {
    if (typeof r === 'string') return r;
    if (Array.isArray(r) && typeof r[0] === 'string') return r[0];
    return '';
  };

  const amikooIdx = reporters.findIndex((r: any) => describe(r).includes(AMIKOO_PLAYWRIGHT_PACKAGE));
  const controlhubIdx = reporters.findIndex((r: any) => describe(r).includes(CONTROLHUB_PACKAGE));

  if (amikooIdx >= 0 && controlhubIdx >= 0 && amikooIdx > controlhubIdx) {
    const bar = '==============================================================';
    console.warn(bar);
    console.warn('  AMIKOO REPORTER ORDER WARNING');
    console.warn(`  ${CONTROLHUB_PACKAGE} is listed before`);
    console.warn(`  ${AMIKOO_PLAYWRIGHT_PACKAGE} in playwright.config.`);
    console.warn(`  Reorder so ${AMIKOO_PLAYWRIGHT_PACKAGE} runs first,`);
    console.warn('  otherwise its per-test enrichment may not be finalized in time.');
    console.warn(bar);
  }
}
