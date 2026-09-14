/**
 * A JSON Schema evaluator covering exactly the keywords this contract uses.
 *
 * Why not a library: this contract is consumed by other repositories, and the
 * point of the pinned distribution is that a consumer can run *the same*
 * validation without installing anything. A dependency-free evaluator keeps the
 * contract and its enforcement in one pinned artefact.
 *
 * Why that is safe: the evaluator refuses to load a schema that uses a keyword
 * it does not implement. A subset evaluator is only dangerous when it silently
 * ignores what it does not understand — so an unknown keyword is a load error,
 * not a skipped constraint. Adding a keyword to a schema therefore forces
 * adding it here, which is the intended direction.
 */

const SUPPORTED_KEYWORDS = new Set([
  '$schema', '$id', '$ref', '$defs',
  'title', 'description', 'examples', 'deprecated',
  'type', 'enum', 'const',
  'properties', 'required', 'additionalProperties', 'minProperties', 'maxProperties',
  'items', 'minItems', 'maxItems', 'uniqueItems',
  'minLength', 'maxLength', 'pattern',
  'minimum', 'maximum',
  'allOf', 'anyOf', 'oneOf', 'not',
]);

// Positions whose values are themselves schemas, and must be walked.
const SCHEMA_MAP_KEYS = ['properties', '$defs'];
const SCHEMA_KEYS = ['items', 'additionalProperties', 'not'];
const SCHEMA_LIST_KEYS = ['allOf', 'anyOf', 'oneOf'];

class SchemaError extends Error {}

function assertSupported(schema, where) {
  if (typeof schema === 'boolean') return;
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new SchemaError(`${where}: expected a schema object`);
  }
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key)) {
      throw new SchemaError(
        `${where}: keyword ${JSON.stringify(key)} is not implemented by this validator. ` +
          'Implement it in scripts/lib/schema.mjs before using it in a schema.',
      );
    }
  }
  for (const key of SCHEMA_MAP_KEYS) {
    const map = schema[key];
    if (map === undefined) continue;
    for (const [name, sub] of Object.entries(map)) assertSupported(sub, `${where}/${key}/${name}`);
  }
  for (const key of SCHEMA_KEYS) {
    const sub = schema[key];
    if (sub === undefined || typeof sub === 'boolean') continue;
    assertSupported(sub, `${where}/${key}`);
  }
  for (const key of SCHEMA_LIST_KEYS) {
    const list = schema[key];
    if (list === undefined) continue;
    list.forEach((sub, i) => assertSupported(sub, `${where}/${key}/${i}`));
  }
}

function pointer(root, path, where) {
  if (path === '' || path === '#') return root;
  const parts = path.replace(/^#/, '').split('/').filter(Boolean);
  let node = root;
  for (const rawPart of parts) {
    const part = rawPart.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, part)) {
      throw new SchemaError(`${where}: cannot resolve $ref pointer ${JSON.stringify(path)}`);
    }
    node = node[part];
  }
  return node;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value, expected) {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  if (expected === 'integer') return actual === 'integer';
  return actual === expected;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  return aKeys.length === bKeys.length
    && aKeys.every((key, i) => key === bKeys[i])
    && aKeys.every((key) => deepEqual(a[key], b[key]));
}

/**
 * A set of schema files that can validate documents against each other's $refs.
 */
export class SchemaSet {
  /**
   * @param {Record<string, object>} files schema documents keyed by file name,
   *   e.g. { 'product-record.schema.json': {...} }
   */
  constructor(files) {
    this.files = files;
    for (const [name, schema] of Object.entries(files)) assertSupported(schema, name);
  }

  /**
   * @param {string} fileName schema to validate against
   * @param {unknown} data document to check
   * @returns {{path: string, message: string}[]} empty when the document is valid
   */
  validate(fileName, data) {
    const schema = this.files[fileName];
    if (!schema) throw new SchemaError(`unknown schema file ${JSON.stringify(fileName)}`);
    const errors = [];
    this.#check(schema, fileName, data, '', errors);
    return errors;
  }

