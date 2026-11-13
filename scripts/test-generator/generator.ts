export interface Step {
  keyword: string;
  text: string;
  /** Raw data table rows (first row is the header), if the step has one. */
  table?: string[][];
}

export interface Scenario {
  name: string;
  steps: Step[];
}

export interface Feature {
  name: string;
  scenarios: Scenario[];
}

export interface StepMatch {
  call: string;
  module: string;
}

interface StepPattern {
  regex: RegExp;
  method: string;
  module: string;
  /** Quoted values captured from the step text become method arguments. */
  takesTable?: boolean;
}

const q = (value: string): string => JSON.stringify(value);

// Each pattern maps a plain-English step to a method in e2e-tests/steps/<module>.ts.
const STEP_PATTERNS: StepPattern[] = [
  { regex: /^I open "([^"]*)"$/i, method: 'openPage', module: 'common-steps' },
  { regex: /^I click "([^"]*)"$/i, method: 'clickByName', module: 'common-steps' },
  { regex: /^I fill "([^"]*)" with "([^"]*)"$/i, method: 'fillField', module: 'common-steps' },
  { regex: /^I should see text "([^"]*)"$/i, method: 'expectText', module: 'common-steps' },
  { regex: /^I should see heading "([^"]*)"$/i, method: 'expectHeading', module: 'common-steps' },
  { regex: /^I should be on "([^"]*)"$/i, method: 'expectPath', module: 'common-steps' },
  { regex: /^the page title should be "([^"]*)"$/i, method: 'expectTitle', module: 'common-steps' },

  // Payroll demo steps (e2e-tests/steps/payroll-steps.ts)
  { regex: /^Navigate to Payroll$/i, method: 'navigateToPayroll', module: 'payroll-steps' },
  {
    regex: /^Navigate to payroll manage page for file upload$/i,
    method: 'navigateToPayrollManagePage',
    module: 'payroll-steps',
  },
  {
    regex: /^Edit the Combined Excel file for Duplicate rows with the following details$/i,
    method: 'editCombinedExcelFile',
    module: 'payroll-steps',
    takesTable: true,
  },
  { regex: /^Payroll file is executed to upload$/i, method: 'executePayrollUpload', module: 'payroll-steps' },
  {
    regex: /^Verify The Error Count On Ecr Page$/i,
    method: 'verifyErrorCount',
    module: 'payroll-steps',
    takesTable: true,
  },
];

const STEP_KEYWORDS = ['Given', 'When', 'Then', 'And', 'But'];

/** Parses a plain-text, Gherkin-like test case (with optional `| a | b |` data tables) into a Feature. */
export function parseFeature(source: string): Feature {
  const feature: Feature = { name: '', scenarios: [] };
  let current: Scenario | undefined;

  source.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    if (line.startsWith('|')) {
      const lastStep = current?.steps[current.steps.length - 1];
      if (!lastStep) throw new Error(`Line ${index + 1}: data table found before any step`);
      const cells = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());
      (lastStep.table ??= []).push(cells);
      return;
    }

    const featureMatch = /^Feature:\s*(.+)$/i.exec(line);
    if (featureMatch) {
      feature.name = featureMatch[1].trim();
      return;
    }

    const scenarioMatch = /^Scenario:\s*(.+)$/i.exec(line);
    if (scenarioMatch) {
      current = { name: scenarioMatch[1].trim(), steps: [] };
      feature.scenarios.push(current);
      return;
    }

    const keyword = STEP_KEYWORDS.find((k) => line.toLowerCase().startsWith(`${k.toLowerCase()} `));
    if (!keyword) {
      throw new Error(`Line ${index + 1}: unrecognised line "${line}"`);
    }
    if (!current) {
      throw new Error(`Line ${index + 1}: step found before any Scenario`);
    }
    current.steps.push({ keyword, text: line.slice(keyword.length).trim() });
  });

  if (!feature.name) throw new Error('Missing "Feature:" line');
  if (feature.scenarios.length === 0) throw new Error('No "Scenario:" found');
  const empty = feature.scenarios.find((s) => s.steps.length === 0);
  if (empty) throw new Error(`Scenario "${empty.name}" has no steps`);
  return feature;
}

/** Converts a name into a lowercase, dash-separated file/identifier slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toCamelCase(text: string): string {
  const words = text.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const camel = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('');
  return /^[a-z]/.test(camel) ? camel : `step${camel}`;
}

/** Converts a raw table (header row + data rows) into a list of header-keyed records. */
export function tableToRecords(table: string[][]): Record<string, string>[] {
  const [header, ...rows] = table;
  return rows.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ''])));
}

/** Returns the call expression and module for a step, or undefined when no built-in step method matches. */
export function matchStep(text: string, table?: string[][]): StepMatch | undefined {
  for (const { regex, method, module, takesTable } of STEP_PATTERNS) {
    const match = regex.exec(text);
    if (!match) continue;
    const args = ['page', ...match.slice(1).map(q)];
    if (takesTable) {
      if (!table) return undefined;
      args.push(JSON.stringify(tableToRecords(table)));
    }
    return { call: `${method}(${args.join(', ')})`, module };
  }
  return undefined;
}

/** Generates a Playwright spec; unmatched steps become stub methods that fail until implemented. */
export function generateSpec(feature: Feature): string {
  const stubs = new Map<string, { text: string; hasTable: boolean }>();
  const imports = new Map<string, Set<string>>();

  const scenarioBlocks = feature.scenarios.map((scenario) => {
    const body = scenario.steps
      .map((step) => {
        const matched = matchStep(step.text, step.table);
        let call: string;
        if (matched) {
          call = matched.call;
          const names = imports.get(matched.module) ?? new Set<string>();
          names.add(call.slice(0, call.indexOf('(')));
          imports.set(matched.module, names);
        } else {
          let name = toCamelCase(step.text);
          while (stubs.has(name) && stubs.get(name)?.text !== step.text) name += '_';
          stubs.set(name, { text: step.text, hasTable: !!step.table });
          call = step.table
            ? `${name}(page, ${JSON.stringify(tableToRecords(step.table))})`
            : `${name}(page)`;
        }
        return `    await test.step(${q(`${step.keyword} ${step.text}`)}, async () => {\n      await ${call};\n    });`;
      })
      .join('\n');
    return `  test(${q(scenario.name)}, async ({ page }) => {\n${body}\n  });`;
  });

  const stubBlock = [...stubs]
    .map(([name, { text, hasTable }]) => {
      const params = hasTable ? '_page: Page, _table: Record<string, string>[]' : '_page: Page';
      return `// TODO: implement step ${q(text)}\nasync function ${name}(${params}): Promise<void> {\n  throw new Error(${q(`Step not implemented: ${text}`)});\n}`;
    })
    .join('\n\n');

  const header = '// Generated by `npm run test:generate`. Re-running overwrites this file.\n';
  const importLines = [
    `import { test${stubs.size ? ', type Page' : ''} } from '@playwright/test';`,
    ...[...imports]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([module, names]) => `import { ${[...names].sort().join(', ')} } from '../steps/${module}';`),
  ].join('\n');

  return `${header}${importLines}\n\n${stubBlock ? `${stubBlock}\n\n` : ''}test.describe(${q(feature.name)}, () => {\n${scenarioBlocks.join('\n\n')}\n});\n`;
}
