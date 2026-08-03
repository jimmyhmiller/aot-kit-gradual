// Supported-subset note: tree nodes use structural object literals. JavaScript prototype
// semantics are outside this kernel; constructor-return semantics have their own frontend case.
type Tree = { left: Tree | null; right: Tree | null };
type Result = {
  stretchDepth: number; stretchCheck: number;
  depth4: number; iterations4: number; check4: number;
  depth6: number; iterations6: number; check6: number;
  depth8: number; iterations8: number; check8: number;
  depth10: number; iterations10: number; check10: number;
  depth12: number; iterations12: number; check12: number;
  depth14: number; iterations14: number; check14: number;
  depth16: number; iterations16: number; check16: number;
  depth18: number; iterations18: number; check18: number;
  depth20: number; iterations20: number; check20: number;
  longLivedDepth: number; longLivedCheck: number;
};

function bottomUpTree(depth: number): Tree {
  if (depth < 1) return { left: null, right: null };
  let next = depth - 1;
  return { left: bottomUpTree(next), right: bottomUpTree(next) };
}

function itemCheck(tree: Tree): number {
  if (tree.left === null) return 1;
  return 1 + itemCheck(tree.left) + itemCheck(tree.right);
}

function pow2(exponent: number): number {
  if (exponent < 1) return 1;
  return 2 * pow2(exponent - 1);
}

function work(depth: number, iterations: number): number {
  let i = 0;
  let sum = 0;
  while (i < iterations) {
    sum = sum + itemCheck(bottomUpTree(depth));
    i = i + 1;
  }
  return sum;
}

function iterationsAt(maxDepth: number, depth: number): number {
  if (depth > maxDepth) return 0;
  return pow2(maxDepth - depth + 4);
}

export function main(maxDepth: number): Result {
  let stretchDepth = maxDepth + 1;
  let stretchCheck = itemCheck(bottomUpTree(stretchDepth));
  let longLivedTree = bottomUpTree(maxDepth);
  let i4 = iterationsAt(maxDepth, 4); let c4 = work(4, i4);
  let i6 = iterationsAt(maxDepth, 6); let c6 = work(6, i6);
  let i8 = iterationsAt(maxDepth, 8); let c8 = work(8, i8);
  let i10 = iterationsAt(maxDepth, 10); let c10 = work(10, i10);
  let i12 = iterationsAt(maxDepth, 12); let c12 = work(12, i12);
  let i14 = iterationsAt(maxDepth, 14); let c14 = work(14, i14);
  let i16 = iterationsAt(maxDepth, 16); let c16 = work(16, i16);
  let i18 = iterationsAt(maxDepth, 18); let c18 = work(18, i18);
  let i20 = iterationsAt(maxDepth, 20); let c20 = work(20, i20);
  return {
    stretchDepth: stretchDepth, stretchCheck: stretchCheck,
    depth4: 4, iterations4: i4, check4: c4,
    depth6: 6, iterations6: i6, check6: c6,
    depth8: 8, iterations8: i8, check8: c8,
    depth10: 10, iterations10: i10, check10: c10,
    depth12: 12, iterations12: i12, check12: c12,
    depth14: 14, iterations14: i14, check14: c14,
    depth16: 16, iterations16: i16, check16: c16,
    depth18: 18, iterations18: i18, check18: c18,
    depth20: 20, iterations20: i20, check20: c20,
    longLivedDepth: maxDepth, longLivedCheck: itemCheck(longLivedTree)
  };
}
