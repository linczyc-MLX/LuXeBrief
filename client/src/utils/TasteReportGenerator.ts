// ============================================
// N4S TASTE PROFILE REPORT GENERATOR
// PDF Generation using jsPDF
// Version: 3.0 - Full Port from N4S
// ============================================

import jsPDF from 'jspdf';
import { tasteQuads } from '@shared/tasteQuads';
import type { TasteQuad, TasteProfile, TasteSelection } from '@shared/schema';

// ============================================
// CONSTANTS
// ============================================

// N4S Brand Colors (RGB values for jsPDF)
const NAVY = { r: 30, g: 58, b: 95 };
const GOLD = { r: 201, g: 162, b: 39 };
const CREAM = { r: 254, g: 249, b: 231 };
const CARD_BG = { r: 248, g: 250, b: 252 };
const LIGHT_GRAY = { r: 100, g: 116, b: 139 };
const DARK_TEXT = { r: 45, g: 55, b: 72 };
const WHITE = { r: 255, g: 255, b: 255 };
const SUCCESS_GREEN = { r: 34, g: 197, b: 94 };

// Category mapping with order
const CATEGORY_ORDER = [
  { id: 'exterior_architecture', code: 'EA', name: 'Exterior Architecture' },
  { id: 'living_spaces', code: 'LS', name: 'Living Spaces' },
  { id: 'dining_spaces', code: 'DS', name: 'Dining Spaces' },
  { id: 'kitchens', code: 'KT', name: 'Kitchens' },
  { id: 'family_areas', code: 'FA', name: 'Family Areas' },
  { id: 'primary_bedrooms', code: 'PB', name: 'Primary Bedrooms' },
  { id: 'primary_bathrooms', code: 'PBT', name: 'Primary Bathrooms' },
  { id: 'guest_bedrooms', code: 'GB', name: 'Guest Bedrooms' },
  { id: 'outdoor_living', code: 'OL', name: 'Outdoor Living' }
];

// Architectural Style labels (AS1-AS9)
const AS_LABELS: Record<number, string> = {
  1: 'Avant-Contemporary',
  2: 'Architectural Modern',
  3: 'Curated Minimalism',
  4: 'Nordic Contemporary',
  5: 'Mid-Century Refined',
  6: 'Modern Classic',
  7: 'Classical Contemporary',
  8: 'Formal Classical',
  9: 'Heritage Estate'
};

// ============================================
// TYPES
// ============================================

interface SessionData {
  clientName: string;
  projectName?: string | null;
  completedAt?: Date | string | null;
}

interface CategoryData {
  id: string;
  code: string;
  name: string;
  selection: { quadId: string; positionIndex: number } | null;
  metrics: { styleEra: number; materialComplexity: number; moodPalette: number };
  asCode: number;
  hasSelection: boolean;
}

interface OverallMetrics {
  styleEra: number;
  materialComplexity: number;
  moodPalette: number;
  styleLabel: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

// Get image URL from quads data
function getSelectionImageUrl(quadId: string, positionIndex: number): string | null {
  const quad = tasteQuads.find(q => q.quadId === quadId);
  if (!quad || !quad.images || !quad.images[positionIndex]) {
    return null;
  }
  return quad.images[positionIndex];
}

// Extract AS/VD/MP codes from image filename
function extractCodesFromFilename(imageUrl: string | null): { as: number; vd: number; mp: number } | null {
  if (!imageUrl) return null;

  const filename = imageUrl.split('/').pop() || '';
  const asMatch = filename.match(/AS(\d)/);
  const vdMatch = filename.match(/VD(\d)/);
  const mpMatch = filename.match(/MP(\d)/);

  if (!asMatch || !vdMatch || !mpMatch) return null;

  return {
    as: parseInt(asMatch[1]),
    vd: parseInt(vdMatch[1]),
    mp: parseInt(mpMatch[1])
  };
}

// Normalize 1-9 scale to 1-5 scale
function normalize9to5(value: number): number {
  return ((value - 1) / 8) * 4 + 1;
}

// Calculate per-category metrics from selected image
function getCategoryMetricsFromSelection(quadId: string, positionIndex: number) {
  const imageUrl = getSelectionImageUrl(quadId, positionIndex);
  const codes = extractCodesFromFilename(imageUrl);

  if (!codes) {
    return { styleEra: 2.5, materialComplexity: 2.5, moodPalette: 2.5 };
  }

  return {
    styleEra: normalize9to5(codes.as),
    materialComplexity: normalize9to5(codes.vd),
    moodPalette: normalize9to5(codes.mp)
  };
}

// Calculate overall style label from average style era
function getStyleLabel(avgStyleEra: number): string {
  if (avgStyleEra < 2.5) return 'Contemporary';
  if (avgStyleEra > 3.5) return 'Traditional';
  return 'Transitional';
}

// Load image as base64 for PDF embedding
async function loadImageAsBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch {
          console.warn('Could not load image:', url);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      console.warn('Image load error:', url);
      resolve(null);
    };
    img.src = url;
  });
}

