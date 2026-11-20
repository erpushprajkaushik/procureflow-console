export type Status = 'Draft' | 'Open' | 'Awarded' | 'Cancelled';
export const categories = ['Packaging', 'Equipment', 'Ingredients', 'Logistics'] as const;
export const units = ['units', 'kg', 'sets', 'shipments'] as const;
export interface Quote {
  id: number;
  supplierId: number;
  supplierName: string;
  supplierRating: number;
  amountCents: number;
  leadTimeDays: number;
  note: string;
  createdAtUtc: string;
}
export interface RequestItem {
  id: number;
  reference: string;
  title: string;
  category: string;
  description: string;
  budgetCents: number;
  quantity: number;
  unit: string;
  status: Status;
  quoteCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
  version: number;
  awardedQuoteId: number | null;
  quotes: Quote[];
}
export interface Supplier {
  id: number;
  name: string;
  category: string;
  location: string;
  rating: number;
  completedOrders: number;
}
export interface Activity {
  id: number;
  requestId: number;
  action: string;
  actor: string;
  detail: string;
  createdAtUtc: string;
}
export interface Snapshot {
  schema: 1;
  requests: RequestItem[];
  suppliers: Supplier[];
  activity: Activity[];
}
export interface Draft {
  title: string;
  category: string;
  description: string;
  budgetCents: number;
  quantity: number;
  unit: string;
}
export function validateDraft(d: Draft): string[] {
  const errors: string[] = [];
  if (d.title.trim().length < 3 || d.title.trim().length > 100)
    errors.push('Use a title of 3–100 characters.');
  if (d.description.trim().length < 20 || d.description.trim().length > 1500)
    errors.push('Describe the requirement in 20–1,500 characters.');
  if (!categories.some((x) => x === d.category)) errors.push('Choose a supported category.');
  if (!units.some((x) => x === d.unit)) errors.push('Choose a supported unit.');
  if (!Number.isSafeInteger(d.budgetCents) || d.budgetCents < 100 || d.budgetCents > 100000000)
    errors.push('Budget must be between $1 and $1,000,000.');
  if (!Number.isSafeInteger(d.quantity) || d.quantity < 1 || d.quantity > 1000000)
    errors.push('Quantity must be a whole number between 1 and 1,000,000.');
  return errors;
}
export function transition(
  r: RequestItem,
  action: 'publish' | 'cancel' | 'award',
  version: number,
  quoteId?: number,
): RequestItem {
  if (r.version !== version) throw new Error('This request changed. Reopen it and try again.');
  if (action === 'publish' && r.status !== 'Draft')
    throw new Error('Only a draft can be published.');
  if (action === 'cancel' && !['Draft', 'Open'].includes(r.status))
    throw new Error('Only draft or open requests can be cancelled.');
  if (action === 'award' && (r.status !== 'Open' || !r.quotes.some((q) => q.id === quoteId)))
    throw new Error('Choose a quote on an open request.');
  return {
    ...r,
    status: action === 'publish' ? 'Open' : action === 'award' ? 'Awarded' : 'Cancelled',
    version: r.version + 1,
    updatedAtUtc: new Date().toISOString(),
    awardedQuoteId: action === 'award' ? quoteId! : r.awardedQuoteId,
  };
}
/** Browser storage is untrusted; corrupt or old snapshots are discarded. */
export function parseSnapshot(raw: string | null): Snapshot | null {
  if (!raw || raw.length > 2000000) return null;
  try {
    const v = JSON.parse(raw) as Snapshot;
    const n = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
    const s = (x: unknown) => typeof x === 'string';
    if (
      !v ||
      v.schema !== 1 ||
      !Array.isArray(v.requests) ||
      !Array.isArray(v.suppliers) ||
      !Array.isArray(v.activity)
    )
      return null;
    if (
      !v.requests.every(
        (r) =>
          r &&
          n(r.id) &&
          s(r.title) &&
          s(r.reference) &&
          s(r.description) &&
          s(r.category) &&
          s(r.unit) &&
          ['Draft', 'Open', 'Awarded', 'Cancelled'].includes(r.status) &&
          n(r.budgetCents) &&
          n(r.quantity) &&
          n(r.version) &&
          n(r.quoteCount) &&
          s(r.createdAtUtc) &&
          s(r.updatedAtUtc) &&
          Array.isArray(r.quotes) &&
          r.quotes.every(
            (q) =>
              q &&
              n(q.id) &&
              n(q.supplierId) &&
              s(q.supplierName) &&
              n(q.supplierRating) &&
              n(q.amountCents) &&
              n(q.leadTimeDays) &&
              s(q.note) &&
              s(q.createdAtUtc),
          ),
      )
    )
      return null;
    if (
      !v.suppliers.every(
        (x) =>
          x &&
          n(x.id) &&
          s(x.name) &&
          s(x.category) &&
          s(x.location) &&
          n(x.rating) &&
          n(x.completedOrders),
      )
    )
      return null;
    if (
      !v.activity.every(
        (x) =>
          x &&
          n(x.id) &&
          n(x.requestId) &&
          s(x.action) &&
          s(x.actor) &&
          s(x.detail) &&
          s(x.createdAtUtc),
      )
    )
      return null;
    return v;
  } catch {
    return null;
  }
}
