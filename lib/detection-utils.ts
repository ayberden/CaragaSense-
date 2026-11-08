import type { DamageType, SeverityLevel } from '@/lib/database.types';

export interface Detection {
  class: string;
  confidence: number;
  bbox?: number[];
  bbox_ratio?: number;
  /** Optional fields populated by the AI crack-type classifier */
  crack_type?: string;
  crack_label?: string;
  crack_description?: string;
}

/** Hazard weights based on municipal road safety and structural damage risk */
export const CLASS_HAZARD_WEIGHT: Record<string, number> = {
  open_manhole: 1.0,        // Direct life and rollover/pedestrian hazard
  pothole: 0.9,             // High tire/rim blowout and motorcycle accident risk
  alligator_crack: 0.7,     // Severe sub-base fatigue / pavement collapse
  rutting: 0.65,            // Wheel path depression, water pooling / hydroplaning
  block_crack: 0.5,         // Advanced grid fatigue
  edge_crack: 0.45,         // Edge breakup due to lack of shoulder support
  longitudinal_crack: 0.35, // Pavement joint/seam separation
  transverse_crack: 0.35,   // Thermal shrinkage cracking
  manhole_cover: 0.2,       // Normal sealed utility cover
  manhole: 0.2,             // Normal utility cover
  other: 0.4,
};

const CLASS_MAP: Record<string, DamageType> = {
  // ── YOLOv11s model classes (my_model.pt) ──────────────────────────────────
  pothole: 'pothole',
  alligator_crack: 'alligator_crack',
  block_crack: 'block_crack',
  edge_crack: 'edge_crack',
  longitudinal_crack: 'longitudinal_crack',
  transverse_crack: 'transverse_crack',
  manhole: 'manhole',
  manhole_cover: 'manhole',
  open_manhole: 'open_manhole',
  // ── Alternate spellings / spaces ──────────────────────────────────────────
  'open manhole': 'open_manhole',
  'manhole cover': 'manhole',
  'alligator crack': 'alligator_crack',
  'block crack': 'block_crack',
  'edge crack': 'edge_crack',
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
  manhole_cover: 'Manhole Cover',
  open_manhole: 'Open Manhole',
  // ── Alternate spellings ───────────────────────────────────────────────────
  'open manhole': 'Open Manhole',
  'manhole cover': 'Manhole Cover',
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
  manhole: 'Manhole',
  alligator_crack: 'Alligator Crack',
  block_crack: 'Block Crack',
  edge_crack: 'Edge Crack',
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

/**
 * Infer enhanced severity based on:
 * 1. Damage class hazard weighting (e.g. Open Manhole / Pothole vs Hairline Cracks)
 * 2. Defect physical size / bounding box area ratio
 * 3. YOLO detection confidence
 * 4. Defect clustering and multi-damage compounding
 */
export function inferSeverity(
  detections: Detection[],
  frameWidth = 640,
  frameHeight = 640
): SeverityLevel {
  if (detections.length === 0) return 'low';

  const total = detections.length;
  const frameArea = frameWidth * frameHeight;

  // ── Immediate Safety Override Checks ──────────────────────────────────────────
  for (const det of detections) {
    const classKey = det.class.toLowerCase().replace(/\s+/g, '_');
    const conf = det.confidence;
    const areaRatio = det.bbox_ratio ?? (det.bbox ? (det.bbox[2] * det.bbox[3]) / frameArea : 0.03);

    // Open manhole is an immediate severe road safety & falling hazard
    if (classKey === 'open_manhole' && conf >= 0.65) {
      return 'critical';
    }

    // Large or deep pothole (occupies >= 8% of the view or very high confidence)
    if (classKey === 'pothole') {
      if (areaRatio >= 0.08 && conf >= 0.70) return 'critical';
      if (conf >= 0.85 && areaRatio >= 0.04) return 'critical';
      if (conf >= 0.75) {
        // High priority for prominent potholes
        if (total >= 2) return 'critical';
      }
    }
  }

  // ── Weighted Composite Hazard Calculation ─────────────────────────────────────
  let totalHazardScore = 0;

  for (const det of detections) {
    const classKey = det.class.toLowerCase().replace(/\s+/g, '_');
    const hazardWeight = CLASS_HAZARD_WEIGHT[classKey] ?? 0.4;
    const conf = det.confidence;

    // Bounding box area ratio relative to frame
    const areaRatio = det.bbox_ratio ?? (det.bbox ? (det.bbox[2] * det.bbox[3]) / frameArea : 0.03);

    // Size multiplier: larger defects represent deeper cavities or wider breakups
    let sizeMultiplier = 1.0;
    if (areaRatio >= 0.08) {
      sizeMultiplier = 1.5; // Large defect
    } else if (areaRatio >= 0.03) {
      sizeMultiplier = 1.2; // Medium defect
    }

    const itemScore = hazardWeight * conf * sizeMultiplier;
    totalHazardScore += itemScore;
  }

  // Multi-defect compound factor (multiple co-located defects indicate structural base failure)
  const compoundMultiplier = 1 + Math.min(total - 1, 5) * 0.15;
  const finalScore = totalHazardScore * compoundMultiplier;

  // ── Calibrated Severity Thresholds ───────────────────────────────────────────
  if (finalScore >= 2.2) return 'critical';
  if (finalScore >= 1.4) return 'high';
  if (finalScore >= 0.7) return 'medium';
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
    'manhole cover': 'manhole covers',
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
