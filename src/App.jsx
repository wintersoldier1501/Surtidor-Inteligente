import React, { useState, useEffect, useMemo, useRef } from 'react';
import initialData from './data/initialData.json';
import Navbar from './components/Navbar';
import RestockDashboard from './components/RestockDashboard';
import CatalogView from './components/CatalogView';
import WorkshopView from './components/WorkshopView';
import ExcelImporter from './components/ExcelImporter';
import ImageModal from './components/ImageModal';
import { subscribeToLiveProducts, pushProductsToCloud } from './firebase';

const STORAGE_KEY = 'accesorizate_products_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState('surtidor'); // 'surtidor', 'catalogo', 'taller', 'importar'
  const isRemoteUpdateRef = useRef(false);

  const [products, setProducts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading saved data:', e);
    }
    return initialData;
  });

  const [selectedProductForImage, setSelectedProductForImage] = useState(null);

  // Subscribe to Firebase Realtime updates from other devices
  useEffect(() => {
    const unsubscribe = subscribeToLiveProducts((remoteProducts) => {
      if (remoteProducts && Array.isArray(remoteProducts) && remoteProducts.length > 0) {
        isRemoteUpdateRef.current = true;
        setProducts(remoteProducts);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Persist products to localStorage and Firebase Cloud when changed
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch (e) {
      console.error('Error saving data to localStorage:', e);
    }

    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
    } else {
      pushProductsToCloud(products);
    }
  }, [products]);

  // Handler: Update stocks from almacenes.xlsx
  const handleUpdateStock = (newStockMap) => {
    let updatedCount = 0;
    let createdCount = 0;

    setProducts(prevProducts => {
      const existingMap = new Map(prevProducts.map(p => [p.sku, p]));

      Object.keys(newStockMap).forEach(sku => {
        const itemData = newStockMap[sku];
        if (existingMap.has(sku)) {
          const current = existingMap.get(sku);
          existingMap.set(sku, {
            ...current,
            nombre: itemData.nombre || current.nombre,
            precioPublico: itemData.precioPublico || current.precioPublico,
            precioMayoreo: itemData.precioMayoreo || current.precioMayoreo,
            stockGeneral: itemData.stockGeneral,
            stockVistaHermosa: itemData.stockVistaHermosa,
            stockPaseo: itemData.stockPaseo
          });
          updatedCount++;
        } else {
          // New product found in Excel
          existingMap.set(sku, {
            sku: sku,
            nombre: itemData.nombre,
            categoria: detectCategory(itemData.nombre),
            precioPublico: itemData.precioPublico,
            precioMayoreo: itemData.precioMayoreo,
            stockGeneral: itemData.stockGeneral,
            stockVistaHermosa: itemData.stockVistaHermosa,
            stockPaseo: itemData.stockPaseo,
            esTaller: false,
            imagen: ''
          });
          createdCount++;
        }
      });

      return Array.from(existingMap.values());
    });

    return { updated: updatedCount, created: createdCount };
  };

  // Handler: Update workshop tags from piezas de taller.xlsx
  const handleUpdateTallerSkus = (tallerSkusSet) => {
    let taggedCount = 0;

    setProducts(prevProducts => {
      return prevProducts.map(p => {
        if (tallerSkusSet.has(p.sku)) {
          taggedCount++;
          return { ...p, esTaller: true };
        }
        return p;
      });
    });

    return taggedCount;
  };

  // Handler: Toggle single Taller status
  const handleToggleTaller = (sku) => {
    setProducts(prev => prev.map(p => {
      if (p.sku === sku) {
        return { ...p, esTaller: !p.esTaller };
      }
      return p;
    }));
  };

  // Handler: Save product image
  const handleSaveImage = (sku, imageUrl) => {
    setProducts(prev => prev.map(p => {
      if (p.sku === sku) {
        return { ...p, imagen: imageUrl };
      }
      return p;
    }));
  };

  // Handler: Update workshop availability & notes
  const handleUpdateWorkshopStatus = (sku, status, nota = '') => {
    setProducts(prev => prev.map(p => {
      if (p.sku === sku) {
        return {
          ...p,
          estadoTaller: status, // 'disponible', 'sin_material', 'desactivado'
          notaTaller: nota
        };
      }
      return p;
    }));
  };

  // Handler: Delete single product from catalog
  const handleDeleteProduct = (sku) => {
    setProducts(prev => prev.filter(p => p.sku !== sku));
  };

  // Handler: Toggle No Surtir a Paseo Durango
  const handleToggleNoSurtirPaseo = (sku) => {
    setProducts(prev => prev.map(p => {
      if (p.sku === sku) {
        return { ...p, noSurtirPaseo: !p.noSurtirPaseo };
      }
      return p;
    }));
  };

  // Handler: Toggle General Product Active/Deactivated Status
  const handleToggleDesactivado = (sku) => {
    setProducts(prev => prev.map(p => {
      if (p.sku === sku) {
        return { ...p, desactivado: !p.desactivado };
      }
      return p;
    }));
  };

  // Handler: Sync photos directly from https://catalogos-accesorios.web.app without CORS issues
  const handleSyncCatalogPhotos = () => {
    return new Promise((resolve) => {
      try {
        const scriptId = 'online-catalog-script-' + Date.now();
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://catalogos-accesorios.web.app/public/data/products_data.js?v=${Date.now()}`;

        const processData = (onlineList) => {
          const onlineMap = {};
          onlineList.forEach(item => {
            const code = String(item.code || '').trim().toUpperCase();
            const img = item.image;
            if (code && img) {
              const url = img.startsWith('http') ? img : `https://catalogos-accesorios.web.app/${img}`;
              onlineMap[code] = url;
            }
          });

          let updatedCount = 0;
          setProducts(prev => prev.map(p => {
            const skuUpper = String(p.sku || '').trim().toUpperCase();
            const baseSku = skuUpper.split('-')[0];

            const targetUrl = onlineMap[skuUpper] || onlineMap[baseSku];
            if (targetUrl) {
              if (!p.imagen || p.imagen !== targetUrl) {
                updatedCount++;
                return { ...p, imagen: targetUrl };
              }
            }
            return p;
          }));

          resolve({ count: updatedCount });
        };

        script.onload = () => {
          if (window.PRODUCTS_DATA && Array.isArray(window.PRODUCTS_DATA)) {
            processData(window.PRODUCTS_DATA);
          } else {
            resolve({ count: 0, error: 'No se encontraron datos en el catálogo web.' });
          }
          try { document.head.removeChild(script); } catch (e) {}
        };

        script.onerror = () => {
          // Fallback via CORS proxy if direct script load is blocked
          fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://catalogos-accesorios.web.app/public/data/products_data.js'))
            .then(res => res.text())
            .then(text => {
              const match = text.match(/window\.PRODUCTS_DATA\s*=\s*(\[[\s\S]*?\]);/);
              if (match) {
                const onlineList = JSON.parse(match[1]);
                processData(onlineList);
              } else {
                resolve({ count: 0, error: 'No se pudo leer el catálogo web.' });
              }
            })
            .catch(() => {
              resolve({ count: 0, error: 'No se pudo conectar con catalogos-accesorios.web.app' });
            });
        };

        document.head.appendChild(script);
      } catch (err) {
        console.error('Error syncing online photos:', err);
        resolve({ count: 0, error: 'Error al sincronizar.' });
      }
    });
  };

  // Computed statistics for Navbar
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const tallerCount = products.filter(p => p.esTaller).length;
    const surtirCount = products.filter(p => p.stockPaseo === 0).length;

    return { totalProducts, tallerCount, surtirCount };
  }, [products]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} stats={stats} />

      {/* Main View Container */}
      <main style={{ flex: 1, paddingBottom: '60px' }}>
        {activeTab === 'surtidor' && (
          <RestockDashboard
            products={products}
            onOpenImageModal={(prod) => setSelectedProductForImage(prod)}
            onSyncCatalogPhotos={handleSyncCatalogPhotos}
            onToggleNoSurtirPaseo={handleToggleNoSurtirPaseo}
            onToggleDesactivado={handleToggleDesactivado}
          />
        )}

        {activeTab === 'catalogo' && (
          <CatalogView
            products={products}
            onToggleTaller={handleToggleTaller}
            onOpenImageModal={(prod) => setSelectedProductForImage(prod)}
            onSyncCatalogPhotos={handleSyncCatalogPhotos}
            onDeleteProduct={handleDeleteProduct}
            onToggleNoSurtirPaseo={handleToggleNoSurtirPaseo}
            onToggleDesactivado={handleToggleDesactivado}
          />
        )}

        {activeTab === 'taller' && (
          <WorkshopView
            products={products}
            onOpenImageModal={(prod) => setSelectedProductForImage(prod)}
            onUpdateWorkshopStatus={handleUpdateWorkshopStatus}
            onSyncCatalogPhotos={handleSyncCatalogPhotos}
          />
        )}

        {activeTab === 'importar' && (
          <ExcelImporter
            products={products}
            onUpdateStock={handleUpdateStock}
            onUpdateTallerSkus={handleUpdateTallerSkus}
            onSyncCatalogPhotos={handleSyncCatalogPhotos}
          />
        )}
      </main>

      {/* Image Upload/View Modal */}
      {selectedProductForImage && (
        <ImageModal
          product={selectedProductForImage}
          onClose={() => setSelectedProductForImage(null)}
          onSaveImage={handleSaveImage}
        />
      )}

      {/* Simple Footer */}
      <footer className="no-print" style={{ textAlign: 'center', padding: '20px', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        Accesorizate Joyería • Vista Hermosa & Paseo Durango • Sistema de Surtido Inteligente v1.0
      </footer>

    </div>
  );
}

function detectCategory(nombre) {
  const nombreUpper = (nombre || '').toUpperCase();
  if (nombreUpper.includes('ARETE') || nombreUpper.includes('HUGGIE') || nombreUpper.includes('ARRACADA') || nombreUpper.includes('STUD')) return 'Aretes';
  if (nombreUpper.includes('COLLAR') || nombreUpper.includes('CADENA') || nombreUpper.includes('GARGANTILLA')) return 'Collares';
  if (nombreUpper.includes('PULSERA') || nombreUpper.includes('BRAZALETE') || nombreUpper.includes('ESCLAVA')) return 'Pulseras';
  if (nombreUpper.includes('ANILLO') || nombreUpper.includes('SELLO')) return 'Anillos';
  if (nombreUpper.includes('DIJE')) return 'Dijes';
  if (nombreUpper.includes('CHARM')) return 'Charms';
  return 'Otros';
}
