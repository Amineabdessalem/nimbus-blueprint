import { randomUUID } from "node:crypto";
import type { Item, ItemRepo } from "./repo.js";

/** The subset of the API Gateway HTTP API (v2) event that the handler uses. */
export interface ApiEvent {
  requestContext: { http: { method: string; path: string } };
  pathParameters?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

export interface ApiResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const MAX_BODY = 4096;
const DEFAULT_PAGE = 50;
const MAX_PAGE = 100;

function json(statusCode: number, payload: unknown): ApiResult {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) };
}

/** Validates a create request. Returns an error message, or the clean fields. */
export function parseNewItem(raw: unknown): { error: string } | { name: string; quantity: number } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { error: "body must be a JSON object" };
  }
  const { name, quantity } = raw as Record<string, unknown>;
  if (typeof name !== "string" || name.trim() === "" || name.length > 200) {
    return { error: "name must be a non-empty string up to 200 characters" };
  }
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 0) {
    return { error: "quantity must be a non-negative integer" };
  }
  return { name: name.trim(), quantity };
}

export function makeHandler(repo: ItemRepo, now: () => Date = () => new Date()) {
  return async function handle(event: ApiEvent): Promise<ApiResult> {
    const { method, path } = event.requestContext.http;
    const id = event.pathParameters?.id;

    if (method === "GET" && path === "/health") return json(200, { status: "ok" });

    if (path === "/items") {
      if (method === "GET") {
        const q = event.queryStringParameters ?? {};
        const limit = q.limit === undefined ? DEFAULT_PAGE : Number(q.limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) {
          return json(400, { error: `limit must be an integer from 1 to ${MAX_PAGE}` });
        }
        return json(200, await repo.list(limit, q.cursor || undefined));
      }
      if (method === "POST") {
        const text = event.body ?? "";
        if (Buffer.byteLength(text) > MAX_BODY) return json(413, { error: "body too large" });
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.isBase64Encoded ? Buffer.from(text, "base64").toString() : text);
        } catch {
          return json(400, { error: "invalid JSON" });
        }
        const fields = parseNewItem(parsed);
        if ("error" in fields) return json(400, { error: fields.error });
        const item: Item = { id: randomUUID(), ...fields, createdAt: now().toISOString() };
        await repo.put(item);
        return json(201, item);
      }
      return json(405, { error: "method not allowed" });
    }

    if (id !== undefined && path === `/items/${id}`) {
      if (method === "GET") {
        const item = await repo.get(id);
        return item ? json(200, item) : json(404, { error: "not found" });
      }
      if (method === "DELETE") {
        return (await repo.delete(id)) ? { statusCode: 204, headers: {}, body: "" } : json(404, { error: "not found" });
      }
      return json(405, { error: "method not allowed" });
    }

    return json(404, { error: "no route" });
  };
}
