import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { CanvasError, createCanvas, joinSession } from "@github/copilot-sdk/extension";
import { validateReadOnlyQuery } from "./query-policy.mjs";

const servers = new Map();
const MAX_DISPLAY_ROWS = 250;
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function databaseUrl() {
    return process.env.DATABASE_URL ?? `file:${join(PROJECT_ROOT, ".data", "tailspin.db")}`;
}

function readRequestBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.setEncoding("utf8");
        request.on("data", (chunk) => {
            body += chunk;
            if (body.length > 100_000) {
                reject(new Error("Request body is too large."));
                request.destroy();
            }
        });
        request.on("end", () => resolve(body));
        request.on("error", reject);
    });
}

function normalizeValue(value) {
    return typeof value === "bigint" ? value.toString() : value;
}

async function executeQuery(url, query) {
    const client = createClient({ url });
    try {
        const result = await client.execute(query);
        const columns = result.columns;
        const rows = result.rows.slice(0, MAX_DISPLAY_ROWS).map((row) =>
            Object.fromEntries(columns.map((column) => [column, normalizeValue(row[column])])),
        );
        return { columns, rows, truncated: result.rows.length > MAX_DISPLAY_ROWS };
    } finally {
        client.close();
    }
}

async function listTables(url) {
    return executeQuery(
        url,
        "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name",
    );
}

