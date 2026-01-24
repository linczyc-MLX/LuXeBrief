// Taste Exploration Quad Library
// All images hosted on Cloudinary at:
// https://res.cloudinary.com/drhp5e0kl/image/upload/v1/Taste-Exploration/{quadId}-{position}
// Note: Position is 1-indexed (1-4 for each image in the quad)

import type { TasteQuad } from "./schema";

const CLOUDINARY_BASE = 'https://res.cloudinary.com/drhp5e0kl/image/upload/v1/Taste-Exploration';
// Image URL format: {quadId}-{position} where position is 1-4
const img = (quadId: string, position: number) => `${CLOUDINARY_BASE}/${quadId}-${position}`;


// Generate quads from the QUAD_MATRIX structure matching N4S tasteConfig.js
// Each quad has 4 images with positions 1-4

// AS attribute mapping (1-9 spectrum for design style)
const AS_ATTRIBUTES: Record<string, { warmth: number; formality: number; drama: number; tradition: number }> = {
  AS1: { warmth: 2, formality: 3, drama: 9, tradition: 1 },
  AS2: { warmth: 3, formality: 4, drama: 8, tradition: 2 },
  AS3: { warmth: 5, formality: 5, drama: 5, tradition: 3 },
  AS4: { warmth: 4, formality: 4, drama: 4, tradition: 4 },
  AS5: { warmth: 5, formality: 6, drama: 5, tradition: 5 },
  AS6: { warmth: 6, formality: 7, drama: 5, tradition: 6 },
  AS7: { warmth: 7, formality: 7, drama: 6, tradition: 7 },
  AS8: { warmth: 8, formality: 9, drama: 7, tradition: 8 },
  AS9: { warmth: 9, formality: 9, drama: 8, tradition: 9 }
};

// Build quads array matching N4S QUAD_MATRIX structure (108 quads total: 12 per category × 9 categories)
const buildQuad = (quadId: string, category: string, styles: string[]): TasteQuad => {
  return {
    quadId,
    category,
    images: [
      img(quadId, 1),
      img(quadId, 2),
      img(quadId, 3),
      img(quadId, 4)
    ],
    attributes: {
      warmth: styles.map(s => AS_ATTRIBUTES[s]?.warmth ?? 5),
      formality: styles.map(s => AS_ATTRIBUTES[s]?.formality ?? 5),
      drama: styles.map(s => AS_ATTRIBUTES[s]?.drama ?? 5),
      tradition: styles.map(s => AS_ATTRIBUTES[s]?.tradition ?? 5)
    }
  };
};

