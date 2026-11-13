# Roadmap

- [x] Framework-free request handler with routing and validation
- [x] In-memory repository and unit tests for the handler
- [x] Monthly cost model with scenario output
- [x] In-process load test
- [ ] Validate `infra/main.tf` with `terraform fmt -check` and `terraform validate` in CI
- [ ] Replace placeholder prices with a dated price table per region
- [ ] Measure cold start and end-to-end latency against a deployed stack, and record the numbers
- [ ] Add pagination to `GET /items`
- [ ] Add a conditional write for `POST /items` to reject duplicate ids
