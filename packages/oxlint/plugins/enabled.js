/** `plugin/rule` keys a config turns on: oxlint loads every rule a plugin lists, so once any is recorded a host lists only these @type {Set<string>} */
const enabled = new Set();

export { enabled };
