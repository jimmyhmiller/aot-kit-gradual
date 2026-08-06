import { assertNativeGraph } from "./frontend-native-graph-regression.mjs";

const nativePath = process.argv[2];
if (!nativePath) throw new Error("usage: frontend-native-exact-graph-test.mjs NATIVE_GRAPH.txt");

assertNativeGraph("basic", nativePath);
