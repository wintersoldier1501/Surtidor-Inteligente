import React, { useState, useEffect, useRef } from 'react';
import { Tag, Printer, X, Plus, Trash2, Upload, Search, Check, AlertCircle, RefreshCw } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import BarTenderLabelDesigner from './BarTenderLabelDesigner';

export default function LabelPrinterModal({ isOpen, onClose, initialProducts = [], allProducts = [] }) {
  const [printQueue, setPrintQueue] = useState([]);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'excel', 'search'
  const [searchQuery, setSearchQuery] = useState('');
  const [excelMsg, setExcelMsg] = useState(null);
  const [showDesigner, setShowDesigner] = useState(false);

  // Initialize print queue when opened with initialProducts from Surtidor
  useEffect(() => {
    if (isOpen && initialProducts && initialProducts.length > 0) {
      const formatted = initialProducts.map(p => ({
        sku: p.sku,
        nombre: p.nombre,
        categoria: p.categoria || 'Otros',
        precio: p.precioPublico || 0,
        copias: 1,
        seleccionado: true,
        // Auto-detect format: Aretes & Piercings default to 'vertical', others default to 'horizontal'
        formato: isEarringCategory(p.categoria, p.nombre) ? 'vertical' : 'horizontal'
      }));
      setPrintQueue(formatted);
    }
  }, [isOpen, initialProducts]);

  if (!isOpen) return null;

  // Helper to detect if item is Arete / Piercing for vertical auto-format
  function isEarringCategory(cat = '', name = '') {
    const c = cat.toLowerCase();
    const n = name.toLowerCase();
    return c.includes('arete') || c.includes('piercing') || n.includes('arete') || n.includes('stud') || n.includes('earcuff') || n.includes('arracada');
  }

  // Handle Excel Upload for Labels
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (data && data.length > 0) {
          const newItems = [];
          data.forEach(row => {
            // Flexible column detection for SKU, Name, Price, Qty
            const sku = String(row['SKU'] || row['Sku'] || row['sku'] || row['CLAVE'] || row['Clave'] || row['Codigo'] || row['CÓDIGO'] || '').trim();
            const nombre = String(row['NOMBRE'] || row['Nombre'] || row['DESCRIPCION'] || row['Descripcion'] || row['Producto'] || '').trim() || sku;
            const precioRaw = row['PRECIO'] || row['Precio'] || row['P.PUBLICO'] || row['P.Publico'] || 0;
            const precio = parseFloat(String(precioRaw).replace(/[^0-9.]/g, '')) || 0;
            const copias = parseInt(row['CANTIDAD'] || row['Cantidad'] || row['COPIAS'] || row['Copias'] || 1) || 1;
            const cat = String(row['CATEGORIA'] || row['Categoria'] || '').trim();

            if (sku) {
              newItems.push({
                sku,
                nombre,
                categoria: cat || 'Otros',
                precio,
                copias,
                formato: isEarringCategory(cat, nombre) ? 'vertical' : 'horizontal'
              });
            }
          });

          if (newItems.length > 0) {
            setPrintQueue(prev => [...prev, ...newItems]);
            setExcelMsg({ type: 'success', text: `¡Se cargaron ${newItems.length} productos desde el Excel correctamente!` });
            setTimeout(() => setExcelMsg(null), 4000);
            setActiveTab('queue');
          } else {
            setExcelMsg({ type: 'error', text: 'No se encontraron columnas de SKU o Clave válidas en el Excel.' });
          }
        }
      } catch (err) {
        console.error('Error al leer Excel de etiquetas:', err);
        setExcelMsg({ type: 'error', text: 'Error al procesar el archivo Excel.' });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Add product from Catalog search
  const handleAddProductFromCatalog = (prod) => {
    const existingIndex = printQueue.findIndex(item => item.sku === prod.sku);
    if (existingIndex >= 0) {
      setPrintQueue(prev => {
        const next = [...prev];
        next[existingIndex].copias += 1;
        return next;
      });
    } else {
      setPrintQueue(prev => [
        ...prev,
        {
          sku: prod.sku,
          nombre: prod.nombre,
          categoria: prod.categoria || 'Otros',
          precio: prod.precioPublico || 0,
          copias: 1,
          formato: isEarringCategory(prod.categoria, prod.nombre) ? 'vertical' : 'horizontal'
        }
      ]);
    }
  };

  // Filter Catalog Products for Search
  const filteredCatalog = allProducts.filter(p => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return p.sku.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q);
  }).slice(0, 15);

  // Update Item Quantity or Format
  const updateQueueItem = (index, key, val) => {
    setPrintQueue(prev => {
      const next = [...prev];
      next[index][key] = val;
      return next;
    });
  };

  // Remove Item from Queue
  const removeQueueItem = (index) => {
    setPrintQueue(prev => prev.filter((_, i) => i !== index));
  };

  // Bulk Select / Deselect
  const handleSelectAll = (val) => {
    setPrintQueue(prev => prev.map(item => ({ ...item, seleccionado: val })));
  };

  // Active Queue (only selected items)
  const activeQueue = printQueue.filter(item => item.seleccionado !== false);

  // Total Labels Count for Active Selected Queue
  const totalLabelsToPrint = activeQueue.reduce((acc, item) => acc + (parseInt(item.copias) || 1), 0);

  // Generate Exact Vector PDF (63mm x 11mm)
  const handleGeneratePDF = () => {
    if (activeQueue.length === 0) return;

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [63, 11]
      });

      let pageIndex = 0;

      activeQueue.forEach(item => {
        const copies = Math.max(1, parseInt(item.copias) || 1);
        
        // Render Code128 Barcode as image for PDF
        let barcodeDataUrl = null;
        if (item.formato === 'horizontal' && item.sku) {
          try {
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, item.sku, {
              format: "CODE128",
              width: 2,
              height: 35,
              displayValue: false,
              margin: 0
            });
            barcodeDataUrl = canvas.toDataURL('image/png');
          } catch (e) {
            console.warn('Barcode PDF render error:', e);
          }
        }

        for (let c = 0; c < copies; c++) {
          if (pageIndex > 0) {
            doc.addPage([63, 11], 'portrait');
          }

          if (item.formato === 'vertical') {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(`${item.sku}  $${item.precio}`, 15, 6, { angle: 90 });
            doc.text(`${item.sku}  $${item.precio}`, 45, 6, { angle: 90 });
          } else {
            // Divider line between name and price/barcode
            doc.setLineWidth(0.3);
            doc.line(26, 0, 26, 11);

            // Product Name (left side)
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            const splitTitle = doc.splitTextToSize((item.nombre || '').toUpperCase(), 24);
            doc.text(splitTitle, 13, 4.2, { align: 'center' });

            // Price (top right)
            doc.setFontSize(8);
            doc.text(`$ ${item.precio}.00`, 60, 3.2, { align: 'right' });

            // Barcode (middle right)
            if (barcodeDataUrl) {
              doc.addImage(barcodeDataUrl, 'PNG', 28, 4, 32, 4);
            }

            // SKU (bottom right)
            doc.setFontSize(7);
            doc.text(item.sku, 44, 9.8, { align: 'center' });
          }

          pageIndex++;
        }
      });

      const pdfBlob = doc.output('bloburl');
      window.open(pdfBlob, '_blank');
    } catch (err) {
      console.error('PDF generation error:', err);
    }
  };

  // Generate Native TSPL Thermal Printer Code File (.prn)
  const handleGenerateTSPL = () => {
    if (activeQueue.length === 0) return;

    let tspl = 'SIZE 63 mm, 11 mm\r\nGAP 3 mm, 0 mm\r\nDIRECTION 1\r\nCLS\r\n';

    activeQueue.forEach(item => {
      const copies = Math.max(1, parseInt(item.copias) || 1);
      const nameEscaped = (item.nombre || '').replace(/"/g, '');
      const skuEscaped = (item.sku || '').replace(/"/g, '');

      tspl += `CLS\r\n`;
      if (item.formato === 'vertical') {
        tspl += `TEXT 120,80,"3",90,1,1,"${skuEscaped}  $${item.precio}"\r\n`;
        tspl += `TEXT 360,80,"3",90,1,1,"${skuEscaped}  $${item.precio}"\r\n`;
      } else {
        tspl += `TEXT 10,10,"2",0,1,1,"${nameEscaped.substring(0, 25)}"\r\n`;
        tspl += `TEXT 350,10,"3",0,1,1,"$ ${item.precio}.00"\r\n`;
        tspl += `BARCODE 250,30,"128",30,1,0,2,2,"${skuEscaped}"\r\n`;
        tspl += `TEXT 280,70,"2",0,1,1,"${skuEscaped}"\r\n`;
      }
      tspl += `PRINT ${copies},1\r\n`;
    });

    const blob = new Blob([tspl], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `etiquetas_accesorizate_${Date.now()}.prn`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger Native Browser Print Dialog
  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.92)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Modal Header */}
      <div className="no-print" style={{
        padding: '16px 28px',
        borderBottom: '1px solid var(--border-color)',
        background: '#0d0d0d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid var(--gold-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--gold-primary)'
          }}>
            <Tag size={22} />
          </div>
          <div>
            <h2 style={{ color: '#fff', fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              Impresor de Etiquetas Calibradas (Ribetec / TSC 63x11mm)
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
              Formato auto-ajustable sin desbordamiento para Aretes (Vertical) y Joyería General (Horizontal con Código de Barras).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn btn-gold" onClick={() => setShowDesigner(true)} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
            <RefreshCw size={16} />
            <span>🎨 Diseñador BarTender / LabelJoy</span>
          </button>

          <button className="btn btn-gold" onClick={handleGeneratePDF} disabled={activeQueue.length === 0} title="Genera un PDF con tamaño 63x11mm por hoja">
            <Printer size={16} />
            <span>📄 Generar PDF (63x11mm)</span>
          </button>

          <button className="btn btn-outline" onClick={handleGenerateTSPL} disabled={activeQueue.length === 0} title="Descarga código térmico nativo para enviar directo a la impresora">
            <Upload size={16} />
            <span>⚡ Comando Térmico TSPL (.prn)</span>
          </button>

          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="no-print" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Left Sidebar: Controls & Product Search / Excel Upload */}
        <div style={{ width: '400px', borderRight: '1px solid var(--border-color)', background: '#050505', display: 'flex', flexDirection: 'column' }}>
          
          {/* Sub-tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#0a0a0a' }}>
            <button
              onClick={() => setActiveTab('queue')}
              style={{
                flex: 1,
                padding: '12px',
                background: activeTab === 'queue' ? '#000000' : 'transparent',
                color: activeTab === 'queue' ? 'var(--gold-primary)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: activeTab === 'queue' ? '2px solid var(--gold-primary)' : '2px solid transparent',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Lista ({printQueue.length})
            </button>
            <button
              onClick={() => setActiveTab('search')}
              style={{
                flex: 1,
                padding: '12px',
                background: activeTab === 'search' ? '#000000' : 'transparent',
                color: activeTab === 'search' ? 'var(--gold-primary)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: activeTab === 'search' ? '2px solid var(--gold-primary)' : '2px solid transparent',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              🔍 Buscar Catálogo
            </button>
            <button
              onClick={() => setActiveTab('excel')}
              style={{
                flex: 1,
                padding: '12px',
                background: activeTab === 'excel' ? '#000000' : 'transparent',
                color: activeTab === 'excel' ? 'var(--gold-primary)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: activeTab === 'excel' ? '2px solid var(--gold-primary)' : '2px solid transparent',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              📄 Cargar Excel
            </button>
          </div>

          {/* Tab 1: Queue Actions */}
          {activeTab === 'queue' && (
            <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Imprimir: <strong style={{ color: 'var(--gold-primary)' }}>{activeQueue.length} de {printQueue.length}</strong> ({totalLabelsToPrint} copias)
                </span>
                {printQueue.length > 0 && (
                  <button
                    className="btn btn-outline"
                    onClick={() => setPrintQueue([])}
                    style={{ padding: '3px 8px', fontSize: '0.72rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                  >
                    <Trash2 size={12} /> Limpiar
                  </button>
                )}
              </div>

              {printQueue.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => handleSelectAll(true)}
                    style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 1 }}
                  >
                    ☑️ Seleccionar Todo
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => handleSelectAll(false)}
                    style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 1 }}
                  >
                    ☐ Deseleccionar Todo
                  </button>
                </div>
              )}

              {printQueue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                  <Tag size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.9rem' }}>No hay etiquetas en la lista.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>Busca productos del catálogo o carga un Excel para generar tus etiquetas libremente.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {printQueue.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        background: '#0e0e0e',
                        border: item.seleccionado ? '1px solid var(--gold-primary)' : '1px solid var(--border-color)',
                        borderRadius: '8px',
                        opacity: item.seleccionado ? 1 : 0.45,
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={item.seleccionado !== false}
                            onChange={(e) => updateQueueItem(idx, 'seleccionado', e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--gold-primary)', cursor: 'pointer' }}
                          />
                          <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '0.9rem' }}>{item.sku}</span>
                        </div>
                        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>${item.precio}</span>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '26px' }}>
                        {item.nombre}
                      </p>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {/* Format selector */}
                        <select
                          className="input-field"
                          value={item.formato}
                          onChange={(e) => updateQueueItem(idx, 'formato', e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }}
                        >
                          <option value="horizontal">🏷️ Estándar (Nombre + Code128)</option>
                          <option value="vertical">👂 Arete (Vertical Compacto)</option>
                        </select>

                        {/* Copies selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Copias:</span>
                          <input
                            type="number"
                            min={1}
                            max={500}
                            value={item.copias}
                            onChange={(e) => updateQueueItem(idx, 'copias', parseInt(e.target.value) || 1)}
                            style={{ width: '50px', padding: '4px 6px', fontSize: '0.8rem', textAlign: 'center' }}
                            className="input-field"
                          />
                        </div>

                        <button
                          onClick={() => removeQueueItem(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }}
                          title="Quitar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Catalog Search */}
          {activeTab === 'search' && (
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '14px' }}>
                <input
                  type="text"
                  placeholder="Buscar por SKU o Descripción..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  autoFocus
                />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!searchQuery.trim() ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', marginTop: '20px' }}>
                    Escribe un código (ej: AX010G) o nombre para agregar productos.
                  </p>
                ) : filteredCatalog.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', marginTop: '20px' }}>
                    No se encontraron coincidencias.
                  </p>
                ) : (
                  filteredCatalog.map((prod) => (
                    <div
                      key={prod.sku}
                      onClick={() => handleAddProductFromCatalog(prod)}
                      style={{
                        padding: '10px 12px',
                        background: '#0a0a0a',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.15s'
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '0.88rem' }}>{prod.sku}</span>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                          {prod.nombre}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>${prod.precioPublico}</span>
                        <button className="btn btn-gold" style={{ padding: '3px 8px', fontSize: '0.75rem' }}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Excel Upload */}
          {activeTab === 'excel' && (
            <div style={{ padding: '24px 16px', flex: 1 }}>
              <div style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '32px 16px',
                textAlign: 'center',
                background: '#0a0a0a',
                cursor: 'pointer'
              }}>
                <Upload size={36} color="var(--gold-primary)" style={{ marginBottom: '12px' }} />
                <h4 style={{ color: '#fff', fontSize: '0.98rem', marginBottom: '6px' }}>Subir Excel de Etiquetas</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>
                  Sube un archivo con columnas <strong>SKU, Nombre, Precio y Cantidad</strong>.
                </p>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelUpload}
                  style={{ display: 'none' }}
                  id="excelLabelUploadInput"
                />
                <label htmlFor="excelLabelUploadInput" className="btn btn-gold" style={{ cursor: 'pointer' }}>
                  Seleccionar Archivo Excel
                </label>
              </div>

              {excelMsg && (
                <div style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: excelMsg.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
                  color: excelMsg.type === 'error' ? '#f87171' : '#34d399',
                  fontSize: '0.85rem',
                  border: '1px solid rgba(52, 211, 153, 0.3)'
                }}>
                  {excelMsg.text}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Preview & Sheet Rendering Canvas */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#000000', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          <div style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            VISTA PREVIA EN PANTALLA (MEDIDA EXACTA 63mm x 11mm PARA RIBETEC RT-420ME / TSC T-200)
          </div>

          {activeQueue.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Printer size={64} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p style={{ fontSize: '1.1rem' }}>No hay etiquetas seleccionadas para vista previa o impresión.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>Marca las casillas ☑️ de las etiquetas que deseas imprimir en el panel izquierdo.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
              {activeQueue.map((item, idx) => (
                <div key={idx} style={{ background: '#111', padding: '12px', borderRadius: '10px', border: '1px solid var(--gold-primary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', marginBottom: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Etiqueta {idx + 1} ({item.copias} {item.copias === 1 ? 'copia' : 'copias'})</span>
                    <span>{item.formato === 'vertical' ? '👂 Vertical Aretes' : '🏷️ Estándar'}</span>
                  </div>

                  {/* Exact 63mm x 11mm Label Simulation Frame (Scaled 3.2x for screen clarity) */}
                  <SingleLabelPreview item={item} scale={3.2} />
                </div>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* PRINT-ONLY CONTAINER (Renders actual printable labels when window.print() is called) */}
      <div className="print-only">
        {activeQueue.flatMap((item) =>
          Array.from({ length: Math.max(1, parseInt(item.copias) || 1) }).map((_, cIdx) => (
            <PrintableSingleLabel key={`${item.sku}-${cIdx}`} item={item} />
          ))
        )}
      </div>

      {/* BarTender Visual Studio Designer Modal */}
      <BarTenderLabelDesigner
        isOpen={showDesigner}
        onClose={() => setShowDesigner(false)}
        sampleProduct={activeQueue[0] || allProducts[0]}
        allProducts={allProducts}
      />

    </div>
  );
}

// Sub-component: Screen Preview of Single Label (63mm x 11mm scaled)
function SingleLabelPreview({ item, scale = 3.2 }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && item.formato === 'horizontal' && item.sku) {
      try {
        JsBarcode(barcodeRef.current, item.sku, {
          format: "CODE128",
          width: 1.2,
          height: 24,
          displayValue: false,
          margin: 0
        });
      } catch (err) {
        console.warn('JsBarcode render error for SKU:', item.sku);
      }
    }
  }, [item.sku, item.formato]);

  // Width: 63mm (approx 238px at 96dpi), Height: 11mm (approx 41.5px at 96dpi)
  const widthPx = 63 * 3.78 * (scale / 3.5);
  const heightPx = 11 * 3.78 * (scale / 3.5);

  // Dynamic auto-fit font sizes based on text length
  const nameLength = (item.nombre || '').length;
  const skuLength = (item.sku || '').length;

  let nameFontSize = '10px';
  if (nameLength > 30) nameFontSize = '7px';
  else if (nameLength > 20) nameFontSize = '8px';
  else if (nameLength > 14) nameFontSize = '9px';

  let skuFontSize = '11px';
  if (skuLength > 12) skuFontSize = '8.5px';
  else if (skuLength > 9) skuFontSize = '9.5px';

  return (
    <div
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        background: '#ffffff',
        color: '#000000',
        border: '1px solid #000000',
        borderRadius: '2px',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {item.formato === 'vertical' ? (
        /* FORMAT B: Aretes / Piercings (Vertical Layout: SKU + $Precio) */
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 8px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '8px',
            transform: 'rotate(-90deg)',
            transformOrigin: 'center center',
            whiteSpace: 'nowrap',
            fontWeight: 'bold',
            fontSize: '12px'
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: skuFontSize }}>{item.sku}</span>
            <span>${item.precio}</span>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '8px',
            transform: 'rotate(-90deg)',
            transformOrigin: 'center center',
            whiteSpace: 'nowrap',
            fontWeight: 'bold',
            fontSize: '12px'
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: skuFontSize }}>{item.sku}</span>
            <span>${item.precio}</span>
          </div>
        </div>
      ) : (
        /* FORMAT A: Standard Horizontal (Nombre + $Precio + Barcode Code128 + SKU) */
        <div style={{ width: '100%', height: '100%', display: 'flex' }}>
          {/* Left Side: Product Name */}
          <div style={{
            width: '42%',
            height: '100%',
            borderRight: '1.5px solid #000',
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: nameFontSize,
            lineHeight: '1.15',
            wordBreak: 'break-word',
            textTransform: 'uppercase'
          }}>
            {item.nombre}
          </div>

          {/* Right Side: Price & Code128 Barcode */}
          <div style={{
            width: '58%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '2px 4px',
            alignItems: 'center'
          }}>
            <div style={{ width: '100%', textAlign: 'right', fontWeight: 'bold', fontSize: '11px' }}>
              $ {item.precio}.00
            </div>

            <svg ref={barcodeRef} style={{ width: '90%', height: '18px' }}></svg>

            <div style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: skuFontSize, lineHeight: 1 }}>
              {item.sku}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component: Physical Printable Single Label for @media print (Exact 63mm x 11mm)
