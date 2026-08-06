export function main(): number {
  let text = 'co' + 'il';
  return (text.length + text.charCodeAt(1) + text.substring(1, 3).length
    + text.substr(-2, 1).length + text.slice(-3, -1).length + text.charAt(9).length
    + parseInt('1f', 16) + parseInt(7) + parseInt(7 / 2)
    + String(-42).length + String(true).length + String(null).length
    + String(undefined).length + String(NaN).length + String(1 / 2).length
    + (255).toString(16).length
    + (isNaN(undefined) ? 1 : 0) + (isNaN(null) ? 1 : 0) + (isNaN('12x') ? 1 : 0)) | 0;
}
