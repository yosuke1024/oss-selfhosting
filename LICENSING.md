# Licensing

Copyright (c) 2026 Yosuke Suzuki.

This repository mixes four kinds of material with four different answers. The
boundary below is the authoritative one; a single `LICENSE` file at the root
would be misleading on its own.

## 1. Code — Apache License 2.0

`scripts/`, `schemas/`, `.github/`, and any Dockerfile, platform configuration
or build file maintained by this repository (including those under
`deployments/`) are licensed under the Apache License 2.0. The full text is in
[`LICENSE`](LICENSE); the attribution notice is in [`NOTICE`](NOTICE).

SPDX identifier: `Apache-2.0`.

This covers the catalog contract and its validator specifically, so that other
projects can consume the same schema and the same validation rather than
reimplementing it.

## 2. Catalog and verification records — CC BY 4.0

`catalog/`, `deployments/` (the prose guides), `notes/` and `checks/` — the
product records, use-case bundles, deployment guides, verification results and
deployment notes written for this repository — are licensed under the
[Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

SPDX identifier: `CC-BY-4.0`.

You may copy, redistribute, adapt and build upon this material, including
commercially, provided you give appropriate credit to JuryPress, link to the
license, and indicate whether changes were made. Attribution must not be stated
in a way that suggests JuryPress endorses you or your use.

Two limits follow from the material itself rather than from the license:

- A verification record describes **one** deployment, of **one** version, at
  **one** point in time, by the person named on it. Reusing the record does not
  transfer that verification to a different version or a different setup, and
  re-publishing an old record as a current claim misrepresents it.
- The records carry no warranty. Self-hosting anything listed here is done at
  your own risk and on your own infrastructure account.

## 3. JuryPress editorial content — not licensed here

Review text, jury comments, scores, Verdicts, rankings and evidence collections
are JuryPress editorial content. They are **all rights reserved** and are not
republished in this repository — an entry links to the published review instead
of copying it. The CC BY 4.0 grant above does not extend to that material, and
copying a review into a catalog entry does not place it under CC BY 4.0.

## 4. Third-party materials — rights of their owners

Product names, logos, trademarks, upstream source code, official deployment
templates, documentation excerpts, screenshots and any other third-party
material remain the property of their respective owners and are used here for
identification and reference only.

- Upstream projects are governed by their own licenses. Check the upstream
  license before self-hosting; a listing here is not a grant of any right to
  the underlying software.
- Nothing in this repository should be read as an official partnership,
  endorsement, certification or affiliation with any product, project or
  hosting provider. Where a product's own material is quoted, it is quoted as
  theirs.
- Deployment routes prefer an official template, then a trusted community
  template, and only then one maintained here. This repository does not
  republish an upstream template as its own in order to capture credit for it.

## 5. The JuryPress name and brand

"JuryPress" and the JuryPress marks are not covered by either grant above.
Attribution as required by CC BY 4.0 is expected and welcome; use of the name
or marks to imply that a derived work is a JuryPress publication, or is
endorsed by JuryPress, is not permitted.

## Reporting a boundary problem

If something here reproduces material it should not, misstates a license, or
implies an affiliation that does not exist, please open an issue. Corrections
take priority over listings.