// Get selection for a category from selections array
function getSelectionForCategory(
  selections: TasteSelection[],
  categoryId: string
): { quadId: string; positionIndex: number } | null {
  const categoryQuads = tasteQuads.filter(q => q.category === categoryId);

  for (const quad of categoryQuads) {
    const sel = selections.find(s => s.quadId === quad.quadId);
    if (sel && sel.favorite1 !== null) {
      return { quadId: quad.quadId, positionIndex: sel.favorite1 };
    }
  }

  return null;
}

// ============================================
// MAIN REPORT GENERATOR CLASS
// ============================================

export class TasteReportGenerator {
  private doc: jsPDF;
  private session: SessionData;
  private profile: TasteProfile;
  private selections: TasteSelection[];
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private contentWidth: number;
  private categoryData: Record<string, CategoryData>;
  private overallMetrics: OverallMetrics;
  private currentPage: number;
  private totalPages: number;

  constructor(session: SessionData, profile: TasteProfile, selections: TasteSelection[]) {
    this.doc = new jsPDF('p', 'pt', 'letter');
    this.session = session;
    this.profile = profile;
    this.selections = selections;

    // Page dimensions
    this.pageWidth = 612;
    this.pageHeight = 792;
    this.margin = 36;
    this.contentWidth = this.pageWidth - (this.margin * 2);

    // Calculate category data and metrics
    const { data, metrics } = this.calculateCategoryData();
    this.categoryData = data;
    this.overallMetrics = metrics;

    // Pagination
    this.currentPage = 1;
    this.totalPages = 4;
  }

  private calculateCategoryData(): { data: Record<string, CategoryData>; metrics: OverallMetrics } {
    const data: Record<string, CategoryData> = {};
    let totalStyleEra = 0;
    let totalMaterialComplexity = 0;
    let totalMoodPalette = 0;
    let count = 0;

    CATEGORY_ORDER.forEach(cat => {
      const selection = getSelectionForCategory(this.selections, cat.id);
      if (selection) {
        const imageUrl = getSelectionImageUrl(selection.quadId, selection.positionIndex);
        const codes = extractCodesFromFilename(imageUrl);
        const metrics = getCategoryMetricsFromSelection(selection.quadId, selection.positionIndex);
        data[cat.id] = {
          ...cat,
          selection,
          metrics,
          asCode: codes?.as || 5,
          hasSelection: true
        };
        totalStyleEra += metrics.styleEra;
        totalMaterialComplexity += metrics.materialComplexity;
        totalMoodPalette += metrics.moodPalette;
        count++;
      } else {
        data[cat.id] = {
          ...cat,
          selection: null,
          metrics: { styleEra: 2.5, materialComplexity: 2.5, moodPalette: 2.5 },
          asCode: 5,
          hasSelection: false
        };
      }
    });

    const metrics: OverallMetrics = count > 0 ? {
      styleEra: totalStyleEra / count,
      materialComplexity: totalMaterialComplexity / count,
      moodPalette: totalMoodPalette / count,
      styleLabel: getStyleLabel(totalStyleEra / count)
    } : {
      styleEra: 2.5,
      materialComplexity: 2.5,
      moodPalette: 2.5,
      styleLabel: 'Transitional'
    };

    return { data, metrics };
  }

