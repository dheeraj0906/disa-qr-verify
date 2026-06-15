import { create } from 'zustand';
import type { Checkpoint, Stretch } from '@/types';

interface TaskState {
  activeCheckpoint: Checkpoint | null;
  activeStretch: Stretch | null;
  scanType: 'start' | 'end' | null;
}

interface TaskActions {
  setActiveScan: (checkpoint: Checkpoint, stretch: Stretch, type: 'start' | 'end') => void;
  clearScan: () => void;
}

export const useTaskStore = create<TaskState & TaskActions>((set) => ({
  activeCheckpoint: null,
  activeStretch: null,
  scanType: null,

  setActiveScan: (checkpoint, stretch, type) =>
    set({ activeCheckpoint: checkpoint, activeStretch: stretch, scanType: type }),

  clearScan: () =>
    set({ activeCheckpoint: null, activeStretch: null, scanType: null }),
}));
