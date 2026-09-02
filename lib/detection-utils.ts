import type { DamageType, SeverityLevel } from '@/lib/database.types';

export interface Detection {
  class: string;
  confidence: number;
  bbox?: number[];
  /** Optional fields populated by the AI crack-type classifier */
  crack_type?: string;
  crack_label?: string;
  crack_description?: string;
}

const CLASS_MAP: Record<string, DamageType> = {
  // ── YOLOv11s model classes (my_model.pt) ──────────────────────────────────
  pothole: 'pothole',
  alligator_crack: 'alligator_crack',
  block_crack: 'block_crack',
  edge_crack: 'longitudinal_crack',    // treat edge crack as longitudinal
  longitudinal_crack: 'longitudinal_crack',
  transverse_crack: 'transverse_crack',
  manhole: 'open_manhole',             // covered manhole → open_manhole family
  open_manhole: 'open_manhole',
  // ── Alternate spellings / spaces ──────────────────────────────────────────
  'open manhole': 'open_manhole',
  'alligator crack': 'alligator_crack',
  'block crack': 'block_crack',
  'edge crack': 'longitudinal_crack',
  'longitudinal crack': 'longitudinal_crack',
  'transverse crack': 'transverse_crack',
  // ── Legacy / generic names ─────────────────────────────────────────────────
  cracks: 'transverse_crack',
  crack: 'transverse_crack',
  // ── Standard RDD / RDDC dataset codes ─────────────────────────────────────
  d00: 'longitudinal_crack', d10: 'longitudinal_crack',
  d20: 'transverse_crack',
  d40: 'pothole', rutting: 'rutting',
};

const RAW_CLASS_DISPLAY: Record<string, string> = {
  // ── YOLOv11s model classes ─────────────────────────────────────────────────
  pothole: 'Pothole',
  alligator_crack: 'Alligator Crack',
  block_crack: 'Block Crack',
  edge_crack: 'Edge Crack',
  longitudinal_crack: 'Longitudinal Crack',
  transverse_crack: 'Transverse Crack',
  manhole: 'Manhole',
  open_manhole: 'Open Manhole',
  // ── Alternate spellings ───────────────────────────────────────────────────
  'open manhole': 'Open Manhole',
  'alligator crack': 'Alligator Crack',
  'block crack': 'Block Crack',
  'edge crack': 'Edge Crack',
  'longitudinal crack': 'Longitudinal Crack',
  'transverse crack': 'Transverse Crack',
  // ── Legacy ────────────────────────────────────────────────────────────────
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
  return CLASS_MAP[det.class.toLowerCase().replace(/\s+/g, '_')] || 'other';
}

export function getDamageLabel(type: DamageType): string {
  return DAMAGE_LABELS[type] || type;
}

/** Count detections by mapped damage type (always using trained YOLO classes: Crack, Open Manhole, Pothole) */
export function countDetections(detections: Detection[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const det of detections) {
    const rawKey = det.class.toLowerCase().replace(/\s+/g, '_');
    const label = RAW_CLASS_DISPLAY[rawKey] ?? RAW_CLASS_DISPLAY[det.class.toLowerCase()] ?? getDamageLabel(mapClassToDamageType(det));
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

  // Group by trained YOLO classes (Crack, Pothole, Open Manhole)
  const labelMap: Record<string, number> = {};
  for (const det of detections) {
    const rawKey = det.class.toLowerCase().replace(/\s+/g, '_');
    const label = RAW_CLASS_DISPLAY[rawKey] ?? RAW_CLASS_DISPLAY[det.class.toLowerCase()] ?? getDamageLabel(mapClassToDamageType(det));
    labelMap[label] = (labelMap[label] || 0) + 1;
  }

  const entries = Object.entries(labelMap).sort((a, b) => b[1] - a[1]);

  // Build damage list string — e.g. "3 open manholes", "1 pothole and 2 alligator cracks"
  const IRREGULAR_PLURALS: Record<string, string> = {
    'manhole': 'manholes',
    'open manhole': 'open manholes',
    'pothole': 'potholes',
    'alligator crack': 'alligator cracks',
    'block crack': 'block cracks',
    'edge crack': 'edge cracks',
    'longitudinal crack': 'longitudinal cracks',
    'transverse crack': 'transverse cracks',
    'crack': 'cracks',
    'rutting': 'rutting',
  };

  const parts: string[] = [];
  for (const [label, count] of entries) {
    const lower = label.toLowerCase();
    const plural = IRREGULAR_PLURALS[lower] ?? `${lower}s`;
    parts.push(count === 1 ? `1 ${lower}` : `${count} ${plural}`);
  }

  let damageList: string;
  if (parts.length === 1) damageList = parts[0];
  else if (parts.length === 2) damageList = `${parts[0]} and ${parts[1]}`;
  else damageList = `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;

  let desc = `AI detection identified ${damageList} in this area.`;

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
