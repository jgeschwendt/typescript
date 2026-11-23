import { host } from './host.js';
import './typescript6.js';

// dynamic: a static import evaluates the plugin's CommonJS before ./typescript6.js patches the resolver on bun
const { default: plugin } = await import('@typescript-eslint/eslint-plugin');

export default host(plugin, 'typescript-js');
