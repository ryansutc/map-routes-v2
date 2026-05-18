import CloseIcon from "@mui/icons-material/Close";
import { Alert, Box, IconButton } from "@mui/material";
import { useToastStore } from "@/store/toastStore";

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        alignItems: "center",
        maxWidth: "90vw",
        width: 480,
      }}
    >
      {toasts.map((toast) => (
        <Alert
          key={toast.id}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%", boxShadow: 4 }}
          action={
            <IconButton
              aria-label="dismiss"
              color="inherit"
              size="small"
              onClick={() => dismiss(toast.id)}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          {toast.message}
        </Alert>
      ))}
    </Box>
  );
}
