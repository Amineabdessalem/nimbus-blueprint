/** Storage port. The Lambda uses DynamoDB; tests and the local load test use memory. */
export interface Item {
  id: string;
  name: string;
  quantity: number;
  createdAt: string;
}

export interface ItemRepo {
  get(id: string): Promise<Item | undefined>;
  put(item: Item): Promise<void>;
  delete(id: string): Promise<boolean>;
  list(limit: number): Promise<Item[]>;
}

export class MemoryRepo implements ItemRepo {
  private readonly items = new Map<string, Item>();

  async get(id: string) {
    return this.items.get(id);
  }

  async put(item: Item) {
    this.items.set(item.id, item);
  }

  async delete(id: string) {
    return this.items.delete(id);
  }

  async list(limit: number) {
    return [...this.items.values()].slice(0, limit);
  }
}
