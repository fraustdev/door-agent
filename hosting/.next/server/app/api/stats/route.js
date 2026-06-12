/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/stats/route";
exports.ids = ["app/api/stats/route"];
exports.modules = {

/***/ "(rsc)/./app/api/stats/route.ts":
/*!********************************!*\
  !*** ./app/api/stats/route.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET)\n/* harmony export */ });\n/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @supabase/supabase-js */ \"(rsc)/./node_modules/@supabase/supabase-js/dist/index.mjs\");\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n\n\nasync function GET() {\n    const supabase = (0,_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_1__.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);\n    // Build the 7-day window starting from 6 days ago at midnight UTC\n    const since = new Date();\n    since.setUTCDate(since.getUTCDate() - 6);\n    since.setUTCHours(0, 0, 0, 0);\n    const { data, error } = await supabase.from('access_log').select('created_at, granted, locked_out').gte('created_at', since.toISOString());\n    if (error) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        error: error.message\n    }, {\n        status: 500\n    });\n    // Pre-fill all 7 days with zeros so days with no activity still appear\n    const dayMap = new Map();\n    for(let i = 6; i >= 0; i--){\n        const d = new Date();\n        d.setUTCDate(d.getUTCDate() - i);\n        dayMap.set(d.toISOString().slice(0, 10), {\n            granted: 0,\n            denied: 0,\n            locked: 0\n        });\n    }\n    for (const row of data ?? []){\n        const key = row.created_at.slice(0, 10);\n        const bucket = dayMap.get(key);\n        if (!bucket) continue;\n        if (row.locked_out) bucket.locked++;\n        else if (row.granted) bucket.granted++;\n        else bucket.denied++;\n    }\n    const result = Array.from(dayMap.entries()).map(([date, counts])=>{\n        // Parse at noon UTC to avoid date-shift on daylight-saving boundaries\n        const d = new Date(`${date}T12:00:00Z`);\n        const day = d.toLocaleDateString('en-US', {\n            weekday: 'short'\n        });\n        return {\n            date,\n            day,\n            ...counts,\n            total: counts.granted + counts.denied + counts.locked\n        };\n    });\n    return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json(result);\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL3N0YXRzL3JvdXRlLnRzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUFvRDtBQUNWO0FBV25DLGVBQWVFO0lBQ3BCLE1BQU1DLFdBQVdILG1FQUFZQSxDQUMzQkksUUFBUUMsR0FBRyxDQUFDQyxZQUFZLEVBQ3hCRixRQUFRQyxHQUFHLENBQUNFLHlCQUF5QjtJQUd2QyxrRUFBa0U7SUFDbEUsTUFBTUMsUUFBUSxJQUFJQztJQUNsQkQsTUFBTUUsVUFBVSxDQUFDRixNQUFNRyxVQUFVLEtBQUs7SUFDdENILE1BQU1JLFdBQVcsQ0FBQyxHQUFHLEdBQUcsR0FBRztJQUUzQixNQUFNLEVBQUVDLElBQUksRUFBRUMsS0FBSyxFQUFFLEdBQUcsTUFBTVgsU0FDM0JZLElBQUksQ0FBQyxjQUNMQyxNQUFNLENBQUMsbUNBQ1BDLEdBQUcsQ0FBQyxjQUFjVCxNQUFNVSxXQUFXO0lBRXRDLElBQUlKLE9BQU8sT0FBT2IscURBQVlBLENBQUNrQixJQUFJLENBQUM7UUFBRUwsT0FBT0EsTUFBTU0sT0FBTztJQUFDLEdBQUc7UUFBRUMsUUFBUTtJQUFJO0lBRTVFLHVFQUF1RTtJQUN2RSxNQUFNQyxTQUFTLElBQUlDO0lBQ25CLElBQUssSUFBSUMsSUFBSSxHQUFHQSxLQUFLLEdBQUdBLElBQUs7UUFDM0IsTUFBTUMsSUFBSSxJQUFJaEI7UUFDZGdCLEVBQUVmLFVBQVUsQ0FBQ2UsRUFBRWQsVUFBVSxLQUFLYTtRQUM5QkYsT0FBT0ksR0FBRyxDQUFDRCxFQUFFUCxXQUFXLEdBQUdTLEtBQUssQ0FBQyxHQUFHLEtBQUs7WUFBRUMsU0FBUztZQUFHQyxRQUFRO1lBQUdDLFFBQVE7UUFBRTtJQUM5RTtJQUVBLEtBQUssTUFBTUMsT0FBT2xCLFFBQVEsRUFBRSxDQUFFO1FBQzVCLE1BQU1tQixNQUFNRCxJQUFJRSxVQUFVLENBQUNOLEtBQUssQ0FBQyxHQUFHO1FBQ3BDLE1BQU1PLFNBQVNaLE9BQU9hLEdBQUcsQ0FBQ0g7UUFDMUIsSUFBSSxDQUFDRSxRQUFRO1FBQ2IsSUFBSUgsSUFBSUssVUFBVSxFQUFFRixPQUFPSixNQUFNO2FBQzVCLElBQUlDLElBQUlILE9BQU8sRUFBRU0sT0FBT04sT0FBTzthQUMvQk0sT0FBT0wsTUFBTTtJQUNwQjtJQUVBLE1BQU1RLFNBQW9CQyxNQUFNdkIsSUFBSSxDQUFDTyxPQUFPaUIsT0FBTyxJQUFJQyxHQUFHLENBQUMsQ0FBQyxDQUFDQyxNQUFNQyxPQUFPO1FBQ3hFLHNFQUFzRTtRQUN0RSxNQUFNakIsSUFBSSxJQUFJaEIsS0FBSyxHQUFHZ0MsS0FBSyxVQUFVLENBQUM7UUFDdEMsTUFBTUUsTUFBTWxCLEVBQUVtQixrQkFBa0IsQ0FBQyxTQUFTO1lBQUVDLFNBQVM7UUFBUTtRQUM3RCxPQUFPO1lBQUVKO1lBQU1FO1lBQUssR0FBR0QsTUFBTTtZQUFFSSxPQUFPSixPQUFPZCxPQUFPLEdBQUdjLE9BQU9iLE1BQU0sR0FBR2EsT0FBT1osTUFBTTtRQUFDO0lBQ3ZGO0lBRUEsT0FBTzdCLHFEQUFZQSxDQUFDa0IsSUFBSSxDQUFDa0I7QUFDM0IiLCJzb3VyY2VzIjpbIi9Vc2Vycy9mcmlkYS9wcm9qZWN0cy9kb29yLWFnZW50L2hvc3RpbmcvYXBwL2FwaS9zdGF0cy9yb3V0ZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjcmVhdGVDbGllbnQgfSBmcm9tICdAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXG5pbXBvcnQgeyBOZXh0UmVzcG9uc2UgfSBmcm9tICduZXh0L3NlcnZlcidcblxuZXhwb3J0IGludGVyZmFjZSBEYXlTdGF0IHtcbiAgZGF0ZTogc3RyaW5nXG4gIGRheTogc3RyaW5nXG4gIGdyYW50ZWQ6IG51bWJlclxuICBkZW5pZWQ6IG51bWJlclxuICBsb2NrZWQ6IG51bWJlclxuICB0b3RhbDogbnVtYmVyXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQoKSB7XG4gIGNvbnN0IHN1cGFiYXNlID0gY3JlYXRlQ2xpZW50KFxuICAgIHByb2Nlc3MuZW52LlNVUEFCQVNFX1VSTCEsXG4gICAgcHJvY2Vzcy5lbnYuU1VQQUJBU0VfU0VSVklDRV9ST0xFX0tFWSFcbiAgKVxuXG4gIC8vIEJ1aWxkIHRoZSA3LWRheSB3aW5kb3cgc3RhcnRpbmcgZnJvbSA2IGRheXMgYWdvIGF0IG1pZG5pZ2h0IFVUQ1xuICBjb25zdCBzaW5jZSA9IG5ldyBEYXRlKClcbiAgc2luY2Uuc2V0VVRDRGF0ZShzaW5jZS5nZXRVVENEYXRlKCkgLSA2KVxuICBzaW5jZS5zZXRVVENIb3VycygwLCAwLCAwLCAwKVxuXG4gIGNvbnN0IHsgZGF0YSwgZXJyb3IgfSA9IGF3YWl0IHN1cGFiYXNlXG4gICAgLmZyb20oJ2FjY2Vzc19sb2cnKVxuICAgIC5zZWxlY3QoJ2NyZWF0ZWRfYXQsIGdyYW50ZWQsIGxvY2tlZF9vdXQnKVxuICAgIC5ndGUoJ2NyZWF0ZWRfYXQnLCBzaW5jZS50b0lTT1N0cmluZygpKVxuXG4gIGlmIChlcnJvcikgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfSwgeyBzdGF0dXM6IDUwMCB9KVxuXG4gIC8vIFByZS1maWxsIGFsbCA3IGRheXMgd2l0aCB6ZXJvcyBzbyBkYXlzIHdpdGggbm8gYWN0aXZpdHkgc3RpbGwgYXBwZWFyXG4gIGNvbnN0IGRheU1hcCA9IG5ldyBNYXA8c3RyaW5nLCB7IGdyYW50ZWQ6IG51bWJlcjsgZGVuaWVkOiBudW1iZXI7IGxvY2tlZDogbnVtYmVyIH0+KClcbiAgZm9yIChsZXQgaSA9IDY7IGkgPj0gMDsgaS0tKSB7XG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKClcbiAgICBkLnNldFVUQ0RhdGUoZC5nZXRVVENEYXRlKCkgLSBpKVxuICAgIGRheU1hcC5zZXQoZC50b0lTT1N0cmluZygpLnNsaWNlKDAsIDEwKSwgeyBncmFudGVkOiAwLCBkZW5pZWQ6IDAsIGxvY2tlZDogMCB9KVxuICB9XG5cbiAgZm9yIChjb25zdCByb3cgb2YgZGF0YSA/PyBbXSkge1xuICAgIGNvbnN0IGtleSA9IHJvdy5jcmVhdGVkX2F0LnNsaWNlKDAsIDEwKVxuICAgIGNvbnN0IGJ1Y2tldCA9IGRheU1hcC5nZXQoa2V5KVxuICAgIGlmICghYnVja2V0KSBjb250aW51ZVxuICAgIGlmIChyb3cubG9ja2VkX291dCkgYnVja2V0LmxvY2tlZCsrXG4gICAgZWxzZSBpZiAocm93LmdyYW50ZWQpIGJ1Y2tldC5ncmFudGVkKytcbiAgICBlbHNlIGJ1Y2tldC5kZW5pZWQrK1xuICB9XG5cbiAgY29uc3QgcmVzdWx0OiBEYXlTdGF0W10gPSBBcnJheS5mcm9tKGRheU1hcC5lbnRyaWVzKCkpLm1hcCgoW2RhdGUsIGNvdW50c10pID0+IHtcbiAgICAvLyBQYXJzZSBhdCBub29uIFVUQyB0byBhdm9pZCBkYXRlLXNoaWZ0IG9uIGRheWxpZ2h0LXNhdmluZyBib3VuZGFyaWVzXG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGAke2RhdGV9VDEyOjAwOjAwWmApXG4gICAgY29uc3QgZGF5ID0gZC50b0xvY2FsZURhdGVTdHJpbmcoJ2VuLVVTJywgeyB3ZWVrZGF5OiAnc2hvcnQnIH0pXG4gICAgcmV0dXJuIHsgZGF0ZSwgZGF5LCAuLi5jb3VudHMsIHRvdGFsOiBjb3VudHMuZ3JhbnRlZCArIGNvdW50cy5kZW5pZWQgKyBjb3VudHMubG9ja2VkIH1cbiAgfSlcblxuICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24ocmVzdWx0KVxufVxuIl0sIm5hbWVzIjpbImNyZWF0ZUNsaWVudCIsIk5leHRSZXNwb25zZSIsIkdFVCIsInN1cGFiYXNlIiwicHJvY2VzcyIsImVudiIsIlNVUEFCQVNFX1VSTCIsIlNVUEFCQVNFX1NFUlZJQ0VfUk9MRV9LRVkiLCJzaW5jZSIsIkRhdGUiLCJzZXRVVENEYXRlIiwiZ2V0VVRDRGF0ZSIsInNldFVUQ0hvdXJzIiwiZGF0YSIsImVycm9yIiwiZnJvbSIsInNlbGVjdCIsImd0ZSIsInRvSVNPU3RyaW5nIiwianNvbiIsIm1lc3NhZ2UiLCJzdGF0dXMiLCJkYXlNYXAiLCJNYXAiLCJpIiwiZCIsInNldCIsInNsaWNlIiwiZ3JhbnRlZCIsImRlbmllZCIsImxvY2tlZCIsInJvdyIsImtleSIsImNyZWF0ZWRfYXQiLCJidWNrZXQiLCJnZXQiLCJsb2NrZWRfb3V0IiwicmVzdWx0IiwiQXJyYXkiLCJlbnRyaWVzIiwibWFwIiwiZGF0ZSIsImNvdW50cyIsImRheSIsInRvTG9jYWxlRGF0ZVN0cmluZyIsIndlZWtkYXkiLCJ0b3RhbCJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./app/api/stats/route.ts\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fstats%2Froute&page=%2Fapi%2Fstats%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fstats%2Froute.ts&appDir=%2FUsers%2Ffrida%2Fprojects%2Fdoor-agent%2Fhosting%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Ffrida%2Fprojects%2Fdoor-agent%2Fhosting&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!*****************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fstats%2Froute&page=%2Fapi%2Fstats%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fstats%2Froute.ts&appDir=%2FUsers%2Ffrida%2Fprojects%2Fdoor-agent%2Fhosting%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Ffrida%2Fprojects%2Fdoor-agent%2Fhosting&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \*****************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   workAsyncStorage: () => (/* binding */ workAsyncStorage),\n/* harmony export */   workUnitAsyncStorage: () => (/* binding */ workUnitAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/./node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _Users_frida_projects_door_agent_hosting_app_api_stats_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/stats/route.ts */ \"(rsc)/./app/api/stats/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/stats/route\",\n        pathname: \"/api/stats\",\n        filename: \"route\",\n        bundlePath: \"app/api/stats/route\"\n    },\n    resolvedPagePath: \"/Users/frida/projects/door-agent/hosting/app/api/stats/route.ts\",\n    nextConfigOutput,\n    userland: _Users_frida_projects_door_agent_hosting_app_api_stats_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { workAsyncStorage, workUnitAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        workAsyncStorage,\n        workUnitAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIvaW5kZXguanM/bmFtZT1hcHAlMkZhcGklMkZzdGF0cyUyRnJvdXRlJnBhZ2U9JTJGYXBpJTJGc3RhdHMlMkZyb3V0ZSZhcHBQYXRocz0mcGFnZVBhdGg9cHJpdmF0ZS1uZXh0LWFwcC1kaXIlMkZhcGklMkZzdGF0cyUyRnJvdXRlLnRzJmFwcERpcj0lMkZVc2VycyUyRmZyaWRhJTJGcHJvamVjdHMlMkZkb29yLWFnZW50JTJGaG9zdGluZyUyRmFwcCZwYWdlRXh0ZW5zaW9ucz10c3gmcGFnZUV4dGVuc2lvbnM9dHMmcGFnZUV4dGVuc2lvbnM9anN4JnBhZ2VFeHRlbnNpb25zPWpzJnJvb3REaXI9JTJGVXNlcnMlMkZmcmlkYSUyRnByb2plY3RzJTJGZG9vci1hZ2VudCUyRmhvc3RpbmcmaXNEZXY9dHJ1ZSZ0c2NvbmZpZ1BhdGg9dHNjb25maWcuanNvbiZiYXNlUGF0aD0mYXNzZXRQcmVmaXg9Jm5leHRDb25maWdPdXRwdXQ9JnByZWZlcnJlZFJlZ2lvbj0mbWlkZGxld2FyZUNvbmZpZz1lMzAlM0QhIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQStGO0FBQ3ZDO0FBQ3FCO0FBQ2U7QUFDNUY7QUFDQTtBQUNBO0FBQ0Esd0JBQXdCLHlHQUFtQjtBQUMzQztBQUNBLGNBQWMsa0VBQVM7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBLFlBQVk7QUFDWixDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsUUFBUSxzREFBc0Q7QUFDOUQ7QUFDQSxXQUFXLDRFQUFXO0FBQ3RCO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDMEY7O0FBRTFGIiwic291cmNlcyI6WyIiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQXBwUm91dGVSb3V0ZU1vZHVsZSB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL3JvdXRlLW1vZHVsZXMvYXBwLXJvdXRlL21vZHVsZS5jb21waWxlZFwiO1xuaW1wb3J0IHsgUm91dGVLaW5kIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvcm91dGUta2luZFwiO1xuaW1wb3J0IHsgcGF0Y2hGZXRjaCBhcyBfcGF0Y2hGZXRjaCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL2xpYi9wYXRjaC1mZXRjaFwiO1xuaW1wb3J0ICogYXMgdXNlcmxhbmQgZnJvbSBcIi9Vc2Vycy9mcmlkYS9wcm9qZWN0cy9kb29yLWFnZW50L2hvc3RpbmcvYXBwL2FwaS9zdGF0cy9yb3V0ZS50c1wiO1xuLy8gV2UgaW5qZWN0IHRoZSBuZXh0Q29uZmlnT3V0cHV0IGhlcmUgc28gdGhhdCB3ZSBjYW4gdXNlIHRoZW0gaW4gdGhlIHJvdXRlXG4vLyBtb2R1bGUuXG5jb25zdCBuZXh0Q29uZmlnT3V0cHV0ID0gXCJcIlxuY29uc3Qgcm91dGVNb2R1bGUgPSBuZXcgQXBwUm91dGVSb3V0ZU1vZHVsZSh7XG4gICAgZGVmaW5pdGlvbjoge1xuICAgICAgICBraW5kOiBSb3V0ZUtpbmQuQVBQX1JPVVRFLFxuICAgICAgICBwYWdlOiBcIi9hcGkvc3RhdHMvcm91dGVcIixcbiAgICAgICAgcGF0aG5hbWU6IFwiL2FwaS9zdGF0c1wiLFxuICAgICAgICBmaWxlbmFtZTogXCJyb3V0ZVwiLFxuICAgICAgICBidW5kbGVQYXRoOiBcImFwcC9hcGkvc3RhdHMvcm91dGVcIlxuICAgIH0sXG4gICAgcmVzb2x2ZWRQYWdlUGF0aDogXCIvVXNlcnMvZnJpZGEvcHJvamVjdHMvZG9vci1hZ2VudC9ob3N0aW5nL2FwcC9hcGkvc3RhdHMvcm91dGUudHNcIixcbiAgICBuZXh0Q29uZmlnT3V0cHV0LFxuICAgIHVzZXJsYW5kXG59KTtcbi8vIFB1bGwgb3V0IHRoZSBleHBvcnRzIHRoYXQgd2UgbmVlZCB0byBleHBvc2UgZnJvbSB0aGUgbW9kdWxlLiBUaGlzIHNob3VsZFxuLy8gYmUgZWxpbWluYXRlZCB3aGVuIHdlJ3ZlIG1vdmVkIHRoZSBvdGhlciByb3V0ZXMgdG8gdGhlIG5ldyBmb3JtYXQuIFRoZXNlXG4vLyBhcmUgdXNlZCB0byBob29rIGludG8gdGhlIHJvdXRlLlxuY29uc3QgeyB3b3JrQXN5bmNTdG9yYWdlLCB3b3JrVW5pdEFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICB3b3JrQXN5bmNTdG9yYWdlLFxuICAgICAgICB3b3JrVW5pdEFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHdvcmtBc3luY1N0b3JhZ2UsIHdvcmtVbml0QXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcywgcGF0Y2hGZXRjaCwgIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFwcC1yb3V0ZS5qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fstats%2Froute&page=%2Fapi%2Fstats%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fstats%2Froute.ts&appDir=%2FUsers%2Ffrida%2Fprojects%2Fdoor-agent%2Fhosting%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Ffrida%2Fprojects%2Fdoor-agent%2Fhosting&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(ssr)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "../app-render/after-task-async-storage.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/app-render/after-task-async-storage.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "./work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/@supabase","vendor-chunks/tslib","vendor-chunks/iceberg-js"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fstats%2Froute&page=%2Fapi%2Fstats%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fstats%2Froute.ts&appDir=%2FUsers%2Ffrida%2Fprojects%2Fdoor-agent%2Fhosting%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Ffrida%2Fprojects%2Fdoor-agent%2Fhosting&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();