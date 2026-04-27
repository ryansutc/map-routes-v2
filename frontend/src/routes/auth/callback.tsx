import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useStore } from '@/state/store';
import { CircularProgress, Box } from '@mui/material';

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
});

function AuthCallback() {
  const { setUser, setUserIsAuthenticated } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const email = params.get('email');

    if (token && email) {
      localStorage.setItem('token', token);
      localStorage.setItem('email', email);
      setUser(email);
      setUserIsAuthenticated(true);
      history.replaceState(null, '', window.location.pathname);
    }
    void navigate({ to: '/routes' });
  }, [setUser, setUserIsAuthenticated, navigate]);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress />
    </Box>
  );
}
