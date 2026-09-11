# Release process

Releases are crate-first and use release-plz with crates.io Trusted Publishing. No long-lived crates.io token belongs in repository or environment secrets.

1. Publish the pinned `lenso-capability-projects`, `lenso-capability-projects-collaboration`, and `lenso-capability-projects-admin` versions first. The pinned Organization Directory and Membership Admin versions must also exist. CI verifies both the package source set and a full `cargo package --locked` build using registry dependencies.
2. Merge only after CI, repository-boundary, and public-package checks pass.
3. Let the `release-plz-pr` job prepare the version PR.
4. Merge the version PR.
5. In crates.io, configure a Trusted Publisher for repository `LioRael/lenso-projects-web-plugin`, workflow `release-plz.yml`, environment `release`.
6. Protect the GitHub `release` environment and require the intended reviewers.
7. Run the Release-plz workflow on `main` with `live=true` and `confirm=publish`.
8. Verify the crate version and immutable Git tag `lenso-projects-web-plugin@<version>`.

The workflow grants `id-token: write` only to the confirmed live release job. Its dry-run and release-PR jobs cannot publish.
