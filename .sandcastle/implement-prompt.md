# TASK

Fix github issue #{{ISSUE_NUMBER}}.

Pull in the issue using `gh issue view`, with comments. If it has a parent PRD or Issue, pull that in too.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits, run tests.

# ISSUE VALIDITY

Before editing, compare the issue and its acceptance criteria with the
current code, tests, and relevant git history. Report what is already
satisfied, what remains, and what cannot yet be verified.

If partially implemented, work only on the remaining gaps. If already
complete, report the evidence without manufacturing changes or a commit.
If outdated, conflicting, or missing requirements that materially affect
the solution, explain why and what clarification is needed, then stop.
Resolve minor ambiguities using repository conventions and state your
assumptions.

Include this assessment in your final response. If stopping without
implementation, also leave it as a comment on the issue.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

# FEEDBACK LOOPS

Before committing:

1. Run tests and ensure pass:
   (for frontend tests, make sure to `cd frontend` first.)

- frontend: `pnpm run typecheck` and `pnpm run test`
- backend: `pipenv run pytest`

2. format code and check code quality for changed files:

- frontend: `pnpm run format` or `pnpm run format:check` and `pnpm run lint` for quality.
- backend: `pipenv run ruff check django_backend` or `pipenv run ruff check --fix django_backend` and `pipenv run ruff format --check django_backend` and `pipenv run ruff format django_backend`.

3. Check builds (frontend)

- If new packages were installed, check build still works and report change in size (before / after) in log output via `pnpm run build`.

# COMMIT

Commit any necessary changes; no commit is required when no changes are needed. The commit message must:

1. Start with `RALPH:` prefix
2. Include task completed + PRD reference or github issue number
3. Key decisions made
4. Files changed
5. Blockers or notes for next iteration

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment on the GitHub issue with what was done.

Do not close the issue - this will be done later.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
