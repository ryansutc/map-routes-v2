import { AppBar, Box, Toolbar, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";

/**
 * AppShell — top-chrome wrapper for the app.
 *
 * Phase 0 stub: intentionally not wired into __root.tsx yet.
 * Phase 2 will mount this around <Outlet /> and add the Google
 * sign-in / avatar menu on the right side of the AppBar.
 */
export default function AppShell({ children }: PropsWithChildren) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="sticky" color="primary" enableColorOnDark>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            map-routes
          </Typography>
          {/* Phase 2: Google sign-in button / authed avatar menu mount here. */}
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
