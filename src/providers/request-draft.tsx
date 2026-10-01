import { createContext, useContext, useState, type ReactNode } from 'react';
import { toIsoDate } from '@/lib/format';
import type { MaterialId, TimeWindow } from '@/lib/types';

/** Answers collected across the three "request a pickup" steps. */
export type Draft = {
  materials: MaterialId[];
  otherMaterial: string;
  date: string;
  window: TimeWindow;
  bags: number;
  instructions: string;
};

type Ctx = {
  draft: Draft;
  update(patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)): void;
  reset(): void;
};

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toIsoDate(d);
}

const initial = (): Draft => ({
  materials: [],
  otherMaterial: '',
  date: tomorrow(),
  window: 'morning',
  bags: 2,
  instructions: '',
});

const DraftContext = createContext<Ctx | null>(null);

export function RequestDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(initial);
  return (
    <DraftContext.Provider
      value={{
        draft,
        update: (patch) => setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) })),
        reset: () => setDraft(initial()),
      }}
    >
      {children}
    </DraftContext.Provider>
  );
}

export function useRequestDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useRequestDraft must be used inside RequestDraftProvider');
  return ctx;
}
