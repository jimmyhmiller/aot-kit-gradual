function main(n) {
  Object.defineProperty(String.prototype, "receiverProbe", {
    configurable: true,
    get: function () {
      "use strict";
      return typeof this === "string" && this === "abc" ? 1 : 100;
    }
  });
  Boolean.prototype.inheritedProbe = 4;

  if ("abc".receiverProbe !== 1) return 101;
  if (true.inheritedProbe !== 4) return 102;

  let nullThrew = false;
  try { null.receiverProbe; } catch (error) { nullThrew = error instanceof TypeError; }
  if (!nullThrew) return 103;

  let undefinedThrew = false;
  try { undefined.receiverProbe; } catch (error) { undefinedThrew = error instanceof TypeError; }
  if (!undefinedThrew) return 104;

  return n | 0;
}
