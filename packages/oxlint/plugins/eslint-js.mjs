import { builtinRules } from 'eslint/use-at-your-own-risk';
import { host } from './host.mjs';

export default host({ rules: Object.fromEntries(builtinRules) }, 'eslint-js');
