const ownOnly = process.env.AOT_B11_OWN_ONLY === "1";
const omitMutation = process.env.AOT_B11_OMIT_MUTATION === "1";

function read(object, name) {
  if (!ownOnly) return object[name];
  return Object.prototype.hasOwnProperty.call(object, name) ? object[name] : undefined;
}

const prototype = { inherited: 20, shadowed: 3 };
const object = Object.create(prototype);
object.own = 10;
object.shadowed = 7;
object.late = 1;
if (!omitMutation) object.late = 9;

function Box(value) { this.value = value; }
Box.prototype.bump = function (amount) { return this.value + amount; };
const instance = new Box(40);
const bump = read(instance, "bump");

console.log(`lookup|${read(object, "own")}|${read(object, "inherited")}`);
console.log(`shadow|${read(object, "shadowed")}|${prototype.shadowed}`);
console.log(`transition|${object.own}|${object.late}|${String(read(object, "missing"))}`);
console.log(`constructor-prototype|${bump === undefined ? -1 : bump.call(instance, 2)}|${Object.getPrototypeOf(instance) === Box.prototype ? 1 : 0}`);
