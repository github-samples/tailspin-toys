import { executeReadOnlyQuery } from "./query-handlers.mjs";

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

export function createHttpHandler({ url, listTables, executeQuery, renderHtml }) {
    return async (request, response) => {
        try {
            if (request.url === "/api/tables" && request.method === "GET") {
                const data = await listTables(url);
                response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
                response.end(JSON.stringify(data));
                return;
            }

            if (request.url === "/api/query" && request.method === "POST") {
                const body = JSON.parse(await readRequestBody(request));
                const data = await executeReadOnlyQuery(url, body.query, executeQuery);
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
    };
}
