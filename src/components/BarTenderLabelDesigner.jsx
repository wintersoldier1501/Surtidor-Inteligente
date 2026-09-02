import React, { useState, useEffect, useRef } from 'react';
import { Tag, Move, Type, Barcode, Minimize2, RotateCw, Trash2, Plus, Save, RefreshCw, Printer, Download, Layout, Layers, Check } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import { getJewelryLeftLines, convertElementsToTSPL } from '../utils/labelUtils';

// Default presets calibrated for 63mm x 11mm (32mm Head + 31mm Tail)
const PRESET_TEMPLATES = {
  rattail: {
    id: 'rattail',
    name: '🏷️ Etiqueta Joyería (32mm + Patilla Blanco)',
    elements: [
      { id: 'el-name', type: 'text', field: 'nombre', label: 'Nombre Producto (Izquierda)', x: 1.2, y: 0.5, w: 14.8, h: 7, fontSize: 5.5, bold: false, align: 'left', rotation: 0, autoFit: true },
      { id: 'el-sku-left', type: 'text', field: 'sku', label: 'SKU (Izquierda)', x: 1.2, y: 7.8, w: 14.8, h: 2.8, fontSize: 5.5, bold: false, align: 'left' },
      
      { id: 'el-price', type: 'text', field: 'precio', label: 'Precio ($ Derecho)', x: 17.5, y: 0.5, w: 14, h: 3, fontSize: 6.5, bold: true, align: 'center', prefix: '$ ' },
      { id: 'el-barcode', type: 'barcode', field: 'sku', label: 'Código Barras (Derecho)', x: 16.5, y: 3.5, w: 15, h: 3.5 },
      { id: 'el-sku-right', type: 'text', field: 'sku', label: 'SKU (Derecho)', x: 17.5, y: 7.5, w: 14, h: 2.8, fontSize: 5.5, bold: false, align: 'center' },

      { id: 'el-tail-blank', type: 'tail', label: 'Patilla Adhesiva (31mm Blanco)', x: 32, y: 0, w: 31, h: 11 }
    ]
  },
  verticalAretes: {
    id: 'verticalAretes',
    name: '👂 Aretes / Piercings (Doble Vertical 90°)',
    elements: [
      { id: 'el-tag1', type: 'text', field: 'sku_precio', label: 'Arete 1 (SKU + $)', x: 12, y: 1.5, w: 10, h: 8, fontSize: 7.5, bold: false, align: 'center', rotation: 90 },
      { id: 'el-line-sep', type: 'line', x: 31.5, y: 0, w: 0.3, h: 11 },
      { id: 'el-tag2', type: 'text', field: 'sku_precio', label: 'Arete 2 (SKU + $)', x: 42, y: 1.5, w: 10, h: 8, fontSize: 7.5, bold: false, align: 'center', rotation: 90 }
    ]
  }
};

