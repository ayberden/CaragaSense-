import type { DamageType, SeverityLevel } from '@/lib/database.types';

export interface Detection {
  class: string;
  confidence: number;
  bbox?: number[];
}

const CLASS_MAP: Record<string, DamageType> = {
  pothole: 'pothole', d00: 'longitudinal_crack', d10: 'longitudinal_crack',
  longitudinal_crack: 'longitudinal_crack', 'longitudinal crack': 'longitudinal_crack',
  d20: 'transverse_crack', transverse_crack: 'transverse_crack', 'transverse crack': 'transverse_crack',
  d40: 'pothole', rutting: 'rutting', faded_markings: 'faded_markings',
  'faded markings': 'faded_markings', crack: 'transverse_crack',
};

const DAMAGE_LABELS: Record<DamageType, string> = {
  pothole: 'Pothole', longitudinal_crack: 'Longitudinal Crack',
  transverse_crack: 'Transverse Crack', rutting: 'Rutting',
  faded_markings: 'Faded Markings', other: 'Other Damage',
};

export function mapClassToDamageType(cls: string): DamageType {
  return CLASS_MAP[cls.toLowerCase().replace(/\s+/g, '_')] || 'other';
}

export function getDamageLabel(type: DamageType): string {
  return DAMAGE_LABELS[type] || type;
}

/** Count detections by mapped damage type */
export function countDetections(detections: Detection[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const det of detections) {
    const label = getDamageLabel(mapClassToDamageType(det.class));
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

/** Get the dominant (most common) damage type */
export function getDominantType(detections: Detection[]): DamageType {
  const typeCounts: Record<DamageType, number> = {} as Record<DamageType, number>;
  for (const det of detections) {
    const t = mapClassToDamageType(det.class);
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
  
  const counts = countDetections(detections);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = detections.length;
  const maxConf = getMaxConfidence(detections);
  const severity = inferSeverity(detections);
  
  // Build damage list string
  const parts: string[] = [];
  for (const [label, count] of entries) {
    parts.push(count === 1 ? `1 ${label.toLowerCase()}` : `${count} ${label.toLowerCase()}s`);
  }
  
  let damageList: string;
  if (parts.length === 1) damageList = parts[0];
  else if (parts.length === 2) damageList = `${parts[0]} and ${parts[1]}`;
  else damageList = `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;

  // Build description
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
