/** typescript-eslint naming-convention's formats, not their strict variants; an empty name passes */
const formats = new Map([
  [
    'camelCase',
    (name) => !name.includes('_') && name.slice(0, 1) === name.slice(0, 1).toLowerCase(),
  ],
  [
    'PascalCase',
    (name) => !name.includes('_') && name.slice(0, 1) === name.slice(0, 1).toUpperCase(),
  ],
  ['UPPER_CASE', (name) => name === name.toUpperCase() && !/^_|__|_$/u.test(name)],
]);

const camel = ['camelCase'];
const either = ['camelCase', 'PascalCase'];
const pascal = ['PascalCase'];

/** the formats per kind of name; an unlisted kind is camelCase; an import may follow its exporter's class or namespace */
const kinds = {
  class: pascal,
  enum: pascal,
  enumMember: pascal,
  import: either,
  interface: pascal,
  objectLiteralProperty: either,
  typeAlias: pascal,
  typeParameter: pascal,
  variable: ['camelCase', 'UPPER_CASE'],
};

/** a JSX file's components, hooks and props take PascalCase beside camelCase */
const jsx = {
  function: either,
  objectLiteralMethod: either,
  objectLiteralProperty: either,
  typeProperty: either,
  variable: ['camelCase', 'PascalCase', 'UPPER_CASE'],
};

/** a key that needs quotes belongs to the DOM or a wire format, not the code */
const identifier = /^[$_\p{ID_Start}][$\p{ID_Continue}]*$/u;

/** the handlers Next reads from a route file */
const methods = /^(?:DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT)$/u;

/** the identifiers a binding pattern declares: a default's left, a rest's argument, a property's value */
const bound = (node) =>
  node.type === 'Identifier'
    ? [node]
    : [
        node.argument,
        node.left,
        node.parameter,
        node.value,
        ...(node.elements ?? []),
        ...(node.properties ?? []),
      ].flatMap((child) => (child ? bound(child) : []));

const plugin = {
  meta: { name: 'names' },
  rules: {
    case: {
      create: (context) => {
        const [{ allow = [] } = {}] = context.options;
        const patterns = allow.map((entry) => new RegExp(`^(?:${entry})$`, 'u'));
        const { filename } = context;
        const accepted = { ...kinds, ...(/\.[jt]sx$/u.test(filename) && jsx) };
        const isRoute = /(?:^|[/\\])route\.[jt]s$/u.test(filename);
        const check = (kind, node, name = node.name) => {
          const list = accepted[kind] ?? camel;
          // a parameter may lead with one underscore, and one of underscores alone is a placeholder
          const bare = kind === 'parameter' ? name.replace(/^_(?:_*$)?/u, '') : name;
          const passes =
            list.some((format) => formats.get(format)(bare)) ||
            allow.includes(name) ||
            patterns.some((pattern) => pattern.test(name));
          if (!passes) {
            context.report({
              data: { formats: list.join(' or '), kind, name },
              messageId: 'case',
              node,
            });
          }
        };
        const member = (kind, node) => {
          const key = node.key ?? node.id;
          const name = key.name ?? key.value;
          if (!node.computed && identifier.test(name)) {
            check(kind, key, name);
          }
        };
        const named =
          (kind) =>
          ({ id }) => {
            if (id) {
              check(kind, id);
            }
          };
        return {
          'AccessorProperty, MethodDefinition, PropertyDefinition, TSAbstractAccessorProperty, TSAbstractMethodDefinition, TSAbstractPropertyDefinition':
            (node) => member('classMember', node),
          'ArrowFunctionExpression, FunctionDeclaration, FunctionExpression, TSDeclareFunction, TSEmptyBodyFunctionExpression':
            (node) => {
              if (
                !(
                  isRoute &&
                  node.parent.type === 'ExportNamedDeclaration' &&
                  methods.test(node.id?.name)
                )
              ) {
                named('function')(node);
              }
              for (const parameter of node.params) {
                for (const id of bound(parameter)) {
                  check(
                    parameter.type === 'TSParameterProperty' ? 'parameterProperty' : 'parameter',
                    id,
                  );
                }
              }
            },
          'ClassDeclaration, ClassExpression': named('class'),
          'ImportDefaultSpecifier, ImportNamespaceSpecifier, ImportSpecifier': (node) => {
            // an un-renamed named import is the exporter's name
            if (node.imported?.range[0] !== node.local.range[0]) {
              check('import', node.local);
            }
          },
          'ObjectExpression > Property': (node) => {
            const method = node.value.type.endsWith('FunctionExpression')
              ? 'objectLiteralMethod'
              : 'objectLiteralProperty';
            member(node.kind === 'init' ? method : 'accessor', node);
          },
          TSEnumDeclaration: named('enum'),
          TSEnumMember: (node) => member('enumMember', node),
          TSInterfaceDeclaration: named('interface'),
          TSMethodSignature: (node) => member('typeMethod', node),
          TSPropertySignature: (node) =>
            member(
              node.typeAnnotation?.typeAnnotation.type === 'TSFunctionType'
                ? 'typeMethod'
                : 'typeProperty',
              node,
            ),
          TSTypeAliasDeclaration: named('typeAlias'),
          'TSTypeParameterDeclaration > TSTypeParameter': (node) =>
            check('typeParameter', node.name),
          VariableDeclarator: (node) => {
            for (const id of bound(node.id)) {
              check('variable', id);
            }
          },
        };
      },
      meta: {
        docs: { description: "Require a declared name in its kind's case" },
        messages: { case: 'The {{kind}} `{{name}}` is not {{formats}}.' },
        schema: [
          {
            additionalProperties: false,
            properties: { allow: { items: { type: 'string' }, type: 'array' } },
            type: 'object',
          },
        ],
        type: 'suggestion',
      },
    },
  },
};

export default plugin;
