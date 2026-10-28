// Minimal in-memory Firestore for tests.
type Data = Record<string, any>;

export class FakeStore {
  docs = new Map<string, Data>();
  private seq = 0;
  collection(path: string) {
    return new FakeCollection(this, path);
  }
  batch() {
    const ops: Array<() => Promise<void>> = [];
    const b = {
      set: (ref: FakeDoc, d: Data, o?: any) => (ops.push(() => ref.set(d, o)), b),
      update: (ref: FakeDoc, d: Data) => (ops.push(() => ref.update(d)), b),
      delete: (ref: FakeDoc) => (ops.push(() => ref.delete()), b),
      commit: async () => {
        for (const op of ops) await op();
      },
    };
    return b;
  }
  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return fn({
      get: (ref: FakeDoc) => ref.get(),
      set: (ref: FakeDoc, d: Data, o?: any) => ref.set(d, o),
      update: (ref: FakeDoc, d: Data) => ref.update(d),
      delete: (ref: FakeDoc) => ref.delete(),
    });
  }
  nextId() {
    return `auto${++this.seq}`;
  }
}

const clean = (d: Data) => {
  const out: Data = {};
  for (const [k, v] of Object.entries(d)) {
    // FieldValue sentinels become a timestamp-like number in the fake.
    out[k] = v && typeof v === "object" && typeof (v as any).isEqual === "function" ? Date.now() : v;
  }
  return out;
};

export class FakeDoc {
  constructor(
    private store: FakeStore,
    public path: string
  ) {}
  get id() {
    return this.path.split("/").pop()!;
  }
  get ref() {
    return this;
  }
  async get() {
    const d = this.store.docs.get(this.path);
    return { exists: !!d, id: this.id, ref: this, data: () => (d ? { ...d } : undefined) };
  }
  async set(data: Data, opts?: { merge?: boolean }) {
    const prev = opts?.merge ? this.store.docs.get(this.path) ?? {} : {};
    this.store.docs.set(this.path, { ...prev, ...clean(data) });
  }
  async update(data: Data) {
    const prev = this.store.docs.get(this.path);
    if (!prev) throw new Error("missing " + this.path);
    this.store.docs.set(this.path, { ...prev, ...clean(data) });
  }
  async delete() {
    this.store.docs.delete(this.path);
  }
}

class FakeQuery {
  constructor(
    protected store: FakeStore,
    protected path: string,
    protected filters: [string, string, any][] = [],
    protected max?: number,
    protected order?: [string, string]
  ) {}
  where(f: string, op: string, v: any) {
    return new FakeQuery(this.store, this.path, [...this.filters, [f, op, v]], this.max, this.order);
  }
  orderBy(f: string, dir = "asc") {
    return new FakeQuery(this.store, this.path, this.filters, this.max, [f, dir]);
  }
  limit(n: number) {
    return new FakeQuery(this.store, this.path, this.filters, n, this.order);
  }
  async get() {
    const depth = this.path.split("/").length + 1;
    let rows = [...this.store.docs.entries()].filter(
      ([k]) => k.startsWith(this.path + "/") && k.split("/").length === depth
    );
    rows = rows.filter(([, d]) =>
      this.filters.every(([f, op, v]) =>
        op === "==" ? d[f] === v : op === "<=" ? d[f] <= v : op === "array-contains" ? (d[f] || []).includes(v) : true
      )
    );
    if (this.order) {
      const [f, dir] = this.order;
      rows.sort((a, b) => (a[1][f] < b[1][f] ? -1 : 1) * (dir === "desc" ? -1 : 1));
    }
    if (this.max) rows = rows.slice(0, this.max);
    const docs = rows.map(([k, d]) => {
      const ref = new FakeDoc(this.store, k);
      return { id: ref.id, ref, data: () => ({ ...d }), exists: true };
    });
    return { docs, empty: docs.length === 0, size: docs.length };
  }
}

class FakeCollection extends FakeQuery {
  doc(id?: string) {
    return new FakeDoc(this.store, `${this.path}/${id ?? this.store.nextId()}`);
  }
  async add(d: Data) {
    const ref = this.doc();
    await ref.set(d);
    return ref;
  }
}

export function fakeFetch(routes: { method?: string; match: string | RegExp; status?: number; json: any }[]) {
  const calls: { url: string; method: string; body?: any; headers?: any }[] = [];
  const fn = async (url: string, init: any = {}) => {
    const method = init.method ?? "GET";
    let body: any = init.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    } else if (body && typeof body.entries === "function") {
      body = Object.fromEntries(body.entries());
    }
    calls.push({ url, method, body, headers: init.headers });
    const r = routes.find(
      (x) => (!x.method || x.method === method) && (typeof x.match === "string" ? url.includes(x.match) : x.match.test(url))
    );
    if (!r) return { ok: false, status: 404, json: async () => ({}), text: async () => "" } as any;
    const status = r.status ?? 200;
    const json = typeof r.json === "function" ? r.json(url, init) : r.json;
    return { ok: status < 400, status, json: async () => json, text: async () => (json == null ? "" : JSON.stringify(json)) } as any;
  };
  return { fn, calls };
}

export function makeRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.send = (b: any) => ((res.body = b), res);
  res.json = (b: any) => ((res.body = b), res);
  res.set = () => res;
  res.setHeader = () => res;
  res.getHeader = () => undefined;
  res.on = () => res;
  return res;
}
