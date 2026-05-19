import { useState } from "react";
import type { MouseEvent, PropsWithChildren } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { zodiosAPI } from "@/api/axiosClient";
import { useStore } from "@/state/store";
import { GOOGLE_LOGIN_URL } from "@/utils/environment";

const TOGGLE_BORDER_COLOR = "rgba(255,255,255,0.5)";

export default function AppShell({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, userIsAuthenticated, setUser, setUserIsAuthenticated, units, setUnits } =
    useStore();

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
      console.error("Sign-out request failed:", e);
      setSignOutError("Sign-out failed. Please try again.");
      return;
    }
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    setUser(null);
    setUserIsAuthenticated(false);
    queryClient.invalidateQueries();
    void navigate({ to: "/routes" });
  };

  const avatarLetter = (user ?? "?").charAt(0).toUpperCase();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="sticky" color="primary" enableColorOnDark>
        <Toolbar>
          <Typography
            variant="h6"
            component={Link}
            to="/routes"
            sx={{
              flexGrow: 1,
              color: "inherit",
              textDecoration: "none",
            }}
          >
            map-routes
          </Typography>

          <ToggleButtonGroup
            value={units}
            exclusive
            onChange={(_, v) => { if (v) setUnits(v); }}
            size="small"
            sx={{ mr: 1 }}
          >
            <Tooltip title={units === "metric" ? "" : "Switch to metric (km)"}>
              <ToggleButton value="metric" sx={{ color: "inherit", borderColor: TOGGLE_BORDER_COLOR }}>km</ToggleButton>
            </Tooltip>
            <Tooltip title={units === "imperial" ? "" : "Switch to imperial (mi)"}>
              <ToggleButton value="imperial" sx={{ color: "inherit", borderColor: TOGGLE_BORDER_COLOR }}>mi</ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>

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
              Sign in with Google
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
      <Box component="main" sx={{ flexGrow: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
