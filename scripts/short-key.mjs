// The anti-library page's 8-character code for a title key ("title|creator"), used to fit a big batch into one
// prefilled issue link. It must match shortKey in personal-portfolio site/antilibrary/app.js.
const CODE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function shortKey(key) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < key.length; i++) { const ch = key.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  let n = 4294967296 * (2097151 & h2) + (h1 >>> 0), code = '';
  for (let i = 0; i < 8; i++) { code += CODE[n % 64]; n = Math.floor(n / 64); }
  return code;
}
// Splits a run of codes and looks each one up in keysByCode (code -> key); an unknown code stops the run.
export function expandCodes(codes, keysByCode, where) {
  if (typeof codes !== 'string' || codes.length % 8) throw Error(`Bad codes in ${where}`);
  return codes.match(/.{8}/g).map(code => {
    const key = keysByCode.get(code);
    if (!key) throw Error(`No title matches code ${code} in ${where}`);
    return key;
  });
}
