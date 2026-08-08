import { codex, run } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

// /matt-pococks-projects/sandcastle
await run({
  agent: codex("gpt-5.6-sol"),
  sandbox: docker({
    mounts: [
      {
        hostPath: "~/.codex/auth.json",
        sandboxPath: "/home/agent/.codex/auth.json",
      },
    ],
  }),

  prompt: "Hello, how are you?",
});
