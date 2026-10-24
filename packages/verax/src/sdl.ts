import type { Def, Schema } from './core.js';
import type { StandardSchemaV1 } from './standard.js';
import { BUILTINS } from './types.js';

const NAME = /^[_A-Za-z][_0-9A-Za-z]*$/u;
/**
GraphQL's default root operation type names: only an output object may take one.
*/
const ROOTS = new Set(['Mutation', 'Query', 'Subscription']);
const BUILTIN_DEFS = new Set<Def>(Object.values(BUILTINS));

/**
GraphQL's implicit `__typename`: on an output object, a literal of the object's own name tags it as a union member and is no field.
*/
const isTypename = (key: string, field: StandardSchemaV1, name: string): boolean => {
  const { def } = field as Partial<Schema>;
  return key === '__typename' && def?.kind === 'literal' && def.value === name;
};

const fail: (message: string) => never = (message) => {
  throw new TypeError(`sdl: ${message}`);
};

const checkName = (name: string, what: string): string => {
  if (!NAME.test(name) || name.startsWith('__')) {
    fail(`${JSON.stringify(name)} is not a valid GraphQL ${what} name`);
  }
  return name;
};

/**
A schema's def — missing on a Standard Schema from elsewhere, which GraphQL cannot see into.
*/
const defOf = (schema: StandardSchemaV1): Def => {
  const { def } = schema as Partial<Schema>;
  return typeof def === 'object' && (def as Def | null) !== null
    ? def
    : fail('a schema without a def has no GraphQL equivalent');
};

type NamedDef = Extract<Def, { kind: 'enum' | 'object' | 'scalar' | 'union' }>;

/**
The def's valid, non-shadowing GraphQL type name.
*/
const typeName = (def: NamedDef): string => {
  const { kind, name } = def;
  if (name === undefined) {
    const factory = kind === 'enum' ? 'enums' : kind;
    fail(`${kind}s must be named — ${factory}(name, …)`);
  }
  if (Object.hasOwn(BUILTINS, name)) {
    fail(`${name} shadows a built-in scalar`);
  }
  return checkName(name, 'type');
};

const checkEnum = (name: string, values: readonly string[]): void => {
  if (values.length === 0) {
    fail(`enum ${name} has no values`);
  }
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      fail(`enum ${name} has duplicate value ${value}`);
    }
    seen.add(value);
    checkName(value, 'enum value');
    if (['false', 'null', 'true'].includes(value)) {
      fail(`enum value ${value} is reserved`);
    }
  }
};

/**
GraphQL forbids an input object reaching itself through non-null fields.
Input `reference` already refused bare nullable/optional, so a field whose def is
an object is non-null.
*/
const checkAcyclic = (declarations: Iterable<{ readonly def: Def }>): void => {
  const acyclic = new Set<Def>();
  const walk = (def: Def, path: readonly Def[]): void => {
    if (def.kind !== 'object' || acyclic.has(def)) {
      return;
    }
    if (path.includes(def)) {
      fail(`input ${String(def.name)} references itself through non-null fields`);
    }
    for (const field of Object.values(def.shape)) {
      walk(defOf(field), [...path, def]);
    }
    acyclic.add(def);
  };
  for (const { def } of declarations) {
    walk(def, []);
  }
};

/**
Emits GraphQL SDL for every named type reachable from `roots`, alpha-sorted.
Throws on anything GraphQL cannot express, rather than emitting invalid SDL.

Output mode refuses bare `optional(x)`: a GraphQL response sends `null`, never
omits, so an absent-able field must be `nullable(x)` or `optional(nullable(x))`.

`input: true` emits objects as `input` types. GraphQL input fields that are
nullable may also be omitted, so there a field must be `optional(nullable(x))`
to be nullable — `nullable` or `optional` alone would promise the wrong contract.
*/
export const sdl = (roots: readonly Schema[], { input = false } = {}): string => {
  const declarations = new Map<string, { def: Def; text: string }>();

  /**
  Declares a named type once, reserving its name before `body` runs so
  recursive references resolve; returns the name to reference it by.
  */
  const declare = (def: NamedDef, body: (name: string) => string): string => {
    const name = typeName(def);
    if (ROOTS.has(name) && (input || def.kind !== 'object')) {
      fail(`${name} is a root operation type name — only an output object can use it`);
    }
    const seen = declarations.get(name);
    if (seen === undefined) {
      const declaration = { def, text: '' };
      declarations.set(name, declaration);
      declaration.text = body(name);
    } else if (seen.def !== def) {
      fail(`two different types are named ${name}`);
    }
    return name;
  };

  const bareType = (def: Def): string => {
    switch (def.kind) {
      case 'enum': {
        return declare(def, (name) => {
          checkEnum(name, def.values);
          return `enum ${name} {\n${def.values.map((value) => `  ${value}`).join('\n')}\n}`;
        });
      }
      case 'list': {
        return `[${reference(def.of, 'item')}]`;
      }
      case 'object': {
        return declare(def, (name) => {
          const entries = Object.entries(def.shape).filter(
            ([key, field]) => input || !isTypename(key, field, name),
          );
          if (entries.length === 0) {
            fail(`object ${name} has no fields`);
          }
          const fields = entries.map(
            ([key, field]) => `  ${checkName(key, 'field')}: ${reference(field, 'field')}`,
          );
          return `${input ? 'input' : 'type'} ${name} {\n${fields.join('\n')}\n}`;
        });
      }
      case 'scalar': {
        return BUILTIN_DEFS.has(def) ? def.name : declare(def, (name) => `scalar ${name}`);
      }
      case 'union': {
        if (input) {
          fail('GraphQL input types cannot be unions');
        }
        return declare(def, (name) => {
          const members = [...new Set(def.of.map((member) => defOf(member)))];
          if (members.length === 0) {
            fail(`union ${name} has no members`);
          }
          const names = members.map((member) =>
            member.kind === 'object'
              ? bareType(member)
              : fail(`union ${name} members must be named objects`),
          );
          return `union ${name} = ${names.join(' | ')}`;
        });
      }
      case 'literal':
      case 'nullable':
      case 'optional':
      case 'record':
      case 'unknown': {
        break;
      }
    }
    return fail(`${def.kind}() has no GraphQL equivalent`);
  };

  /**
  Refuses nullable/optional combinations whose SDL would promise the wrong contract.
  */
  const reference = (schema: StandardSchemaV1, position: 'field' | 'item' | 'root'): string => {
    let def = defOf(schema);
    let isNullable = false;
    let isOptional = false;
    while (def.kind === 'nullable' || def.kind === 'optional') {
      isNullable ||= def.kind === 'nullable';
      isOptional ||= def.kind === 'optional';
      def = defOf(def.of);
    }
    const type = bareType(def);
    if (!input && isOptional && !isNullable) {
      fail('output optional(x) must be nullable(x) — GraphQL responses send null, never omit');
    }
    if (input && position === 'field' && isNullable !== isOptional) {
      fail(
        'an input field must be optional(nullable(x)) or neither — GraphQL lets a nullable input be omitted or null',
      );
    }
    if (input && position !== 'field' && isOptional) {
      fail('only input fields can be optional');
    }
    return isNullable ? type : `${type}!`;
  };

  for (const root of roots) {
    reference(root, 'root');
  }
  if (input) {
    checkAcyclic(declarations.values());
  }
  return [...declarations]
    .toSorted(([left], [right]) => (left < right ? -1 : 1))
    .map(([, declaration]) => declaration.text)
    .join('\n\n');
};
