// Request comparison preserves time bounds and per-filter limits.
export const ordered = v => Array.isArray(v)?v.map(ordered):v&&typeof v==='object'
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
export const canonical = v => Array.isArray(v)?v.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
  :v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const equalKind=(f,ks)=>f.kinds?.length===ks.length&&ks.every(k=>f.kinds.includes(k));
export function family(filters){
  if(filters.every(f=>f['#e']?.length&&equalKind(f,[1,6,7,9735])))return 'counts';
  if(filters.every(f=>equalKind(f,[0])))return 'profiles';
  if(filters.every(f=>equalKind(f,[3])))return 'follows';
  if(filters.every(f=>equalKind(f,[10002])))return 'relay-lists';
  if(filters.some(f=>f['#p']))return 'notifications-or-tagged-context';
  if(filters.some(f=>f.authors?.length))return 'authored';
  if(filters.some(f=>f.ids?.length))return 'ids';
  return 'other';
}
