# deployments/

The deployment route material for a product: the guide a reader follows, and
any configuration this repository maintains itself.

**Layout:** `deployments/<product-slug>/` — matching the slug in
[`../catalog/projects/`](../catalog/projects/).

- `README.md` — the setup guide: prerequisites, the route to use, step-by-step
  deployment, initial configuration, how to confirm it works, and what it will
  cost you in services you must supply.
- Any `Dockerfile`, platform configuration or template files maintained here.

**Route preference — official, then trusted community, then ours.** Maintain a
configuration in this directory only when no official or trusted community
route is usable for the product. Re-publishing someone else's working template
under this repository's name is not done here, and is not done for referral or
template revenue.

**Rules:**

- Deployment happens on the reader's own hosting account, at their own cost.
  Say so where a guide could be read otherwise.
- A guide describes the version named on the product record. If the guide moves
  ahead of the verified version, the listing is out of date — fix the record,
  do not quietly let the two diverge.
- No secrets, no account identifiers, no personal deploy URLs. Placeholders
  only.
- A guide is not a verification. What was actually run and confirmed belongs in
  the verification block on the product record.
- Configuration maintained here is Apache-2.0 (code); the prose guide is
  CC BY 4.0. See [`../LICENSING.md`](../LICENSING.md).
