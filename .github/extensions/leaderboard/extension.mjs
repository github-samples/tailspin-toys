import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CanvasError, createCanvas, joinSession } from "@github/copilot-sdk/extension";
import { rankGames } from "./leaderboard-data.mjs";

const servers = new Map();
const EXTENSION_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(EXTENSION_DIRECTORY, "../../..");
const HTML = readFileSync(resolve(EXTENSION_DIRECTORY, "leaderboard.html"), "utf8");

function databasePath() {
    const databaseUrl = process.env.DATABASE_URL ?? "file:tailspin.db";
    if (databaseUrl === ":memory:" || !databaseUrl.startsWith("file:")) {
        throw new Error("DATABASE_URL must point to a local SQLite file.");
    }

    const configuredPath = databaseUrl.startsWith("file://")
        ? fileURLToPath(databaseUrl)
        : databaseUrl.slice("file:".length);
    if (!configuredPath) {
        throw new Error("DATABASE_URL must include a database file path.");
    }

    const path = isAbsolute(configuredPath) ? configuredPath : resolve(PROJECT_ROOT, configuredPath);
    if (!existsSync(path)) {
        throw new Error("The local game database was not found. Run `npm run db:setup`, then refresh.");
    }
    return path;
}

function getLeaderboard(requestedCategory = null) {
    const database = new DatabaseSync(databasePath(), { readOnly: true });
    try {
        const categories = database
            .prepare("SELECT name FROM categories ORDER BY name")
            .all()
            .map((row) => row.name);
        const rows = database
            .prepare(`
                SELECT
                    games.id AS id,
                    games.title AS title,
                    publishers.name AS publisher,
                    categories.name AS category,
                    games.star_rating AS score
                FROM games
                INNER JOIN publishers ON publishers.id = games.publisher_id
                INNER JOIN categories ON categories.id = games.category_id
                WHERE (? IS NULL OR categories.name = ?)
            `)
            .all(requestedCategory, requestedCategory);
        const games = rankGames(rows);
        const ratedGames = games.filter((game) => game.score !== null);
        const scoreTotal = ratedGames.reduce((total, game) => total + game.score, 0);

        return {
            categories,
            games,
            summary: {
                total: games.length,
                rated: ratedGames.length,
                unrated: games.length - ratedGames.length,
                average: ratedGames.length === 0 ? null : scoreTotal / ratedGames.length,
            },
        };
    } finally {
        database.close();
    }
}

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
    });
    response.end(JSON.stringify(payload));
}

async function startServer() {
    const server = createServer((request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");

        if (request.method === "GET" && url.pathname === "/") {
            response.writeHead(200, {
                "Cache-Control": "no-store",
                "Content-Type": "text/html; charset=utf-8",
                "X-Content-Type-Options": "nosniff",
            });
            response.end(HTML);
            return;
        }

        if (request.method === "GET" && url.pathname === "/api/leaderboard") {
            try {
                const category = url.searchParams.get("category")?.trim() || null;
                sendJson(response, 200, getLeaderboard(category));
            } catch (error) {
                sendJson(response, 500, {
                    error: error instanceof Error ? error.message : "Could not load game ratings.",
                });
            }
            return;
        }

        if (request.method !== "GET") {
            response.writeHead(405, { Allow: "GET", "Content-Type": "text/plain; charset=utf-8" });
            response.end("Only GET requests are supported.");
            return;
        }

        sendJson(response, 404, { error: "Not found." });
    });

    await new Promise((resolvePromise, rejectPromise) => {
        server.once("error", rejectPromise);
        server.listen(0, "127.0.0.1", resolvePromise);
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return { server, url: `http://127.0.0.1:${port}/` };
}

await joinSession({
    canvases: [
        createCanvas({
            id: "game-leaderboard",
            displayName: "Game Leaderboard",
            description: "Compare Tailspin Toys games ranked by their existing star ratings.",
            actions: [
                {
                    name: "get_leaderboard",
                    description: "Get game ratings and ranks from the local Tailspin Toys catalog.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            category: { type: "string", minLength: 1 },
                        },
                        additionalProperties: false,
                    },
                    handler: async (context) => {
                        try {
                            const category = context.input?.category?.trim() || null;
                            return getLeaderboard(category);
                        } catch (error) {
                            throw new CanvasError(
                                "leaderboard_unavailable",
                                error instanceof Error ? error.message : "Could not load game ratings.",
                            );
                        }
                    },
                },
            ],
            open: async (context) => {
                let entry = servers.get(context.instanceId);
                if (!entry) {
                    entry = await startServer();
                    servers.set(context.instanceId, entry);
                }
                return { title: "Game Leaderboard", url: entry.url };
            },
            onClose: async (context) => {
                const entry = servers.get(context.instanceId);
                if (entry) {
                    servers.delete(context.instanceId);
                    await new Promise((resolvePromise) => entry.server.close(resolvePromise));
                }
            },
        }),
    ],
});
