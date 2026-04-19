import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  // TODO add content to me
  return <div className="p-2">Hello from About!</div>;
}
