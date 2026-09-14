# scripts/

The validator and index generator.

```bash
node scripts/catalog.mjs validate            # every record, bundle and check definition
node scripts/catalog.mjs index --check       # the README index matches the records
node scripts/catalog.mjs index --write       # regenerate the README index
node scripts/catalog.mjs contract --check    # schemas/contract.json matches the contract files
node scripts/catalog.mjs contract --write    # regenerate the manifest
node scripts/catalog.mjs digest <slug>       # the deployment configuration digest for a record
```

Node.js 22 or newer. No install step: there are no dependencies.

## Layout

| File | Responsibility |
| --- | --- |
| `catalog.mjs` | The CLI. Argument handling and output only. |
| `lib/validate.mjs` | The public entry point consumers call. Schema check, then rules. |
| `lib/rules.mjs` | What a document may *claim*: states, approval, checks, digests, cross-document consistency. |
| `lib/schema.mjs` | A JSON Schema evaluator covering exactly the keywords these schemas use — and refusing to load a schema that uses any other. |
| `lib/loader.mjs` | Reading the repository from disk into the shape the rules expect. |
| `lib/json.mjs` | Parsing, deterministic serialization, and the refusal of prototype-touching keys. |
| `lib/digest.mjs` | The deployment configuration digest that binds a verification to what was actually deployed. |
| `lib/urls.mjs` | URL and path safety. |
| `lib/index-render.mjs` | The generated "Browse by use case" section of the README. |
| `lib/contract.mjs` | The pinned distribution manifest. |

## What the validator refuses

A duplicate product slug or a record whose file name does not match its slug; a
second record claiming the same review; an unsupported `schema_version`; a
verification date in the future; an approval dated before the verification it
approves; a `tested` or `experimental` state without a complete verification
block and a recorded human approval; a required check left unanswered, failed or
`not_tested`; `not_applicable` with no reason; a `tested` state with anything
still outstanding; an `experimental` state with nothing outstanding; a retired
product that kept its deployment link, or a retirement with no reason; a
non-https or otherwise unsafe URL; a review URL somewhere other than the review
site; a path that is absolute, escapes the repository, leaves the directory the
field allows, or does not exist; a fixture inside `catalog/`; a bundle
referencing a product that is missing or not listed; and a verification or
approval whose deployment configuration has changed since.

## Rules

- Runs standalone: no credentials, no network, no access to private JuryPress
  data. A contributor runs the same command CI runs.
- Never loads Markdown, YAML or JSON from the repository as executable code.
  Documents are parsed as data, and a key that would reach the prototype chain
  is refused rather than dropped.
- Fails closed. An unknown state, an unknown schema version, an unrecognised
  field or a schema keyword the evaluator does not implement is an error, not a
  warning — a validator that passes what it does not understand is not a gate.
