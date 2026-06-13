import { useState, useCallback } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
}

export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const acquire = useCallback((): Promise<GeoPosition> => {
    setLoading(true);
    setError(null);
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = 'Geolocation not supported by this browser';
        setError(msg);
        setLoading(false);
        reject(new Error(msg));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosition(geo);
          setLoading(false);
          resolve(geo);
        },
        (err) => {
          const msg = err.message || 'Location access denied';
          setError(msg);
          setLoading(false);
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
      );
    });
  }, []);

  return { position, error, loading, acquire };
}
