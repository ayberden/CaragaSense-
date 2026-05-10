'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function MapContent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (leafletInstance.current) return;

    // Use light themed map tiles
    const map = L.map(mapRef.current).setView([8.9475, 125.5406], 13);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    const createMarker = (lat: number, lng: number, color: string, id: string, iconStr: string) => {
      const icon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: bold;">${iconStr}</div><div style="background-color: #2e3038; color: white; font-family: monospace; font-size: 10px; padding: 2px 6px; border-radius: 4px; position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%); white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">${id}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      L.marker([lat, lng], { icon }).addTo(map);
    };

    createMarker(8.9475, 125.5406, '#DE350B', 'ID: PH-1092', '!'); // Critical
    createMarker(8.9550, 125.5500, '#FFAB00', 'ID: CR-881', '!'); // Medium
    createMarker(8.9300, 125.5300, '#003d9b', 'CAM-04 Active', 'O'); // Active Cam

    leafletInstance.current = map;

    return () => {
      map.remove();
      leafletInstance.current = null;
    };
  }, []);

  return <div ref={mapRef} className="w-full h-full z-0 relative" />;
}
