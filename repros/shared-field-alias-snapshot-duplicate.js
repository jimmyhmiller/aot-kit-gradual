// Two fields sharing one alias entry -- {p, q}'s p and a later {p}'s p -- left the same alias
// in a control snapshot's active list TWICE after the field->alias mapping. Each list entry
// records its own memory state, the duplicates diverged once node processing order changed, and
// the ternary's merge built two mem#1 phis under one MemMerge:
//
//   evaluator stopped: a memory edge does not describe the alias class being touched
//
// Latent while duplicate entries happened to record identical states; the fuzzer found it as
// ops = ((Store) (Barrier) (CallEnd)) after a hash-order change. fng-control-aliases! now
// compacts to first occurrence. node says 8 for main(0).
function main(n: number): number {
  let acc = n | 0;
  { let cs0 = {p: acc, q: 1}; cs0.q = cs0.p; acc = (cs0.p + cs0.q + 1) | 0; }
  { let bi1 = {v: acc}; let bo1: any = {p: null}; bo1.p = bi1; acc = (bo1.p.v + 3) | 0; }
  { const ce2 = (x: number): number => (x + 4) | 0; acc = ((acc & 1) === 0) ? ce2(acc) : (acc - 4) | 0; }
  return acc | 0;
}
