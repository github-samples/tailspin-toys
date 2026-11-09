import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

export type Schema = {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: unknown[];
  example?: unknown;
  default?: unknown;
  format?: string;
  [key: string]: unknown;
};

export interface Param {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  schema: Schema;
}

export interface Operation {
  key: string; // e.g. "GET /posts/{id}"
  method: string;
  path: string;
  operationId: string;
  summary: string;
  tag: string;
  params: Param[];
  requestSchema?: Schema;
  responses: Record<string, Schema | undefined>;
  successStatus: string;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export function loadSpec(file: string): Record<string, any> {
  const text = readFileSync(file, 'utf8');
  return file.endsWith('.json') ? JSON.parse(text) : parseYaml(text);
}

/** Recursively resolves local $ref pointers (cycle-safe). */
export function deref(node: any, root: any, seen: string[] = []): any {
  if (Array.isArray(node)) return node.map((n) => deref(n, root, seen));
  if (node && typeof node === 'object') {
    if (typeof node.$ref === 'string') {
      if (seen.includes(node.$ref)) return {};
      const target = node.$ref
        .replace(/^#\//, '')
        .split('/')
        .reduce((acc: any, part: string) => acc?.[part], root);
      return deref(target, root, [...seen, node.$ref]);
    }
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, deref(v, root, seen)]));
  }
  return node;
}

export function parseOperations(spec: Record<string, any>): Operation[] {
  const ops: Operation[] = [];
  for (const [path, rawItem] of Object.entries<any>(spec.paths ?? {})) {
    const item = deref(rawItem, spec);
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      const params: Param[] = [...(item.parameters ?? []), ...(op.parameters ?? [])].map((p: any) => ({
        name: p.name,
        in: p.in,
        required: Boolean(p.required) || p.in === 'path',
        schema: p.schema ?? { type: 'string' },
      }));
      const responses: Record<string, Schema | undefined> = {};
      for (const [status, r] of Object.entries<any>(op.responses ?? {})) {
        responses[status] = r.content?.['application/json']?.schema;
      }
      const successStatus = Object.keys(responses).find((s) => s.startsWith('2')) ?? '200';
      ops.push({
        key: `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        operationId: op.operationId ?? `${method}${path.replace(/\W+/g, '_')}`,
        summary: op.summary ?? op.operationId ?? `${method} ${path}`,
        tag: op.tags?.[0] ?? 'default',
        params,
        requestSchema: op.requestBody?.content?.['application/json']?.schema,
        responses,
        successStatus,
      });
    }
  }
  return ops;
}

/** Builds a deterministic sample value from a schema. */
export function sampleValue(schema: Schema | undefined): unknown {
  if (!schema) return 'string';
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  switch (schema.type) {
    case 'integer':
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'array':
      return [sampleValue(schema.items)];
    case 'object':
      return Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([k, v]) => [k, sampleValue(v)]),
      );
    default:
      return 'string';
  }
}

/** Renders a schema as a TypeScript type expression. */
export function schemaToTs(schema: Schema | undefined): string {
  if (!schema) return 'unknown';
  switch (schema.type) {
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'string':
      return 'string';
    case 'array':
      return `Array<${schemaToTs(schema.items)}>`;
    case 'object': {
      const req = new Set(schema.required ?? []);
      const fields = Object.entries(schema.properties ?? {}).map(
        ([k, v]) => `${JSON.stringify(k)}${req.has(k) ? '' : '?'}: ${schemaToTs(v)}`,
      );
      return `{ ${fields.join('; ')} }`;
    }
    default:
      return 'unknown';
  }
}
