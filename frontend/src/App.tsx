import MainWrapper from "@/components/main/MainWrapper";
import { ToastContainer } from "@/components/layout/ToastContainer";

import theme from "@/utils/muitheme";
import { Container, ThemeProvider } from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import "./App.css";
import { routeTree } from "./routeTree.gen";

// Declare global window property for initial path
declare global {
  interface Window {
    __INITIAL_PATH__?: string;
  }
}

// react-query tanstack query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 10 * 60 * 1000,
      staleTime: 5 * 60 * 1000,
    },
  },
});

// Create a new TanStack Router instance
const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  useEffect(() => {
    // In production, navigate to the initial path from the server
    if (
      import.meta.env.PROD &&
      window.__INITIAL_PATH__ &&
      window.__INITIAL_PATH__ !== "/"
    ) {
      router.navigate({ to: window.__INITIAL_PATH__ });
    }
  }, []);

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Container
            id="appContainer"
            component="main"
            maxWidth={false}
            disableGutters
            sx={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
            }}
          >
            <MainWrapper>
              <RouterProvider router={router} />
            </MainWrapper>
          </Container>
        </ThemeProvider>
        <ToastContainer />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </>
  );
}

export default App;
