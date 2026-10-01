import { createContext, useContext, useState, type ReactNode } from 'react';
import type { MaterialId, PickupMode } from '@/lib/types';

/** Answers collected across the three "request a pickup" steps. */
export type Draft = {
  materials: MaterialId[];
  otherMaterial: string;
  /** chosen route day (YYYY-MM-DD); empty until the donor picks one */
  routeDate: string;
  mode: PickupMode;
  bags: number;
  instructions: string;
};

type Ctx = {
  draft: Draft;
  update(patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)): void;
  reset(): void;
};

const initial = (): Draft => ({
  materials: [],
  otherMaterial: '',
  routeDate: '',
  mode: 'doorstep',
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
