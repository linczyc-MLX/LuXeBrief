// ============================================
// TASTE PROFILE REPORT GENERATOR
// PDF Generation using jsPDF
// Simplified version for LuXeBrief client
// ============================================

import jsPDF from 'jspdf';

// Brand Colors (RGB values for jsPDF)
const NAVY = { r: 30, g: 58, b: 95 };
const GOLD = { r: 201, g: 162, b: 39 };
const CREAM = { r: 254, g: 249, b: 231 };
const CARD_BG = { r: 248, g: 250, b: 252 };
const LIGHT_GRAY = { r: 100, g: 116, b: 139 };
const DARK_TEXT = { r: 45, g: 55, b: 72 };
const WHITE = { r: 255, g: 255, b: 255 };

// Axis descriptions for display
const axisInfo = {
  warmth: {
    label: "Warmth",
    low: "Cool",
    high: "Warm",
  },
  formality: {
    label: "Formality",
    low: "Casual",
    high: "Formal",
  },
  drama: {
    label: "Drama",
    low: "Subtle",
    high: "Dramatic",
  },
  tradition: {
    label: "Tradition",
    low: "Contemporary",
    high: "Traditional",
  },
  openness: {
    label: "Openness",
    low: "Defined",
    high: "Open",
  },
  artFocus: {
    label: "Art Integration",
    low: "Minimal",
    high: "Art-Centric",
  },
};

interface TasteProfile {
  warmthScore: number;
  formalityScore: number;
  dramaScore: number;
  traditionScore: number;
  opennessScore: number;
  artFocusScore: number;
  completedQuads: number;
  skippedQuads: number;
  totalQuads: number;
  topMaterials?: string;
}

interface Session {
  clientName: string;
  projectName?: string | null;
  completedAt?: Date | string | null;
}

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

// Get style label from tradition score
function getStyleLabel(traditionScore: number): string {
  if (traditionScore < 40) return 'Contemporary';
  if (traditionScore > 60) return 'Traditional';
  return 'Transitional';
}

export class TasteReportGenerator {
  private doc: jsPDF;
  private profile: TasteProfile;
  private session: Session;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private contentWidth: number;

  constructor(session: Session, profile: TasteProfile) {
    this.doc = new jsPDF('p', 'pt', 'letter');
    this.session = session;
    this.profile = profile;

    // Page dimensions
    this.pageWidth = 612;
    this.pageHeight = 792;
    this.margin = 36;
    this.contentWidth = this.pageWidth - (this.margin * 2);
  }

  async generate(): Promise<jsPDF> {
    this.addCoverPage();
    return this.doc;
  }

