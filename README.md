# nimbus-blueprint

A small serverless REST API on AWS (API Gateway HTTP API, Lambda, DynamoDB), with a cost model and an in-process load-test harness.

## What is here

- `src/api.ts`: a framework-free request handler (`makeHandler`) for `GET /health`, `GET|POST /items`, `GET|DELETE /items/{id}`. Bodies over 4096 bytes get 413; bad JSON or bad fields get 400 with a reason.
- `src/repo.ts`: the `ItemRepo` interface plus an in-memory implementation used by tests and the load test.
- `src/dynamo.ts`: a DynamoDB-backed `ItemRepo` using the AWS SDK v3 document client.
- `src/lambda.ts`: adapter from the API Gateway HTTP API v2 event shape to the handler.
- `src/cost.ts`: a monthly cost model (`monthlyCost`) across API Gateway, Lambda and DynamoDB.
- `src/loadtest.ts`: calls the handler directly in-process and reports throughput and latency percentiles.
- `infra/main.tf`: Terraform for the API, Lambda and table.

## Run it

```sh
npm ci
npm test        # compiles, then runs node:test on dist/test
npm run cost    # prints cost scenarios
npm run loadtest
```

Requires Node 22.

## Honest limits

- **Cost figures use placeholder prices.** The price constants in `src/cost.ts` are not current AWS list prices. Replace them with values from the AWS pricing page for your region before using the numbers.
- **The load test is in-process only.** It measures the handler and in-memory repository on one machine. It does not include network, API Gateway, Lambda cold starts or DynamoDB latency. No AWS measurements are recorded here.
- **Terraform is not validated.** `infra/main.tf` has not been run through `terraform fmt -check` or `terraform validate`. Do that before any `apply`.

## Design notes

- The handler takes an injected clock and repository, so tests run without AWS.
- Request validation happens before the repository is called, so bad input never reaches DynamoDB.
- The Lambda adapter is a thin translation layer; all routing lives in `makeHandler`.

See [ROADMAP.md](ROADMAP.md) for what is planned next.

## License

MIT. See [LICENSE](LICENSE).
