export const PROBLEM_MEDIA_TYPE=`application/problem+json`;export function isProblem(e){if(typeof e!=`object`||!e||Array.isArray(e))return!1;let t=e,n=(e,n)=>e in t&&typeof t[e]===n,r=t.fields,i=typeof r==`object`&&!!r&&!Array.isArray(r);return n(`title`,`string`)||n(`status`,`number`)||n(`detail`,`string`)||n(`type`,`string`)||i}
//# sourceMappingURL=problem.js.map
