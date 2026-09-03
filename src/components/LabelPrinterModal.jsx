import React, { useState, useEffect, useRef } from 'react';
import { Tag, Printer, X, Plus, Trash2, Upload, Search, Check, AlertCircle, RefreshCw } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import BarTenderLabelDesigner from './BarTenderLabelDesigner';
import { getJewelryLeftLines, convertElementsToTSPL } from '../utils/labelUtils';

export default function LabelPrinterModal({ isOpen, onClose, initialProducts = [], allProducts = [] }) {
  const [printQueue, setPrintQueue] = useState([]);
  const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'excel', 'search'
  const [searchQuery, setSearchQuery] = useState('');
  const [excelMsg, setExcelMsg] = useState(null);
  const [showDesigner, setShowDesigner] = useState(false);
  const [serialPort, setSerialPort] = useState(null);
  const [hardwareStatus, setHardwareStatus] = useState('desconectado'); // 'desconectado', 'conectado', 'error'
  const [excelCatalog, setExcelCatalog] = useState([]);
  const [excelSearchQuery, setExcelSearchQuery] = useState('');

  // Load saved Excel catalog from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('accesorizate_saved_excel_catalog');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExcelCatalog(parsed);
        }
      }
    } catch (e) {
      console.warn('Error reading saved Excel catalog:', e);
    }
  }, []);

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
        formato: 'horizontal'
      }));
      setPrintQueue(formatted);
    }
  }, [isOpen, initialProducts]);

  if (!isOpen) return null;

  // Helper (all products now default to horizontal format)
  function isEarringCategory(cat = '', name = '') {
    return false;
  }

  // Handle Excel Upload for Labels with Accent-Insensitive Column Key Resolver
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
          
          // Helper to extract column value ignoring accents, spaces, and case
          const getValue = (row, candidates) => {
            const keys = Object.keys(row);
            for (const c of candidates) {
              const normCand = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
              for (const k of keys) {
                const normKey = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
                if (normKey === normCand || normKey.includes(normCand)) {
                  if (row[k] !== undefined && row[k] !== '') {
                    return row[k];
                  }
                }
              }
            }
            return '';
          };

          data.forEach(row => {
            const sku = String(getValue(row, ['clave', 'sku', 'codigo', 'clavearticulo'])).trim();
            const nombre = String(getValue(row, ['nombredelarticulo', 'nombre', 'descripcion', 'producto', 'articulo'])).trim() || sku;
            
            // Look specifically for 'preciopublico' first so it doesn't accidentally grab 'preciomayoreo'
            const precioRaw = getValue(row, ['preciopublico', 'ppublico', 'precio', 'p.publico', 'precio1']);
            const precio = parseFloat(String(precioRaw).replace(/[^0-9.]/g, '')) || 0;
            
            const copias = parseInt(getValue(row, ['cantidad', 'copias', 'cant']) || 1) || 1;
            const cat = String(getValue(row, ['categoria', 'cat'])).trim();

            if (sku) {
              newItems.push({
                sku,
                nombre,
                categoria: cat || 'Otros',
                precio,
                precioPublico: precio,
                copias,
                formato: 'horizontal'
              });
            }
          });

          if (newItems.length > 0) {
            setExcelCatalog(newItems);
            try {
              localStorage.setItem('accesorizate_saved_excel_catalog', JSON.stringify(newItems));
            } catch (e) {
              console.warn('Error saving catalog to localStorage:', e);
            }
            setExcelMsg({ type: 'success', text: `¡Se guardaron ${newItems.length} productos en memoria permanente! Ya no tendrás que volver a subir el Excel.` });
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

  // Clear Saved Excel Catalog
  const handleClearSavedCatalog = () => {
    if (window.confirm('¿Deseas borrar el catálogo de Excel guardado en memoria?')) {
      setExcelCatalog([]);
      try {
        localStorage.removeItem('accesorizate_saved_excel_catalog');
      } catch (e) {
        console.warn('Error clearing catalog:', e);
      }
    }
  };

  // Combined Catalog Search (allProducts + excelCatalog)
  const combinedCatalog = [...excelCatalog, ...allProducts];

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
          precio: prod.precioPublico || prod.precio || 0,
          copias: 1,
          seleccionado: true,
          formato: 'horizontal'
        }
      ]);
    }
  };

  // Filter Catalog Products for Search
  const filteredCatalog = combinedCatalog.filter(p => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return (p.sku && p.sku.toLowerCase().includes(q)) || (p.nombre && p.nombre.toLowerCase().includes(q));
  }).slice(0, 25);

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
        const leftLines = getJewelryLeftLines(item.nombre, item.sku);
        leftLines.forEach((l, idx) => {
          const yPos = 4 + (idx * 15);
          tspl += `TEXT 10,${yPos},"1",0,1,1,"${l}"\r\n`;
        });

        const priceText = `$ ${item.precio}.00`;
        const isLongSku = skuEscaped.length > 9;

        const barcodeX = isLongSku ? 112 : 122;
        const skuRightX = isLongSku ? 118 : 135;
        const priceX = isLongSku ? 128 : 138;

        tspl += `TEXT ${priceX},4,"1",0,1,1,"${priceText}"\r\n`;
        tspl += `BARCODE ${barcodeX},22,"128",24,0,0,1,2,"${skuEscaped.substring(0, 15)}"\r\n`;
        tspl += `TEXT ${skuRightX},54,"1",0,1,1,"${skuEscaped.substring(0, 13)}"\r\n`;
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

  // Direct Hardware Printing via Accesorizate Native Agent (Zero PDF, Zero Dialog, Instant)
  const handlePrintDirectHardware = async () => {
    if (activeQueue.length === 0) return;

    let tspl = 'SIZE 63 mm, 11 mm\r\nGAP 3 mm, 0 mm\r\nDIRECTION 1\r\nCLS\r\n';

    activeQueue.forEach(item => {
      const copies = Math.max(1, parseInt(item.copias) || 1);
      const skuEscaped = (item.sku || '').replace(/"/g, '').toUpperCase();

      tspl += `CLS\r\n`;
      if (item.formato === 'vertical') {
        // Aretes double 90° format:
        tspl += `TEXT 110,75,"2",90,1,1,"${skuEscaped}  $${item.precio}"\r\n`;
        tspl += `BAR 245,4,2,80\r\n`;
        tspl += `TEXT 360,75,"2",90,1,1,"${skuEscaped}  $${item.precio}"\r\n`;
      } else {
        // 1. Left Half: Cleaned Product Name + SKU Line (12 chars max/line, 14-dot vertical spacing, mathematically centered)
        const leftLines = getJewelryLeftLines(item.nombre, item.sku);
        leftLines.forEach((l, idx) => {
          const textWidth = l.length * 8;
          const lineX = Math.max(2, 55 - Math.round(textWidth / 2));
          const yPos = 4 + (idx * 14);
          tspl += `TEXT ${lineX},${yPos},"1",0,1,1,"${l}"\r\n`;
        });

        // 2. Right Half of Printable Head: Price ($), Barcode Code128, SKU
        const priceText = `$ ${item.precio}.00`;
        const isLongSku = skuEscaped.length > 9;

        const barcodeX = isLongSku ? 112 : 122;
        const skuRightX = isLongSku ? 118 : 135;
        const priceX = isLongSku ? 128 : 138;

        tspl += `TEXT ${priceX},4,"1",0,1,1,"${priceText}"\r\n`;
        tspl += `BARCODE ${barcodeX},22,"128",24,0,0,1,2,"${skuEscaped.substring(0, 15)}"\r\n`;
        tspl += `TEXT ${skuRightX},54,"1",0,1,1,"${skuEscaped.substring(0, 13)}"\r\n`;

        // 3. Long Adhesive Tail (32mm to 63mm): LEFT COMPLETELY BLANK!
      }
      tspl += `PRINT ${copies},1\r\n`;
    });

    try {
      // 1. Try local Accesorizate WinSpool Agent (http://127.0.0.1:9123/print)
      const res = await fetch('http://127.0.0.1:9123/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tspl, printer: 'TSC T-200' })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        alert('¡Etiquetas enviadas instantáneamente a tu impresora Ribetec / TSC!');
        return;
      }
    } catch (e) {
      console.warn('Local print agent fallback to WebSerial/WebUSB:', e);
    }

    // Fallback: WebSerial / WebUSB
    try {
      if ('serial' in navigator) {
        let port = serialPort;
        if (!port) {
          port = await navigator.serial.requestPort();
          await port.open({ baudRate: 9600 });
          setSerialPort(port);
        }
        const encoder = new TextEncoder();
        const writer = port.writable.getWriter();
        await writer.write(encoder.encode(tspl));
        writer.releaseLock();
        alert('¡Etiquetas enviadas a la impresora!');
      }
    } catch (err) {
      alert('No se pudo conectar a la impresora. Revisa que el servicio local de impresión esté activo.');
    }
  };

  // WebUSB Direct Printing Attempt
  const handleWebUSBPrint = async () => {
    if (activeQueue.length === 0) return;

    if (!('usb' in navigator)) {
      alert('Tu navegador no soporta la API WebUSB. Usa Google Chrome o Microsoft Edge.');
      return;
    }

    try {
      const device = await navigator.usb.requestDevice({ filters: [] });
      await device.open();
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      await device.claimInterface(0);

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

      const encoder = new TextEncoder();
      const data = encoder.encode(tspl);
      await device.transferOut(1, data);
      alert('¡Etiquetas enviadas directamente a la impresora USB!');
    } catch (err) {
      console.error('Error WebUSB:', err);
      alert('Información del puerto: ' + err.message);
    }
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
          <button
            className="btn btn-gold"
            onClick={handlePrintDirectHardware}
            disabled={activeQueue.length === 0}
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 0 14px rgba(16, 185, 129, 0.4)' }}
            title="Imprime directamente a la impresora física Ribetec RT-420ME por USB (SIN ventanas ni PDF)"
          >
            <Printer size={18} />
            <span>🖨️ IMPRIMIR DIRECTO A RIBETEC (USB)</span>
          </button>

          <button className="btn btn-gold" onClick={() => setShowDesigner(true)} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
            <RefreshCw size={16} />
            <span>🎨 Diseñador</span>
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
        <div style={{ width: '400px', borderRight: '1px solid var(--border-color)', background: '#050505', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          
          {/* Sub-tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#0a0a0a', flexShrink: 0 }}>
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
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
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
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
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
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <div style={{ marginBottom: '14px', flexShrink: 0 }}>
                <input
                  type="text"
                  placeholder="Buscar por SKU o Descripción..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  autoFocus
                />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
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

          {/* Tab 3: Excel Upload & Selective Picker */}
          {activeTab === 'excel' && (
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <div style={{
                border: '1.5px dashed var(--border-color)',
                borderRadius: '10px',
                padding: '16px',
                textAlign: 'center',
                background: '#0a0a0a',
                marginBottom: '14px'
              }}>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelUpload}
                  style={{ display: 'none' }}
                  id="excelLabelUploadInput"
                />
                <label htmlFor="excelLabelUploadInput" className="btn btn-gold" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={16} />
                  <span>{excelCatalog.length > 0 ? '📁 Cambiar Archivo Excel' : '📥 Cargar Archivo Excel'}</span>
                </label>
                {excelCatalog.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 'bold' }}>
                      ✅ {excelCatalog.length} productos guardados en memoria
                    </span>
                    <button
                      onClick={handleClearSavedCatalog}
                      style={{ background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Borrar Memoria
                    </button>
                  </div>
                )}
              </div>

              {excelCatalog.length > 0 && (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="🔍 Buscar por SKU o Nombre en el Excel..."
                      value={excelSearchQuery}
                      onChange={(e) => setExcelSearchQuery(e.target.value)}
                      className="input-field"
                      style={{ fontSize: '0.82rem' }}
                    />
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {excelCatalog
                      .filter(p => {
                        if (!excelSearchQuery.trim()) return true;
                        const q = excelSearchQuery.toLowerCase();
                        return (p.sku && p.sku.toLowerCase().includes(q)) || (p.nombre && p.nombre.toLowerCase().includes(q));
                      })
                      .slice(0, 50)
                      .map((prod) => (
                        <div
                          key={prod.sku}
                          style={{
                            padding: '8px 12px',
                            background: '#0e0e0e',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ flex: 1, overflow: 'hidden', paddingRight: '8px' }}>
                            <span style={{ color: 'var(--gold-primary)', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '0.85rem' }}>{prod.sku}</span>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {prod.nombre}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 'bold' }}>${prod.precio}</span>
                            <button
                              className="btn btn-gold"
                              onClick={() => handleAddProductFromCatalog(prod)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                              title="Agregar a la lista de impresión"
                            >
                              <Plus size={14} />
                              <span>Agregar</span>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {/* Right Preview & Sheet Rendering Canvas */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#000000', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          <div style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            VISTA PREVIA DE ETIQUETAS A IMPRIMIR ({totalLabelsToPrint} {totalLabelsToPrint === 1 ? 'etiqueta total' : 'etiquetas totales'} • MEDIDA 63x11mm)
          </div>

          {activeQueue.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Printer size={64} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p style={{ fontSize: '1.1rem' }}>No hay etiquetas en la lista para vista previa o impresión.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>Agrega productos desde la pestaña "Buscar Catálogo" o carga un Excel.</p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: '#141414',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #262626',
              boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
              paddingBottom: '30px'
            }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--gold-primary)', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '0.5px' }}>
                📜 ROLLO CONTINUO DE ETIQUETAS RIBETEC
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', border: '1px solid #333', borderRadius: '4px', overflow: 'hidden' }}>
                {activeQueue.flatMap((item, idx) =>
                  Array.from({ length: Math.max(1, parseInt(item.copias) || 1) }).map((_, cIdx) => ({
                    ...item,
                    parentIdx: idx + 1,
                    copyNumber: cIdx + 1,
                    totalCopies: Math.max(1, parseInt(item.copias) || 1)
                  }))
                ).map((itemCopy, globalIdx) => (
                  <SingleLabelPreview key={`${itemCopy.sku}-${globalIdx}`} item={itemCopy} scale={6.5} />
                ))}
              </div>
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
        /* FORMAT A: Horizontal Rat-Tail Jewelry Flag Label (26mm Left Head + 16mm Barcode Box + 21mm Adhesive Tail) */
        <div style={{ width: '100%', height: '100%', display: 'flex' }}>
          {/* Left Box (26mm / 41% width): Clean word lines centered + 1.5px solid black divider line */}
          <div style={{
            width: '41%',
            height: '100%',
            borderRight: '1.5px solid #000000',
            padding: '2px 4px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 'bold',
            lineHeight: '1.15',
            textTransform: 'uppercase',
            fontFamily: 'monospace',
            whiteSpace: 'pre-line',
            boxSizing: 'border-box'
          }}>
            {getJewelryLeftLines(item.nombre, item.sku).join('\n')}
          </div>

          {/* Right Box (16mm / 26% width): Price ($), Barcode Code128, SKU */}
          <div style={{
            width: '26%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '1px 4px',
            boxSizing: 'border-box'
          }}>
            <div style={{ width: '100%', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', fontFamily: 'Arial, sans-serif' }}>${item.precio}.00</div>
            <svg ref={barcodeRef} style={{ width: '92%', height: '22px' }}></svg>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold' }}>{item.sku}</div>
          </div>

          {/* Long Right Adhesive Tail (21mm / 33% width): COMPLETELY BLANK */}
          <div style={{
            width: '33%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.02)',
            borderLeft: '1px dashed #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '10px',
            fontStyle: 'italic'
          }}>
            (Patilla Adhesiva)
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
