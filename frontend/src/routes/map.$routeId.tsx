import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/map/$routeId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/routes/$routeId",
      params: { routeId: params.routeId },
      replace: true,
    });
  },
});
