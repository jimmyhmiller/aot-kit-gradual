type Tree = { value: number; left: Tree | null; right: Tree | null };
function build(depth: number, value: number): Tree {
  if (depth === 0) return {value: value, left: null, right: null};
  return {value: value, left: build(depth - 1, value + 1), right: build(depth - 1, value + 2)};
}
function sum(tree: Tree): number {
  if (tree.left === null) return tree.value;
  return tree.value + sum(tree.left) + sum(tree.right);
}

export function main(): number {
  let roots = [];
  for (let i = 0; i < 5; i++) roots[i] = build(4, i);
  let offset = 1;
  let read = function(index: number): number { return sum(roots[index]) + offset; };
  let label = 'native' + '-typescript';
  return (read(0) + read(4) + roots.length + label.length) | 0;
}
