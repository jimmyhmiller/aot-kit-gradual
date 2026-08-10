function localScore(): number {
  let effects = 0;
  const a: any = undefined;
  const b: any = null;
  const c: any = 0;
  const d: any = false;
  const e: any = "";
  const ra = a ?? (effects += 10);
  const rb = b ?? (effects += 20);
  const rc = c ?? (effects += 30);
  const rd = d ?? (effects += 40);
  const re = e ?? (effects += 50);
  return (ra * 100 + rb * 10 + rc + (typeof rd === "boolean" ? 3 : 0)
    + (typeof re === "string" ? 4 : 0) + effects) | 0;
}

function heapScore(): number {
  const effects: number[] = [];
  const missing: any = undefined;
  const present: any = 0;
  missing ?? effects.push(7);
  present ?? effects.push(9);
  return (effects.length * 10 + effects[0]) | 0;
}

export function main(): number {
  return (localScore() + heapScore()) | 0;
}
