'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

interface LocationPickerProps {
  coords: { lat: number; lng: number } | null;
  onCoordsChange: (coords: { lat: number; lng: number }) => void;
}

export default function LocationPicker({ coords, onCoordsChange }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (leafletInstance.current) return;

    const center: [number, number] = coords
      ? [coords.lat, coords.lng]
      : [8.9475, 125.5406]; // Default: Butuan City

    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView(center, 16);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // CARTO basemaps now require an API key, so use OpenStreetMap (no key needed).
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Place initial marker if coords exist
    if (coords) {
      const icon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color: #003d9b; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      markerRef.current = L.marker([coords.lat, coords.lng], { icon, draggable: true }).addTo(map);

      markerRef.current.on('dragend', () => {
        const pos = markerRef.current!.getLatLng();
        onCoordsChange({ lat: pos.lat, lng: pos.lng });
      });
    }

    // Click to place/move marker
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onCoordsChange({ lat, lng });

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const icon = L.divIcon({
          className: 'custom-pin',
          html: `<div style="background-color: #003d9b; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
            <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        markerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
        markerRef.current.on('dragend', () => {
          const pos = markerRef.current!.getLatLng();
          onCoordsChange({ lat: pos.lat, lng: pos.lng });
        });
      }
    });

    leafletInstance.current = map;

    return () => {
      map.remove();
      leafletInstance.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker when coords change externally (e.g., from GPS button)
  useEffect(() => {
    if (!leafletInstance.current || !coords) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([coords.lat, coords.lng]);
    } else {
      const icon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color: #003d9b; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      markerRef.current = L.marker([coords.lat, coords.lng], { icon, draggable: true }).addTo(leafletInstance.current);
      markerRef.current.on('dragend', () => {
        const pos = markerRef.current!.getLatLng();
        onCoordsChange({ lat: pos.lat, lng: pos.lng });
      });
    }
    leafletInstance.current.panTo([coords.lat, coords.lng]);
  }, [coords, onCoordsChange]);

  return <div ref={mapRef} className="w-full h-full z-0 relative rounded-lg" />;
}
