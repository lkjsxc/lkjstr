import { describe, expect, it } from 'vitest';
import type { ResolvedReference } from '../../../src/lib/events/reference-resolver';
import {
  planEventReferenceList,
  toggleEventReferenceList,
  toggleEventReferenceListExpanded,
} from '../../../src/lib/components/events/event-reference-list-plan';

describe('event reference list plan', () => {
  it('keeps short reference lists fully visible without a toggle', () => {
    const references = refs(3);
    const plan = planEventReferenceList(references, false);

    expect(plan.visible).toEqual(references);
    expect(plan.canToggle).toBe(false);
    expect(plan.toggleLabel).toBe('Show all references (3)');
  });

  it('collapses long reference lists and labels the expansion action', () => {
    const references = refs(4);
    const plan = planEventReferenceList(references, false);

    expect(plan.visible.map((item) => item.id)).toEqual([
      '0'.repeat(64),
      '1'.repeat(64),
      '2'.repeat(64),
    ]);
    expect(plan.canToggle).toBe(true);
    expect(plan.toggleLabel).toBe('Show all references (4)');
  });

  it('keeps expanded reference lists fully visible', () => {
    const references = refs(4);
    const plan = planEventReferenceList(references, true);

    expect(plan.visible).toEqual(references);
    expect(plan.canToggle).toBe(true);
    expect(plan.toggleLabel).toBe('Hide references');
  });

  it('toggles retained reference expansion state explicitly', () => {
    expect(toggleEventReferenceListExpanded(false)).toBe(true);
    expect(toggleEventReferenceListExpanded(true)).toBe(false);
  });

  it('toggles retained reference expansion without bubbling into the row', () => {
    let stopped = 0;

    expect(
      toggleEventReferenceList(
        { stopPropagation: () => (stopped += 1) },
        false,
      ),
    ).toBe(true);
    expect(stopped).toBe(1);
  });
});

function refs(count: number): ResolvedReference[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: 'quote',
    id: String(index).repeat(64),
  }));
}
