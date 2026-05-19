import { useToastStore, type ToastSeverity } from "@/store/toastStore";

export function useToast() {
  const enqueue = useToastStore((s) => s.enqueue);

  const enqueueSnackbar = (message: string, severity?: ToastSeverity) =>
    enqueue(message, severity);

  const enqueueError = (message: string) => enqueue(message, "error");

  return { enqueueSnackbar, enqueueError };
}
