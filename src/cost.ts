/**
 * A monthly cost model for the API: Lambda compute, API Gateway requests and
 * DynamoDB on-demand requests. Prices are parameters, not facts. AWS changes
 * them and they differ by region, so the defaults are placeholders to replace
 * with the current price list before any decision is made.
 */
export interface Prices {
  /** USD per million API Gateway HTTP API requests. */
  apiRequestPerMillion: number;
  /** USD per million Lambda requests. */
  lambdaRequestPerMillion: number;
  /** USD per GB-second of Lambda compute. */
  lambdaGbSecond: number;
  /** USD per million DynamoDB on-demand read request units. */
  dynamoReadPerMillion: number;
  /** USD per million DynamoDB on-demand write request units. */
  dynamoWritePerMillion: number;
}

export const PLACEHOLDER_PRICES: Prices = {
  apiRequestPerMillion: 1.0,
  lambdaRequestPerMillion: 0.2,
  lambdaGbSecond: 0.0000166667,
  dynamoReadPerMillion: 0.25,
  dynamoWritePerMillion: 1.25,
};

export interface Workload {
  requestsPerMonth: number;
  /** Share of requests that read (GET); the rest write. */
  readShare: number;
  /** Mean Lambda duration in milliseconds. */
  durationMs: number;
  memoryMb: number;
  /** DynamoDB request units per API request. */
  unitsPerRequest: number;
}

export interface Breakdown {
  apiGateway: number;
  lambdaRequests: number;
  lambdaCompute: number;
  dynamo: number;
  total: number;
  perMillionRequests: number;
}

export function monthlyCost(w: Workload, p: Prices = PLACEHOLDER_PRICES): Breakdown {
  if (w.requestsPerMonth < 0 || w.readShare < 0 || w.readShare > 1) {
    throw new RangeError("requestsPerMonth must be >= 0 and readShare in [0, 1]");
  }
  const n = w.requestsPerMonth;
  const apiGateway = (n / 1e6) * p.apiRequestPerMillion;
  const lambdaRequests = (n / 1e6) * p.lambdaRequestPerMillion;
  const gbSeconds = n * (w.durationMs / 1000) * (w.memoryMb / 1024);
  const lambdaCompute = gbSeconds * p.lambdaGbSecond;
  const units = n * w.unitsPerRequest;
  const dynamo =
    ((units * w.readShare) / 1e6) * p.dynamoReadPerMillion +
    ((units * (1 - w.readShare)) / 1e6) * p.dynamoWritePerMillion;
  const total = apiGateway + lambdaRequests + lambdaCompute + dynamo;
  return {
    apiGateway,
    lambdaRequests,
    lambdaCompute,
    dynamo,
    total,
    perMillionRequests: n === 0 ? 0 : (total / n) * 1e6,
  };
}
