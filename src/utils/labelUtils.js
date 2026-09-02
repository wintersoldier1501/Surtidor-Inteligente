// Independent utility helper for jewelry label layout and formatting
export function getJewelryLeftLines(rawNombre = '', rawSku = '') {
  const sku = (rawSku || '').trim().toUpperCase();
  let name = (rawNombre || '').trim().toUpperCase();

  if (sku) {
    const skuClean = sku.replace(/[^A-Z0-9]/g, '');
    let nameWords = name.replace(/-/g, ' ').split(/\s+/).filter(Boolean);

    while (nameWords.length > 0) {
      const lastWord = nameWords[nameWords.length - 1].replace(/[^A-Z0-9]/g, '');
      if (!lastWord) {
        nameWords.pop();
        continue;
      }
      if (skuClean.includes(lastWord) || (lastWord.length >= 3 && skuClean.startsWith(lastWord))) {
        nameWords.pop();
      } else {
        break;
      }
    }
    name = nameWords.join(' ');
  }

  const words = name.replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  let descLines = [];
  let cur = "";

  words.forEach(w => {
    if ((cur + " " + w).trim().length <= 11) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) descLines.push(cur);
      cur = w.length > 11 ? w.substring(0, 11) : w;
    }
  });
  if (cur) descLines.push(cur);

  const resultLines = descLines.slice(0, 3);
  const skuLeft = sku.length > 10 ? sku.substring(0, 10) : sku;
  if (skuLeft) resultLines.push(skuLeft);

  return resultLines;
}
