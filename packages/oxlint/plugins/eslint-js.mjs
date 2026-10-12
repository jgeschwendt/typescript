import { builtinRules } from 'eslint/use-at-your-own-risk';
import { host } from './host.mjs';

const names = [
  'camelcase',
  'consistent-this',
  'no-invalid-this',
  'no-restricted-syntax',
  'no-undef-init',
  'require-atomic-updates',
];

export default host(
  {
    rules: Object.fromEntries(names.map((name) => [name, builtinRules.get(name)])),
  },
  'eslint-js',
);
