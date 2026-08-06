import React from 'react';
import { Sparkles, Package, Hammer, Upload, Gem, Layers, Warehouse, Lock } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, stats, onLock }) {
  return (
    <header className="no-print" style={{ background: '#11131a', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#ffffff',
              border: '2px solid var(--gold-primary)',
              boxShadow: '0 0 14px rgba(212, 175, 55, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              overflow: 'hidden'
            }}
          >
            <img
              src="/logo.svg"
              alt="Accesorizate Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', color: '#fff', letterSpacing: '1px', lineHeight: 1.1 }}>ACCESORIZATE</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontWeight: '600', letterSpacing: '0.5px' }}>Surtido Inteligente & Taller</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '8px', background: '#181b24', padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <button
            className={`btn ${activeTab === 'surtidor' ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setActiveTab('surtidor')}
            style={{ border: activeTab === 'surtidor' ? 'none' : 'transparent' }}
          >
            <Warehouse size={18} />
            <span>Surtidor entre Almacenes</span>
            {stats.surtirCount > 0 && (
              <span style={{ background: activeTab === 'surtidor' ? '#0f1117' : 'var(--warning)', color: activeTab === 'surtidor' ? '#fff' : '#0f1117', padding: '2px 7px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {stats.surtirCount}
              </span>
            )}
          </button>

          <button
            className={`btn ${activeTab === 'catalogo' ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setActiveTab('catalogo')}
            style={{ border: activeTab === 'catalogo' ? 'none' : 'transparent' }}
          >
            <Package size={18} />
            <span>Catálogo Maestro</span>
            <span style={{ background: '#272c3d', color: 'var(--text-muted)', padding: '2px 7px', borderRadius: '10px', fontSize: '0.75rem' }}>
              {stats.totalProducts}
            </span>
          </button>

          <button
            className={`btn ${activeTab === 'taller' ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setActiveTab('taller')}
            style={{ border: activeTab === 'taller' ? 'none' : 'transparent' }}
          >
            <Hammer size={18} />
            <span>Taller</span>
            <span style={{ background: 'var(--purple-bg)', color: '#c084fc', padding: '2px 7px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              {stats.tallerCount}
            </span>
          </button>

          <button
            className={`btn ${activeTab === 'importar' ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setActiveTab('importar')}
            style={{ border: activeTab === 'importar' ? 'none' : 'transparent' }}
          >
            <Upload size={18} />
            <span>Cargar Excel</span>
          </button>
        </nav>

        {/* Info Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>
            <div>Sucursal Matriz: <strong style={{ color: '#fff' }}>Vista Hermosa</strong></div>
            <div>Destino Surtido: <strong style={{ color: 'var(--gold-primary)' }}>Paseo Durango</strong></div>
          </div>
          {onLock && (
            <button
              className="btn btn-outline"
              onClick={onLock}
              style={{ padding: '6px 10px', fontSize: '0.75rem', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
              title="Bloquear el sistema con PIN"
            >
              <Lock size={14} />
              <span>Bloquear</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
