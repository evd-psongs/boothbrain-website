export type EventPhase = 'prep' | 'live' | 'post';

export type EventChecklistItem = {
  id: string;
  title: string;
  done: boolean;
  phase: EventPhase;
};

export type EventRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  startDateISO: string;
  endDateISO: string;
  location?: string | null;
  notes?: string | null;
  checklist: EventChecklistItem[];
  createdAt?: string | null;
  updatedAt?: string | null;
};
