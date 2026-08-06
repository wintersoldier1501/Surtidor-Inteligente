import React, { useState, useEffect } from 'react';
import { X, Upload, Link as LinkIcon, Check, Image as ImageIcon } from 'lucide-react';

export default function ImageModal({ product, onClose, onSaveImage }) {
  const [imageUrl, setImageUrl] = useState('');
  const [preview, setPreview] = useState('');

  useEffect(() => {
    if (product) {
      setImageUrl(product.imagen || '');
      setPreview(product.imagen || '');
    }
  }, [product]);

  if (!product) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      setPreview(dataUrl);
      setImageUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setImageUrl(val);
    setPreview(val);
  };

  const handleSave = () => {
    onSaveImage(product.sku, imageUrl);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="glass-card animate-fade-in"
        style={{
          maxWidth: '520px',
          width: '100%',
          background: '#181b24',
          border: '1px solid var(--border-color)',
          padding: '24px',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={24} />
        </button>

        <h3 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '4px' }}>Fotografía del Producto</h3>
        <p style={{ color: 'var(--gold-primary)', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '16px' }}>
          {product.sku} - {product.nombre}
        </p>

        {/* Image Preview Box */}
        <div
          style={{
            width: '100%',
            height: '240px',
            borderRadius: 'var(--radius-md)',
            background: '#11131a',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            marginBottom: '20px',
            position: 'relative'
          }}
        >
          {preview ? (
            <img src={preview} alt={product.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <ImageIcon size={48} style={{ opacity: 0.4, marginBottom: '8px' }} />
              <p style={{ fontSize: '0.85rem' }}>Sin fotografía asignada</p>
            </div>
          )}
        </div>

        {/* Input Methods */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          
          {/* File Upload */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              SUBIR FOTO DESDE TU DISPOSITIVO:
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="input-field"
              style={{ cursor: 'pointer' }}
            />
          </div>

          {/* URL Input */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              O PEGAR ENLACE / URL DE IMAGEN:
            </label>
            <input
              type="url"
              className="input-field"
              placeholder="https://..."
              value={imageUrl}
              onChange={handleUrlChange}
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={handleSave}>
            <Check size={18} /> Guardar Imagen
          </button>
        </div>

      </div>
    </div>
  );
}
