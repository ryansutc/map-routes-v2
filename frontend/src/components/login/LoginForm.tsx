import {
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import { zodiosAPI } from "@/api/axiosClient";

import { useStore } from "@/state/store";
import { BACKEND_DOMAIN } from "@/utils/environment";
import { useState } from "react";

export default function LoginForm() {
  const setUser = useStore((state) => state.setUser);
  const setPage = useStore((state) => state.setPage);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          return;
        }
        const response = await zodiosAPI.postApiAuthRegisterJwt(
          {
            email,
            password,
            confirm_password: confirmPassword,
          },
          {
            withCredentials: true,
          }
        );
        localStorage.setItem("token", response.token);
        localStorage.setItem("email", response.email);
        setUser(response.email);
        setPage("route");
      } else {
        const response = await zodiosAPI.postApiAuthLoginJwt(
          {
            email,
            password,
          },
          {
            withCredentials: true,
          }
        );
        localStorage.setItem("token", response.token);
        localStorage.setItem("email", response.email);
        setUser(response.email);
        setPage("route");
      }
    } catch (e) {
      console.error("Auth failed:", e);
      setError(isSignUp ? "Registration failed." : "Invalid email or password.");
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Container maxWidth="xs">
        <Paper elevation={6} sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom>
            {isSignUp ? "Sign Up" : "Log In"}
          </Typography>
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
          >
            <TextField
              label="email"
              variant="outlined"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <TextField
              label="Password"
              type="password"
              variant="outlined"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {isSignUp && (
              <TextField
                label="Confirm Password"
                type="password"
                variant="outlined"
                fullWidth
                margin="normal"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            )}
            {error && (
              <Typography color="error" variant="body2" align="center">
                {error}
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              sx={{ mt: 2 }}
            >
              {isSignUp ? "Signup" : "Login"}
            </Button>
            {!isSignUp ? (
              <Typography
                variant="body2"
                align="center"
                sx={{ mt: 2, cursor: "pointer" }}
              >
                Don't have an account?
                <span>
                  <Button onClick={() => setIsSignUp(true)}>
                    Register
                  </Button>
                </span>
              </Typography>
            ) : (
              <Typography
                variant="body2"
                align="center"
                sx={{ mt: 2, cursor: "pointer" }}
              >
                Go back to
                <span>
                  <Button onClick={() => setIsSignUp(false)}>Log In</Button>
                </span>
              </Typography>
            )}
          </form>
        </Paper>
      </Container>
    </Box>
  );
}
