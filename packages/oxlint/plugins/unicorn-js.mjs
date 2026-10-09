// eslint-plugin-unicorn, loaded here so oxlintrc.jsonc names it by a relative
// path: a bare specifier in an extended config resolves from the consumer's
// symlinked node_modules/@jlg/oxlint, whose ancestors hold none of this
// package's dependencies under an isolated install, while this module's own
// import resolves from its real path. Rules run through host.mjs.
import plugin from 'eslint-plugin-unicorn';
import { host } from './host.mjs';

export default host(plugin, 'unicorn-js');
