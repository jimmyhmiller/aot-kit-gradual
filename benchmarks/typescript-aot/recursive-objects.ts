type Tree = {value: number; left: Tree | null; right: Tree | null};

function build(depth: number, value: number): Tree {
  if (depth === 0) return {value: value, left: null, right: null};
  return {value: value, left: build(depth - 1, value + 1), right: build(depth - 1, value + 2)};
}

function sum(tree: Tree): number {
  if (tree.left === null) return tree.value;
  return tree.value + sum(tree.left) + sum(tree.right);
}

export function main(depth: number): number {
  return sum(build(depth, 1)) | 0;
}
