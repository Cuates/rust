

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.COr2Vn84.js","_app/immutable/chunks/BePSGrG4.js","_app/immutable/chunks/B6IXPnOU.js","_app/immutable/chunks/CP-4Ibl2.js"];
export const stylesheets = ["_app/immutable/assets/0.Xns0oSMA.css"];
export const fonts = [];
