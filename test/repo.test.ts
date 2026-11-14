import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryRepo, type Item } from "../src/repo.js";

const item = (id: string): Item => ({ id, name: id, quantity: 1, createdAt: "2026-01-01T00:00:00.000Z" });

test("MemoryRepo pages through every item exactly once", async () => {
  const repo = new MemoryRepo();
  for (const id of ["a", "b", "c", "d", "e"]) await repo.put(item(id));

  const seen: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const page = await repo.list(2, cursor);
    seen.push(...page.items.map((i) => i.id));
    cursor = page.next;
    pages++;
  } while (cursor !== undefined);

  assert.deepEqual(seen, ["a", "b", "c", "d", "e"]);
  assert.equal(pages, 3);
});

test("MemoryRepo returns no cursor when everything fits", async () => {
  const repo = new MemoryRepo();
  await repo.put(item("only"));
  assert.deepEqual(await repo.list(10), { items: [item("only")] });
});
