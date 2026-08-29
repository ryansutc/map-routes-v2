import { useToastStore, type ToastSeverity } from "@/store/toastStore";
import { useCallback } from "react";

/**
 * Exposes convenience functions for adding general and error notifications.
 * Used by route editing screens and map-layer error handling.
 */
export function useToast() {
  const enqueue = useToastStore((s) => s.enqueue);

  const enqueueSnackbar = useCallback(
    (message: string, severity?: ToastSeverity) =>
      enqueue(message, severity),
    [enqueue],
  );

  const enqueueError = useCallback(
    (message: string) => enqueue(message, "error"),
    [enqueue],
  );

  return { enqueueSnackbar, enqueueError };
}
