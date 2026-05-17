import { createFileRoute, redirect } from "@tanstack/react-router";
import { useStore } from "@/state/store";
import { GOOGLE_LOGIN_URL } from "@/utils/environment";
import CreateRouteWizard from "@/components/routes/CreateRouteWizard";

export const Route = createFileRoute("/routes/new")({
  beforeLoad: () => {
    const { userIsAuthenticated } = useStore.getState();
    if (userIsAuthenticated === false) {
      throw redirect({ href: GOOGLE_LOGIN_URL });
    }
  },
  component: CreateRouteWizard,
});
