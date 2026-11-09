import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../studio.js",import.meta.url),"utf8");
test("import adds the loaded GLTF scene even when original is null for rigged files",()=>{
 assert.match(source,/original=info\.alreadyRigged\?null:next/);
 assert.match(source,/scene\.add\(next\);\s*next\.visible=true/);
 assert.doesNotMatch(source,/scene\.add\(original\);\s*original\.visible=true/);
});
test("switching preview modes is guarded against a null original object",()=>{
 assert.match(source,/if\(original\)original\.visible=/);
 assert.match(source,/if\(rigged\)rigged\.visible=/);
});
