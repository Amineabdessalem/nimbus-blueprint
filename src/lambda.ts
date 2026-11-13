import { makeHandler, type ApiEvent } from "./api.js";
import { DynamoItemRepo } from "./dynamo.js";

// Built once per Lambda container, so warm invocations reuse the client.
const handler = makeHandler(new DynamoItemRepo(process.env.TABLE_NAME ?? "items"));

export async function lambdaHandler(event: ApiEvent) {
  return handler(event);
}
