import React, { useState, useMemo } from 'react';
import { Hammer, Search, Printer, Copy, Check, AlertCircle, Clock, XCircle, CheckCircle2, Edit3, Image as ImageIcon } from 'lucide-react';

export default function WorkshopView({ products, onOpenImageModal, onUpdateWorkshopStatus }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos'); // 'Todos', 'disponible', 'sin_material', 'desactivado'
  const [editingNoteSku, setEditingNoteSku] = useState(null);
  const [tempNote, setTempNote] = useState('');
  const [copied, setCopied] = useState(false);

  // Filter only Taller items
  const tallerProducts = useMemo(() => {
    return products.filter(p => p.esTaller);
  }, [products]);

  const filtered = useMemo(() => {
    return tallerProducts.filter(p => {
      const q = searchQuery.trim().toLowerCase();
      const matchQuery = !q || p.sku.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q);
      
      const pStatus = p.estadoTaller || 'disponible';
      const matchStatus = statusFilter === 'Todos' || pStatus === statusFilter;

      return matchQuery && matchStatus;
    });
  }, [tallerProducts, searchQuery, statusFilter]);

  // Urgent crafting needed (Paseo == 0 && General == 0) that are DISPONIBLES
  const urgentCraft = useMemo(() => {
    return tallerProducts.filter(p => p.stockPaseo === 0 && p.stockGeneral === 0 && (p.estadoTaller || 'disponible') === 'disponible');
  }, [tallerProducts]);

  const pausedForMaterials = useMemo(() => {
    return tallerProducts.filter(p => p.estadoTaller === 'sin_material');
  }, [tallerProducts]);

  const handleCopyUrgent = () => {
    let text = `*🔨 ACCESORIZATE - URGENTE PRODUCIR EN TALLER*\n`;
    text += `Fecha: ${new Date().toLocaleDateString('es-MX')}\n\n`;
    text += `Listado de piezas DISPONIBLES sin existencia en Almacén General ni Paseo Durango (${urgentCraft.length} piezas):\n\n`;

    urgentCraft.forEach((item, idx) => {
      text += `${idx + 1}. [${item.sku}] ${item.nombre}\n`;
    });

    if (pausedForMaterials.length > 0) {
      text += `\n*🟡 PIEZAS PAUSADAS EN TALLER POR FALTA DE MATERIAL (${pausedForMaterials.length} piezas):*\n`;
      pausedForMaterials.forEach((item, idx) => {
        text += `• [${item.sku}] ${item.nombre} ${item.notaTaller ? `(${item.notaTaller})` : ''}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSaveNote = (sku) => {
    const currentStatus = products.find(p => p.sku === sku)?.estadoTaller || 'disponible';
    onUpdateWorkshopStatus(sku, currentStatus, tempNote);
    setEditingNoteSku(null);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Hammer size={28} color="#c084fc" />
            Panel de Control & Disponibilidad de Taller
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Gestiona la disponibilidad de insumos, piezas pausadas por materiales y descontinuadas ({tallerProducts.length} productos).
          </p>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={handleCopyUrgent}>
            {copied ? <Check size={18} color="#34d399" /> : <Copy size={18} />}
            <span>{copied ? '¡Copiado!' : 'Copiar Reporte Taller'}</span>
          </button>
          <button className="btn btn-gold" onClick={() => window.print()}>
            <Printer size={18} />
            <span>Imprimir Hoja Taller</span>
          </button>
        </div>
      </div>

      {/* Quick KPI Cards */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        {/* Total Taller */}
        <div
          onClick={() => setStatusFilter('Todos')}
          className="glass-card"
          style={{ cursor: 'pointer', border: statusFilter === 'Todos' ? '2px solid #c084fc' : '1px solid var(--border-color)' }}
        >
          <span style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: '600', textTransform: 'uppercase' }}>TOTAL PIEZAS DE TALLER</span>
          <div style={{ fontSize: '2.2rem', fontWeight: '700', color: '#fff', marginTop: '4px' }}>
            {tallerProducts.length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>modelos</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Catálogo completo de fabricación.
          </p>
        </div>

        {/* Urgentes Disponibles */}
        <div
          onClick={() => setStatusFilter('disponible')}
          className="glass-card"
          style={{ cursor: 'pointer', border: statusFilter === 'disponible' ? '2px solid var(--success)' : '1px solid var(--border-color)' }}
        >
          <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: '600', textTransform: 'uppercase' }}>🟢 URGENTE PRODUCIR</span>
          <div style={{ fontSize: '2.2rem', fontWeight: '700', color: '#34d399', marginTop: '4px' }}>
            {urgentCraft.length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>disponibles</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Listas para fabricar de inmediato.
          </p>
        </div>

        {/* Pausados por Falta de Material */}
        <div
          onClick={() => setStatusFilter('sin_material')}
          className="glass-card"
          style={{ cursor: 'pointer', border: statusFilter === 'sin_material' ? '2px solid var(--warning)' : '1px solid var(--border-color)' }}
        >
          <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: '600', textTransform: 'uppercase' }}>🟡 PAUSADAS SIN MATERIAL</span>
          <div style={{ fontSize: '2.2rem', fontWeight: '700', color: '#fbbf24', marginTop: '4px' }}>
            {pausedForMaterials.length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>modelos</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Falta piedra, cadena o insumo.
          </p>
        </div>

        {/* Descontinuadas */}
        <div
          onClick={() => setStatusFilter('desactivado')}
          className="glass-card"
          style={{ cursor: 'pointer', border: statusFilter === 'desactivado' ? '2px solid var(--danger)' : '1px solid var(--border-color)' }}
        >
          <span style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: '600', textTransform: 'uppercase' }}>🔴 DESCONTINUADAS</span>
          <div style={{ fontSize: '2.2rem', fontWeight: '700', color: '#f87171', marginTop: '4px' }}>
            {tallerProducts.filter(p => p.estadoTaller === 'desactivado').length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>modelos</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            No se volverán a fabricar.
          </p>
        </div>

      </div>

      {/* Search Toolbar */}
      <div className="glass-card no-print" style={{ marginBottom: '24px', padding: '16px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>BUSCAR PIEZA DE TALLER:</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Buscar por código (ej: AX056) o nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '38px' }}
              />
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>FILTRAR DISPONIBILIDAD:</label>
            <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="Todos">Todos los Estados ({tallerProducts.length})</option>
              <option value="disponible">🟢 Disponibles para Fabricar</option>
              <option value="sin_material">🟡 Pausadas por Falta de Material ({pausedForMaterials.length})</option>
              <option value="desactivado">🔴 Descontinuadas / Desactivadas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Workshop Control Table */}
      <div className="glass-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--gold-primary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Foto</th>
                <th style={{ padding: '12px 16px' }}>Clave (SKU)</th>
                <th style={{ padding: '12px 16px' }}>Nombre del Artículo</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Stock Paseo</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Almacén General</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Estado de Disponibilidad</th>
                <th style={{ padding: '12px 16px' }}>Nota / Motivo de Taller</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((item) => {
                const currentStatus = item.estadoTaller || 'disponible';
                return (
                  <tr key={item.sku} style={{ borderBottom: '1px solid #1e2330' }}>
                    
                    {/* Foto */}
                    <td style={{ padding: '12px 16px' }}>
                      <div
                        onClick={() => onOpenImageModal(item)}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          background: '#11131a',
                          border: '1px solid var(--border-color)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {item.imagen ? (
                          <img src={item.imagen} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <ImageIcon size={18} color="var(--text-muted)" />
                        )}
                      </div>
                    </td>

                    {/* SKU */}
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--gold-primary)', fontFamily: 'monospace' }}>
                      {item.sku}
                    </td>

                    {/* Nombre */}
                    <td style={{ padding: '12px 16px', color: '#fff', fontWeight: '500' }}>
                      {item.nombre}
                    </td>

                    {/* Stock Paseo */}
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: item.stockPaseo === 0 ? '#f87171' : '#fff' }}>
                      {item.stockPaseo}
                    </td>

                    {/* Stock General */}
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: item.stockGeneral > 0 ? '#34d399' : 'var(--text-muted)' }}>
                      {item.stockGeneral}
                    </td>

                    {/* Estado Switch Selector */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <select
                        className="input-field"
                        value={currentStatus}
                        onChange={(e) => onUpdateWorkshopStatus(item.sku, e.target.value, item.notaTaller || '')}
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          background: currentStatus === 'disponible' ? 'var(--success-bg)' : currentStatus === 'sin_material' ? 'var(--warning-bg)' : 'var(--danger-bg)',
                          color: currentStatus === 'disponible' ? '#34d399' : currentStatus === 'sin_material' ? '#fbbf24' : '#f87171',
                          border: `1px solid ${currentStatus === 'disponible' ? 'rgba(52, 211, 153, 0.4)' : currentStatus === 'sin_material' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(248, 113, 113, 0.4)'}`
                        }}
                      >
                        <option value="disponible">🟢 Disponible para Fabricar</option>
                        <option value="sin_material">🟡 Pausado (Sin Material)</option>
                        <option value="desactivado">🔴 Descontinuado / No Fabricar</option>
                      </select>
                    </td>

                    {/* Nota de Taller */}
                    <td style={{ padding: '12px 16px' }}>
                      {editingNoteSku === item.sku ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Ej: Falta dije de luna, sin dije..."
                            value={tempNote}
                            onChange={(e) => setTempNote(e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          />
                          <button className="btn btn-gold" onClick={() => handleSaveNote(item.sku)} style={{ padding: '4px 8px' }}>
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => { setEditingNoteSku(item.sku); setTempNote(item.notaTaller || ''); }}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: item.notaTaller ? '#fbbf24' : 'var(--text-muted)', fontSize: '0.85rem' }}
                          title="Hacer clic para editar nota"
                        >
                          <Edit3 size={14} style={{ opacity: 0.6 }} />
                          <span>{item.notaTaller || <em>Agregar nota (ej. falta broche)...</em>}</span>
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
