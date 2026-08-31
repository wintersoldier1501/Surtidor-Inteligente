import React, { useState, useMemo } from 'react';
import { Search, Filter, Hammer, Image as ImageIcon, Edit2, CheckCircle2, XCircle, Trash2, Star } from 'lucide-react';

export default function CatalogView({ products, onToggleTaller, onOpenImageModal, onSyncCatalogPhotos, onDeleteProduct, onToggleNoSurtirPaseo, onToggleDesactivado, onToggleEstrella }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [tallerFilter, setTallerFilter] = useState('Todos'); // 'Todos', 'SoloTaller', 'NoTaller'
  const [statusFilter, setStatusFilter] = useState('activos'); // 'activos', 'desactivados', 'todos'
  const [prioridadFilter, setPrioridadFilter] = useState('todos'); // 'todos', 'estrellas', 'normales'
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const pageSize = 50;

  const handleSync = async () => {
    setSyncing(true);
    const res = await onSyncCatalogPhotos();
    setSyncing(false);
    if (res.error) {
      setSyncMsg({ type: 'error', text: res.error });
    } else if (res.count > 0) {
      setSyncMsg({ type: 'success', text: `¡Se vincularon ${res.count} nuevas fotografías del catálogo web!` });
      setTimeout(() => setSyncMsg(null), 5000);
    } else {
      setSyncMsg({ type: 'success', text: `¡Todas las fotografías están al día! (Las 2,274 fotos del catálogo web ya se encuentran sincronizadas)` });
      setTimeout(() => setSyncMsg(null), 5000);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q || p.sku.toLowerCase().includes(q) || p.nombre.toLowerCase().includes(q);
      const matchCat = categoryFilter === 'Todas' || p.categoria === categoryFilter;
      const matchTaller =
        tallerFilter === 'Todos' ||
        (tallerFilter === 'SoloTaller' && p.esTaller) ||
        (tallerFilter === 'NoTaller' && !p.esTaller);
      const matchStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'activos' && !p.desactivado) ||
        (statusFilter === 'desactivados' && p.desactivado);
      const matchPrioridad =
        prioridadFilter === 'todos' ||
        (prioridadFilter === 'estrellas' && p.esEstrella) ||
        (prioridadFilter === 'normales' && !p.esEstrella);

      return matchSearch && matchCat && matchTaller && matchStatus && matchPrioridad;
    });
  }, [products, searchQuery, categoryFilter, tallerFilter, statusFilter, prioridadFilter]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;

  const categories = ['Todas', 'Aretes', 'Collares', 'Pulseras', 'Anillos', 'Dijes', 'Charms', 'Otros'];

  const productsWithPhotos = useMemo(() => products.filter(p => p.imagen).length, [products]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 16px' }}>
      
      {/* Title */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', color: '#fff' }}>Catálogo Maestro de Productos Accesorizate</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Explora los {products.length} productos registrados (<strong>{productsWithPhotos} fotos vinculadas</strong>).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-gold" onClick={handleSync} disabled={syncing}>
            <ImageIcon size={18} />
            <span>{syncing ? 'Sincronizando...' : '⚡ Sincronizar Fotos de catalogos-accesorios.web.app'}</span>
          </button>
        </div>
      </div>

      {syncMsg && (
        <div style={{ padding: '12px 18px', borderRadius: 'var(--radius-md)', background: syncMsg.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)', color: syncMsg.type === 'error' ? '#f87171' : '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)', marginBottom: '16px', fontSize: '0.9rem' }}>
          {syncMsg.text}
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '18px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          
          {/* Search bar */}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--gold-primary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              BUSCAR POR CÓDIGO (SKU) O NOMBRE:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Buscar por código (ej: AX056, AX100) o descripción..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                style={{ paddingLeft: '38px' }}
              />
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          {/* Category filter */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              CATEGORÍA:
            </label>
            <select
              className="input-field"
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Taller filter */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              FILTRAR POR TALLER:
            </label>
            <select
              className="input-field"
              value={tallerFilter}
              onChange={(e) => { setTallerFilter(e.target.value); setPage(1); }}
            >
              <option value="Todos">Todos los Productos</option>
              <option value="SoloTaller">🔨 Solo Piezas de Taller ({products.filter(p => p.esTaller).length})</option>
              <option value="NoTaller">📦 Piezas de Proveedor ({products.filter(p => !p.esTaller).length})</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              ESTADO EN CATÁLOGO:
            </label>
            <select
              className="input-field"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="activos">🟢 Solo Activos ({products.filter(p => !p.desactivado).length})</option>
              <option value="desactivados">🔴 Solo Desactivados ({products.filter(p => p.desactivado).length})</option>
              <option value="todos">👁️ Mostrar Todos ({products.length})</option>
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--gold-primary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              PRIORIDAD REPOSICIÓN:
            </label>
            <select
              className="input-field"
              value={prioridadFilter}
              onChange={(e) => { setPrioridadFilter(e.target.value); setPage(1); }}
            >
              <option value="todos">👁️ Todos los Productos</option>
              <option value="estrellas">⭐ Solo Productos Estrella ({products.filter(p => p.esEstrella).length})</option>
              <option value="normales">📦 Productos Normales ({products.filter(p => !p.esEstrella).length})</option>
            </select>
          </div>

        </div>
      </div>

      {/* Catalog Table */}
      <div className="glass-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--gold-primary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Foto</th>
                <th style={{ padding: '12px 16px' }}>Clave (SKU)</th>
                <th style={{ padding: '12px 16px' }}>Nombre del Artículo</th>
                <th style={{ padding: '12px 16px' }}>Categoría</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Precio Púb.</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>General</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>V. Hermosa</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Paseo</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Origen / Tipo</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Surtir Paseo</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No se encontraron productos con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((item) => (
                  <tr key={item.sku} style={{ borderBottom: '1px solid #1e2330', opacity: item.desactivado ? 0.45 : 1 }}>
                    
                    {/* Photo thumbnail */}
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

                    {/* Categoría */}
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {item.categoria}
                    </td>

                    {/* Precio público */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#fff', fontWeight: '600' }}>
                      ${item.precioPublico}
                    </td>

                    {/* Stock General */}
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: item.stockGeneral > 0 ? '#34d399' : 'var(--text-muted)' }}>
                      {item.stockGeneral}
                    </td>

                    {/* Stock Vista Hermosa */}
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {item.stockVistaHermosa}
                    </td>

                    {/* Stock Paseo */}
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: item.stockPaseo === 0 ? '#f87171' : '#fff' }}>
                      {item.stockPaseo}
                    </td>

                    {/* Es Taller Toggle Button */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => onToggleTaller(item.sku)}
                        className={`badge ${item.esTaller ? 'badge-taller' : 'badge-warning'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        title="Hacer clic para cambiar entre TALLER y PROVEEDOR"
                      >
                        {item.esTaller ? (
                          <><Hammer size={12} /> TALLER</>
                        ) : (
                          <>📦 PROVEEDOR</>
                        )}
                      </button>
                    </td>

                    {/* Surtir a Paseo Toggle Button */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => onToggleNoSurtirPaseo(item.sku)}
                        className={`badge ${item.noSurtirPaseo ? 'badge-danger' : 'badge-surtir'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        title="Hacer clic para activar o desactivar el surtido a Paseo Durango"
                      >
                        {item.noSurtirPaseo ? '🚫 NO SURTIR' : '🟢 SÍ SURTIR'}
                      </button>
                    </td>

                    {/* Estado en Catálogo (Activo / Desactivado) */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => onToggleDesactivado(item.sku)}
                        className={`badge ${item.desactivado ? 'badge-danger' : 'badge-surtir'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        title="Haz clic para activar o desactivar el producto en la tienda"
                      >
                        {item.desactivado ? '🔴 DESACTIVADO' : '🟢 ACTIVO'}
                      </button>
                    </td>

                    {/* Action buttons */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
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
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title="Cambiar o ver fotografía"
                        >
                          <Edit2 size={12} /> Foto
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => {
                            if (window.confirm(`¿Estás seguro de eliminar el producto [${item.sku}] "${item.nombre}" del catálogo?`)) {
                              onDeleteProduct(item.sku);
                            }
                          }}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title="Eliminar producto permanentemente"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <div>
            Mostrando <strong>{paginatedProducts.length}</strong> de <strong>{filteredProducts.length}</strong> productos filtrados
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: '4px 12px', opacity: page === 1 ? 0.5 : 1 }}
            >
              Anterior
            </button>
            <span>Página <strong>{page}</strong> de {totalPages}</span>
            <button
              className="btn btn-secondary"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: '4px 12px', opacity: page === totalPages ? 0.5 : 1 }}
            >
              Siguiente
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
