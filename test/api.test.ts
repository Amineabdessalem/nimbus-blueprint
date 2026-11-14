import { test } from "node:test";
import assert from "node:assert/strict";
import { makeHandler, parseNewItem, type ApiEvent } from "../src/api.js";
import { MemoryRepo } from "../src/repo.js";

const ev = (method: string, path: string, extra: Partial<ApiEvent> = {}): ApiEvent => ({
  requestContext: { http: { method, path } },
  ...extra,
});

const fixed = new Date("2026-01-01T00:00:00Z");

test("create, read, list and delete an item", async () => {
  const handle = makeHandler(new MemoryRepo(), () => fixed);
  const created = await handle(ev("POST", "/items", { body: JSON.stringify({ name: " widget ", quantity: 3 }) }));
  assert.equal(created.statusCode, 201);
  const item = JSON.parse(created.body);
  assert.equal(item.name, "widget");
  assert.equal(item.createdAt, "2026-01-01T00:00:00.000Z");

  const got = await handle(ev("GET", `/items/${item.id}`, { pathParameters: { id: item.id } }));
  assert.equal(got.statusCode, 200);

  const list = JSON.parse((await handle(ev("GET", "/items"))).body);
  assert.equal(list.items.length, 1);

  const del = await handle(ev("DELETE", `/items/${item.id}`, { pathParameters: { id: item.id } }));
  assert.equal(del.statusCode, 204);
  const gone = await handle(ev("GET", `/items/${item.id}`, { pathParameters: { id: item.id } }));
  assert.equal(gone.statusCode, 404);
});

test("rejects bad bodies with 400 and explains why", async () => {
  const handle = makeHandler(new MemoryRepo());
  const cases = [
    "not json",
    JSON.stringify([1]),
    JSON.stringify({ name: "", quantity: 1 }),
    JSON.stringify({ name: "x", quantity: -1 }),
    JSON.stringify({ name: "x", quantity: 1.5 }),
  ];
  for (const body of cases) {
    const res = await handle(ev("POST", "/items", { body }));
    assert.equal(res.statusCode, 400, body);
    assert.ok(JSON.parse(res.body).error);
  }
});

test("rejects oversized bodies with 413", async () => {
  const handle = makeHandler(new MemoryRepo());
  const body = JSON.stringify({ name: "x".repeat(5000), quantity: 1 });
  assert.equal((await handle(ev("POST", "/items", { body }))).statusCode, 413);
});

test("decodes base64 bodies", async () => {
  const handle = makeHandler(new MemoryRepo());
  const body = Buffer.from(JSON.stringify({ name: "b64", quantity: 2 })).toString("base64");
  const res = await handle(ev("POST", "/items", { body, isBase64Encoded: true }));
  assert.equal(res.statusCode, 201);
});

test("unknown routes and methods", async () => {
  const handle = makeHandler(new MemoryRepo());
  assert.equal((await handle(ev("GET", "/nope"))).statusCode, 404);
  assert.equal((await handle(ev("PUT", "/items"))).statusCode, 405);
  assert.equal((await handle(ev("GET", "/health"))).statusCode, 200);
});

test("parseNewItem trims names and checks types", () => {
  assert.deepEqual(parseNewItem({ name: "  a  ", quantity: 0 }), { name: "a", quantity: 0 });
  assert.ok("error" in parseNewItem({ name: "a".repeat(201), quantity: 1 }));
});

test("GET /items pages with limit and cursor and rejects a bad limit", async () => {
  const handle = makeHandler(new MemoryRepo(), () => fixed);
  for (const name of ["one", "two", "three"]) {
    await handle(ev("POST", "/items", { body: JSON.stringify({ name, quantity: 1 }) }));
  }

  const first = JSON.parse((await handle(ev("GET", "/items", { queryStringParameters: { limit: "2" } }))).body);
  assert.equal(first.items.length, 2);
  assert.ok(first.next);

  const rest = await handle(
    ev("GET", "/items", { queryStringParameters: { limit: "2", cursor: first.next } }),
  );
  const second = JSON.parse(rest.body);
  assert.equal(second.items.length, 1);
  assert.equal(second.next, undefined);

  const bad = await handle(ev("GET", "/items", { queryStringParameters: { limit: "0" } }));
  assert.equal(bad.statusCode, 400);
});
