import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { Item, ItemRepo, Page } from "./repo.js";

/** DynamoDB adapter. The table has a partition key id and is billed on demand. */
export class DynamoItemRepo implements ItemRepo {
  private readonly doc: DynamoDBDocumentClient;

  constructor(private readonly table: string, client?: DynamoDBClient) {
    this.doc = DynamoDBDocumentClient.from(client ?? new DynamoDBClient({}));
  }

  async get(id: string) {
    const out = await this.doc.send(new GetCommand({ TableName: this.table, Key: { id } }));
    return out.Item as Item | undefined;
  }

  async put(item: Item) {
    await this.doc.send(new PutCommand({ TableName: this.table, Item: item }));
  }

  async delete(id: string) {
    const out = await this.doc.send(
      new DeleteCommand({ TableName: this.table, Key: { id }, ReturnValues: "ALL_OLD" }),
    );
    return out.Attributes !== undefined;
  }

  async list(limit: number, cursor?: string): Promise<Page> {
    // A scan is fine for a demo table. A production list would page with a GSI.
    const out = await this.doc.send(
      new ScanCommand({
        TableName: this.table,
        Limit: limit,
        ExclusiveStartKey: cursor === undefined ? undefined : { id: cursor },
      }),
    );
    const items = (out.Items ?? []) as Item[];
    const last = out.LastEvaluatedKey?.id;
    return typeof last === "string" ? { items, next: last } : { items };
  }
}
