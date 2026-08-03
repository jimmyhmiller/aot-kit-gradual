# Benchmark results

Generated 2026-08-03T03:53:50.949Z on darwin arm64, Node v26.5.0. Ratio is kit/V8; above 1 is slower. No losses are hidden.

| Benchmark | Unit | Kit median | V8 median | Ratio | Result |
|---|---:|---:|---:|---:|---|
| arm64-addmul-call | ns/op | 2.053 | 10.494 | 0.196× | win |
| typescript-compile | ns/compile | 16463.208 | 245.834 | 66.969× | loss |
| structural-load | ns/op | 199.900 | 10.120 | 19.754× | loss |

## Raw samples

- arm64-addmul-call kit: 2.032, 2.069, 2.043, 2.019, 2.117, 2.086, 2.053, 2.051, 2.131
  V8: 10.855, 10.437, 10.724, 10.603, 10.492, 10.359, 10.494, 10.482, 10.515
- typescript-compile kit: 19300.083, 17993.416, 17247.500, 17763.458, 16056.791, 16275.333, 16375.500, 16463.208, 15710.209
  V8: 289.375, 264.417, 277.958, 214.416, 221.208, 264.667, 225.542, 219.750, 245.834
- structural-load kit: 218.990, 205.770, 206.915, 207.214, 199.900, 191.797, 192.088, 195.655, 192.164
  V8: 12.907, 10.110, 10.120, 10.832, 9.881, 9.402, 9.862, 10.211, 10.943

## Specialization profile

`dynamic-add`: 1,000 samples; number 900, string 100; clone cost 7. The 90% dominant target passes the 80%/32-sample/32-cost model.
