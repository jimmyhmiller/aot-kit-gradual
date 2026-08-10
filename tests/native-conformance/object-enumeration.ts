export function main(): number {
  let object: any = {};
  object.later = 7;
  object["10"] = 5;
  object["2"] = 3;
  object.earlier = 11;

  let keys = Object.keys(object);
  // @ts-ignore — the bridge's ambient lib predates Object.values/entries.
  let values = Object.values(object);
  // @ts-ignore — runtime support is what this conformance case exercises.
  let entries = Object.entries(object);

  let ordering = (keys[0] === "2" ? 1 : 0)
               + (keys[1] === "10" ? 2 : 0)
               + (keys[2] === "later" ? 4 : 0)
               + (keys[3] === "earlier" ? 8 : 0);
  let payload = values[0] + values[1] + values[2] + values[3];
  let pairs = (entries[0][0] === "2" ? entries[0][1] : 0)
            + (entries[3][0] === "earlier" ? entries[3][1] : 0);

  let sparse: any = [];
  sparse[2] = 13;
  sparse.extra = 17;
  let sparseKeys = Object.keys(sparse);
  let sparseValues = Object.values(sparse);
  let sparseCheck = (sparseKeys[0] === "2" ? 20 : 0)
                  + (sparseKeys[1] === "extra" ? 40 : 0)
                  + sparseValues[0] + sparseValues[1];

  let stringKeys = Object.keys("ab");
  let stringValues = Object.values("ab");
  let stringEntries = Object.entries("ab");
  let primitiveCheck = (stringKeys[0] === "0" ? 80 : 0)
                     + (stringKeys[1] === "1" ? 160 : 0)
                     + (stringValues[0] === "a" ? 320 : 0)
                     + (stringEntries[1][1] === "b" ? 640 : 0)
                     + Object.keys(7).length;
  return (ordering * 100 + payload + pairs + sparseCheck + primitiveCheck) | 0;
}
