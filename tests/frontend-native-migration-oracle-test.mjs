import { assertNativeGraph } from "./frontend-native-graph-regression.mjs";

const nativePath = process.argv[2];
if (!nativePath) throw new Error("usage: frontend-native-migration-oracle-test.mjs NATIVE_GRAPH.txt");
assertNativeGraph("full", nativePath);
