import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { createCanvas, joinSession } from "@github/copilot-sdk/extension";
import { rankGames } from "./ranking.mjs";

const servers = new Map();
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function databaseUrl() {
    return process.env.DATABASE_URL ?? `file:${join(PROJECT_ROOT, ".data", "tailspin.db")}`;
}

// Fixed read-only queries only; no user-supplied SQL ever reaches the database.
async function loadGames(url) {
    const client = createClient({ url });
    try {
        const result = await client.execute(
            `SELECT g.id AS id, g.title AS title, g.star_rating AS starRating, c.name AS genre, p.name AS publisher
             FROM games g
             LEFT JOIN categories c ON c.id = g.category_id
             LEFT JOIN publishers p ON p.id = g.publisher_id`,
        );
        return result.rows.map((row) => ({
            id: Number(row.id),
            title: String(row.title),
            starRating: row.starRating === null ? null : Number(row.starRating),
            genre: row.genre === null ? null : String(row.genre),
            publisher: row.publisher === null ? null : String(row.publisher),
        }));
    } finally {
        client.close();
    }
}

async function loadLeaderboard(url, genre) {
    const games = await loadGames(url);
    const genres = [...new Set(games.map((game) => game.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return { genres, entries: rankGames(games, genre) };
}

function renderHtml() {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Game Leaderboard</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--background-color-default, #ffffff); color: var(--text-color-default, #1f2328); font: var(--text-body-medium, 14px)/var(--leading-body-medium, 20px) var(--font-sans, system-ui, sans-serif); }
      main { max-width: 960px; margin: 0 auto; padding: clamp(16px, 3vw, 32px); }
      h1 { font-size: clamp(26px, 3vw, 36px); letter-spacing: -0.025em; line-height: 1.1; margin: 0; }
      .lede { color: var(--text-color-muted, #59636e); margin: 8px 0 0; max-width: 62ch; }
      .badge { border: 1px solid var(--border-color-default, #d0d7de); border-radius: 999px; font-size: 12px; margin-left: 6px; padding: 1px 8px; }
      .controls { align-items: center; display: flex; gap: 10px; margin: 20px 0 14px; }
      select { background: var(--background-color-default, #ffffff); border: 1px solid var(--border-color-default, #d0d7de); border-radius: 7px; color: inherit; font: inherit; min-height: 34px; padding: 4px 8px; }
      select:focus-visible { outline: 2px solid var(--color-focus-outline, #0969da); outline-offset: 2px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-bottom: 1px solid var(--border-color-default, #d0d7de); padding: 9px 11px; text-align: left; }
      th { font-size: 11px; letter-spacing: 0.02em; text-transform: uppercase; }
      td.rank { font-variant-numeric: tabular-nums; font-weight: var(--font-weight-semibold, 600); width: 5ch; }
      .muted { color: var(--text-color-muted, #59636e); }
      .empty-state { border: 1px dashed var(--border-color-default, #d0d7de); border-radius: 8px; color: var(--text-color-muted, #59636e); margin-top: 14px; padding: 18px 14px; }
      .error { color: var(--true-color-red, #cf222e); }
    </style>
  </head>
  <body>
    <main>
      <h1>Game Leaderboard</h1>
      <p class="lede">Games ranked by catalog star rating. Ratings are not gameplay scores or live popularity.<span class="badge">Read-only</span></p>
      <div class="controls">
        <label for="genre">Genre</label>
        <select id="genre"><option value="">All genres</option></select>
        <span id="status" role="status" aria-live="polite" class="muted"></span>
      </div>
      <div id="result"></div>
    </main>
    <script>
      const genreSelect = document.querySelector("#genre");
      const result = document.querySelector("#result");
      const status = document.querySelector("#status");
      const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
      const load = async () => {
        status.textContent = "Loading...";
        status.className = "muted";
        try {
          const response = await fetch("/api/leaderboard?genre=" + encodeURIComponent(genreSelect.value));
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Request failed.");
          if (genreSelect.options.length === 1) {
            genreSelect.insertAdjacentHTML("beforeend", data.genres.map((g) => '<option value="' + escapeHtml(g) + '">' + escapeHtml(g) + "</option>").join(""));
          }
          if (!data.entries.length) {
            result.innerHTML = '<div class="empty-state">No games found. Set up the local database with <code>npm run db:setup</code> or pick another genre.</div>';
          } else {
            result.innerHTML = '<table><thead><tr><th scope="col">Rank</th><th scope="col">Game</th><th scope="col">Genre</th><th scope="col">Publisher</th><th scope="col">Star rating</th></tr></thead><tbody>' +
              data.entries.map((e) => '<tr><td class="rank">' + (e.rank ?? "&ndash;") + "</td><td>" + escapeHtml(e.title) + "</td><td>" + escapeHtml(e.genre ?? "") + "</td><td>" + escapeHtml(e.publisher ?? "") + "</td><td>" +
                (e.starRating === null ? '<span class="muted">Unrated</span>' : escapeHtml(e.starRating.toFixed(1))) + "</td></tr>").join("") + "</tbody></table>";
          }
          status.textContent = data.entries.length + " game(s)";
        } catch (error) {
          result.innerHTML = "";
          status.textContent = "Could not load leaderboard: " + error.message;
          status.className = "error";
        }
      };
      genreSelect.addEventListener("change", load);
      load();
    </script>
  </body>
</html>`;
}

async function startServer(url) {
    const server = createServer(async (request, response) => {
        try {
            const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
            if (requestUrl.pathname === "/api/leaderboard" && request.method === "GET") {
                const data = await loadLeaderboard(url, requestUrl.searchParams.get("genre") ?? undefined);
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
            id: "game-leaderboard",
            displayName: "Game Leaderboard",
            description: "Read-only leaderboard ranking catalog games by star rating, with optional genre filtering.",
            actions: [
                {
                    name: "get_leaderboard",
                    description: "Get games ranked by star rating, optionally filtered by genre (category name). Ties share a rank; unrated games are last.",
                    inputSchema: {
                        type: "object",
                        properties: { genre: { type: "string" } },
                        additionalProperties: false,
                    },
                    handler: async (ctx) => loadLeaderboard(databaseUrl(), ctx.input?.genre),
                },
            ],
            open: async (ctx) => {
                let entry = servers.get(ctx.instanceId);
                if (!entry) {
                    entry = await startServer(databaseUrl());
                    servers.set(ctx.instanceId, entry);
                }
                return { title: "Game Leaderboard", url: entry.url };
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
