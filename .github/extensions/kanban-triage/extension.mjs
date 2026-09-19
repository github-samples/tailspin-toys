import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { CanvasError, createCanvas, joinSession } from "@github/copilot-sdk/extension";

const execFileAsync = promisify(execFile);
const servers = new Map();
const repository = "github-samples/tailspin-toys";

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function summarize(body) {
    const text = String(body ?? "").replace(/^<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
    return text.length > 220 ? `${text.slice(0, 217)}...` : text || "No issue description provided.";
}

function rankIssues(issues) {
    const now = Date.now();
    return issues
        .map((issue) => {
            const ageDays = Math.max(0, (now - new Date(issue.updatedAt).getTime()) / 86_400_000);
            const hasAcceptanceCriteria = /acceptance criteria|proposed solution/i.test(issue.body ?? "");
            const score = (hasAcceptanceCriteria ? 3 : 0) + Math.max(0, 3 - ageDays / 30);
            const reasons = [
                hasAcceptanceCriteria ? "It has concrete acceptance criteria or a proposed solution." : null,
                ageDays < 30 ? "It has been updated recently." : null,
                issue.labels?.length ? `It has ${issue.labels.length} label${issue.labels.length === 1 ? "" : "s"} to help scope the work.` : null,
            ].filter(Boolean);
            return { ...issue, summary: summarize(issue.body), score, reasons };
        })
        .sort((a, b) => b.score - a.score || new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function loadIssues() {
    const { stdout } = await execFileAsync("gh", [
        "issue",
        "list",
        "--repo",
        repository,
        "--state",
        "open",
        "--limit",
        "100",
        "--json",
        "number,title,body,labels,updatedAt,url",
    ]);
    return rankIssues(JSON.parse(stdout));
}

function renderIssueCard(issue, priority) {
    const reason = priority
        ? `<p class="reason"><strong>Why it is prioritized:</strong> ${escapeHtml(issue.reasons.join(" "))}</p>`
        : "";
    return `<article class="card">
      <div class="card-top"><span class="issue-number">#${issue.number}</span><span class="updated">Updated ${new Date(issue.updatedAt).toLocaleDateString()}</span></div>
      <h3><a href="${escapeHtml(issue.url)}" target="_blank" rel="noreferrer">${escapeHtml(issue.title)}</a></h3>
      <p>${escapeHtml(issue.summary)}</p>
      ${reason}
      <button type="button" data-issue-number="${issue.number}">Add to current context</button>
      <span class="status" role="status" aria-live="polite"></span>
    </article>`;
}

function renderHtml(issues) {
    const priority = issues.slice(0, 3);
    const remainder = issues.slice(3);
    return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Issue triage board</title>
<style>
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--background-color-default,#fff); color: var(--text-color-default,#1f2328); font: var(--text-body-medium,14px)/var(--leading-body-medium,20px) var(--font-sans,system-ui,sans-serif); }
main { max-width: 1180px; margin: 0 auto; padding: 24px; }
header { align-items: end; border-bottom: 1px solid var(--border-color-default,#d0d7de); display: flex; justify-content: space-between; gap: 16px; margin-bottom: 24px; padding-bottom: 18px; }
h1 { font-size: 28px; line-height: 1.2; margin: 0; } h2 { font-size: 18px; margin: 0 0 12px; }
.lede { color: var(--text-color-muted,#59636e); margin: 6px 0 0; max-width: 70ch; }
.lane { margin: 0 0 28px; } .cards { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 14px; }
.cards.secondary { grid-template-columns: repeat(auto-fit,minmax(250px,1fr)); }
.card { background: color-mix(in srgb,var(--background-color-default,#fff) 92%,var(--text-color-default,#1f2328) 8%); border: 1px solid var(--border-color-default,#d0d7de); border-radius: 10px; padding: 16px; }
.card-top { color: var(--text-color-muted,#59636e); display: flex; justify-content: space-between; font-size: 12px; } .issue-number { font-weight: 600; }
h3 { font-size: 16px; line-height: 1.35; margin: 12px 0 8px; } h3 a { color: inherit; } .card p { margin: 8px 0; }
.reason { border-left: 3px solid var(--true-color-blue,#0969da); color: var(--text-color-muted,#59636e); padding-left: 10px; }
button { background: var(--true-color-blue,#0969da); border: 1px solid var(--true-color-blue,#0969da); border-radius: 7px; color: var(--color-white,#fff); cursor: pointer; font: inherit; font-weight: 600; margin-top: 10px; min-height: 34px; padding: 6px 10px; }
button:disabled { cursor: wait; opacity: .65; } button:focus-visible { outline: 2px solid var(--color-focus-outline,#0969da); outline-offset: 2px; }
.status { color: var(--text-color-muted,#59636e); display: block; font-size: 12px; margin-top: 6px; min-height: 18px; } .error { color: var(--true-color-red,#cf222e); }
@media (max-width: 800px) { header { align-items: start; flex-direction: column; } .cards { grid-template-columns: 1fr; } }
</style></head>
<body><main><header><div><h1>Issue triage board</h1><p class="lede">The three issues most likely to need attention appear first, followed by the remaining open work.</p></div><button id="refresh" type="button">Refresh board</button></header>
<section class="lane"><h2>Needs attention now</h2><div class="cards">${priority.length ? priority.map((issue) => renderIssueCard(issue, true)).join("") : "<p>No open issues found.</p>"}</div></section>
<section class="lane"><h2>Remaining open issues</h2><div class="cards secondary">${remainder.length ? remainder.map((issue) => renderIssueCard(issue, false)).join("") : "<p>No remaining issues.</p>"}</div></section>
<script>
const setStatus = (button, message, error = false) => { const status = button.parentElement.querySelector(".status"); status.textContent = message; status.className = error ? "status error" : "status"; };
document.querySelectorAll("[data-issue-number]").forEach((button) => button.addEventListener("click", async () => {
  button.disabled = true; setStatus(button, "Adding...");
  try { const response = await fetch("/api/context", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({ number: Number(button.dataset.issueNumber) }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setStatus(button, "Added to current context."); } catch (error) { setStatus(button, error.message || "Could not add issue.", true); button.disabled = false; }
}));
document.querySelector("#refresh").addEventListener("click", () => location.reload());
</script></main></body></html>`;
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", (chunk) => { body += chunk; if (body.length > 10_000) reject(new Error("Request body is too large.")); });
        request.on("end", () => resolve(body));
        request.on("error", reject);
    });
}

async function addIssueToContext(number) {
    const issues = await loadIssues();
    const issue = issues.find((candidate) => candidate.number === number);
    if (!issue) throw new Error(`Open issue #${number} was not found.`);
    await session.send({ prompt: `I want to work on this repository issue next:\n\n${issue.title} (#${issue.number})\n${issue.url}\n\n${issue.body || "No description provided."}` });
}

async function startServer(instanceId) {
    const server = createServer(async (request, response) => {
        try {
            if (request.method === "POST" && request.url === "/api/context") {
                const payload = JSON.parse(await readBody(request));
                if (!Number.isInteger(payload.number)) throw new Error("A valid issue number is required.");
                await addIssueToContext(payload.number);
                response.writeHead(200, { "content-type": "application/json" });
                response.end(JSON.stringify({ ok: true }));
                return;
            }
            const issues = await loadIssues();
            response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            response.end(renderHtml(issues));
        } catch (error) {
            response.writeHead(500, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unable to load issues." }));
        }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    return { server, url: `http://127.0.0.1:${address.port}/` };
}

const session = await joinSession({
    canvases: [
        createCanvas({
            id: "kanban-triage",
            displayName: "Issue triage board",
            description: "Review open repository issues, prioritize three, and add selected work to the current session context.",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
            actions: [
                {
                    name: "add_to_context",
                    description: "Add an open repository issue to the current session context by issue number.",
                    inputSchema: { type: "object", properties: { number: { type: "integer" } }, required: ["number"], additionalProperties: false },
                    handler: async (ctx) => {
                        if (!Number.isInteger(ctx.input?.number)) throw new CanvasError("invalid_issue", "A valid issue number is required.");
                        await addIssueToContext(ctx.input.number);
                        return { ok: true, number: ctx.input.number };
                    },
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) { entry = await startServer(ctx.instanceId); servers.set(ctx.instanceId, entry); }
                return { title: "Issue triage board", url: entry.url };
            },
            onClose: async (ctx) => {
                const entry = servers.get(ctx.instanceId);
                if (entry) {
                    servers.delete(ctx.instanceId);
                    await new Promise((resolve) => entry.server.close(() => resolve()));
                }
            },
        }),
    ],
});