  async generate(): Promise<jsPDF> {
    // Page 1: Cover/Overview
    this.addPage1Cover();

    // Page 2: Categories 1-4 (EA, LS, DS, KT)
    this.doc.addPage();
    this.currentPage = 2;
    await this.addSelectionsPage([0, 1, 2, 3]);

    // Page 3: Categories 5-8 (FA, PB, PBT, GB)
    this.doc.addPage();
    this.currentPage = 3;
    await this.addSelectionsPage([4, 5, 6, 7]);

    // Page 4: Category 9 (OL)
    this.doc.addPage();
    this.currentPage = 4;
    await this.addSelectionsPage([8]);

    return this.doc;
  }

  private addPageFooter(): void {
    const footerY = this.pageHeight - 25;

    this.doc.setFontSize(8);
    this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
    this.doc.text(formatDate(new Date()), this.margin, footerY);
    this.doc.text(
      `Page ${this.currentPage} of ${this.totalPages}`,
      this.pageWidth - this.margin,
      footerY,
      { align: 'right' }
    );
  }

  private drawSlider5(x: number, y: number, width: number, value: number, label: string, leftLabel = '', rightLabel = ''): number {
    const trackHeight = 8;
    const normalizedValue = Math.max(1, Math.min(5, value));
    const fillWidth = ((normalizedValue - 1) / 4) * width;

    // Label
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    this.doc.text(label, x, y);

    // Value
    this.doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    this.doc.text(normalizedValue.toFixed(1), x + width + 10, y);

    y += 6;

    // Track background
    this.doc.setFillColor(226, 232, 240);
    this.doc.roundedRect(x, y, width, trackHeight, 4, 4, 'F');

    // Filled portion
    if (fillWidth > 0) {
      this.doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
      this.doc.roundedRect(x, y, fillWidth, trackHeight, 4, 4, 'F');
    }

    // Marker
    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.circle(x + fillWidth, y + trackHeight / 2, 6, 'F');

    // Endpoint labels below slider
    if (leftLabel || rightLabel) {
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
      if (leftLabel) {
        this.doc.text(leftLabel, x, y + trackHeight + 10);
      }
      if (rightLabel) {
        this.doc.text(rightLabel, x + width, y + trackHeight + 10, { align: 'right' });
      }
      return y + trackHeight + 18;
    }

    return y + trackHeight + 8;
  }

  private addPage1Cover(): void {
    let y = 0;

    // Navy header bar
    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.rect(0, 0, this.pageWidth, 50, 'F');

    // Header text
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    this.doc.text('N4S Your Design Profile', this.margin, 32);

    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Taste Exploration', this.pageWidth / 2, 32, { align: 'center' });

    y = 65;

    // Client info line
    const clientName = this.session.clientName;
    const projectName = this.session.projectName;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);

    let infoText = `Client:  ${clientName}`;
    if (projectName) infoText += `     Project: ${projectName}`;
    this.doc.text(infoText, this.margin, y);

    y += 20;

    // Cream banner with style label
    this.doc.setFillColor(CREAM.r, CREAM.g, CREAM.b);
    this.doc.roundedRect(this.margin, y, this.contentWidth, 50, 6, 6, 'F');

    this.doc.setFontSize(9);
    this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
    this.doc.text('Your overall design aesthetic', this.margin + 12, y + 18);

    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.text(this.overallMetrics.styleLabel, this.pageWidth / 2, y + 35, { align: 'center' });

    y += 65;

    // Design DNA: Style Axes section
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.text('Design DNA: Style Axes', this.margin, y);
    y += 25;