export const tasteQuads: TasteQuad[] = [
  // ============================================================
  // EXTERIOR ARCHITECTURE (EA) - 12 quads
  // ============================================================
  buildQuad('EA-001', 'exterior_architecture', ['AS1', 'AS3', 'AS6', 'AS8']),
  buildQuad('EA-002', 'exterior_architecture', ['AS2', 'AS4', 'AS5', 'AS7']),
  buildQuad('EA-003', 'exterior_architecture', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('EA-004', 'exterior_architecture', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('EA-005', 'exterior_architecture', ['AS1', 'AS3', 'AS5', 'AS9']),
  buildQuad('EA-006', 'exterior_architecture', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('EA-007', 'exterior_architecture', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('EA-008', 'exterior_architecture', ['AS2', 'AS5', 'AS6', 'AS8']),
  buildQuad('EA-009', 'exterior_architecture', ['AS1', 'AS4', 'AS5', 'AS7']),
  buildQuad('EA-010', 'exterior_architecture', ['AS2', 'AS3', 'AS6', 'AS9']),
  buildQuad('EA-011', 'exterior_architecture', ['AS1', 'AS4', 'AS7', 'AS8']),
  buildQuad('EA-012', 'exterior_architecture', ['AS2', 'AS5', 'AS6', 'AS9']),

  // ============================================================
  // LIVING SPACES (LS) - 12 quads
  // ============================================================
  buildQuad('LS-001', 'living_spaces', ['AS1', 'AS3', 'AS6', 'AS8']),
  buildQuad('LS-002', 'living_spaces', ['AS2', 'AS4', 'AS5', 'AS7']),
  buildQuad('LS-003', 'living_spaces', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('LS-004', 'living_spaces', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('LS-005', 'living_spaces', ['AS1', 'AS3', 'AS5', 'AS9']),
  buildQuad('LS-006', 'living_spaces', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('LS-007', 'living_spaces', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('LS-008', 'living_spaces', ['AS2', 'AS5', 'AS6', 'AS8']),
  buildQuad('LS-009', 'living_spaces', ['AS1', 'AS4', 'AS5', 'AS7']),
  buildQuad('LS-010', 'living_spaces', ['AS2', 'AS3', 'AS6', 'AS9']),
  buildQuad('LS-011', 'living_spaces', ['AS1', 'AS4', 'AS7', 'AS8']),
  buildQuad('LS-012', 'living_spaces', ['AS2', 'AS5', 'AS6', 'AS9']),

  // ============================================================
  // DINING SPACES (DS) - 12 quads
  // ============================================================
  buildQuad('DS-001', 'dining_spaces', ['AS1', 'AS3', 'AS6', 'AS8']),
  buildQuad('DS-002', 'dining_spaces', ['AS2', 'AS4', 'AS5', 'AS7']),
  buildQuad('DS-003', 'dining_spaces', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('DS-004', 'dining_spaces', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('DS-005', 'dining_spaces', ['AS1', 'AS3', 'AS5', 'AS9']),
  buildQuad('DS-006', 'dining_spaces', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('DS-007', 'dining_spaces', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('DS-008', 'dining_spaces', ['AS2', 'AS5', 'AS6', 'AS8']),
  buildQuad('DS-009', 'dining_spaces', ['AS1', 'AS4', 'AS5', 'AS7']),
  buildQuad('DS-010', 'dining_spaces', ['AS2', 'AS3', 'AS6', 'AS9']),
  buildQuad('DS-011', 'dining_spaces', ['AS1', 'AS4', 'AS7', 'AS8']),
  buildQuad('DS-012', 'dining_spaces', ['AS2', 'AS5', 'AS6', 'AS9']),

  // ============================================================
  // KITCHENS (KT) - 12 quads
  // ============================================================
  buildQuad('KT-001', 'kitchens', ['AS1', 'AS3', 'AS6', 'AS8']),
  buildQuad('KT-002', 'kitchens', ['AS2', 'AS4', 'AS5', 'AS7']),
  buildQuad('KT-003', 'kitchens', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('KT-004', 'kitchens', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('KT-005', 'kitchens', ['AS1', 'AS3', 'AS5', 'AS9']),
  buildQuad('KT-006', 'kitchens', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('KT-007', 'kitchens', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('KT-008', 'kitchens', ['AS2', 'AS5', 'AS6', 'AS8']),
  buildQuad('KT-009', 'kitchens', ['AS1', 'AS4', 'AS5', 'AS7']),
  buildQuad('KT-010', 'kitchens', ['AS2', 'AS3', 'AS6', 'AS9']),
  buildQuad('KT-011', 'kitchens', ['AS1', 'AS4', 'AS7', 'AS8']),
  buildQuad('KT-012', 'kitchens', ['AS2', 'AS5', 'AS6', 'AS9']),

  // ============================================================
  // FAMILY AREAS (FA) - 12 quads
  // ============================================================
  buildQuad('FA-001', 'family_areas', ['AS1', 'AS3', 'AS6', 'AS8']),
  buildQuad('FA-002', 'family_areas', ['AS2', 'AS4', 'AS5', 'AS7']),
  buildQuad('FA-003', 'family_areas', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('FA-004', 'family_areas', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('FA-005', 'family_areas', ['AS1', 'AS3', 'AS5', 'AS9']),
  buildQuad('FA-006', 'family_areas', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('FA-007', 'family_areas', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('FA-008', 'family_areas', ['AS2', 'AS5', 'AS6', 'AS8']),
  buildQuad('FA-009', 'family_areas', ['AS1', 'AS4', 'AS5', 'AS7']),
  buildQuad('FA-010', 'family_areas', ['AS2', 'AS3', 'AS6', 'AS9']),
  buildQuad('FA-011', 'family_areas', ['AS1', 'AS4', 'AS7', 'AS8']),
  buildQuad('FA-012', 'family_areas', ['AS2', 'AS5', 'AS6', 'AS9']),

  // ============================================================
  // PRIMARY BEDROOMS (PB) - 12 quads
  // ============================================================
  buildQuad('PB-001', 'primary_bedrooms', ['AS1', 'AS3', 'AS6', 'AS8']),
  buildQuad('PB-002', 'primary_bedrooms', ['AS2', 'AS4', 'AS5', 'AS7']),
  buildQuad('PB-003', 'primary_bedrooms', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('PB-004', 'primary_bedrooms', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('PB-005', 'primary_bedrooms', ['AS1', 'AS3', 'AS5', 'AS9']),
  buildQuad('PB-006', 'primary_bedrooms', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('PB-007', 'primary_bedrooms', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('PB-008', 'primary_bedrooms', ['AS2', 'AS5', 'AS6', 'AS8']),
  buildQuad('PB-009', 'primary_bedrooms', ['AS1', 'AS4', 'AS5', 'AS7']),
  buildQuad('PB-010', 'primary_bedrooms', ['AS2', 'AS3', 'AS6', 'AS9']),
  buildQuad('PB-011', 'primary_bedrooms', ['AS1', 'AS4', 'AS7', 'AS8']),
  buildQuad('PB-012', 'primary_bedrooms', ['AS2', 'AS5', 'AS6', 'AS9']),

  // ============================================================
  // PRIMARY BATHROOMS (PBT) - 14 quads
  // ============================================================
  buildQuad('PBT-001', 'primary_bathrooms', ['AS1', 'AS3', 'AS6', 'AS8']),
  buildQuad('PBT-002', 'primary_bathrooms', ['AS2', 'AS4', 'AS5', 'AS7']),
  buildQuad('PBT-003', 'primary_bathrooms', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('PBT-004', 'primary_bathrooms', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('PBT-005', 'primary_bathrooms', ['AS1', 'AS3', 'AS5', 'AS9']),
  buildQuad('PBT-006', 'primary_bathrooms', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('PBT-007', 'primary_bathrooms', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('PBT-008', 'primary_bathrooms', ['AS2', 'AS5', 'AS6', 'AS8']),
  buildQuad('PBT-009', 'primary_bathrooms', ['AS1', 'AS4', 'AS5', 'AS7']),
  buildQuad('PBT-010', 'primary_bathrooms', ['AS2', 'AS3', 'AS6', 'AS9']),
  buildQuad('PBT-011', 'primary_bathrooms', ['AS1', 'AS4', 'AS7', 'AS8']),
  buildQuad('PBT-012', 'primary_bathrooms', ['AS2', 'AS5', 'AS6', 'AS9']),
  buildQuad('PBT-013', 'primary_bathrooms', ['AS1', 'AS3', 'AS6', 'AS8']),
  buildQuad('PBT-014', 'primary_bathrooms', ['AS2', 'AS4', 'AS7', 'AS9']),

  // ============================================================
  // GUEST BEDROOMS (GB) - 12 quads
  // ============================================================
  buildQuad('GB-001', 'guest_bedrooms', ['AS1', 'AS3', 'AS6', 'AS8']),
  buildQuad('GB-002', 'guest_bedrooms', ['AS2', 'AS4', 'AS5', 'AS7']),
  buildQuad('GB-003', 'guest_bedrooms', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('GB-004', 'guest_bedrooms', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('GB-005', 'guest_bedrooms', ['AS1', 'AS3', 'AS5', 'AS9']),
  buildQuad('GB-006', 'guest_bedrooms', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('GB-007', 'guest_bedrooms', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('GB-008', 'guest_bedrooms', ['AS2', 'AS5', 'AS6', 'AS8']),
  buildQuad('GB-009', 'guest_bedrooms', ['AS1', 'AS4', 'AS5', 'AS7']),
  buildQuad('GB-010', 'guest_bedrooms', ['AS2', 'AS3', 'AS6', 'AS9']),
  buildQuad('GB-011', 'guest_bedrooms', ['AS1', 'AS4', 'AS7', 'AS8']),
  buildQuad('GB-012', 'guest_bedrooms', ['AS2', 'AS5', 'AS6', 'AS9']),

  // ============================================================
  // OUTDOOR LIVING (OL) - 12 quads
  // ============================================================
  buildQuad('OL-001', 'outdoor_living', ['AS1', 'AS3', 'AS6', 'AS8']),
  buildQuad('OL-002', 'outdoor_living', ['AS2', 'AS4', 'AS5', 'AS7']),
  buildQuad('OL-003', 'outdoor_living', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('OL-004', 'outdoor_living', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('OL-005', 'outdoor_living', ['AS1', 'AS3', 'AS5', 'AS9']),
  buildQuad('OL-006', 'outdoor_living', ['AS2', 'AS4', 'AS6', 'AS8']),
  buildQuad('OL-007', 'outdoor_living', ['AS1', 'AS3', 'AS7', 'AS9']),
  buildQuad('OL-008', 'outdoor_living', ['AS2', 'AS5', 'AS6', 'AS8']),
  buildQuad('OL-009', 'outdoor_living', ['AS1', 'AS4', 'AS5', 'AS7']),
  buildQuad('OL-010', 'outdoor_living', ['AS2', 'AS3', 'AS6', 'AS9']),
  buildQuad('OL-011', 'outdoor_living', ['AS1', 'AS4', 'AS7', 'AS8']),
  buildQuad('OL-012', 'outdoor_living', ['AS2', 'AS5', 'AS6', 'AS9']),
];

export const getTasteQuadCount = () => tasteQuads.length;
export const getTasteQuadsByCategory = (category: string) => tasteQuads.filter(q => q.category === category);
