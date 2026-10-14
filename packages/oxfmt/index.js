const oxfmtrc = new URL('oxfmtrc.json', import.meta.url);

// oxfmt has no `extends`: shallow merge, consumer keys win, fresh object per call
const defineConfig = (config = {}) => ({
  ...JSON.parse(String(process.getBuiltinModule('node:fs').readFileSync(oxfmtrc))),
  ...config,
});

export { defineConfig };
