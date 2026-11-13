import { expect, type Page } from '@playwright/test';

// Demo step methods for the payroll example. The payroll app is simulated with in-page
// HTML so the example runs anywhere; swap the bodies for real locators against your app.

type Table = Record<string, string>[];
type Rows = Record<number, Record<string, string>>;

// Excel edits made by the scenario, kept per page so scenarios stay isolated.
const uploadedRows = new WeakMap<Page, Rows>();

const PAGES: Record<string, string> = {
  payroll: `<h1 data-testid="payroll-title">Payroll</h1>
    <a href="#manage" data-testid="manage-link">Manage</a>`,
  manage: `<h1 data-testid="manage-title">Payroll Manage - File Upload</h1>
    <button data-testid="upload-button">Upload</button>`,
};

export async function navigateToPayroll(page: Page): Promise<void> {
  await page.setContent(PAGES.payroll);
  await expect(page.getByTestId('payroll-title')).toHaveText('Payroll');
}

export async function navigateToPayrollManagePage(page: Page): Promise<void> {
  await page.getByTestId('manage-link').click();
  await page.setContent(PAGES.manage);
  await expect(page.getByTestId('manage-title')).toContainText('File Upload');
}

export async function editCombinedExcelFile(page: Page, table: Table): Promise<void> {
  const rows: Rows = {};
  for (const { Row, Field, Value } of table) {
    (rows[Number(Row)] ??= {})[Field] = Value;
  }
  uploadedRows.set(page, rows);
}

/** Demo rule: rows sharing HIRE DATE and PAY DATE are duplicates (1 error per group, 1 warning per row). */
function countIssues(rows: Rows): { warnings: number; errors: number } {
  const groups = new Map<string, number>();
  for (const row of Object.values(rows)) {
    const key = `${row['HIRE DATE']}|${row['PAY DATE']}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const duplicates = [...groups.values()].filter((n) => n > 1);
  return { warnings: duplicates.reduce((a, b) => a + b, 0), errors: duplicates.length };
}

export async function executePayrollUpload(page: Page): Promise<void> {
  await page.getByTestId('upload-button').click();
  const { warnings, errors } = countIssues(uploadedRows.get(page) ?? {});
  await page.setContent(`<h1>ECR</h1>
    <span data-testid="warning-count">${warnings}</span>
    <span data-testid="error-count">${errors}</span>`);
}

export async function verifyErrorCount(page: Page, table: Table): Promise<void> {
  const [expected] = table;
  await expect(page.getByTestId('warning-count')).toHaveText(expected['Warning Count']);
  await expect(page.getByTestId('error-count')).toHaveText(expected['Error Count']);
}