export default function BarTenderLabelDesigner({
  isOpen,
  onClose,
  sampleProduct = { sku: 'AX054-6', nombre: 'ANILLO - LISO DORADO AX054-6', precioPublico: 58, categoria: 'Anillos' },
  allProducts = [],
  onPrintBatch
}) {
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('rattail');
  const [elements, setElements] = useState(PRESET_TEMPLATES.rattail.elements);
  const [selectedElementId, setSelectedElementId] = useState('el-name');
  const [testProduct, setTestProduct] = useState(sampleProduct);
  const [scale, setScale] = useState(14.0); // Ultra HD Fit Screen 14.0x zoom by default
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  useEffect(() => {
    if (sampleProduct) {
      setTestProduct(sampleProduct);
    }
  }, [sampleProduct]);

  // Load saved custom template from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('accesorizate_bartender_custom_template');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setElements(parsed);
        }
      }
    } catch (e) {
      console.warn('Error loading custom bartender template:', e);
    }
  }, []);

  if (!isOpen) return null;

  const selectedElement = elements.find(el => el.id === selectedElementId);

  // Save Custom Template to localStorage
  const handleSaveCustomTemplate = () => {
    try {
      localStorage.setItem('accesorizate_bartender_custom_template', JSON.stringify(elements));
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    } catch (e) {
      console.warn('Error saving template:', e);
    }
  };

  // Switch Preset Template
  const handleSelectPreset = (key) => {
    setSelectedTemplateKey(key);
    if (PRESET_TEMPLATES[key]) {
      setElements(JSON.parse(JSON.stringify(PRESET_TEMPLATES[key].elements)));
      setSelectedElementId(PRESET_TEMPLATES[key].elements[0]?.id || null);
    }
  };

  // Update Element Property
  const updateElement = (id, key, val) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, [key]: val } : el));
  };

  // Add New Custom Text Element
  const handleAddTextElement = () => {
    const newId = `el-text-${Date.now()}`;
    const newEl = {
      id: newId,
      type: 'text',
      field: 'nombre',
      label: 'Nuevo Texto',
      x: 10,
      y: 3,
      w: 25,
      h: 5,
      fontSize: 8,
      bold: true,
      align: 'center',
      rotation: 0
    };
    setElements(prev => [...prev, newEl]);
    setSelectedElementId(newId);
  };

  // Add New Barcode Element
  const handleAddBarcodeElement = () => {
    const newId = `el-barcode-${Date.now()}`;
    const newEl = {
      id: newId,
      type: 'barcode',
      field: 'sku',
      label: 'Código de Barras',
      x: 15,
      y: 3,
      w: 30,
      h: 5
    };
    setElements(prev => [...prev, newEl]);
    setSelectedElementId(newId);
  };

  // Delete Element
  const handleDeleteElement = (id) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(elements[0]?.id || null);
    }
  };

  // Direct Hardware Printing from Designer Canvas (Converts visual elements to real TSPL)
  const handlePrintDirectFromDesigner = async () => {
    const tspl = convertElementsToTSPL(elements, testProduct, 1);

    try {
      const res = await fetch('http://127.0.0.1:9123/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tspl, printer: 'TSC T-200' })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        alert('¡Etiqueta enviada a la impresora con tu diseño exacto!');
      }
    } catch (e) {
      alert('Servidor local de impresión no respondió. Revisa la conexión.');
    }
  };

  // Get Display Value for Field (with multiline word wrap matching TSPL physical print)
  const getFieldValue = (el, prod) => {
    const p = prod || testProduct;
    if (el.field === 'nombre') {
      const leftLines = getJewelryLeftLines(p.nombre, p.sku);
      return leftLines.join('\n');
    }
    if (el.field === 'sku') return p.sku || 'SKU123';
    if (el.field === 'precio') return `${el.prefix || ''}${p.precioPublico || p.precio || 0}.00`;
    if (el.field === 'sku_precio') return `${p.sku || 'SKU'}  $${p.precioPublico || p.precio || 0}`;
    if (el.field === 'categoria') return p.categoria || 'Joyas';
    return el.customText || 'TEXTO';
  };

  // Convert mm to Canvas Screen Pixels
  const mmToPx = (mm) => mm * 3.78 * (scale / 3.5);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      color: '#fff',
      fontFamily: 'sans-serif'
    }}>
      {/* Studio Header Bar */}
      <div style={{
        padding: '12px 24px',
        background: '#0a0a0a',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #d4af37 0%, #b8860b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000',
            fontWeight: 'bold'
          }}>
            <Layout size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#fff', letterSpacing: '0.5px' }}>
              Estudio Diseñador de Etiquetas BarTender / LabelJoy
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--gold-primary)' }}>
              Lienzo Interactivo WYSIWYG Calibrado a Medida Exacta: 63.00 mm x 11.00 mm
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          
          {/* Zoom Level Controller */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#111', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Zoom:</span>
            <button className="btn btn-outline" onClick={() => setScale(prev => Math.max(3, prev - 1.5))} style={{ padding: '2px 8px', fontSize: '0.8rem', fontWeight: 'bold' }}>-</button>
            <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--gold-primary)', minWidth: '45px', textAlign: 'center' }}>{Math.round((scale / 3.5) * 100)}%</span>
            <button className="btn btn-outline" onClick={() => setScale(prev => Math.min(18, prev + 1.5))} style={{ padding: '2px 8px', fontSize: '0.8rem', fontWeight: 'bold' }}>+</button>
          </div>

          <button
            className="btn btn-gold"
            onClick={handleSaveCustomTemplate}
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
          >
            <Save size={16} />
            <span>{saveSuccessMsg ? '✅ ¡Plantilla Guardada!' : '💾 Guardar Plantilla en Memoria'}</span>
          </button>

          <button className="btn btn-gold" onClick={handlePrintDirectFromDesigner}>
            <Printer size={16} />
            <span>🖨️ Imprimir Prueba en Ribetec</span>
          </button>

          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
          >
            <Minimize2 size={22} />
          </button>
        </div>
      </div>

      {/* Main Studio Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Left Toolbar & Layers Panel */}
        <div style={{ width: '280px', borderRight: '1px solid var(--border-color)', background: '#050505', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Preset Templates Selector */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
              PLANTILLA DE DISEÑO:
            </label>
            <select
              className="input-field"
              value={selectedTemplateKey}
              onChange={(e) => handleSelectPreset(e.target.value)}
              style={{ width: '100%', fontSize: '0.82rem' }}
            >
              <option value="rattail">🏷️ Joyería Mariposa (32mm + Patilla Blanco)</option>
              <option value="verticalAretes">👂 Aretes (Doble Vertical 90°)</option>
            </select>
          </div>

          {/* Add Elements Buttons */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
              AGREGAR ELEMENTOS AL LIENZO:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline" onClick={handleAddTextElement} style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}>
                <Type size={14} /> + Texto
              </button>
              <button className="btn btn-outline" onClick={handleAddBarcodeElement} style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}>
                <Barcode size={14} /> + Código
              </button>
            </div>
          </div>

          {/* Layers List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
              CAPAS DEL DISEÑO ({elements.length}):
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {elements.map(el => (
                <div
                  key={el.id}
                  onClick={() => setSelectedElementId(el.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: selectedElementId === el.id ? 'rgba(212, 175, 55, 0.2)' : '#0e0e0e',
                    border: selectedElementId === el.id ? '1px solid var(--gold-primary)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {el.type === 'text' && <Type size={14} color="var(--gold-primary)" />}
                    {el.type === 'barcode' && <Barcode size={14} color="#34d399" />}
                    {el.type === 'tail' && <div style={{ width: '12px', height: '12px', background: 'rgba(255,255,255,0.2)', border: '1px dashed #aaa' }} />}
                    {el.type === 'line' && <div style={{ width: '12px', height: '2px', background: '#fff' }} />}
                    <span style={{ fontWeight: selectedElementId === el.id ? 'bold' : 'normal', color: selectedElementId === el.id ? '#fff' : 'var(--text-muted)' }}>
                      {el.label || el.field || el.id}
                    </span>
                  </div>

                  {el.type !== 'tail' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteElement(el.id); }}
                      style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                      title="Eliminar capa"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Center Canvas Studio Work Area */}
        <div style={{ flex: 1, background: '#000000', padding: '32px', overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          
          <div style={{ marginBottom: '14px', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            LIENZO INTERACTIVO WYSIWYG (32mm RECUADRO IMPRIMIBLE + 31mm PATILLA ADHESIVA BLANCO)
          </div>

          {/* Interactive Bounding Frame (63mm x 11mm scaled) */}
          <div
            style={{
              width: `${mmToPx(63)}px`,
              height: `${mmToPx(11)}px`,
              background: '#ffffff',
              color: '#000000',
              border: '2px solid var(--gold-primary)',
              boxShadow: '0 0 30px rgba(212, 175, 55, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              userSelect: 'none',
              boxSizing: 'border-box'
            }}
          >
            {elements.map(el => {
              const isSelected = selectedElementId === el.id;
              const val = getFieldValue(el, testProduct);

              if (el.type === 'tail') {
                return (
                  <div
                    key={el.id}
                    style={{
                      position: 'absolute',
                      left: `${mmToPx(el.x)}px`,
                      top: `${mmToPx(el.y)}px`,
                      width: `${mmToPx(el.w)}px`,
                      height: `${mmToPx(el.h)}px`,
                      background: 'rgba(0, 0, 0, 0.05)',
                      borderLeft: '1.5px dashed #999',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#888',
                      fontSize: '10px',
                      fontStyle: 'italic'
                    }}
                  >
                    (Patilla Adhesiva en Blanco)
                  </div>
                );
              }

              return (
                <div
                  key={el.id}
                  onClick={() => setSelectedElementId(el.id)}
                  style={{
                    position: 'absolute',
                    left: `${mmToPx(el.x)}px`,
                    top: `${mmToPx(el.y)}px`,
                    width: `${mmToPx(el.w)}px`,
                    height: `${mmToPx(el.h)}px`,
                    border: isSelected ? '1.5px dashed #0070f3' : '1px transparent solid',
                    background: isSelected ? 'rgba(0, 112, 243, 0.08)' : 'transparent',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
                    overflow: 'hidden'
                  }}
                >
                  {el.type === 'line' && (
                    <div style={{ width: '100%', height: '100%', background: '#000000' }} />
                  )}

                  {el.type === 'text' && (
                    <span style={{
                      fontSize: `${el.fontSize * (scale / 2.8)}px`,
                      fontWeight: el.bold ? 'bold' : 'normal',
                      fontFamily: 'monospace',
                      color: '#000000',
                      transform: el.rotation ? `rotate(-${el.rotation}deg)` : 'none',
                      whiteSpace: 'pre-line',
                      lineHeight: '1.15',
                      textAlign: el.align || 'left'
                    }}>
                      {val}
                    </span>
                  )}

                  {el.type === 'barcode' && (
                    <CanvasBarcodeRenderer sku={testProduct.sku || 'SKU123'} widthPx={mmToPx(el.w)} heightPx={mmToPx(el.h)} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Floating Zoom Control Bar at Canvas Bottom */}
          <div style={{
            marginTop: '20px',
            background: 'rgba(15, 15, 15, 0.95)',
            border: '1px solid var(--gold-primary)',
            borderRadius: '24px',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 6px 30px rgba(0,0,0,0.8)'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--gold-primary)', fontWeight: 'bold' }}>🔍 Zoom del Lienzo:</span>
            <input
              type="range"
              min="5"
              max="25"
              step="0.5"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              style={{ width: '220px', accentColor: 'var(--gold-primary)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff', minWidth: '48px' }}>{Math.round((scale / 3.5) * 100)}%</span>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setScale(8)} style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>100%</button>
              <button onClick={() => setScale(14)} style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'var(--gold-primary)', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Fit Pantalla (200%)</button>
              <button onClick={() => setScale(22)} style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>300% Ultra HD</button>
            </div>
          </div>

          <div style={{ marginTop: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Modifica cualquier parámetro en el panel derecho y presiona 💾 <strong>Guardar Plantilla en Memoria</strong>.
          </div>

        </div>

        {/* Right Element Properties Inspector Panel */}
        <div style={{ width: '300px', borderLeft: '1px solid var(--border-color)', background: '#050505', padding: '16px', overflowY: 'auto' }}>
          
          <h3 style={{ fontSize: '0.9rem', color: 'var(--gold-primary)', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            PROPIEDADES DEL ELEMENTO
          </h3>

          {!selectedElement ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Selecciona un elemento en el lienzo para ver sus propiedades.</p>
          ) : selectedElement.type === 'tail' ? (
            <p style={{ fontSize: '0.8rem', color: '#34d399' }}>Patilla adhesiva protegida en blanco (31mm de cola para doblar en la mercancía).</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.8rem' }}>
              
              {/* Field Binding */}
              {selectedElement.type === 'text' && (
                <div>
                  <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Dato a Mostrar:</label>
                  <select
                    className="input-field"
                    value={selectedElement.field || 'nombre'}
                    onChange={(e) => updateElement(selectedElement.id, 'field', e.target.value)}
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  >
                    <option value="nombre">Nombre del Producto</option>
                    <option value="sku">SKU / Clave</option>
                    <option value="precio">Precio Público ($)</option>
                    <option value="sku_precio">SKU + Precio (Vertical)</option>
                    <option value="categoria">Categoría</option>
                  </select>
                </div>
              )}

              {/* Position X (mm) */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Posición X (mm):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedElement.x}
                    onChange={(e) => updateElement(selectedElement.id, 'x', parseFloat(e.target.value) || 0)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Posición Y (mm):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedElement.y}
                    onChange={(e) => updateElement(selectedElement.id, 'y', parseFloat(e.target.value) || 0)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              {/* Dimensions W & H (mm) */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Ancho W (mm):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedElement.w}
                    onChange={(e) => updateElement(selectedElement.id, 'w', parseFloat(e.target.value) || 1)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Alto H (mm):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedElement.h}
                    onChange={(e) => updateElement(selectedElement.id, 'h', parseFloat(e.target.value) || 1)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              {/* Text specific styling */}
              {selectedElement.type === 'text' && (
                <>
                  <div style={{ background: '#111', padding: '12px', borderRadius: '8px', border: '1px solid var(--gold-primary)' }}>
                    <label style={{ color: 'var(--gold-primary)', fontWeight: 'bold', display: 'block', marginBottom: '8px', fontSize: '0.82rem' }}>
                      🔤 Tamaño de Tipografía / Fuente:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="btn btn-outline"
                        onClick={() => updateElement(selectedElement.id, 'fontSize', Math.max(4, Number(((selectedElement.fontSize || 6.5) - 0.5).toFixed(1))))}
                        style={{ padding: '6px 12px', fontSize: '0.95rem', fontWeight: 'bold', flex: '0 0 auto' }}
                        title="Hacer letra más chica"
                      >
                        A-
                      </button>

                      <input
                        type="number"
                        step="0.5"
                        min="4"
                        max="24"
                        value={selectedElement.fontSize || 6.5}
                        onChange={(e) => updateElement(selectedElement.id, 'fontSize', parseFloat(e.target.value) || 6)}
                        className="input-field"
                        style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: '1rem', color: 'var(--gold-primary)' }}
                      />

                      <button
                        className="btn btn-outline"
                        onClick={() => updateElement(selectedElement.id, 'fontSize', Number(((selectedElement.fontSize || 6.5) + 0.5).toFixed(1)))}
                        style={{ padding: '6px 12px', fontSize: '0.95rem', fontWeight: 'bold', flex: '0 0 auto' }}
                        title="Hacer letra más grande"
                      >
                        A+
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                      <button
                        onClick={() => updateElement(selectedElement.id, 'fontSize', 5.5)}
                        style={{ flex: 1, padding: '4px', fontSize: '0.72rem', background: selectedElement.fontSize === 5.5 ? 'var(--gold-primary)' : '#222', color: selectedElement.fontSize === 5.5 ? '#000' : '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Chica (5.5)
                      </button>
                      <button
                        onClick={() => updateElement(selectedElement.id, 'fontSize', 6.5)}
                        style={{ flex: 1, padding: '4px', fontSize: '0.72rem', background: selectedElement.fontSize === 6.5 ? 'var(--gold-primary)' : '#222', color: selectedElement.fontSize === 6.5 ? '#000' : '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Normal (6.5)
                      </button>
                      <button
                        onClick={() => updateElement(selectedElement.id, 'fontSize', 8.5)}
                        style={{ flex: 1, padding: '4px', fontSize: '0.72rem', background: selectedElement.fontSize === 8.5 ? 'var(--gold-primary)' : '#222', color: selectedElement.fontSize === 8.5 ? '#000' : '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Grande (8.5)
                      </button>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="chkBoldToggle"
                        checked={!!selectedElement.bold}
                        onChange={(e) => updateElement(selectedElement.id, 'bold', e.target.checked)}
                        style={{ accentColor: 'var(--gold-primary)', cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <label htmlFor="chkBoldToggle" style={{ color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold' }}>
                        Texto en Negrita (Bold)
                      </label>
                    </div>
                  </div>

                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Rotación (°):</label>
                    <select
                      className="input-field"
                      value={selectedElement.rotation || 0}
                      onChange={(e) => updateElement(selectedElement.id, 'rotation', parseInt(e.target.value) || 0)}
                      style={{ width: '100%', fontSize: '0.8rem' }}
                    >
                      <option value={0}>0° (Horizontal Estándar)</option>
                      <option value={90}>90° (Vertical Aretes)</option>
                      <option value={180}>180° (Invertido)</option>
                      <option value={270}>270° (Vertical Invertido)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Alineación:</label>
                    <select
                      className="input-field"
                      value={selectedElement.align || 'left'}
                      onChange={(e) => updateElement(selectedElement.id, 'align', e.target.value)}
                      style={{ width: '100%', fontSize: '0.8rem' }}
                    >
                      <option value="left">Izquierda</option>
                      <option value="center">Centro</option>
                      <option value="right">Derecha</option>
                    </select>
                  </div>
                </>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}

// Sub-component: Barcode Canvas Renderer
function CanvasBarcodeRenderer({ sku, widthPx, heightPx }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && sku) {
      try {
        JsBarcode(barcodeRef.current, sku, {
          format: "CODE128",
          width: 1.5,
          height: 30,
          displayValue: false,
          margin: 0
        });
      } catch (err) {
        console.warn('Canvas barcode render error:', err);
      }
    }
  }, [sku, widthPx, heightPx]);

  return <svg ref={barcodeRef} style={{ width: `${widthPx}px`, height: `${heightPx}px` }}></svg>;
}
