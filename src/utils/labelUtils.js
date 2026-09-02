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

  // Split each word onto its own line for ultra-clean centered presentation
  const words = name.replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  let descLines = words.map(w => w.length > 12 ? w.substring(0, 12) : w);

  const resultLines = descLines.slice(0, 3);
  const skuLeft = sku.length > 12 ? sku.substring(0, 12) : sku;
  if (skuLeft) resultLines.push(skuLeft);

  return resultLines;
}

// Convert custom BarTender studio elements into 203 DPI TSPL printer commands
export function convertElementsToTSPL(elements, product, copies = 1) {
  let tspl = 'SIZE 63 mm, 11 mm\r\nGAP 3 mm, 0 mm\r\nDIRECTION 1\r\nCLS\r\n';

  const sku = (product.sku || '').replace(/"/g, '').toUpperCase();

  elements.forEach(el => {
    if (el.type === 'tail') return; // Adhesive tail is 100% blank

    // Convert mm to 203 DPI dots (1 mm = 8 dots)
    const xDots = Math.round(el.x * 8);
    const yDots = Math.round(el.y * 8);
    const wDots = Math.round((el.w || 14) * 8);
    const hDots = Math.round((el.h || 4) * 8);

    if (el.type === 'line') {
      tspl += `BAR ${xDots},${yDots},${wDots || 2},${hDots || 80}\r\n`;
      return;
    }

    if (el.type === 'barcode') {
      const isLongSku = sku.length > 9;
      const narrow = isLongSku ? 1 : 1;
      const bHeight = Math.max(16, hDots);
      tspl += `BARCODE ${xDots},${yDots},"128",${bHeight},0,0,${narrow},2,"${sku.substring(0, 15)}"\r\n`;
      return;
    }

    if (el.type === 'text') {
      let content = '';

      if (el.field === 'nombre') {
        const leftLines = getJewelryLeftLines(product.nombre, product.sku);
        const ySpacing = 14;
        const fontType = "1";

        leftLines.slice(0, 3).forEach((lineText, idx) => {
          let lineX = xDots;
          const charWidth = 8;
          const textWidth = lineText.length * charWidth;

          if (el.align === 'center') {
            lineX = Math.max(0, xDots + Math.round((wDots - textWidth) / 2));
          } else if (el.align === 'right') {
            lineX = Math.max(0, xDots + wDots - textWidth);
          }

          const lineY = yDots + (idx * ySpacing);
          tspl += `TEXT ${lineX},${lineY},"${fontType}",0,1,1,"${lineText}"\r\n`;
        });
        return;
      }

      if (el.field === 'sku') {
        content = sku.length > 12 ? sku.substring(0, 12) : sku;
      } else if (el.field === 'precio') {
        content = `${el.prefix || ''}${product.precioPublico || product.precio || 0}.00`;
      } else if (el.field === 'sku_precio') {
        content = `${sku}  $${product.precioPublico || product.precio || 0}`;
      } else {
        content = (el.customText || '').toUpperCase();
      }

      const fontType = "1";
      const charWidth = 8;
      const textWidth = content.length * charWidth;
      let textX = xDots;

      if (el.align === 'center') {
        textX = Math.max(0, xDots + Math.round((wDots - textWidth) / 2));
      } else if (el.align === 'right') {
        textX = Math.max(0, xDots + wDots - textWidth);
      }

      const rot = el.rotation || 0;
      tspl += `TEXT ${textX},${yDots},"${fontType}",${rot},1,1,"${content}"\r\n`;
    }
  });

  tspl += `PRINT ${copies},1\r\n`;
  return tspl;
}
