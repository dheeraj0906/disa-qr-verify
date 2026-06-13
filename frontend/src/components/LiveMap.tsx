import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Stretch } from '../types';

// Khammam, Telangana — default center when no GPS coords available
const KHAMMAM_CENTER: [number, number] = [17.2478, 80.1514];
const DEFAULT_ZOOM = 13;

// Map stretch color_code strings to Leaflet-compatible colours
const LEAFLET_COLOR: Record<string, string> = {
  green:  '#16a34a',
  yellow: '#ca8a04',
  red:    '#dc2626',
  orange: '#ea580c',
};

interface VehicleMarker {
  stretchId: string;
  colorCode: string;
  lat: number;
  lng: number;
  label: string;
}

interface Props {
  stretches: (Stretch & { last_vehicle_location?: string | null })[];
  vehicles?: VehicleMarker[];
  className?: string;
}

function parseGeoJSON(raw: string | null | undefined): [number, number] | null {
  if (!raw) return null;
  try {
    const geo = JSON.parse(raw) as { coordinates?: [number, number] };
    if (geo.coordinates?.length === 2) {
      const [lng, lat] = geo.coordinates;
      return [lat, lng]; // Leaflet uses [lat, lng]
    }
  } catch { /* ignore */ }
  return null;
}

export default function LiveMap({ stretches, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const layersRef    = useRef<L.Layer[]>([]);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: KHAMMAM_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-draw stretch layers whenever data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old layers
    layersRef.current.forEach((l) => l.remove());
    layersRef.current = [];

    const bounds: [number, number][] = [];

    stretches.forEach((s) => {
      const color = LEAFLET_COLOR[s.color_code] ?? '#6b7280';
      const startPt = parseGeoJSON(s.start_point);
      const endPt   = parseGeoJSON(s.end_point);

      if (startPt && endPt) {
        // Draw polyline between start and end
        const line = L.polyline([startPt, endPt], {
          color,
          weight: 5,
          opacity: 0.85,
        }).bindTooltip(`${s.name} — ${s.status.replace('_', ' ')}`, { sticky: true });

        line.addTo(map);
        layersRef.current.push(line);
        bounds.push(startPt, endPt);

        // Start marker
        const startMarker = L.circleMarker(startPt, {
          radius: 7,
          color: '#fff',
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        }).bindTooltip(`${s.name} — Start`);
        startMarker.addTo(map);
        layersRef.current.push(startMarker);

        // End marker
        const endMarker = L.circleMarker(endPt, {
          radius: 7,
          color: '#fff',
          weight: 2,
          fillColor: color,
          fillOpacity: 1,
        }).bindTooltip(`${s.name} — End`);
        endMarker.addTo(map);
        layersRef.current.push(endMarker);
      }

      // Live vehicle position from last scan GPS
      const vehiclePt = parseGeoJSON(s.last_vehicle_location ?? null);
      if (vehiclePt) {
        const vMarker = L.circleMarker(vehiclePt, {
          radius: 11,
          color: '#fff',
          weight: 2.5,
          fillColor: color,
          fillOpacity: 0.9,
        }).bindPopup(
          `<strong>${s.name}</strong><br/>Last vehicle position<br/>Status: ${s.status}`
        );

        // Pulse ring (SVG icon overlay)
        const pulseIcon = L.divIcon({
          className: '',
          html: `<div style="
            width:22px;height:22px;border-radius:50%;
            background:${color};opacity:0.35;
            animation:pulse 1.8s ease-out infinite;
          "></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const pulseMarker = L.marker(vehiclePt, { icon: pulseIcon, interactive: false });
        pulseMarker.addTo(map);
        layersRef.current.push(pulseMarker);

        vMarker.addTo(map);
        layersRef.current.push(vMarker);
        bounds.push(vehiclePt);
      }
    });

    // Fit map to all drawn points, or keep default center
    if (bounds.length >= 2) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] });
    }
  }, [stretches]);

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%   { transform: scale(1);   opacity: 0.35; }
          70%  { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
      <div ref={containerRef} className={`w-full h-full ${className}`} />
    </>
  );
}
