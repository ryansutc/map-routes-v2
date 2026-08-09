import { useToastStore, type ToastSeverity } from "@/store/toastStore";

/**
 * Exposes convenience functions for adding general and error notifications.
 * Used by route editing screens and map-layer error handling.
 */
export function useToast() {
  const enqueue = useToastStore((s) => s.enqueue);

  const enqueueSnackbar = (message: string, severity?: ToastSeverity) =>
    enqueue(message, severity);

  const enqueueError = (message: string) => enqueue(message, "error");

  return { enqueueSnackbar, enqueueError };
}
