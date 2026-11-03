import { describe, expect, it } from 'vitest';
import { generateSpec, matchStep, parseFeature, slugify } from './generator.ts';

const SOURCE = `
# comment
Feature: Home page
Scenario: Visitor sees welcome
  Given I open "/"
  Then I should see heading "Welcome to Tailspin Toys"
  And I do a custom thing
`;

describe('parseFeature', () => {
  it('parses feature, scenario and steps', () => {
    const feature = parseFeature(SOURCE);
    expect(feature.name).toBe('Home page');
    expect(feature.scenarios[0].steps.map((s) => s.keyword)).toEqual(['Given', 'Then', 'And']);
  });

  it('rejects steps before a scenario', () => {
    expect(() => parseFeature('Feature: X\nGiven I open "/"')).toThrow(/before any Scenario/);
  });

  it('requires a feature name and scenario', () => {
    expect(() => parseFeature('Scenario: A\nGiven I open "/"')).toThrow(/Feature/);
    expect(() => parseFeature('Feature: X')).toThrow(/Scenario/);
  });
});

describe('matchStep', () => {
  it('maps known steps to step method calls', () => {
    expect(matchStep('I open "/game/1"')).toBe('openPage(page, "/game/1")');
    expect(matchStep('I fill "Name" with "Ada"')).toBe('fillField(page, "Name", "Ada")');
  });

  it('returns undefined for unknown steps', () => {
    expect(matchStep('I dance')).toBeUndefined();
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

  it('is deterministic', () => {
    expect(generateSpec(parseFeature(SOURCE))).toBe(generateSpec(parseFeature(SOURCE)));
  });
});

describe('slugify', () => {
  it('creates dash-separated slugs', () => {
    expect(slugify('Home page!')).toBe('home-page');
  });
});
