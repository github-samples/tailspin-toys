import { expect, type APIResponse, type APIRequestContext } from '@playwright/test';
import { test as base } from 'playwright-bdd';
import { sendRequest, type RequestOptions } from '../src/support/http';
import { findOperation, validateResponse } from '../src/support/schema';
import type { Operation } from '../src/generator/parser';

/** Per-scenario state shared by the generic steps. */
export class ApiWorld {
  readonly options: RequestOptions = { pathParams: {}, query: {}, headers: {} };
  response?: APIResponse;
  json?: unknown;
  operation?: Operation;
  readonly saved = new Map<string, unknown>();

  constructor(readonly request: APIRequestContext) {}

  async send(method: string, pathTemplate: string): Promise<void> {
    this.operation = findOperation(method, pathTemplate);
    this.response = await sendRequest(this.request, method, pathTemplate, this.options);
    this.json = await this.response.json().catch(() => undefined);
  }

  /** Reads "a.b[0].c" style paths from the last JSON response. */
  property(path: string): unknown {
    return path
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(Boolean)
      .reduce<any>((acc, key) => acc?.[key], this.json);
  }
}

export const test = base.extend<{ api: ApiWorld }>({
  api: async ({ request }, use) => {
    await use(new ApiWorld(request));
  },
});

export { expect, validateResponse };
