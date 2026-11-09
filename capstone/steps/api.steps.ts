import { createBdd } from 'playwright-bdd';
import { expect, test, validateResponse } from './fixtures';

const { Given, When, Then } = createBdd(test);

/** Cucumber strings arrive as text; coerce "42", "true", "null" or JSON to real values. */
function coerce(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// ---- Given: build the request -------------------------------------------------

Given('I set path parameter {string} to {string}', async ({ api }, name: string, value: string) => {
  api.options.pathParams![name] = value;
});

Given('I set query parameter {string} to {string}', async ({ api }, name: string, value: string) => {
  api.options.query![name] = value;
});

Given('I set header {string} to {string}', async ({ api }, name: string, value: string) => {
  api.options.headers![name] = value;
});

Given('I set the request body to:', async ({ api }, docString: string) => {
  api.options.body = JSON.parse(docString);
});

Given('I set request body property {string} to {string}', async ({ api }, path: string, value: string) => {
  const body = (api.options.body ??= {}) as Record<string, unknown>;
  body[path] = coerce(value);
});

// ---- When: send ---------------------------------------------------------------

When(/^I send an? (GET|POST|PUT|PATCH|DELETE) request to "([^"]+)"$/, async ({ api }, method: string, path: string) => {
  await api.send(method, path);
});

// ---- Then: assertions ---------------------------------------------------------

Then('the response status should be {int}', async ({ api }, status: number) => {
  expect(api.response!.status()).toBe(status);
});

Then('the response body should match the OpenAPI schema', async ({ api }) => {
  expect(api.operation, 'request must target an operation defined in the spec').toBeDefined();
  const errors = validateResponse(api.operation!, api.response!.status(), api.json);
  expect(errors, errors.join('\n')).toEqual([]);
});

Then('the response JSON property {string} should exist', async ({ api }, path: string) => {
  expect(api.property(path)).not.toBeUndefined();
});

Then('the response JSON property {string} should equal {string}', async ({ api }, path: string, expected: string) => {
  expect(api.property(path)).toEqual(coerce(expected));
});

Then('the response JSON property {string} should contain {string}', async ({ api }, path: string, expected: string) => {
  expect(String(api.property(path))).toContain(expected);
});

Then('the response JSON property {string} should be of type {string}', async ({ api }, path: string, type: string) => {
  const value = api.property(path);
  const actual = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  expect(actual).toBe(type);
});

Then('the response JSON array should not be empty', async ({ api }) => {
  expect(Array.isArray(api.json)).toBe(true);
  expect((api.json as unknown[]).length).toBeGreaterThan(0);
});

Then('the response JSON array should have {int} items', async ({ api }, count: number) => {
  expect(api.json).toHaveLength(count);
});

Then('the response header {string} should contain {string}', async ({ api }, name: string, expected: string) => {
  expect(api.response!.headers()[name.toLowerCase()] ?? '').toContain(expected);
});
