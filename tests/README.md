# tests/

The contract's own tests. Run them with:

```bash
node --test 'tests/*.test.mjs'
```

Node.js 22 or newer; no dependencies, no install step.

| File | What it covers |
| --- | --- |
| `contract.test.mjs` | The schemas load, the repository as checked in validates, the fixtures are self-consistent, the pinned manifest describes the tree, and an unimplemented schema keyword is refused. |
| `states.test.mjs` | Work state, listing state, verification, approval, the check results, and the digest that invalidates a verification when the deployment changes. |
| `safety.test.mjs` | Unsafe URLs, paths that leave the repository, fixtures reaching the catalog, duplicate slugs, and documents that try to be more than data. |
| `bundles.test.mjs` | A bundle's members must exist, be listed, and have their services declared. |
| `index.test.mjs` | Only listed products reach the generated README index. |

## Fixtures

`fixtures/` holds representative documents: a `tested` record, an
`experimental` one, a `retired` one, one still awaiting verification, and a
bundle. They describe products that do not exist.

Every fixture carries `data_class: "fixture"`, which is what keeps them out of
the catalog — the validator refuses a fixture inside `catalog/`, and a test
asserts each one is still marked that way. A test that needs to exercise the
catalog rules copies a fixture and marks the copy production **in memory**.
Nothing writes a production document into `tests/`, and nothing writes a fixture
into `catalog/`.

## Adding a rule

A rule and its test belong in the same change. The test should fail if the rule
is removed — which means asserting on the specific error code, not just that
something failed. Write the test from the direction that would publish something
untrue, because that is the direction the rule exists to block.

If a fixture's deployment fields change, its `config_digest` changes with them;
`contract.test.mjs` fails with the value to write back.
