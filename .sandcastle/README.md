This is a configuration of https://github.com/mattpocock/sandcastle

Its used to allow us to run development of big chunks of work AFK.

## Setup

To use here / notes to self:

1. Install codex cli ``https://learn.chatgpt.com/docs/codex/cli` and sign in

2. Create a SPEC and a Plan for a large group of work using the usual `/grill-me-with-docs` and `/to-issues` or the `/wayfinder` skills. Make sure plan is updated to reference github issues if needed.
   (You can also just run this against a single issue)

3. Run this: `npx tsx .sandcastle/main.mts --issue [issue number]`

Each issue uses a stable branch, such as `sandcastle/issue-86`. Sandcastle
derives the phase log filenames from that branch:

- `.sandcastle/logs/sandcastle-issue-86-implementer.log`
- `.sandcastle/logs/sandcastle-issue-86-reviewer.log`

Running the same issue again reuses its branch and managed worktree.
