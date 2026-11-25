import { host } from './host.js';
import './typescript6.js';

// dynamic: a static import evaluates the plugin's CommonJS before ./typescript6.js patches the resolver on bun
const { default: plugin } = await import('@typescript-eslint/eslint-plugin');

// naming-convention needs parser services the host lacks: unregistered, naming it fails as an unknown rule, never as a crash
const rules = Object.fromEntries(
  Object.entries(plugin.rules).filter(([name]) => name !== 'naming-convention'),
);

export default host({ rules }, 'typescript-js');
