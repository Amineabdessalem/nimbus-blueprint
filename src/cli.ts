import { monthlyCost } from "./cost.js";

const scenarios = [
  { name: "side project", requestsPerMonth: 50_000 },
  { name: "small product", requestsPerMonth: 5_000_000 },
  { name: "busy API", requestsPerMonth: 300_000_000 },
];

for (const s of scenarios) {
  const b = monthlyCost({
    requestsPerMonth: s.requestsPerMonth,
    readShare: 0.8,
    durationMs: 12,
    memoryMb: 256,
    unitsPerRequest: 1,
  });
  const reqs = s.requestsPerMonth.toLocaleString("en-US").padStart(13);
  console.log(`${s.name.padEnd(15)}${reqs} req/month  USD ${b.total.toFixed(2)}  (USD ${b.perMillionRequests.toFixed(2)} per million)`);
}