function PrintableSingleLabel({ item }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && item.formato === 'horizontal' && item.sku) {
      try {
        JsBarcode(barcodeRef.current, item.sku, {
          format: "CODE128",
          width: 1,
          height: 18,
          displayValue: false,
          margin: 0
        });
      } catch (err) {
        console.warn('Print barcode error:', err);
      }
    }
  }, [item.sku, item.formato]);

  const nameLength = (item.nombre || '').length;
  const skuLength = (item.sku || '').length;

  let nameFontSize = '7.5pt';
  if (nameLength > 30) nameFontSize = '5.5pt';
  else if (nameLength > 20) nameFontSize = '6.5pt';

  let skuFontSize = '8.5pt';
  if (skuLength > 12) skuFontSize = '6.5pt';
  else if (skuLength > 9) skuFontSize = '7.5pt';

  return (
    <div
      style={{
        width: '63mm',
        height: '11mm',
        boxSizing: 'border-box',
        pageBreakAfter: 'always',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
        background: '#ffffff',
        color: '#000000',
        display: 'flex',
        position: 'relative'
      }}
    >
      {item.formato === 'vertical' ? (
        <div style={{
          width: '63mm',
          height: '11mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 2mm'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3mm',
            transform: 'rotate(-90deg)',
            transformOrigin: 'center center',
            whiteSpace: 'nowrap',
            fontWeight: 'bold',
            fontSize: '9pt'
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: skuFontSize }}>{item.sku}</span>
            <span>${item.precio}</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3mm',
            transform: 'rotate(-90deg)',
            transformOrigin: 'center center',
            whiteSpace: 'nowrap',
            fontWeight: 'bold',
            fontSize: '9pt'
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: skuFontSize }}>{item.sku}</span>
            <span>${item.precio}</span>
          </div>
        </div>
      ) : (
        <div style={{ width: '63mm', height: '11mm', display: 'flex' }}>
          <div style={{
            width: '26mm',
            height: '11mm',
            borderRight: '1pt solid #000',
            padding: '0.5mm 1mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: nameFontSize,
            lineHeight: '1.1',
            wordBreak: 'break-word',
            textTransform: 'uppercase'
          }}>
            {item.nombre}
          </div>

          <div style={{
            width: '37mm',
            height: '11mm',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.5mm 1mm'
          }}>
            <div style={{ width: '100%', textAlign: 'right', fontWeight: 'bold', fontSize: '8.5pt' }}>
              $ {item.precio}.00
            </div>

            <svg ref={barcodeRef} style={{ width: '32mm', height: '4.5mm' }}></svg>

            <div style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: skuFontSize, lineHeight: 1 }}>
              {item.sku}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
