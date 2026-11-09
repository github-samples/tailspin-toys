import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface ApiResult {
  status(): number;
  json(): Promise<unknown>;
  text(): Promise<string>;
  headers(): Record<string, string>;
}

export interface RequestOptions {
  pathParams?: Record<string, string | number>;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
}

export function buildPath(template: string, pathParams: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(String(pathParams[name] ?? `{${name}}`)));
}

/** Single place where every HTTP call (generated client + generic steps) is made. */
export async function sendRequest(
  request: APIRequestContext,
  method: string,
  pathTemplate: string,
  opts: RequestOptions = {},
): Promise<APIResponse> {
  const params = Object.fromEntries(
    Object.entries(opts.query ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  );
  return request.fetch(buildPath(pathTemplate, opts.pathParams), {
    method,
    params,
    headers: opts.headers,
    data: opts.body,
  });
}
