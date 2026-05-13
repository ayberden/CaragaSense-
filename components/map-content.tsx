'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useReports } from '@/hooks/use-reports';
import type { Report, SeverityLevel } from '@/lib/database.types';

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  critical: '#DE350B',
  high: '#DE350B',
  medium: '#FFAB00',
  low: '#36B37E',
};

const STATUS_ICONS: Record<string, string> = {
  reported: '!',
  verified: '✓',
  scheduled: '📋',
  in_progress: '🔧',
  fixed: '✅',
  dismissed: '—',
};

const DAMAGE_LABELS: Record<string, string> = {
  pothole: 'Pothole',
  longitudinal_crack: 'Long. Crack',
  transverse_crack: 'Trans. Crack',
  rutting: 'Rutting',
  faded_markings: 'Faded Marks',
  other: 'Other',
};

function createReportMarker(report: Report, map: L.Map) {
  const color = SEVERITY_COLORS[report.severity];
  const iconStr = STATUS_ICONS[report.status] || '?';
  const label = DAMAGE_LABELS[report.damage_type] || report.damage_type;
  const severity = report.severity.charAt(0).toUpperCase() + report.severity.slice(1);

  const icon = L.divIcon({
    className: 'custom-pin',
    html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold; cursor: pointer;">${iconStr}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  const confidence = report.confidence !== null ? `${Math.round(report.confidence * 100)}%` : 'N/A';
  const address = report.address || `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`;

  const marker = L.marker([report.latitude, report.longitude], { icon }).addTo(map);

  marker.bindPopup(`
    <div style="font-family: 'Inter', sans-serif; min-width: 180px;">
      <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${label}</div>
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
        <span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; font-family: monospace;">${severity}</span>
        <span style="font-size: 11px; color: #666; font-family: monospace;">AI: ${confidence}</span>
      </div>
      <div style="font-size: 12px; color: #555; margin-bottom: 4px;">📍 ${address}</div>
      <div style="font-size: 11px; color: #999; font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em;">Status: ${report.status.replace('_', ' ')}</div>
    </div>
  `);

  return marker;
}

export default function MapContent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const { reports } = useReports();

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;
    if (leafletInstance.current) return;

    const map = L.map(mapRef.current).setView([8.9475, 125.5406], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    leafletInstance.current = map;

    return () => {
      map.remove();
      leafletInstance.current = null;
    };
  }, []);

  // Update markers when reports change
  useEffect(() => {
    const map = leafletInstance.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add markers for each report
    reports.forEach((report) => {
      const marker = createReportMarker(report, map);
      markersRef.current.push(marker);
    });
  }, [reports]);

  return <div ref={mapRef} className="w-full h-full z-0 relative" />;
}
