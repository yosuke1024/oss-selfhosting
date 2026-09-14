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

An automated smoke check, where one exists, is a convenience. It is evidence
about a deployment; it is not a person's verification and never substitutes for
one.