    const sliderWidth = 200;
    y = this.drawSlider5(this.margin, y, sliderWidth, this.overallMetrics.styleEra, 'Style Era', 'Contemporary', 'Traditional');
    y += 5;
    y = this.drawSlider5(this.margin, y, sliderWidth, this.overallMetrics.materialComplexity, 'Material Complexity', 'Minimal', 'Layered');
    y += 5;
    y = this.drawSlider5(this.margin, y, sliderWidth, this.overallMetrics.moodPalette, 'Mood Palette', 'Warm', 'Cool');

    y += 20;

    // Design Preferences card
    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.roundedRect(this.margin, y, this.contentWidth, 24, 4, 4, 'F');
    this.doc.rect(this.margin, y + 16, this.contentWidth, 8, 'F');

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    this.doc.text('Design Preferences', this.margin + 10, y + 16);

    y += 28;

    // Card body
    this.doc.setFillColor(CARD_BG.r, CARD_BG.g, CARD_BG.b);
    this.doc.roundedRect(this.margin, y, this.contentWidth, 180, 4, 4, 'F');

    // Top row: Style Direction, Formality, Mood
    const boxY = y + 10;
    const boxWidth = (this.contentWidth - 30) / 3;

    this.doc.setFontSize(9);
    this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
    this.doc.text('Style Direction', this.margin + 15, boxY + 12);
    this.doc.text('Formality', this.margin + boxWidth + 20, boxY + 12);
    this.doc.text('Mood', this.margin + boxWidth * 2 + 25, boxY + 12);

    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.text(this.overallMetrics.styleLabel, this.margin + 15, boxY + 28);

    // Determine formality and mood from profile scores
    const formalityLabel = (this.profile.formalityScore ?? 50) > 60 ? 'Formal' : (this.profile.formalityScore ?? 50) < 40 ? 'Casual' : 'Relaxed';
    const warmthLabel = (this.profile.warmthScore ?? 50) > 60 ? 'Warm' : (this.profile.warmthScore ?? 50) < 40 ? 'Cool' : 'Neutral';
    this.doc.text(formalityLabel, this.margin + boxWidth + 20, boxY + 28);
    this.doc.text(warmthLabel, this.margin + boxWidth * 2 + 25, boxY + 28);

    // 2x3 DNA metric boxes
    const metricStartY = boxY + 50;
    const metricBoxWidth = (this.contentWidth - 40) / 3;
    const metricBoxHeight = 50;

    const dnaMetrics = [
      { label: 'Tradition', value: (this.profile.traditionScore ?? 50) / 10 },
      { label: 'Formality', value: (this.profile.formalityScore ?? 50) / 10 },
      { label: 'Warmth', value: (this.profile.warmthScore ?? 50) / 10 },
      { label: 'Drama', value: (this.profile.dramaScore ?? 50) / 10 },
      { label: 'Openness', value: (this.profile.opennessScore ?? 50) / 10 },
      { label: 'Art Focus', value: (this.profile.artFocusScore ?? 50) / 10 }
    ];

    dnaMetrics.forEach((metric, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const bx = this.margin + 10 + col * (metricBoxWidth + 10);
      const by = metricStartY + row * (metricBoxHeight + 10);

      this.doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
      this.doc.roundedRect(bx, by, metricBoxWidth, metricBoxHeight, 4, 4, 'F');

      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
      this.doc.text(metric.label, bx + 8, by + 14);

      this.doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
      this.doc.text(metric.value.toFixed(1), bx + metricBoxWidth - 25, by + 14);

      // Mini slider - values are 1-10 scale
      const sliderY = by + 28;
      const sliderW = metricBoxWidth - 16;
      const fillW = ((metric.value - 1) / 9) * sliderW;

      this.doc.setFillColor(226, 232, 240);
      this.doc.roundedRect(bx + 8, sliderY, sliderW, 6, 3, 3, 'F');
      this.doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
      this.doc.roundedRect(bx + 8, sliderY, Math.max(0, fillW), 6, 3, 3, 'F');
      this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
      this.doc.circle(bx + 8 + Math.max(0, fillW), sliderY + 3, 4, 'F');
    });

