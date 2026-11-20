import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { WorkspaceStore } from '../core/workspace-store';
import { RequestItem, categories, units } from '../core/domain';
@Component({
  selector: 'app-workspace',
  imports: [FormsModule, RouterLink, RouterLinkActive, CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
})
export class Workspace {
  private readonly document = inject(DOCUMENT);
  private returnFocus: HTMLElement | null = null;
  readonly store = inject(WorkspaceStore);
  readonly route = toSignal(inject(ActivatedRoute).data);
  readonly view = computed(() => this.route()?.['view'] ?? 'overview');
  readonly search = signal('');
  readonly status = signal('All');
  readonly selectedId = signal<number | null>(null);
  readonly selected = computed(() =>
    this.store.state().requests.find((r) => r.id === this.selectedId()),
  );
  readonly modal = signal(false);
  readonly categories = categories;
  readonly units = units;
  readonly rows = computed(() =>
    this.store
      .state()
      .requests.filter(
        (r) =>
          (this.status() === 'All' || r.status === this.status()) &&
          `${r.title} ${r.reference} ${r.category}`
            .toLowerCase()
            .includes(this.search().trim().toLowerCase()),
      ),
  );
  readonly suppliers = computed(() =>
    this.store
      .state()
      .suppliers.filter((s) =>
        `${s.name} ${s.category} ${s.location}`
          .toLowerCase()
          .includes(this.search().trim().toLowerCase()),
      ),
  );
  readonly statuses = ['All', 'Open', 'Draft', 'Awarded', 'Cancelled'];
  draft = this.emptyDraft();
  get title(): string {
    return (
      {
        overview: 'Workspace overview',
        requests: 'Purchase requests',
        suppliers: 'Supplier directory',
        activity: 'Workspace activity',
      } as Record<string, string>
    )[this.view()];
  }
  get subtitle(): string {
    return (
      {
        overview: 'A clear view of what your business needs next.',
        requests: 'Create requirements, compare quotes and choose suppliers.',
        suppliers: 'Your fictional supply network, all in one place.',
        activity: 'Follow every decision, from draft to award.',
      } as Record<string, string>
    )[this.view()];
  }
  emptyDraft() {
    return {
      title: '',
      category: 'Packaging',
      description: '',
      budget: null as number | null,
      quantity: 1,
      unit: 'units',
    };
  }
  openCreate(): void {
    this.returnFocus = this.document.activeElement as HTMLElement;
    this.draft = this.emptyDraft();
    this.store.error.set('');
    this.modal.set(true);
    setTimeout(() => this.document.querySelector<HTMLInputElement>('input[name="title"]')?.focus());
  }
  openRequest(id: number): void {
    this.returnFocus = this.document.activeElement as HTMLElement;
    this.selectedId.set(id);
    setTimeout(() =>
      this.document
        .querySelector<HTMLButtonElement>('[aria-label="Close request details"]')
        ?.focus(),
    );
  }
  @HostListener('document:keydown', ['$event']) trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || (!this.modal() && !this.selected())) return;
    const dialog = this.document.querySelector('[role="dialog"]');
    const controls = Array.from(
      dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, select, textarea, a[href]',
      ) ?? [],
    );
    const first = controls[0],
      last = controls[controls.length - 1];
    if (!first || !last) return;
    const active = this.document.activeElement;
    if (event.shiftKey && (active === first || !dialog?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog?.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }
  @HostListener('document:keydown.escape') close(): void {
    if (!this.store.busy()) {
      this.modal.set(false);
      this.selectedId.set(null);
      this.returnFocus?.focus();
    }
  }
  async save(): Promise<void> {
    if (
      await this.store.create({
        title: this.draft.title,
        category: this.draft.category,
        description: this.draft.description,
        budgetCents: Math.round((this.draft.budget ?? 0) * 100),
        quantity: this.draft.quantity,
        unit: this.draft.unit,
      })
    )
      this.modal.set(false);
  }
  async action(
    r: RequestItem,
    kind: 'publish' | 'cancel' | 'award',
    quoteId?: number,
  ): Promise<void> {
    await this.store.act(r, kind, quoteId);
  }
  clear(): void {
    this.search.set('');
    this.status.set('All');
  }
}
