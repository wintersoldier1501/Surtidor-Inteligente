import React, { useState, useMemo } from 'react';
import { Warehouse, Printer, Copy, Check, Filter, Hammer, PackageCheck, AlertTriangle, Image as ImageIcon, Search, Star, Tag } from 'lucide-react';
import LabelPrinterModal from './LabelPrinterModal';

export default function RestockDashboard({ products, onOpenImageModal, onToggleNoSurtirPaseo, onToggleEstrella }) {
  const [paseoThreshold, setPaseoThreshold] = useState(0); // 0 means Paseo stock == 0
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [prioridadFilter, setPrioridadFilter] = useState('todas'); // 'todas', 'estrellas', 'normales'
  const [activeSubTab, setActiveSubTab] = useState('general'); // 'general', 'taller', 'agotados'
  const [omitExcluidos, setOmitExcluidos] = useState(true);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedSkusForLabels, setSelectedSkusForLabels] = useState([]);

  // Compute items that require restocking for Paseo Durango
  const restockAnalysis = useMemo(() => {
    const itemsToRestock = products.filter(p => {
      if (p.desactivado) return false;
      if (omitExcluidos && p.noSurtirPaseo) return false;

      // 🌟 REGLA DE PRODUCTO ESTRELLA / TOP VENTAS:
      // Si el producto está marcado como Estrella y en Paseo hay 4 o menos piezas, ¡SIEMPRE ENTRA A SURTIDO!
      if (p.esEstrella && p.stockPaseo <= 4) return true;

      // Regla estándar: comparar contra el umbral seleccionado (0, 1 o 2 piezas)
      return p.stockPaseo <= paseoThreshold;
    });

    // Apply category, search, exclusion & priority filters
    const filtered = itemsToRestock.filter(p => {
      const matchCat = selectedCategory === 'Todas' || p.categoria === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery = !q || p.sku.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q);
      const matchPrioridad =
        prioridadFilter === 'todas' ||
        (prioridadFilter === 'estrellas' && p.esEstrella) ||
        (prioridadFilter === 'normales' && !p.esEstrella);

      return matchCat && matchQuery && matchPrioridad;
    });

    // Sorter: Los Productos Estrella SIEMPRE aparecen HASTA ARRIBA de las listas de surtido
    const starSort = (a, b) => {
      if (a.esEstrella && !b.esEstrella) return -1;
      if (!a.esEstrella && b.esEstrella) return 1;
      return 0;
    };

    // 1. From Almacen General (General > 0)
    const surtirGeneral = filtered.filter(p => p.stockGeneral > 0).sort(starSort);

    // 2. Taller Order (General == 0 && esTaller)
    const ordenTaller = filtered.filter(p => p.stockGeneral <= 0 && p.esTaller).sort(starSort);

    // 3. Out of stock (General == 0 && !esTaller)
    const agotados = filtered.filter(p => p.stockGeneral <= 0 && !p.esTaller).sort(starSort);

    return { surtirGeneral, ordenTaller, agotados, totalNeedingRestock: itemsToRestock.length };
  }, [products, paseoThreshold, selectedCategory, searchQuery, omitExcluidos, prioridadFilter]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyWhatsApp = () => {
    let text = `*💎 ACCESORIZATE - SURTIDOR ENTRE ALMACENES*\n`;
    text += `Fecha: ${new Date().toLocaleDateString('es-MX')}\n\n`;

    if (activeSubTab === 'general') {
      text += `*📦 1. PIEZAS A TOMAR DE ALMACÉN GENERAL (${restockAnalysis.surtirGeneral.length} artículos):*\n`;
      restockAnalysis.surtirGeneral.forEach((item, idx) => {
        text += `${idx + 1}. [${item.sku}] ${item.nombre}\n   • Hay en Almacén: ${item.stockGeneral} | Sugerido: 1 o 2 pzas\n`;
      });
    } else if (activeSubTab === 'taller') {
      text += `*🔨 2. ORDEN DE TRABAJO PARA TALLER (${restockAnalysis.ordenTaller.length} artículos):*\n`;
      restockAnalysis.ordenTaller.forEach((item, idx) => {
        text += `${idx + 1}. [${item.sku}] ${item.nombre}\n   • En Paseo: ${item.stockPaseo} | Taller Fabricar\n`;
      });
    } else {
      text += `*🔴 3. ARTÍCULOS AGOTADOS (${restockAnalysis.agotados.length} artículos):*\n`;
      restockAnalysis.agotados.forEach((item, idx) => {
        text += `${idx + 1}. [${item.sku}] ${item.nombre}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 3000);
  };

  const categories = ['Todas', 'Aretes', 'Collares', 'Pulseras', 'Anillos', 'Dijes', 'Charms', 'Otros'];

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Header section */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Warehouse color="var(--gold-primary)" size={28} />
            Surtidor entre Almacenes
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Orden y Producción de Almacén General y Taller.
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-gold" onClick={() => setShowLabelModal(true)} style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
            <Tag size={18} />
            <span>
              {selectedSkusForLabels.length > 0
                ? `🏷️ Generar Etiquetas (${selectedSkusForLabels.length} seleccionados)`
                : '🏷️ Generar Etiquetas'}
            </span>
          </button>

          <button className="btn btn-outline" onClick={handleCopyWhatsApp}>
            {copiedMsg ? <Check color="#34d399" size={18} /> : <Copy size={18} />}
            <span>{copiedMsg ? '¡Copiado!' : 'Copiar para WhatsApp'}</span>
          </button>

          <button className="btn btn-gold" onClick={handlePrint}>
            <Printer size={18} />
            <span>Imprimir Hoja de Surtido</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card no-print" style={{ marginBottom: '24px', padding: '18px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', alignItems: 'center' }}>
          
          {/* Paseo Stock Criterion Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--gold-primary)', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.5px' }}>
              CRITERIO DE REPOSICIÓN EN PASEO:
            </label>
            <select
              className="input-field"
              value={paseoThreshold}
              onChange={(e) => setPaseoThreshold(Number(e.target.value))}
              style={{ width: '100%' }}
            >
              <option value={0}>Surtir cuando existan 0 piezas en Paseo (Stock Agotado)</option>
              <option value={1}>Surtir cuando existan 1 o menos piezas en Paseo</option>
              <option value={2}>Surtir cuando existan 2 o menos piezas en Paseo</option>
              <option value={3}>Surtir cuando existan 3 o menos piezas en Paseo</option>
              <option value={4}>Surtir cuando existan 4 o menos piezas en Paseo</option>
            </select>
          </div>

          {/* Exclusion Filter Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--gold-primary)', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.5px' }}>
              FILTRO DE EXCLUSIONES:
            </label>
            <select
              className="input-field"
              value={omitExcluidos ? 'omitir' : 'mostrar'}
              onChange={(e) => setOmitExcluidos(e.target.value === 'omitir')}
              style={{ width: '100%' }}
            >
              <option value="omitir">🚫 Omitir no vendibles en Paseo Durango</option>
              <option value="mostrar">👁️ Mostrar todos los productos</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--gold-primary)', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.5px' }}>
              CATEGORÍA:
            </label>
            <select
              className="input-field"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ width: '100%' }}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Priority Star Filter Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--gold-primary)', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.5px' }}>
              PRIORIDAD REPOSICIÓN:
            </label>
            <select
              className="input-field"
              value={prioridadFilter}
              onChange={(e) => setPrioridadFilter(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="todas">👁️ Mostrar Todo el Surtido</option>
              <option value="estrellas">⭐ Solo Productos Estrella / Prioridad Top</option>
              <option value="normales">📦 Productos Normales</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--gold-primary)', fontWeight: 'bold', marginBottom: '6px', letterSpacing: '0.5px' }}>
              BUSCAR PIEZA O CÓDIGO:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Ej. AX056, Aretes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ width: '100%', paddingLeft: '36px' }}
              />
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

        </div>
      </div>

      {/* Main Analysis Cards (Sub-tabs) */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        
        {/* Card 1: Almacén General */}
        <div
          onClick={() => setActiveSubTab('general')}
          className={`stat-card ${activeSubTab === 'general' ? 'active' : ''}`}
          style={{
            cursor: 'pointer',
            padding: '22px 24px 22px 24px',
            borderRadius: '16px',
            border: activeSubTab === 'general' ? '2px solid #34d399' : '1px solid var(--border-color)',
            background: activeSubTab === 'general' ? 'rgba(52, 211, 153, 0.05)' : 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                1. Almacén General
              </span>
              <PackageCheck color="#34d399" size={24} />
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>
              {restockAnalysis.surtirGeneral.length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>piezas</span>
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '10px', lineHeight: '1.4' }}>
            Listas para recoger del Almacén General en Vista Hermosa.
          </p>
        </div>

        {/* Card 2: Orden a Taller */}
        <div
          onClick={() => setActiveSubTab('taller')}
          className={`stat-card ${activeSubTab === 'taller' ? 'active' : ''}`}
          style={{
            cursor: 'pointer',
            padding: '22px 24px 22px 24px',
            borderRadius: '16px',
            border: activeSubTab === 'taller' ? '2px solid #c084fc' : '1px solid var(--border-color)',
            background: activeSubTab === 'taller' ? 'rgba(192, 132, 252, 0.05)' : 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: '#c084fc', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                2. Orden a Taller
              </span>
              <Hammer color="#c084fc" size={24} />
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>
              {restockAnalysis.ordenTaller.length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>piezas</span>
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '10px', lineHeight: '1.4' }}>
            En 0 en Almacén General, pero etiquetadas como <strong>Procedencia Taller</strong>.
          </p>
        </div>

        {/* Card 3: Agotados de Proveedor */}
        <div
          onClick={() => setActiveSubTab('agotados')}
          className={`stat-card ${activeSubTab === 'agotados' ? 'active' : ''}`}
          style={{
            cursor: 'pointer',
            padding: '22px 24px 22px 24px',
            borderRadius: '16px',
            border: activeSubTab === 'agotados' ? '2px solid #f87171' : '1px solid var(--border-color)',
            background: activeSubTab === 'agotados' ? 'rgba(248, 113, 113, 0.05)' : 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: '#f87171', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                3. Agotados Proveedor
              </span>
              <AlertTriangle color="#f87171" size={24} />
            </div>
            <div style={{ fontSize: '2.4rem', fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>
              {restockAnalysis.agotados.length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>piezas</span>
            </div>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '10px', lineHeight: '1.4' }}>
            En 0 en Almacén General (requiere pedido a Proveedor).
          </p>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="glass-card">
        
        {/* Table Header / Subtab Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {activeSubTab === 'general' && <><PackageCheck color="#34d399" /> Lista 1: Tomar de Almacén General ({restockAnalysis.surtirGeneral.length})</>}
              {activeSubTab === 'taller' && <><Hammer color="#c084fc" /> Lista 2: Orden de Fabricación para Taller ({restockAnalysis.ordenTaller.length})</>}
              {activeSubTab === 'agotados' && <><AlertTriangle color="#f87171" /> Lista 3: Piezas Agotadas de Proveedor ({restockAnalysis.agotados.length})</>}
            </h3>
          </div>
        </div>

        {/* Table list */}
        {getCurrentList(activeSubTab, restockAnalysis).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
            <Check size={48} color="var(--gold-primary)" style={{ opacity: 0.5, marginBottom: '12px' }} />
            <p style={{ fontSize: '1.1rem' }}>No hay piezas en esta lista con los filtros seleccionados.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--gold-primary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={
                        getCurrentList(activeSubTab, restockAnalysis).length > 0 &&
                        getCurrentList(activeSubTab, restockAnalysis).every(item => selectedSkusForLabels.includes(item.sku))
                      }
                      onChange={(e) => {
                        const currentSkus = getCurrentList(activeSubTab, restockAnalysis).map(i => i.sku);
                        if (e.target.checked) {
                          setSelectedSkusForLabels(prev => Array.from(new Set([...prev, ...currentSkus])));
                        } else {
                          setSelectedSkusForLabels(prev => prev.filter(sku => !currentSkus.includes(sku)));
                        }
                      }}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--gold-primary)', cursor: 'pointer' }}
                      title="Seleccionar todo para etiquetas"
                    />
                  </th>
                  <th style={{ padding: '12px 16px' }}>Foto</th>
                  <th style={{ padding: '12px 16px' }}>Clave (SKU)</th>
                  <th style={{ padding: '12px 16px' }}>Nombre del Artículo</th>
                  <th style={{ padding: '12px 16px' }}>Categoría</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Stock Paseo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Almacén General</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Vista Hermosa</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Origen</th>
                  <th className="no-print" style={{ padding: '12px 16px', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {getCurrentList(activeSubTab, restockAnalysis).map((item) => (
                  <tr key={item.sku} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}>
                    
                    {/* Checkbox for label selection */}
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedSkusForLabels.includes(item.sku)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSkusForLabels(prev => [...prev, item.sku]);
                          } else {
                            setSelectedSkusForLabels(prev => prev.filter(s => s !== item.sku));
                          }
                        }}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--gold-primary)', cursor: 'pointer' }}
                      />
                    </td>
                    
                    {/* Thumbnail / Image */}
                    <td style={{ padding: '12px 16px' }}>
                      <div
                        onClick={() => onOpenImageModal(item)}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '8px',
                          background: '#000000',
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
                          <ImageIcon size={20} color="var(--text-muted)" />
                        )}
                      </div>
                    </td>

                    {/* SKU */}
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--gold-primary)', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{item.sku}</span>
                        {item.esEstrella && (
                          <span className="badge badge-surtir" style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(212, 175, 55, 0.2)', border: '1px solid var(--gold-primary)', color: 'var(--gold-primary)' }} title="Producto Estrella / Top Ventas">
                            ⭐ TOP VENTAS
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Nombre */}
                    <td style={{ padding: '12px 16px', color: '#fff', fontWeight: '500' }}>
                      {item.nombre}
                    </td>

                    {/* Categoría */}
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {item.categoria}
                    </td>

                    {/* Stock Paseo */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className="badge badge-danger">
                        {item.stockPaseo} pza
                      </span>
                    </td>

                    {/* Stock Almacén General */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {item.stockGeneral > 0 ? (
                        <span className="badge badge-surtir">
                          {item.stockGeneral} pzas
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>0</span>
                      )}
                    </td>

                    {/* Stock Vista Hermosa */}
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {item.stockVistaHermosa}
                    </td>

                    {/* Origen Tag */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {item.esTaller ? (
                        item.estadoTaller === 'sin_material' ? (
                          <span className="badge badge-warning" title={item.notaTaller || 'Falta material'}>
                            ⚠️ PAUSADO ({item.notaTaller || 'Sin Insumo'})
                          </span>
                        ) : item.estadoTaller === 'desactivado' ? (
                          <span className="badge badge-danger">
                            🔴 DESCONTINUADO
                          </span>
                        ) : (
                          <span className="badge badge-taller">
                            <Hammer size={12} /> TALLER DISPONIBLE
                          </span>
                        )
                      ) : (
                        <span className="badge badge-warning">
                          📦 PROVEEDOR
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="no-print" style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => onToggleEstrella(item.sku)}
                          style={{
                            padding: '6px',
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            border: item.esEstrella ? '1px solid var(--gold-primary)' : '1px solid rgba(255, 255, 255, 0.15)',
                            background: item.esEstrella ? 'rgba(212, 175, 55, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          title={item.esEstrella ? "Producto Estrella (Prioridad Top) - Clic para quitar" : "Marcar como Producto Estrella"}
                        >
                          <Star size={16} fill={item.esEstrella ? 'var(--gold-primary)' : 'none'} color={item.esEstrella ? 'var(--gold-primary)' : 'var(--text-muted)'} />
                        </button>
                        <button
                          className="btn btn-outline"
                          onClick={() => onOpenImageModal(item)}
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          {item.imagen ? 'Foto' : '+ Foto'}
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Label Printer Modal */}
      <LabelPrinterModal
        isOpen={showLabelModal}
        onClose={() => setShowLabelModal(false)}
        initialProducts={
          selectedSkusForLabels.length > 0
            ? products.filter(p => selectedSkusForLabels.includes(p.sku))
            : getCurrentList(activeSubTab, restockAnalysis)
        }
        allProducts={products}
      />

    </div>
  );
}

function getCurrentList(subTab, analysis) {
  if (subTab === 'general') return analysis.surtirGeneral;
  if (subTab === 'taller') return analysis.ordenTaller;
  return analysis.agotados;
}