    y = metricStartY + 130;

    // Exploration summary
    y += 20;
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.text('Exploration Summary', this.margin, y);
    y += 20;

    const summaryBoxWidth = (this.contentWidth - 20) / 3;
    const summaryItems = [
      { value: this.profile.completedQuads?.toString() || '0', label: 'Completed' },
      { value: this.profile.skippedQuads?.toString() || '0', label: 'Skipped' },
      { value: this.profile.totalQuads?.toString() || '36', label: 'Total' }
    ];

    summaryItems.forEach((item, i) => {
      const sx = this.margin + i * (summaryBoxWidth + 10);
      this.doc.setFillColor(CARD_BG.r, CARD_BG.g, CARD_BG.b);
      this.doc.roundedRect(sx, y, summaryBoxWidth, 50, 6, 6, 'F');

      this.doc.setFontSize(24);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
      this.doc.text(item.value, sx + summaryBoxWidth / 2, y + 25, { align: 'center' });

      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
      this.doc.text(item.label, sx + summaryBoxWidth / 2, y + 42, { align: 'center' });
    });

    // Top materials if available
    let topMaterials: string[] = [];
    if (this.profile.topMaterials) {
      try {
        topMaterials = JSON.parse(this.profile.topMaterials);
      } catch {
        topMaterials = [];
      }
    }

    if (topMaterials.length > 0) {
      y += 70;
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
      this.doc.text('Preferred Materials', this.margin, y);
      y += 18;

      let chipX = this.margin;
      topMaterials.forEach(material => {
        const chipWidth = this.doc.getTextWidth(material) + 16;
        if (chipX + chipWidth > this.pageWidth - this.margin) {
          chipX = this.margin;
          y += 20;
        }

        this.doc.setFillColor(SUCCESS_GREEN.r, SUCCESS_GREEN.g, SUCCESS_GREEN.b);
        this.doc.roundedRect(chipX, y - 10, chipWidth, 16, 8, 8, 'F');
        this.doc.setFontSize(8);
        this.doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
        this.doc.text(material, chipX + 8, y);

        chipX += chipWidth + 8;
      });
    }

