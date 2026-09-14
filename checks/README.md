# checks/

Check-suite definitions: what each check id means, which checks a listing
requires, and any optional automated smoke check.

**Definitions only.** A check *result* belongs to the verification block on the
product record in [`../catalog/projects/`](../catalog/projects/). Keeping the
definition and the result apart is what makes "this check, on this version, by
this person, on this date" a statement that can be validated instead of prose.

**A check definition holds:** a stable check id, what a person must actually do
to satisfy it, what counts as passing, and whether it is required for a listing
or optional.

**Result vocabulary** — the four values a verification may record:

| Value | Meaning |
| --- | --- |
| `passed` | Performed, and it worked. |
| `failed` | Performed, and it did not work. Not listable while a required check is failed. |
| `not_tested` | Not performed. A normal, publishable answer. |
| `not_applicable` | Does not apply to this product, **with a stated reason**. Never a quiet way to drop an inconvenient check. |

**Required checks** cover what a person must confirm before anything is listed:
the deployment completes, initial configuration completes, the product's main
flow works, the public and authentication behaviour is understood, and any
required persistence survives a restart. `experimental` does not waive them.
The definitions themselves are in [`checks.json`](checks.json), which is what
the validator reads; this file explains them.

**How the answers decide the listing state.** The line is mechanical, so that
neither state is a matter of mood:

| Listing state | Required checks | Anything outstanding |
| --- | --- | --- |
| `tested` | every one `passed`, or `not_applicable` with a reason | nothing: no check left `not_tested`, no failed check, and an empty `not_tested` list |
| `experimental` | every one `passed`, or `not_applicable` with a reason | at least one named gap — an entry in the record's `not_tested`, or an optional check left `not_tested` |
| neither | a required check `failed`, `not_tested`, or missing | — |

An optional check you did not run is a real gap, and naming it is the point: it
makes the record honest and puts the listing at `experimental`, which is an
accurate description rather than a demotion. If a check genuinely does not apply
to a product, answer `not_applicable` with the reason instead of leaving it
unanswered.

Adding a **required** check invalidates every existing listing until each one
answers it. That is intended — see
[`../schemas/VERSIONING.md`](../schemas/VERSIONING.md).

An automated smoke check, where one exists, is a convenience. It is evidence
about a deployment; it is not a person's verification and never substitutes for
one.