function renderHtml() {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Database Explorer</title>
    <style>
      :root {
        color-scheme: light dark;
        --canvas-surface: color-mix(in srgb, var(--background-color-default, #ffffff) 94%, var(--text-color-default, #1f2328) 6%);
        --canvas-surface-strong: color-mix(in srgb, var(--background-color-default, #ffffff) 88%, var(--text-color-default, #1f2328) 12%);
        --canvas-shadow: color-mix(in srgb, var(--text-color-default, #1f2328) 11%, transparent);
      }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--background-color-default, #ffffff); color: var(--text-color-default, #1f2328); font: var(--text-body-medium, 14px)/var(--leading-body-medium, 20px) var(--font-sans, system-ui, sans-serif); }
      main { max-width: 1180px; margin: 0 auto; padding: clamp(16px, 3vw, 32px); }
      .page-header { align-items: end; border-bottom: 1px solid var(--border-color-default, #d0d7de); display: flex; justify-content: space-between; margin-bottom: 24px; padding-bottom: 20px; }
      h1 { font-size: clamp(26px, 3vw, 36px); letter-spacing: -0.025em; line-height: 1.1; margin: 0; }
      .lede { color: var(--text-color-muted, #59636e); margin: 8px 0 0; max-width: 62ch; }
      .read-only { background: color-mix(in srgb, var(--true-color-blue-muted, #ddf4ff) 75%, transparent); border: 1px solid color-mix(in srgb, var(--true-color-blue, #0969da) 35%, transparent); border-radius: 999px; color: var(--true-color-blue, #0969da); display: inline-block; font-size: 12px; font-weight: var(--font-weight-semibold, 600); margin-left: 6px; padding: 1px 8px; vertical-align: 1px; }
      .grid { align-items: start; display: grid; gap: 20px; grid-template-columns: minmax(220px, 0.9fr) minmax(0, 3.6fr); }
      .panel { background: var(--canvas-surface); border: 1px solid var(--border-color-default, #d0d7de); border-radius: 12px; box-shadow: 0 12px 30px var(--canvas-shadow); min-width: 0; padding: 18px; }
      .panel-heading { align-items: center; display: flex; gap: 12px; justify-content: space-between; margin-bottom: 14px; }
      h2, .query-label { font-size: 14px; font-weight: var(--font-weight-semibold, 600); line-height: 20px; margin: 0; }
      button { appearance: none; background: var(--true-color-blue, #0969da); border: 1px solid var(--true-color-blue, #0969da); border-radius: 7px; color: var(--color-white, #ffffff); cursor: pointer; font: inherit; font-weight: var(--font-weight-semibold, 600); min-height: 34px; padding: 6px 11px; transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease; }
      button:hover:not(:disabled) { background: color-mix(in srgb, var(--true-color-blue, #0969da) 86%, var(--text-color-default, #1f2328)); border-color: color-mix(in srgb, var(--true-color-blue, #0969da) 86%, var(--text-color-default, #1f2328)); transform: translateY(-1px); }
      button:disabled { cursor: wait; opacity: 0.65; }
      button:focus-visible, textarea:focus-visible { outline: 2px solid var(--color-focus-outline, #0969da); outline-offset: 2px; }
      .tables { display: grid; gap: 6px; }
      .table-button { align-items: center; background: transparent; border-color: transparent; color: var(--text-color-default, #1f2328); display: flex; font-family: var(--font-mono, monospace); font-size: 13px; justify-content: space-between; padding: 8px 9px; text-align: left; width: 100%; }
      .table-button:hover:not(:disabled) { background: var(--canvas-surface-strong); border-color: var(--border-color-default, #d0d7de); color: var(--text-color-default, #1f2328); transform: none; }
      .table-kind { color: var(--text-color-muted, #59636e); font-family: var(--font-sans, system-ui, sans-serif); font-size: 11px; }
      .empty-state { border: 1px dashed var(--border-color-default, #d0d7de); border-radius: 8px; color: var(--text-color-muted, #59636e); padding: 18px 14px; }
      .empty-state h3 { color: var(--text-color-default, #1f2328); font-size: 14px; margin: 0 0 6px; }
      .empty-state p { margin: 0; }
      code { background: var(--canvas-surface-strong); border-radius: 4px; color: var(--text-color-default, #1f2328); font: 12px/1.5 var(--font-mono, monospace); padding: 2px 5px; }
      textarea { background: var(--background-color-default, #ffffff); border: 1px solid var(--border-color-default, #d0d7de); border-radius: 8px; color: inherit; font: 13px/1.55 var(--font-mono, monospace); min-height: 168px; margin-top: 8px; padding: 12px; resize: vertical; width: 100%; }
      textarea::placeholder { color: var(--text-color-muted, #59636e); }
      .actions { align-items: center; display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
      #status { color: var(--text-color-muted, #59636e); }
      #result { margin-top: 20px; overflow-x: auto; }
      .result-summary { color: var(--text-color-muted, #59636e); font-size: 12px; margin: 0 0 8px; }
      table { border-collapse: separate; border-spacing: 0; font-family: var(--font-mono, monospace); font-size: 12px; min-width: 100%; overflow: hidden; width: max-content; }
      th, td { border-bottom: 1px solid var(--border-color-default, #d0d7de); max-width: 38ch; padding: 9px 11px; text-align: left; vertical-align: top; white-space: pre-wrap; }
      th { background: var(--canvas-surface-strong); border-bottom-width: 2px; font-family: var(--font-sans, system-ui, sans-serif); font-size: 11px; font-weight: var(--font-weight-semibold, 600); letter-spacing: 0.02em; text-transform: uppercase; }
      .error { color: var(--true-color-red, #cf222e) !important; }
      @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } .page-header { align-items: start; flex-direction: column; } }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; } }
    </style>
  </head>
  <body>
    <main>
      <header class="page-header">
        <div>
          <h1>Database Explorer</h1>
          <p class="lede">Browse the project's local SQLite database and inspect its data with SQL.<span class="read-only">Read-only</span></p>
        </div>
      </header>
      <div class="grid">
        <aside class="panel">
          <div class="panel-heading">
            <h2>Tables and views</h2>
            <button id="refresh" type="button">Refresh</button>
          </div>
          <div id="tables" class="tables" aria-live="polite"></div>
        </aside>
        <section class="panel">
          <label class="query-label" for="query">Query</label>
          <textarea id="query" aria-label="SQL query">SELECT * FROM games LIMIT 25;</textarea>
          <div class="actions">
            <button id="run" type="button">Run query</button>
            <span id="status" role="status" aria-live="polite"></span>
          </div>
          <div id="result"></div>
        </section>
      </div>
    </main>
    <script>
      const tables = document.querySelector("#tables");
      const query = document.querySelector("#query");
      const result = document.querySelector("#result");
      const status = document.querySelector("#status");
      const refreshButton = document.querySelector("#refresh");
      const runButton = document.querySelector("#run");
      const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
      const renderSetupState = () => {
        tables.innerHTML = '<div class="empty-state"><h3>No tables found</h3><p>Set up the local database with <code>npm run db:setup</code>, then refresh this list.</p></div>';
      };
      const renderResult = (data) => {
        if (!data.rows.length) { result.innerHTML = '<div class="empty-state"><h3>No rows returned</h3><p>Try adjusting the query or selecting a table from the list.</p></div>'; return; }
        result.innerHTML = \`<p class="result-summary">\${data.rows.length} row(s) returned\${data.truncated ? "; showing the first 250" : ""}.</p><table><thead><tr>\${data.columns.map((column) => \`<th>\${escapeHtml(column)}</th>\`).join("")}</tr></thead><tbody>\${data.rows.map((row) => \`<tr>\${data.columns.map((column) => \`<td>\${escapeHtml(row[column])}</td>\`).join("")}</tr>\`).join("")}</tbody></table>\`;
      };
      const request = async (path, options = {}) => {
        const response = await fetch(path, options);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Request failed.");
        return data;
      };
      const loadTables = async () => {
        status.textContent = "Loading tables...";
        status.className = "";
        refreshButton.disabled = true;
        try {
          const data = await request("/api/tables");
          if (!data.rows.length) {
            renderSetupState();
          } else {
            tables.innerHTML = data.rows.map((row) => \`<button class="table-button" type="button" data-table="\${escapeHtml(row.name)}">\${escapeHtml(row.name)} <small class="table-kind">\${escapeHtml(row.type)}</small></button>\`).join("");
          }
          status.textContent = "";
        } catch (error) {
          renderSetupState();
          status.textContent = \`Could not load tables: \${error.message}\`;
          status.className = "error";
        } finally {
          refreshButton.disabled = false;
        }
      };
      tables.addEventListener("click", (event) => {
        const table = event.target.dataset.table;
        if (table) {
          query.value = \`SELECT * FROM "\${table.replace(/"/g, '""')}" LIMIT 25;\`;
          document.querySelector("#run").focus();
        }
      });
      refreshButton.addEventListener("click", loadTables);
      runButton.addEventListener("click", async () => {
        status.textContent = "Running query...";
        status.className = "";
        result.innerHTML = "";
        runButton.disabled = true;
        try {
          const data = await request("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: query.value }) });
          renderResult(data);
          status.textContent = "";
        } catch (error) {
          status.textContent = error.message;
          status.className = "error";
        } finally {
          runButton.disabled = false;
        }
      });
      loadTables();
    </script>
  </body>
</html>`;
}

async function startServer(url) {
    const server = createServer(async (request, response) => {
        try {
            if (request.url === "/api/tables" && request.method === "GET") {
                const data = await listTables(url);
                response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
                response.end(JSON.stringify(data));
                return;
            }

            if (request.url === "/api/query" && request.method === "POST") {
                const body = JSON.parse(await readRequestBody(request));
                const data = await executeQuery(url, validateReadOnlyQuery(body.query));
                response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
                response.end(JSON.stringify(data));
                return;
            }

            response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            response.end(renderHtml());
        } catch (error) {
            response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : "The request failed." }));
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

await joinSession({
    canvases: [
        createCanvas({
            id: "database-explorer",
            displayName: "Database Explorer",
            description: "Explore this project's SQLite tables and run read-only SQL queries.",
            actions: [
                {
                    name: "list_tables",
                    description: "List tables and views in the project SQLite database.",
                    handler: async () => listTables(databaseUrl()),
                },
                {
                    name: "run_query",
                    description: "Run one read-only SELECT or WITH query against the project SQLite database.",
                    inputSchema: {
                        type: "object",
                        properties: { query: { type: "string", minLength: 1 } },
                        required: ["query"],
                        additionalProperties: false,
                    },
                    handler: async (ctx) => {
                        try {
                            return executeQuery(databaseUrl(), validateReadOnlyQuery(ctx.input?.query));
                        } catch (error) {
                            throw new CanvasError("database_query_invalid", error instanceof Error ? error.message : "The query is invalid.");
                        }
                    },
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(databaseUrl());
                    servers.set(ctx.instanceId, entry);
                }
                return { title: "Database Explorer", url: entry.url };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(resolve));
                }
            },
        }),
    ],
});
