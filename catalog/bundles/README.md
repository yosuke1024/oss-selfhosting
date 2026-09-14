# catalog/bundles/

Use-case bundles: a small set of products that together cover one job, with the
reasoning for the selection.

**Layout:** `catalog/bundles/<bundle-slug>.json` — one file per bundle.

**A bundle holds:**

- The use case it serves, and why these members were chosen.
- Member product slugs, referenced — never restated. A bundle carries no copy
  of a member's record, verification, score or Verdict.
- The combined service dependencies across members.
- Overlaps and conflicts between members, stated plainly.
- Per-member deployment links; each member is deployed individually.

**Rules:**

- A bundle may only reference products that are currently listed. When a member
  is retired or its review is withdrawn, the bundle follows immediately.
- Running each member successfully is not the same as the members working
  *together*. Keep the two verifications distinct, and do not imply integration
  testing that was not performed.
- A one-click "deploy this whole stack" flow is deliberately not part of this
  contract. Until the interactions between members have been verified, bundles
  are curation, not orchestration.
- Bundles are built from products that are already listed. Do not create a
  bundle in order to justify listing its members.
