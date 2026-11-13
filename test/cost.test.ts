import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyCost, PLACEHOLDER_PRICES } from "../src/cost.js";

test("zero traffic costs nothing", () => {
  const b = monthlyCost({ requestsPerMonth: 0, readShare: 0.5, durationMs: 10, memoryMb: 128, unitsPerRequest: 1 });
  assert.equal(b.total, 0);
  assert.equal(b.perMillionRequests, 0);
});

test("one million requests with known prices", () => {
  const prices = { apiRequestPerMillion: 1, lambdaRequestPerMillion: 0.2, lambdaGbSecond: 0.00001, dynamoReadPerMillion: 0.25, dynamoWritePerMillion: 1.25 };
  // 1M req, 1000 ms at 1024 MB => 1,000,000 GB-seconds.
  const b = monthlyCost({ requestsPerMonth: 1e6, readShare: 1, durationMs: 1000, memoryMb: 1024, unitsPerRequest: 2 }, prices);
  assert.equal(b.apiGateway, 1);
  assert.equal(b.lambdaRequests, 0.2);
  assert.ok(Math.abs(b.lambdaCompute - 10) < 1e-9);
  assert.ok(Math.abs(b.dynamo - 0.5) < 1e-9); // 2M reads at 0.25 per million
});

test("writes are priced above reads", () => {
  const base = { requestsPerMonth: 1e6, durationMs: 10, memoryMb: 128, unitsPerRequest: 1 };
  const reads = monthlyCost({ ...base, readShare: 1 });
  const writes = monthlyCost({ ...base, readShare: 0 });
  assert.ok(writes.dynamo > reads.dynamo);
});

test("rejects invalid shares and negative volumes", () => {
  assert.throws(() => monthlyCost({ requestsPerMonth: -1, readShare: 0.5, durationMs: 1, memoryMb: 1, unitsPerRequest: 1 }), RangeError);
  assert.throws(() => monthlyCost({ requestsPerMonth: 1, readShare: 1.5, durationMs: 1, memoryMb: 1, unitsPerRequest: 1 }), RangeError);
});

test("per-request cost falls as volume rises only through fixed parts", () => {
  const w = { readShare: 0.8, durationMs: 12, memoryMb: 256, unitsPerRequest: 1 };
  const small = monthlyCost({ ...w, requestsPerMonth: 1e4 }, PLACEHOLDER_PRICES);
  const big = monthlyCost({ ...w, requestsPerMonth: 1e8 }, PLACEHOLDER_PRICES);
  assert.ok(Math.abs(small.perMillionRequests - big.perMillionRequests) < 1e-6, "all parts are linear in volume");
});
