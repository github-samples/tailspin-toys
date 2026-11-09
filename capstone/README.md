# API BDD Capstone

Reads an **OpenAPI spec** (methods, paths, parameters, payload schemas, JSON properties) and generates:

- **Gherkin features** (`features/generated/*.feature`) — one scenario per operation using sample payloads from the schema
- **A typed Playwright client** (`src/generated/client.ts`) — one method per operation
- **Generic, reusable step definitions** (`steps/api.steps.ts`) that work for any API, including response validation against the spec's schema (Ajv)

Built with `playwright-bdd` + `@playwright/test` (`APIRequestContext`).

## Structure

| Path | Purpose |
| --- | --- |
| `specs/` | OpenAPI input (JSON or YAML) |
| `src/generator/parser.ts` | Spec parser: operations, params, schemas, `$ref` resolution, sample data |
| `src/generator/generate.ts` | Generates features + typed client |
| `src/support/` | HTTP helper and schema validator |
| `steps/` | Generic step definitions and Playwright fixture (`api` world) |
| `features/posts.feature` | Hand-written example scenarios |

## Usage

```bash
npm install
npx playwright install   # only needed for browsers; API tests don't need them
npm run generate         # regenerate features + client (optional: pass a spec path)
npm test                 # generate, bddgen, run Playwright
```

Config: `API_BASE_URL` (default `https://jsonplaceholder.typicode.com`), `SPEC_FILE` (default `specs/jsonplaceholder.openapi.json`).
To use another API, point `SPEC_FILE` to its spec, run `npm run generate`, and set `API_BASE_URL`.

## Generic steps

```gherkin
Given I set path parameter "id" to "1"
And I set query parameter "userId" to "1"
And I set header "Authorization" to "Bearer x"
And I set the request body to:  (JSON docstring)
And I set request body property "title" to "hi"
When I send a PUT request to "/posts/{id}"
Then the response status should be 200
And the response body should match the OpenAPI schema
And the response JSON property "address.city" should exist
And the response JSON property "[0].userId" should equal "1"
And the response JSON property "id" should be of type "number"
And the response JSON array should not be empty
```

## Ideas for extension

Auth/token steps, saving response values for chaining, negative scenarios from `required` fields, CI workflow.
