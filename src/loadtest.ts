/**
 * In-process load test of the request handler against an in-memory store.
 * It measures the handler's own overhead (routing, validation, JSON), not
 * AWS latency: no network, no DynamoDB, no API Gateway, no cold starts.
 */
import { makeHandler, type ApiEvent } from "./api.js";
import { MemoryRepo } from "./repo.js";

const total = Number(process.env.REQUESTS ?? 100_000);
const concurrency = Number(process.env.CONCURRENCY ?? 64);

const handle = makeHandler(new MemoryRepo());
const create = (i: number): ApiEvent => ({
  requestContext: { http: { method: "POST", path: "/items" } },
  body: JSON.stringify({ name: `item ${i}`, quantity: i % 100 }),
});
const read = (id: string): ApiEvent => ({
  requestContext: { http: { method: "GET", path: `/items/${id}` } },
  pathParameters: { id },
});

async function main() {
  const seed = await handle(create(0));
  const id = JSON.parse(seed.body).id as string;
  const latencies: number[] = [];
  let next = 0;
  let errors = 0;

  const worker = async () => {
    while (next < total) {
      const i = next++;
      const ev = i % 2 === 0 ? create(i) : read(id);
      const t0 = performance.now();
      const res = await handle(ev);
      latencies.push(performance.now() - t0);
      if (res.statusCode >= 500) errors++;
    }
  };

  const start = performance.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const elapsed = (performance.now() - start) / 1000;

  latencies.sort((a, b) => a - b);
  const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))]!;
  console.log(`requests=${total} concurrency=${concurrency} elapsed=${elapsed.toFixed(2)}s`);
  console.log(`throughput=${Math.round(total / elapsed)} req/s  5xx=${errors}`);
  console.log(`p50=${pct(0.5).toFixed(3)}ms p95=${pct(0.95).toFixed(3)}ms p99=${pct(0.99).toFixed(3)}ms`);
}

await main();
