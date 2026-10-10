# Coding Standards

<!-- Customize this file with your project's coding standards.
     The reviewer agent loads it during code review via @.sandcastle/CODING_STANDARDS.md
     so these standards are enforced during review without costing tokens during implementation. -->

### Frontend / React

- Use a single exportable React functional Component per file.
- Unless clear benefit, prefer keeping frontend state in Zustand over using the Provider pattern. Zustand state shows in Redux DEV tools which provides better observability.
- see @frontend/MUI.md for guidance on MUI component usage

#### Comments

- Add brief jsdoc style comments for functions and for react components where purpose is not readily clear and/or function is a shared exported function that resides in a root level utils folder-- meaning its intended to be used across app. Also note, when helpful, where a function is used. Especially if it is in the root util folder but only currently used in one or two specific places.

### Backend / Python Django

- add short comments to code functions
- use type annotations
