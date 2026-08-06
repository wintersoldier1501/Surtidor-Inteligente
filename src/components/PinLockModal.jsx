import React, { useState } from 'react';
import { Lock, KeyRound, ShieldAlert, ArrowRight } from 'lucide-react';

const CORRECT_PIN = '13011';

export default function PinLockModal({ onUnlock }) {
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pinInput.trim() === CORRECT_PIN) {
      onUnlock();
    } else {
      setError(true);
      setPinInput('');
      setTimeout(() => setError(false), 2500);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#0a0d14',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '36px 28px',
        textAlign: 'center',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)'
      }}>
        {/* Logo or Lock Icon */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.4))',
          border: '1px solid var(--emerald-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto'
        }}>
          <Lock size={30} color="var(--gold-primary)" />
        </div>

        <h2 style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '8px', fontFamily: 'serif', letterSpacing: '0.5px' }}>
          ACCESORIZATE
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '24px' }}>
          Sistema de Surtido Inteligente & Taller. Ingresa el PIN de seguridad autorizado para acceder.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px', position: 'relative' }}>
            <input
              type="password"
              className="input-field"
              placeholder="Ingresa el PIN (ej: 13011)"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              autoFocus
              maxLength={10}
              style={{
                fontSize: '1.3rem',
                textAlign: 'center',
                letterSpacing: '6px',
                padding: '14px',
                borderColor: error ? '#f87171' : undefined,
                background: '#111520'
              }}
            />
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: '#f87171',
              fontSize: '0.85rem',
              marginBottom: '16px'
            }}>
              <ShieldAlert size={16} />
              <span>PIN incorrecto. Inténtalo de nuevo.</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-gold"
            style={{ width: '100%', padding: '12px', fontSize: '1rem', justifyContent: 'center' }}
          >
            <span>Ingresar al Sistema</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: '24px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          🔒 Acceso restringido para personal de Vista Hermosa y Paseo Durango.
        </div>
      </div>
    </div>
  );
}
