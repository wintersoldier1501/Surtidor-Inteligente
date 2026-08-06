import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Hammer } from 'lucide-react';

export default function ExcelImporter({ onUpdateStock, onUpdateTallerSkus, products }) {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const handleFileUpload = (e, mode) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatusMsg({ type: 'info', text: 'Procesando archivo de Excel...' });

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (mode === 'almacenes') {
          processAlmacenesExcel(jsonData);
        } else if (mode === 'taller') {
          processTallerExcel(jsonData);
        }
      } catch (err) {
        console.error('Error procesando Excel:', err);
        setStatusMsg({ type: 'error', text: 'Error al leer el archivo. Asegúrate de que es un archivo .xlsx válido exportado de Microsip.' });
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const processAlmacenesExcel = (rows) => {
    let claveIdx = -1;
    let nombreIdx = -1;
    let pubIdx = -1;
    let mayIdx = -1;
    let generalIdx = -1;
    let vhIdx = -1;
    let paseoIdx = -1;

    // Scan all cells in rows 0 to 15 for headers
    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const row = rows[r];
      if (!row) continue;
      row.forEach((cell, idx) => {
        const val = String(cell || '').trim().toLowerCase();
        if (!val) return;

        if (val === 'clave' || (claveIdx === -1 && val.includes('clave'))) claveIdx = idx;
        if (nombreIdx === -1 && (val.includes('nombre') || val.includes('artículo') || val.includes('articulo'))) nombreIdx = idx;
        if (pubIdx === -1 && (val.includes('precio público') || val.includes('precio publico') || val.includes('público') || val.includes('publico'))) pubIdx = idx;
        if (mayIdx === -1 && (val.includes('precio mayoreo') || val.includes('mayoreo'))) mayIdx = idx;
        
        if (vhIdx === -1 && (val.includes('vista hermosa') || val.includes('vista'))) vhIdx = idx;
        if (paseoIdx === -1 && val.includes('paseo')) paseoIdx = idx;

        // General warehouse header (can be 'Almacén general', 'Almacén gene', 'Almacén gen', 'Almacén', etc.)
        if (generalIdx === -1 && (val.includes('almacén') || val.includes('almacen') || val.includes('general') || val.includes('gene')) && !val.includes('vista') && !val.includes('paseo')) {
          generalIdx = idx;
        }
      });
    }

    // Fallback defaults if any header wasn't found by text
    if (claveIdx === -1) claveIdx = 0;
    if (nombreIdx === -1) nombreIdx = (claveIdx === 0 ? 1 : 2);
    if (generalIdx === -1) generalIdx = 24; // Default column Y in raw Microsip export
    if (vhIdx === -1) vhIdx = 25; // Default column Z
    if (paseoIdx === -1) paseoIdx = 27; // Default column AB

    // Robust cell value extraction helper that checks adjacent cells for merged headers
    const extractNum = (row, primaryIdx) => {
      if (!row) return 0;
      const candidateIndices = [primaryIdx, primaryIdx + 1, primaryIdx - 1, primaryIdx + 2];
      for (const i of candidateIndices) {
        if (i >= 0 && i < row.length) {
          const raw = row[i];
          if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
            const strVal = String(raw).replace(/,/g, '').trim();
            const num = parseFloat(strVal);
            if (!isNaN(num)) {
              return Math.floor(num);
            }
          }
        }
      }
      return 0;
    };

    let updatedCount = 0;
    let newCount = 0;

    const newStockMap = {};

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const sku = String(row[claveIdx] || '').trim();
      if (!sku || sku.toLowerCase() === 'clave' || sku.toLowerCase() === 'nan' || sku.includes('Existencia') || sku.includes('ACCESORIZATE')) continue;

      let nombre = String(row[nombreIdx] || '').trim();
      if (!nombre && nombreIdx + 1 < row.length) {
        nombre = String(row[nombreIdx + 1] || '').trim();
      }

      const pub = extractNum(row, pubIdx);
      const may = extractNum(row, mayIdx);
      const gen = extractNum(row, generalIdx);
      const vh = extractNum(row, vhIdx);
      const pas = extractNum(row, paseoIdx);

      newStockMap[sku] = {
        nombre,
        precioPublico: pub,
        precioMayoreo: may,
        stockGeneral: gen,
        stockVistaHermosa: vh,
        stockPaseo: pas
      };
    }

    const { updated, created } = onUpdateStock(newStockMap);

    setStatusMsg({
      type: 'success',
      text: `¡Inventario de almacenes actualizado con éxito! Se actualizaron ${updated} productos y se registraron ${created} productos nuevos.`
    });
  };

  const processTallerExcel = (rows) => {
    // Look for SKUs in column 0 or column 1
    const tallerSkusFound = new Set();

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const val = String(row[0] || '').trim();
      if (
        val &&
        !val.includes('ACCESORIZATE') &&
        !val.includes('Existencia') &&
        !val.includes('PROCEDENCIA') &&
        !val.includes('ALMACÉN') &&
        !val.includes('ALMACEN') &&
        !val.includes('Valuación') &&
        !val.includes('Artículo') &&
        !val.includes('Articulo') &&
        !val.startsWith('Al ') &&
        !val.includes('sin existencia')
      ) {
        tallerSkusFound.add(val);
      }
    }

    const count = onUpdateTallerSkus(tallerSkusFound);

    setStatusMsg({
      type: 'success',
      text: `¡Concentrado de Taller procesado con éxito! Se etiquetaron automáticamente ${count} productos como "Piezas de Taller".`
    });
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '30px auto' }}>
      
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '8px' }}>Cargar Archivos de Excel de Microsip</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Carga las exportaciones de Microsip para actualizar las existencias de almacenes y etiquetar automáticamente las piezas de taller.
        </p>
      </div>

      {/* Alert Messages */}
      {statusMsg && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: statusMsg.type === 'success' ? 'var(--success-bg)' : statusMsg.type === 'error' ? 'var(--danger-bg)' : 'var(--warning-bg)',
            border: `1px solid ${statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : statusMsg.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
            color: statusMsg.type === 'success' ? '#34d399' : statusMsg.type === 'error' ? '#f87171' : '#fbbf24'
          }}
        >
          {statusMsg.type === 'success' ? <CheckCircle2 size={24} /> : statusMsg.type === 'error' ? <AlertCircle size={24} /> : <RefreshCw size={24} className="spin" />}
          <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>{statusMsg.text}</div>
        </div>
      )}

      {/* Upload Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* Card 1: Almacenes Excel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={26} color="#34d399" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>1. Inventario de Almacenes</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Archivo: <code>almacenes.xlsx</code></p>
            </div>
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Exportación general de Microsip con existencias de <strong>Almacén General</strong>, <strong>Vista Hermosa</strong> y <strong>Paseo Durango</strong>.
          </p>

          <label
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '32px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#11131a',
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}
            className="hover-border-gold"
          >
            <Upload size={32} color="var(--gold-primary)" />
            <span style={{ fontWeight: '600', color: '#fff' }}>Hacer clic o arrastrar archivo de almacenes</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Formato compatible: .xlsx de Microsip</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => handleFileUpload(e, 'almacenes')}
              style={{ display: 'none' }}
              disabled={loading}
            />
          </label>
        </div>

        {/* Card 2: Concentrado Taller Excel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--purple-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Hammer size={26} color="#c084fc" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>2. Concentrado de Taller</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Archivo: <code>piezas de taller.xlsx</code></p>
            </div>
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Exportación del concentrado de Microsip con artículos de <strong>Procedencia: TALLER</strong>. Etiqueta automáticamente todas las piezas de taller.
          </p>

          <label
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '32px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: '#11131a',
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}
            className="hover-border-gold"
          >
            <Upload size={32} color="#c084fc" />
            <span style={{ fontWeight: '600', color: '#fff' }}>Hacer clic o arrastrar concentrado de taller</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Formato compatible: .xlsx de Taller</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => handleFileUpload(e, 'taller')}
              style={{ display: 'none' }}
              disabled={loading}
            />
          </label>
        </div>

      </div>

      {/* Information box */}
      <div className="glass-card" style={{ marginTop: '32px', background: '#11131a' }}>
        <h4 style={{ color: 'var(--gold-primary)', marginBottom: '8px', fontSize: '1rem' }}>💡 ¿Cómo funciona el etiquetado inteligente?</h4>
        <ul style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>Al cargar <strong>piezas de taller.xlsx</strong>, el sistema memoriza de forma permanente todos los códigos de taller.</li>
          <li>Cuando cargues futuros reportes de existencias de <strong>almacenes.xlsx</strong>, aunque una pieza de taller salga en <code>0</code> en Almacén General, el sistema automáticamente sabrá que es de taller y la enviará a la <strong>Orden de Producción</strong> para los joyeros.</li>
        </ul>
      </div>

    </div>
  );
}
