# Projects Web agent instructions

## UI changes

Before creating a page, changing controls/layout, or fixing visual details, read the Lenso Console checkout's `docs/design/README.md` and follow its linked component and geometry standards. Locate the active Console checkout among sibling repositories/worktrees; do not assume this repository's parent is the workspace root. The canonical repository is https://github.com/LioRael/lenso-console (path `docs/design/README.md`). If the standard is unavailable, report that limitation rather than inventing a replacement standard.

The Console standard is shared by this plugin; keep product-specific examples and verification here, and update the shared standard at its owner rather than copying it. Inspect installed `@lenso/ui` APIs before implementing controls. Scope plugin styles and verify the real Console integration in addition to standalone fixtures.
