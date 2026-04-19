import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/__init__')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/auth/__init__"!</div>
}
