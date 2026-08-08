# Coding Standards

<!-- Customize this file with your project's coding standards.
     The reviewer agent loads it during code review via @.sandcastle/CODING_STANDARDS.md
     so these standards are enforced during review without costing tokens during implementation. -->

### Frontend / React

- Use a single exportable React functional Component per file.
- Unless clear benefit, prefer keeping frontend state in Zustand over using the Provider pattern. Zustand state shows in Redux DEV tools which provides better observability.
- see @frontend/MUI.md for guidance on MUI component usage

### Backend / Python Django

- add short comments to code functions
- use type annotations
