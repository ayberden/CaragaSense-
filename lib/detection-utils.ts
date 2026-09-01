import type { DamageType, SeverityLevel } from '@/lib/database.types';

export interface Detection {
  class: string;
  confidence: number;
  bbox?: number[];
  // Populated by backend AI crack classifier when a crack class is detected
  crack_type?: 'longitudinal' | 'transverse' | 'alligator' | 'block' | 'edge' | 'unknown';
  crack_label?: string;
  crack_description?: string;
}

const CLASS_MAP: Record<string, DamageType> = {
  // ── Custom model classes (my_model.pt) ─────────────────────────────────
  pothole: 'pothole',
  cracks: 'transverse_crack',
  crack: 'transverse_crack',
  open_manhole: 'open_manhole',
  'open manhole': 'open_manhole',
  // ── AI crack subtype values (from crack_type field) ───────────────────────
  longitudinal: 'longitudinal_crack',
  transverse: 'transverse_crack',
  alligator: 'alligator_crack',
  alligator_crack: 'alligator_crack',
  block: 'block_crack',
  block_crack: 'block_crack',
  edge: 'longitudinal_crack',
  // ── Standard RDD / RDDC dataset codes ───────────────────────────────
  d00: 'longitudinal_crack', d10: 'longitudinal_crack',
  longitudinal_crack: 'longitudinal_crack', 'longitudinal crack': 'longitudinal_crack',
  d20: 'transverse_crack', transverse_crack: 'transverse_crack', 'transverse crack': 'transverse_crack',
  d40: 'pothole', rutting: 'rutting',
};

const RAW_CLASS_DISPLAY: Record<string, string> = {
  pothole: 'Pothole',
  open_manhole: 'Open Manhole',
  'open manhole': 'Open Manhole',
  alligator_crack: 'Alligator Crack',
  block_crack: 'Block Crack',
  longitudinal_crack: 'Longitudinal Crack',
  transverse_crack: 'Transverse Crack',
  cracks: 'Crack',
  crack: 'Crack',
  rutting: 'Rutting',
};

const DAMAGE_LABELS: Record<DamageType, string> = {
  pothole: 'Pothole',
  open_manhole: 'Open Manhole',
  alligator_crack: 'Alligator Crack',
  block_crack: 'Block Crack',
  longitudinal_crack: 'Longitudinal Crack',
  transverse_crack: 'Transverse Crack',
  rutting: 'Rutting',
  other: 'Other Damages',
};

export function mapClassToDamageType(det: Detection): DamageType {
  // Check for specialized crack type first
  if (det.crack_type && det.crack_type !== 'unknown') {
    return CLASS_MAP[det.crack_type] || 'other';
  }
  return CLASS_MAP[det.class.toLowerCase().replace(/\s+/g, '_')] || 'other';
}

export function getDamageLabel(type: DamageType): string {
  return DAMAGE_LABELS[type] || type;
}

/** Count detections by mapped damage type */
export function countDetections(detections: Detection[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const det of detections) {
    // Prefer AI crack_label (e.g. "Alligator Crack"), else use raw class display
    let label: string;
    if (det.crack_label && det.crack_type && det.crack_type !== 'unknown') {
      label = det.crack_label;
    } else {
      const rawKey = det.class.toLowerCase().replace(/\s+/g, '_');
      label = RAW_CLASS_DISPLAY[rawKey] ?? RAW_CLASS_DISPLAY[det.class.toLowerCase()] ?? getDamageLabel(mapClassToDamageType(det));
    }
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

/** Get the dominant (most common) damage type */
export function getDominantType(detections: Detection[]): DamageType {
  const typeCounts: Record<DamageType, number> = {} as Record<DamageType, number>;
  for (const det of detections) {
    const t = mapClassToDamageType(det);
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  let maxType: DamageType = 'other';
  let maxCount = 0;
  for (const [t, c] of Object.entries(typeCounts)) {
    if (c > maxCount) { maxCount = c; maxType = t as DamageType; }
  }
  return maxType;
}

/** Get the highest confidence value */
export function getMaxConfidence(detections: Detection[]): number {
  if (detections.length === 0) return 0;
  return Math.max(...detections.map((d) => d.confidence));
}

/** Infer severity from detection count and confidence */
export function inferSeverity(detections: Detection[]): SeverityLevel {
  const maxConf = getMaxConfidence(detections);
  const total = detections.length;
  if (total >= 5 || (total >= 3 && maxConf >= 0.8)) return 'critical';
  if (total >= 3 || (total >= 2 && maxConf >= 0.7)) return 'high';
  if (total >= 2 || maxConf >= 0.6) return 'medium';
  return 'low';
}

/** Generate a human-readable description from detections */
export function generateDescription(detections: Detection[]): string {
  if (detections.length === 0) return '';

  const total = detections.length;
  const maxConf = getMaxConfidence(detections);
  const severity = inferSeverity(detections);

  // Build per-detection labels, explicitly naming crack subtypes
  const labelMap: Record<string, number> = {};
  for (const det of detections) {
    let label: string;
    if (det.crack_label && det.crack_type && det.crack_type !== 'unknown') {
      // AI successfully classified the crack type (e.g. "Alligator Crack")
      label = det.crack_label;
    } else if ((det.class === 'cracks' || det.class === 'crack') && (!det.crack_type || det.crack_type === 'unknown')) {
      // YOLO detected a crack but AI classification is unavailable
      label = 'Crack (type unclassified)';
    } else {
      const rawKey = det.class.toLowerCase().replace(/\s+/g, '_');
      label = RAW_CLASS_DISPLAY[rawKey] ?? RAW_CLASS_DISPLAY[det.class.toLowerCase()] ?? getDamageLabel(mapClassToDamageType(det));
    }
    labelMap[label] = (labelMap[label] || 0) + 1;
  }

  const entries = Object.entries(labelMap).sort((a, b) => b[1] - a[1]);

  // Build damage list string
  const parts: string[] = [];
  for (const [label, count] of entries) {
    parts.push(count === 1 ? `1 ${label.toLowerCase()}` : `${count} ${label.toLowerCase()}s`);
  }

  let damageList: string;
  if (parts.length === 1) damageList = parts[0];
  else if (parts.length === 2) damageList = `${parts[0]} and ${parts[1]}`;
  else damageList = `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;

  let desc = `AI detection identified ${damageList} in this area.`;

  // Append crack subtype description sentence from AI classifier
  const crackDetails = [...new Set(
    detections
      .filter((d) => d.crack_description && d.crack_type && d.crack_type !== 'unknown')
      .map((d) => d.crack_description as string)
  )];
  if (crackDetails.length > 0) {
    desc += ` ${crackDetails[0]}`;
  }

  // Add severity context
  const severityText: Record<SeverityLevel, string> = {
    critical: 'The road surface shows critical deterioration requiring urgent attention.',
    high: 'Significant road damage detected that should be addressed promptly.',
    medium: 'Moderate road damage observed that warrants scheduled maintenance.',
    low: 'Minor road surface issues detected.',
  };
  desc += ` ${severityText[severity]}`;

  // Add confidence note
  desc += ` Highest detection confidence: ${Math.round(maxConf * 100)}%.`;

  // Add multi-type note
  if (entries.length > 1) {
    desc += ` Multiple damage types present across ${total} detection${total > 1 ? 's' : ''}.`;
  }

  return desc;
}