  #resolve(ref, currentFile) {
    const [filePart, pointerPart = ''] = ref.split('#');
    const fileName = filePart === '' ? currentFile : filePart;
    const target = this.files[fileName];
    if (!target) throw new SchemaError(`${currentFile}: $ref to unknown file ${JSON.stringify(fileName)}`);
    return { schema: pointer(target, pointerPart, currentFile), file: fileName };
  }

  #check(schema, file, data, path, errors) {
    if (schema === true || schema === undefined) return;
    if (schema === false) {
      errors.push({ path, message: 'no value is allowed here' });
      return;
    }

    if (schema.$ref !== undefined) {
      const resolved = this.#resolve(schema.$ref, file);
      this.#check(resolved.schema, resolved.file, data, path, errors);
    }

    if (schema.type !== undefined) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!types.some((t) => matchesType(data, t))) {
        errors.push({ path, message: `expected type ${types.join(' or ')}, got ${typeOf(data)}` });
        return; // Further keywords would only restate the same mismatch.
      }
    }

    if (schema.const !== undefined && !deepEqual(data, schema.const)) {
      errors.push({ path, message: `must be ${JSON.stringify(schema.const)}` });
    }

    if (schema.enum !== undefined && !schema.enum.some((option) => deepEqual(data, option))) {
      errors.push({ path, message: `must be one of ${schema.enum.map((o) => JSON.stringify(o)).join(', ')}` });
    }

    if (typeof data === 'string') this.#checkString(schema, data, path, errors);
    if (typeof data === 'number') this.#checkNumber(schema, data, path, errors);
    if (Array.isArray(data)) this.#checkArray(schema, file, data, path, errors);
    else if (data !== null && typeof data === 'object') this.#checkObject(schema, file, data, path, errors);

    for (const key of SCHEMA_LIST_KEYS) {
      const list = schema[key];
      if (list === undefined) continue;
      const results = list.map((sub) => {
        const subErrors = [];
        this.#check(sub, file, data, path, subErrors);
        return subErrors;
      });
      if (key === 'allOf') results.forEach((subErrors) => errors.push(...subErrors));
      if (key === 'anyOf' && !results.some((subErrors) => subErrors.length === 0)) {
        errors.push({ path, message: 'does not match any of the allowed shapes' });
      }
      if (key === 'oneOf') {
        const matched = results.filter((subErrors) => subErrors.length === 0).length;
        if (matched !== 1) {
          errors.push({ path, message: `must match exactly one of the allowed shapes (matched ${matched})` });
        }
      }
    }

    if (schema.not !== undefined) {
      const subErrors = [];
      this.#check(schema.not, file, data, path, subErrors);
      if (subErrors.length === 0) errors.push({ path, message: 'matches a shape that is not allowed here' });
    }
  }

  #checkString(schema, data, path, errors) {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({ path, message: `must be at least ${schema.minLength} characters` });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({ path, message: `must be at most ${schema.maxLength} characters` });
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(data)) {
      errors.push({ path, message: `does not match the required pattern ${schema.pattern}` });
    }
  }

  #checkNumber(schema, data, path, errors) {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({ path, message: `must be >= ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({ path, message: `must be <= ${schema.maximum}` });
    }
  }

  #checkArray(schema, file, data, path, errors) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({ path, message: `must have at least ${schema.minItems} item(s)` });
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push({ path, message: `must have at most ${schema.maxItems} item(s)` });
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      for (const item of data) {
        const key = JSON.stringify(item);
        if (seen.has(key)) {
          errors.push({ path, message: 'must not contain duplicate entries' });
          break;
        }
        seen.add(key);
      }
    }
    if (schema.items !== undefined) {
      data.forEach((item, i) => this.#check(schema.items, file, item, `${path}/${i}`, errors));
    }
  }

  #checkObject(schema, file, data, path, errors) {
    const keys = Object.keys(data);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      errors.push({ path, message: `must have at least ${schema.minProperties} propert(ies)` });
    }
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
      errors.push({ path, message: `must have at most ${schema.maxProperties} propert(ies)` });
    }
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(data, required)) {
        errors.push({ path, message: `missing required property ${JSON.stringify(required)}` });
      }
    }
    const properties = schema.properties ?? {};
    for (const [key, value] of Object.entries(data)) {
      if (Object.hasOwn(properties, key)) {
        this.#check(properties[key], file, value, `${path}/${key}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push({ path, message: `unknown property ${JSON.stringify(key)} is not allowed` });
      } else if (typeof schema.additionalProperties === 'object') {
        this.#check(schema.additionalProperties, file, value, `${path}/${key}`, errors);
      }
    }
  }
}

export { SchemaError, SUPPORTED_KEYWORDS };