  private addCoverPage(): void {
    let y = 0;

    // Navy header bar
    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.rect(0, 0, this.pageWidth, 60, 'F');

    // Header text
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    this.doc.text('N4S Design Profile', this.pageWidth / 2, 25, { align: 'center' });

    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Taste Exploration Results', this.pageWidth / 2, 45, { align: 'center' });

    y = 80;

    // Client info
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.text(this.session.clientName, this.margin, y);

    if (this.session.projectName) {
      y += 18;
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
      this.doc.text(`Project: ${this.session.projectName}`, this.margin, y);
    }

    y += 30;

    // Style label banner
    const styleLabel = getStyleLabel(this.profile.traditionScore || 50);
    this.doc.setFillColor(CREAM.r, CREAM.g, CREAM.b);
    this.doc.roundedRect(this.margin, y, this.contentWidth, 60, 8, 8, 'F');

    this.doc.setFontSize(10);
    this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
    this.doc.text('Your overall design aesthetic', this.margin + 15, y + 22);

    this.doc.setFontSize(28);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.text(styleLabel, this.pageWidth / 2, y + 45, { align: 'center' });

    y += 80;

    // Exploration Summary
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.text('Exploration Summary', this.margin, y);
    y += 25;

    // Summary boxes
    const boxWidth = (this.contentWidth - 40) / 3;
    const summaryItems = [
      { value: this.profile.completedQuads?.toString() || '0', label: 'Completed' },
      { value: this.profile.skippedQuads?.toString() || '0', label: 'Skipped' },
      { value: this.profile.totalQuads?.toString() || '36', label: 'Total' },
    ];

    summaryItems.forEach((item, i) => {
      const x = this.margin + i * (boxWidth + 20);

      this.doc.setFillColor(CARD_BG.r, CARD_BG.g, CARD_BG.b);
      this.doc.roundedRect(x, y, boxWidth, 50, 6, 6, 'F');

      this.doc.setFontSize(24);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
      this.doc.text(item.value, x + boxWidth / 2, y + 25, { align: 'center' });

      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
      this.doc.text(item.label, x + boxWidth / 2, y + 42, { align: 'center' });
    });

    y += 70;

    // Design DNA section
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.text('Design DNA: Style Axes', this.margin, y);
    y += 25;

    // Draw axis sliders
    const axes = [
      { key: 'warmth', score: this.profile.warmthScore },
      { key: 'formality', score: this.profile.formalityScore },
      { key: 'drama', score: this.profile.dramaScore },
      { key: 'tradition', score: this.profile.traditionScore },
      { key: 'openness', score: this.profile.opennessScore },
      { key: 'artFocus', score: this.profile.artFocusScore },
    ];

    const sliderWidth = this.contentWidth - 80;
    axes.forEach((axis) => {
      const info = axisInfo[axis.key as keyof typeof axisInfo];
      const score = axis.score ?? 50;

      y = this.drawSlider(this.margin, y, sliderWidth, score, info.label, info.low, info.high);
      y += 8;
    });

    y += 20;

    // Top Materials if available
    let topMaterials: string[] = [];
    if (this.profile.topMaterials) {
      try {
        topMaterials = JSON.parse(this.profile.topMaterials);
      } catch {
        topMaterials = [];
      }
    }

    if (topMaterials.length > 0) {
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
      this.doc.text('Preferred Materials', this.margin, y);
      y += 20;

      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);

      let chipX = this.margin;
      topMaterials.forEach((material) => {
        const chipWidth = this.doc.getTextWidth(material) + 20;
        if (chipX + chipWidth > this.pageWidth - this.margin) {
          chipX = this.margin;
          y += 25;
        }

        this.doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
        this.doc.roundedRect(chipX, y - 12, chipWidth, 20, 10, 10, 'F');
        this.doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
        this.doc.text(material, chipX + 10, y + 2);

        chipX += chipWidth + 10;
      });
    }

    // Footer
    this.addFooter();
  }

  private drawSlider(x: number, y: number, width: number, value: number, label: string, leftLabel: string, rightLabel: string): number {
    const trackHeight = 10;
    const percent = Math.max(0, Math.min(100, value));
    const fillWidth = (percent / 100) * width;

    // Label and value
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    this.doc.text(label, x, y);

    this.doc.setTextColor(GOLD.r, GOLD.g, GOLD.b);
    this.doc.text(`${percent}/100`, x + width + 15, y);

    y += 8;

    // Track background
    this.doc.setFillColor(226, 232, 240);
    this.doc.roundedRect(x, y, width, trackHeight, 5, 5, 'F');

    // Filled portion
    if (fillWidth > 0) {
      this.doc.setFillColor(GOLD.r, GOLD.g, GOLD.b);
      this.doc.roundedRect(x, y, fillWidth, trackHeight, 5, 5, 'F');
    }

    // Marker
    this.doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    this.doc.circle(x + fillWidth, y + trackHeight / 2, 7, 'F');

    // Endpoint labels
    y += trackHeight + 12;
    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
    this.doc.text(leftLabel, x, y);
    this.doc.text(rightLabel, x + width, y, { align: 'right' });

    return y + 8;
  }

  private addFooter(): void {
    const footerY = this.pageHeight - 30;

    this.doc.setFontSize(9);
    this.doc.setTextColor(LIGHT_GRAY.r, LIGHT_GRAY.g, LIGHT_GRAY.b);
    this.doc.text(formatDate(new Date()), this.margin, footerY);
    this.doc.text('N4S Luxury Residential Advisory', this.pageWidth - this.margin, footerY, { align: 'right' });
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

// Convenience function
export async function downloadTasteReport(session: Session, profile: TasteProfile): Promise<void> {
  const generator = new TasteReportGenerator(session, profile);
  await generator.generate();
  generator.download();
}

export default TasteReportGenerator;
