import { useState } from "react";

import { zodiosAPI } from "@/api/axiosClient";
import useWidth from "@/hooks/useWidth";
import { useStore } from "@/state/store";
import { GOOGLE_LOGIN_URL } from "@/utils/environment";
import { Button, CircularProgress, Fade, styled } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import LogoutDialog from "./LogoutDialog";
import RouteButton from "./RouteButton";

const StyledButton = styled(Button)(() => ({
  textTransform: "none",
}));

export default function NavBarMenu() {
  // page state
  const { page, user, setPage, setUser } = useStore();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const backendLoginUrl = GOOGLE_LOGIN_URL;

  const queryClient = useQueryClient();

  const performLogout = async () => {
    try {
      setIsLoggingOut(true);
      // Clear cart items for the current user
      localStorage.clear();
      // Clear the JWT token
      await zodiosAPI.postApiAuthLogout();

      // Invalidate all our API data:

      queryClient.invalidateQueries();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setTimeout(() => setIsLoggingOut(false), 500);
    }
    setPage("login");

    setUser(null);
  };

  const handleConfirmLogout = () => {
    setShowLogoutDialog(false);
    void performLogout();
  };

  const handleCancelLogout = () => {
    setShowLogoutDialog(false);
  };
  const width = useWidth();
  return (
    <>
      {width <= 560 && <RouteButton />}

      <Fade in timeout={300}>
        <StyledButton
          variant="text"
          color="primary"
          sx={{
            color: page === "login" ? "primary.main" : "primary.dark",
          }}
          href={backendLoginUrl}
          title={user ? user : "Login to view/edit your own routes!"}
        >
          {isLoggingOut ? (
            <CircularProgress size={24} color="inherit" />
          ) : user ? (
            "Logout"
          ) : (
            "Login"
          )}
        </StyledButton>
      </Fade>

      <LogoutDialog
        open={showLogoutDialog}
        onConfirm={handleConfirmLogout}
        onCancel={handleCancelLogout}
      />
    </>
  );
}
