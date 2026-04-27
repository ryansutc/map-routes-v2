import { Box, Button, Typography } from "@mui/material";
import { createFileRoute, Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <Box sx={{ p: 6, textAlign: "center" }}>
      <Typography variant="h3" gutterBottom>
        404
      </Typography>
      <Typography variant="h6" color="text.secondary" gutterBottom>
        We couldn't find the page you were looking for.
      </Typography>
      <Button component={Link} to="/routes" variant="contained" sx={{ mt: 2 }}>
        Back to routes
      </Button>
    </Box>
  );
}

export const Route = createFileRoute("/__not-found")({
  component: NotFound,
});
