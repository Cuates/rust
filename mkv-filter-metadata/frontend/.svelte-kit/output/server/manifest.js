export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.png","svelte.svg","tauri.svg","vite.svg"]),
	mimeTypes: {".png":"image/png",".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.Vwn4AV1d.js",app:"_app/immutable/entry/app.wbNHi2KW.js",imports:["_app/immutable/entry/start.Vwn4AV1d.js","_app/immutable/chunks/CVPVbAvc.js","_app/immutable/chunks/B6IXPnOU.js","_app/immutable/chunks/BYzwSmT_.js","_app/immutable/entry/app.wbNHi2KW.js","_app/immutable/chunks/B6IXPnOU.js","_app/immutable/chunks/5M0JQpfu.js","_app/immutable/chunks/BePSGrG4.js","_app/immutable/chunks/BYzwSmT_.js","_app/immutable/chunks/BRKoSwl-.js","_app/immutable/chunks/CP-4Ibl2.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
