import { create } from "zustand";

export type ToastSeverity = "error" | "warning" | "info" | "success";

export interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
}

interface ToastState {
  toasts: Toast[];
  enqueue: (message: string, severity?: ToastSeverity) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  enqueue: (message, severity = "error") => {
    const duplicate = get().toasts.some(
      (t) => t.message === message && t.severity === severity
    );
    if (duplicate) return;
    const id = `${Date.now()}-${Math.random()}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, severity }] }));
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
