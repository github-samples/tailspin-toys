import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { resolve } from 'node:path';
import { deref, loadSpec, parseOperations, type Operation } from '../generator/parser';

const specFile = resolve(process.env.SPEC_FILE ?? 'specs/jsonplaceholder.openapi.json');
const spec = loadSpec(specFile);
const operations = parseOperations(spec);
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

export function findOperation(method: string, pathTemplate: string): Operation | undefined {
  return operations.find((o) => o.method === method.toUpperCase() && o.path === pathTemplate);
}

/** Validates a response body against the spec's schema for the given operation and status. */
export function validateResponse(op: Operation, status: number, body: unknown): string[] {
  const schema = op.responses[String(status)];
  if (!schema) return [`No JSON schema defined for ${op.key} -> ${status}`];
  const validate = ajv.compile(deref(schema, spec));
  return validate(body) ? [] : (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`);
}
