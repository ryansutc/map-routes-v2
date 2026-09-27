import {
  AppBar,
  Avatar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { MouseEvent, PropsWithChildren } from "react";
import { useState } from "react";

import { zodiosAPI } from "@/api/axiosClient";
import {
  clearClientAuthentication,
  isUnauthorizedError,
} from "@/auth/clientSession";
import { useStore } from "@/state/store";
import { GOOGLE_LOGIN_URL } from "@/utils/environment";
import {
  SettingsDialogProvider,
  useSettingsDialog,
} from "@/components/settings/SettingsDialog";

function AppShellContent({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Subscribe field-by-field so unrelated application updates stay local.
  const user = useStore((s) => s.user);
  const userIsAuthenticated = useStore((s) => s.userIsAuthenticated);
  const { openSettings } = useSettingsDialog();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const menuOpen = Boolean(menuAnchor);

  const handleAvatarClick = (e: MouseEvent<HTMLElement>) => {
    setMenuAnchor(e.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleSignOut = async () => {
    handleMenuClose();
    setSignOutError(null);
    try {
      await zodiosAPI.auth_logout_create(undefined);
    } catch (e) {
      if (!isUnauthorizedError(e)) {
        console.error("Sign-out request failed:", e);
        setSignOutError("Sign-out failed. Please try again.");
        return;
      }
    }
    clearClientAuthentication();
    queryClient.invalidateQueries();
    void navigate({ to: "/routes" });
  };

  const avatarLetter = (user ?? "?").charAt(0).toUpperCase();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        "@supports (height: 100dvh)": {
          height: "100dvh",
        },
        overflow: "hidden",
      }}
    >
      <AppBar position="sticky" color="primary" enableColorOnDark>
        <Toolbar>
          <Typography
            variant="h6"
            component={Link}
            to="/routes"
            sx={{
              mr: "auto",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            map-routes
          </Typography>

          <Tooltip title="Settings">
            <IconButton
              color="inherit"
              aria-label="Open settings"
              onClick={() => openSettings("general")}
              sx={{ mr: 1 }}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          {userIsAuthenticated ? (
            <>
              <Tooltip title={user ?? "Account"}>
                <IconButton
                  onClick={handleAvatarClick}
                  size="small"
                  aria-label="Open account menu"
                  aria-controls={menuOpen ? "account-menu" : undefined}
                  aria-haspopup="true"
                  aria-expanded={menuOpen ? "true" : undefined}
                  sx={{ ml: 1 }}
                >
                  <Avatar sx={{ width: 32, height: 32 }}>{avatarLetter}</Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                id="account-menu"
                anchorEl={menuAnchor}
                open={menuOpen}
                onClose={handleMenuClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                <MenuItem onClick={() => void handleSignOut()}>
                  Sign out
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              color="inherit"
              variant="outlined"
              href={GOOGLE_LOGIN_URL}
              sx={{ textTransform: "none" }}
            >
              Sign in
            </Button>
          )}
        </Toolbar>
      </AppBar>
      {signOutError && (
        <Box
          role="alert"
          sx={{
            bgcolor: "error.main",
            color: "error.contrastText",
            px: 2,
            py: 1,
          }}
        >
          {signOutError}
        </Box>
      )}
      <Box
        component="main"
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", maxHeight: "98%" }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <SettingsDialogProvider>
      <AppShellContent>{children}</AppShellContent>
    </SettingsDialogProvider>
  );
}
