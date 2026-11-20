import { describe, expect, it } from 'vitest';
import { Draft, parseSnapshot, transition, validateDraft } from './domain';
import { createSeed } from './seed';
const draft: Draft = {
  title: 'Recycled shipping cartons',
  description: 'Recyclable shipping cartons for a fictional warehouse.',
  category: 'Packaging',
  budgetCents: 250000,
  quantity: 500,
  unit: 'units',
};
describe('purchase request rules', () => {
  it('accepts a valid requirement and integer cent amounts', () =>
    expect(validateDraft(draft)).toEqual([]));
  it.each([
    { budgetCents: -1 },
    { budgetCents: 100.5 },
    { quantity: 1.5 },
    { quantity: 0 },
    { title: 'x' },
    { description: 'short' },
    { category: 'Unknown' },
    { unit: 'barrels' },
  ])('rejects invalid input %j', (change) =>
    expect(validateDraft({ ...draft, ...change }).length).toBeGreaterThan(0),
  );
  it('publishes a draft and increments its concurrency version', () => {
    const original = createSeed().requests[3];
    const updated = transition(original, 'publish', original.version);
    expect(updated.status).toBe('Open');
    expect(updated.version).toBe(2);
    expect(original.status).toBe('Draft');
  });
  it('rejects a stale decision after another change', () => {
    const original = createSeed().requests[3];
    const updated = transition(original, 'publish', 1);
    expect(() => transition(updated, 'cancel', 1)).toThrow('changed');
  });
  it('awards only a quote belonging to the open request', () => {
    const r = createSeed().requests[0];
    expect(transition(r, 'award', 1, 1).awardedQuoteId).toBe(1);
    expect(() => transition(r, 'award', 1, 3)).toThrow();
  });
  it('does not allow an award to be cancelled or a published request to publish again', () => {
    const state = createSeed();
    expect(() => transition(state.requests[2], 'cancel', 1)).toThrow();
    expect(() => transition(state.requests[0], 'publish', 1)).toThrow();
  });
});
describe('persistent browser workspace', () => {
  it('round-trips a valid snapshot without changing quote links', () => {
    const seed = createSeed();
    const restored = parseSnapshot(JSON.stringify(seed));
    expect(restored).toEqual(seed);
    expect(restored?.requests[2].awardedQuoteId).toBe(4);
  });
  it.each([null, '', '{broken', '{}', '{"schema":0,"requests":[],"suppliers":[],"activity":[]}'])(
    'discards corrupt or incompatible storage %s',
    (raw) => expect(parseSnapshot(raw)).toBeNull(),
  );
  it('rejects a malformed nested quote rather than crashing the UI later', () => {
    const seed = createSeed();
    const corrupt = JSON.parse(JSON.stringify(seed));
    corrupt.requests[0].quotes[0].amountCents = 'oops';
    expect(parseSnapshot(JSON.stringify(corrupt))).toBeNull();
  });
});
