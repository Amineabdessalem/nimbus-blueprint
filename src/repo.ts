/** Storage port. The Lambda uses DynamoDB; tests and the local load test use memory. */
export interface Item {
  id: string;
  name: string;
  quantity: number;
  createdAt: string;
}

export interface Page {
  items: Item[];
  /** Pass back as `cursor` to get the next page. Absent on the last page. */
  next?: string;
}

export interface ItemRepo {
  get(id: string): Promise<Item | undefined>;
  put(item: Item): Promise<void>;
  delete(id: string): Promise<boolean>;
  /** Returns up to `limit` items, starting after `cursor` when given. */
  list(limit: number, cursor?: string): Promise<Page>;
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

  async list(limit: number, cursor?: string): Promise<Page> {
    // Map keeps insertion order, so the cursor is the id of the last item returned.
    const all = [...this.items.values()];
    const start = cursor === undefined ? 0 : all.findIndex((i) => i.id === cursor) + 1;
    const items = all.slice(start, start + limit);
    const more = start + limit < all.length;
    return more && items.length > 0 ? { items, next: items[items.length - 1]!.id } : { items };
  }
}
