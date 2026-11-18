import {readFileSync} from 'node:fs';
const names=['orquestador','politicas','datos','analista','ingesta'];
export const prompts=Object.fromEntries(names.map(name=>[name,readFileSync(new URL(`../prompts/prompt_${name}.txt`,import.meta.url),'utf8')]));
