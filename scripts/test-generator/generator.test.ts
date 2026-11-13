import { describe, expect, it } from 'vitest';
import { generateSpec, matchStep, parseFeature, slugify, tableToRecords } from './generator.ts';

const SOURCE = `
# comment
Feature: Home page
Scenario: Visitor sees welcome
  Given I open "/"
  Then I should see heading "Welcome to Tailspin Toys"
  And I do a custom thing
`;

const TABLE_SOURCE = `
Feature: Payroll
Scenario: Duplicates
  Given Navigate to Payroll
  When Edit the Combined Excel file for Duplicate rows with the following details
    | Row | Field     | Value    |
    |   1 | HIRE DATE | 1/1/2025 |
  Then Verify The Error Count On Ecr Page
    | Warning Count | Error Count |
    |             2 |           1 |
  And I review this data
    | A |
    | 1 |
`;

describe('parseFeature', () => {
  it('parses feature, scenario and steps', () => {
    const feature = parseFeature(SOURCE);
    expect(feature.name).toBe('Home page');
    expect(feature.scenarios[0].steps.map((s) => s.keyword)).toEqual(['Given', 'Then', 'And']);
  });

  it('attaches data tables to the preceding step', () => {
    const steps = parseFeature(TABLE_SOURCE).scenarios[0].steps;
    expect(steps[0].table).toBeUndefined();
    expect(steps[1].table).toEqual([
      ['Row', 'Field', 'Value'],
      ['1', 'HIRE DATE', '1/1/2025'],
    ]);
  });

  it('rejects steps before a scenario', () => {
    expect(() => parseFeature('Feature: X\nGiven I open "/"')).toThrow(/before any Scenario/);
  });

  it('rejects tables without a step', () => {
    expect(() => parseFeature('Feature: X\nScenario: A\n| a |')).toThrow(/before any step/);
  });

  it('requires a feature name and scenario', () => {
    expect(() => parseFeature('Scenario: A\nGiven I open "/"')).toThrow(/Feature/);
    expect(() => parseFeature('Feature: X')).toThrow(/Scenario/);
  });
});

describe('matchStep', () => {
  it('maps known steps to step method calls', () => {
    expect(matchStep('I open "/game/1"')).toEqual({ call: 'openPage(page, "/game/1")', module: 'common-steps' });
    expect(matchStep('I fill "Name" with "Ada"')?.call).toBe('fillField(page, "Name", "Ada")');
  });

  it('passes data tables as records', () => {
    const match = matchStep('Verify The Error Count On Ecr Page', [
      ['Warning Count', 'Error Count'],
      ['2', '1'],
    ]);
    expect(match).toEqual({
      call: 'verifyErrorCount(page, [{"Warning Count":"2","Error Count":"1"}])',
      module: 'payroll-steps',
    });
  });

  it('returns undefined for unknown steps or a missing required table', () => {
    expect(matchStep('I dance')).toBeUndefined();
    expect(matchStep('Verify The Error Count On Ecr Page')).toBeUndefined();
  });
});

describe('tableToRecords', () => {
  it('keys rows by the header', () => {
    expect(tableToRecords([['a', 'b'], ['1', '2']])).toEqual([{ a: '1', b: '2' }]);
  });
});

describe('generateSpec', () => {
  it('wraps steps in test.step, imports used methods and stubs unknown steps', () => {
    const spec = generateSpec(parseFeature(SOURCE));
    expect(spec).toContain("import { expectHeading, openPage } from '../steps/common-steps';");
    expect(spec).toContain('test.step("Given I open \\"/\\""');
    expect(spec).toContain('async function iDoACustomThing(_page: Page)');
    expect(spec).toContain('await iDoACustomThing(page);');
  });

  it('imports from each step module and stubs unknown steps that have tables', () => {
    const spec = generateSpec(parseFeature(TABLE_SOURCE));
    expect(spec).toContain("import { editCombinedExcelFile, navigateToPayroll, verifyErrorCount } from '../steps/payroll-steps';");
    expect(spec).toContain('_table: Record<string, string>[]');
    expect(spec).toContain('await iReviewThisData(page, [{"A":"1"}]);');
  });

  it('is deterministic', () => {
    expect(generateSpec(parseFeature(SOURCE))).toBe(generateSpec(parseFeature(SOURCE)));
  });
});

describe('slugify', () => {
  it('creates dash-separated slugs', () => {
    expect(slugify('Home page!')).toBe('home-page');
  });
});
