import { computed, Injectable, signal } from '@angular/core';
import {
  Activity,
  Draft,
  RequestItem,
  Snapshot,
  Supplier,
  parseSnapshot,
  transition,
  validateDraft,
} from './domain';
import { createSeed } from './seed';
const KEY = 'procureflow.workspace.v1';
const API = 'http://localhost:5175/api';
@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  readonly state = signal<Snapshot>(this.read());
  readonly mode = signal<'browser' | 'api'>('browser');
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly error = signal('');
  private token = '';
  readonly metrics = computed(() => {
    const rows = this.state().requests;
    return {
      open: rows.filter((r) => r.status === 'Open').length,
      budget: rows.reduce((n, r) => n + r.budgetCents, 0),
      quotes: rows.reduce((n, r) => n + r.quotes.length, 0),
      awarded: rows.filter((r) => r.status === 'Awarded').length,
    };
  });
  private read(): Snapshot {
    try {
      return parseSnapshot(localStorage.getItem(KEY)) ?? createSeed();
    } catch {
      return createSeed();
    }
  }
  private save(snapshot: Snapshot): void {
    this.state.set(snapshot);
    if (this.mode() === 'browser') {
      try {
        localStorage.setItem(KEY, JSON.stringify(snapshot));
      } catch {
        this.notice.set('Storage unavailable. Changes will last for this session.');
      }
    }
  }
  private audit(requestId: number, action: string, detail: string): Activity {
    return {
      id: Date.now(),
      requestId,
      action,
      detail,
      actor: 'Demo buyer',
      createdAtUtc: new Date().toISOString(),
    };
  }
  private async api<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${API}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      throw new Error(
        problem.detail ||
          (problem.errors
            ? Object.values(problem.errors).flat().join(' ')
            : `API returned ${response.status}.`),
      );
    }
    return response.status === 204 ? (undefined as T) : response.json();
  }
  private async reload(): Promise<void> {
    const [page, suppliers, activity] = await Promise.all([
      this.api<{ items: RequestItem[]; total: number }>('/requests?pageSize=100'),
      this.api<Supplier[]>('/suppliers'),
      this.api<Activity[]>('/activity'),
    ]);
    if (page.total > 100)
      throw new Error(
        'This console supports up to 100 requests. Use API pagination for larger datasets.',
      );
    const requests = await Promise.all(
      page.items.map(async (r) => {
        const detail = await this.api<{ request: RequestItem; quotes: RequestItem['quotes'] }>(
          `/requests/${r.id}`,
        );
        return { ...detail.request, quotes: detail.quotes };
      }),
    );
    this.state.set({ schema: 1, requests, suppliers, activity });
  }
  async connect(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    const before = this.state();
    try {
      const response = await fetch(`${API}/demo/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'buyer' }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Demo token endpoint unavailable.');
      this.token = (await response.json()).accessToken;
      await this.reload();
      this.mode.set('api');
      this.notice.set('Connected to your local .NET API. Changes now persist in SQLite.');
    } catch {
      this.token = '';
      this.state.set(before);
      this.error.set(
        'Could not connect. Start procureflow-api on http://localhost:5175 in Development mode.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  useBrowser(): void {
    this.token = '';
    this.mode.set('browser');
    this.state.set(this.read());
    this.error.set('');
    this.notice.set('Browser demo restored.');
  }
  reset(): void {
    if (this.mode() !== 'browser' || this.busy()) return;
    this.save(createSeed());
    this.notice.set('Sample data reset.');
    this.error.set('');
  }
  async create(draft: Draft): Promise<boolean> {
    const errors = validateDraft(draft);
    if (errors.length) {
      this.error.set(errors.join(' '));
      return false;
    }
    return this.run(async () => {
      if (this.mode() === 'api') {
        await this.api('/requests', draft);
        await this.reload();
      } else {
        const state = this.state();
        const id = Math.max(0, ...state.requests.map((r) => r.id)) + 1;
        const now = new Date().toISOString();
        const request: RequestItem = {
          ...draft,
          title: draft.title.trim(),
          description: draft.description.trim(),
          id,
          reference: `RFQ-${new Date().getFullYear()}-${1040 + id}`,
          status: 'Draft',
          quoteCount: 0,
          createdAtUtc: now,
          updatedAtUtc: now,
          version: 1,
          awardedQuoteId: null,
          quotes: [],
        };
        this.save({
          ...state,
          requests: [request, ...state.requests],
          activity: [
            this.audit(id, 'Request created', `${request.title} saved as a draft.`),
            ...state.activity,
          ],
        });
      }
      this.notice.set('Request saved as a draft. Open it to publish.');
    });
  }
  async act(
    request: RequestItem,
    action: 'publish' | 'cancel' | 'award',
    quoteId?: number,
  ): Promise<boolean> {
    return this.run(async () => {
      if (this.mode() === 'api') {
        await this.api(`/requests/${request.id}/${action}`, { version: request.version, quoteId });
        await this.reload();
      } else {
        const state = this.state();
        const current = state.requests.find((r) => r.id === request.id);
        if (!current) throw new Error('Request no longer exists.');
        const updated = transition(current, action, request.version, quoteId);
        this.save({
          ...state,
          requests: state.requests.map((r) => (r.id === request.id ? updated : r)),
          activity: [
            this.audit(
              request.id,
              `Request ${action === 'award' ? 'awarded' : action === 'publish' ? 'published' : 'cancelled'}`,
              request.title,
            ),
            ...state.activity,
          ],
        });
      }
      this.notice.set(
        action === 'award'
          ? 'Supplier selected. The request is now awarded.'
          : action === 'publish'
            ? 'Request published and open for quotes.'
            : 'Request cancelled.',
      );
    });
  }
  private async run(work: () => Promise<void>): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await work();
      return true;
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