    this.addPageFooter();
  }

  private async addSelectionsPage(categoryIndices: number[]): Promise<void> {
    // Light blue-gray page background
    this.doc.setFillColor(248, 250, 252);
    this.doc.rect(0, 0, this.pageWidth, this.pageHeight, 'F');

    let y = this.margin;

    // Title
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.text('Your Selections', this.margin, y);
    y += 14;

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
    this.doc.text('The images you selected during Taste Exploration', this.margin, y);
    y += 25;

    // Calculate card dimensions for 2x2 grid
    const cardWidth = (this.contentWidth - 20) / 2;
    const imageHeight = cardWidth * 0.625; // 16:10 aspect ratio
    const cardHeight = imageHeight + 130;

    // Handle single card centering (for page 4 with only OL)
    const isSingleCard = categoryIndices.length === 1;

    for (let i = 0; i < categoryIndices.length; i++) {
      const catIndex = categoryIndices[i];
      if (catIndex >= CATEGORY_ORDER.length) continue;

      const cat = CATEGORY_ORDER[catIndex];
      const catData = this.categoryData[cat.id];

      let cardX: number, cardY: number;

      if (isSingleCard) {
        cardX = (this.pageWidth - cardWidth) / 2;
        cardY = y;
      } else {
        const col = i % 2;
        const row = Math.floor(i / 2);
        cardX = this.margin + col * (cardWidth + 20);
        cardY = y + row * (cardHeight + 20);
      }

      // Card background
      this.doc.setFillColor(CARD_BG.r, CARD_BG.g, CARD_BG.b);
      this.doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 6, 6, 'F');

      // Image area placeholder
      this.doc.setFillColor(226, 232, 240);
      this.doc.roundedRect(cardX + 8, cardY + 8, cardWidth - 16, imageHeight, 4, 4, 'F');

      // Try to load image
      if (catData.selection) {
        const imageUrl = getSelectionImageUrl(catData.selection.quadId, catData.selection.positionIndex);
        if (imageUrl) {
          try {
            const imgData = await loadImageAsBase64(imageUrl);
            if (imgData) {
              this.doc.addImage(imgData, 'JPEG', cardX + 8, cardY + 8, cardWidth - 16, imageHeight);
            }
          } catch (e) {
            // Keep placeholder
            console.warn('Failed to load image:', imageUrl);
          }
        }
      } else {
        // No selection - show placeholder text
        this.doc.setFontSize(10);
        this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
        this.doc.text('No selection', cardX + cardWidth / 2, cardY + 8 + imageHeight / 2, { align: 'center' });
      }

      // Navy title bar below image
      const titleBarY = cardY + 8 + imageHeight;
      this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
      this.doc.rect(cardX + 8, titleBarY, cardWidth - 16, 24, 'F');

      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
      this.doc.text(cat.name, cardX + cardWidth / 2, titleBarY + 16, { align: 'center' });

      // Design DNA subtitle
      let sliderY = titleBarY + 42;
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
      this.doc.text('Design DNA', cardX + 12, sliderY);
      sliderY += 12;

      // 3 sliders with per-category values
      const sliderWidth = cardWidth - 60;
      const metrics = catData.metrics;

      this.drawCategorySlider(cardX + 12, sliderY, sliderWidth, metrics.styleEra, 'Style Era', 'Contemporary', 'Traditional');
      sliderY += 24;

      this.drawCategorySlider(cardX + 12, sliderY, sliderWidth, metrics.materialComplexity, 'Material Complexity', 'Minimal', 'Layered');
      sliderY += 24;

      this.drawCategorySlider(cardX + 12, sliderY, sliderWidth, metrics.moodPalette, 'Mood Palette', 'Warm', 'Cool');
    }

    this.addPageFooter();
  }

  private drawCategorySlider(x: number, y: number, width: number, value: number, label: string, leftLabel = '', rightLabel = ''): void {
    const normalizedValue = Math.max(1, Math.min(5, value));
    const fillWidth = ((normalizedValue - 1) / 4) * width;

    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    this.doc.text(label, x, y);

    this.doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    this.doc.text(normalizedValue.toFixed(1), x + width + 8, y);

    const trackY = y + 4;
    this.doc.setFillColor(226, 232, 240);
    this.doc.roundedRect(x, trackY, width, 4, 2, 2, 'F');

    if (fillWidth > 0) {
      this.doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
      this.doc.roundedRect(x, trackY, fillWidth, 4, 2, 2, 'F');
    }

    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.circle(x + fillWidth, trackY + 2, 3, 'F');

    // Endpoint labels below slider
    if (leftLabel || rightLabel) {
      this.doc.setFontSize(6);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
      if (leftLabel) {
        this.doc.text(leftLabel, x, trackY + 12);
      }
      if (rightLabel) {
        this.doc.text(rightLabel, x + width, trackY + 12, { align: 'right' });
      }
    }
  }

  download(filename?: string): void {
    const name = filename || `N4S-Design-Profile-${this.session.clientName.replace(/\s+/g, '-')}.pdf`;
    this.doc.save(name);
  }

  openInNewTab(): void {
    const blob = this.doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  getBlob(): Blob {
    return this.doc.output('blob');
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export async function downloadTasteReport(
  session: SessionData,
  profile: TasteProfile,
  selections: TasteSelection[] = []
): Promise<void> {
  const generator = new TasteReportGenerator(session, profile, selections);
  await generator.generate();
  generator.download();
}

export async function viewTasteReport(
  session: SessionData,
  profile: TasteProfile,
  selections: TasteSelection[] = []
): Promise<void> {
  const generator = new TasteReportGenerator(session, profile, selections);
  await generator.generate();
  generator.openInNewTab();
}

export default TasteReportGenerator;
