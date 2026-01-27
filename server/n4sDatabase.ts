/**
 * N4S API Client
 *
 * This module provides access to N4S data via the N4S Dashboard's REST API.
 * The API endpoint is publicly accessible at the IONOS-hosted N4S Dashboard.
 *
 * Why API instead of direct DB connection:
 * - IONOS shared hosting blocks external database connections
 * - API provides authentication and access control
 * - Maintains N4S as single source of truth
 * - Cleaner separation of concerns
 */

// N4S Dashboard API base URL
const N4S_API_URL = process.env.N4S_API_URL || 'https://website.not-4.sale/api';
const N4S_API_KEY = process.env.N4S_API_KEY || 'n4s-portal-2026-secure';

// Activity log entry
interface ActivityEntry {
  action: string;
  details: string;
  timestamp: string;
}

// Sign-off data
interface SignOffData {
  signed: boolean;
  signedAt: string;
  signedBy: string;
}

// Phase data
interface PhaseData {
  p1Complete?: boolean;
  p2Unlocked?: boolean;
  p3Unlocked?: boolean;
}

// Client project from N4S
interface ClientProject {
  projectId: string;
  projectName: string;
  projectCode: string;
  role: 'principal' | 'secondary';
  principalName: string;
  secondaryName: string | null;
  kycCompletion: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch helper with error handling
 */
async function n4sFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${N4S_API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': N4S_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`N4S API error (${response.status}): ${error}`);
  }

  return response.json();
}

export class N4SDatabase {
  private static initialized = false;

  /**
   * Initialize - just logs that we're using API mode
   */
  static async initialize(): Promise<void> {
    console.log('[N4S API] Using N4S REST API at:', N4S_API_URL);
    this.initialized = true;
  }

  /**
   * Get projects for a client by email
   */
  static async getClientProjects(email: string): Promise<ClientProject[]> {
    try {
      const data = await n4sFetch(`/portal.php?action=client-projects&email=${encodeURIComponent(email)}`);
      return data.projects || [];
    } catch (error) {
      console.error('[N4S API] getClientProjects error:', error);
      return [];
    }
  }

  /**
   * Get project status for a specific project
   */
  static async getProjectStatus(projectId: string, email: string): Promise<any | null> {
    try {
      return await n4sFetch(`/portal.php?action=project-status&projectId=${projectId}&email=${encodeURIComponent(email)}`);
    } catch (error) {
      console.error('[N4S API] getProjectStatus error:', error);
      return null;
    }
  }

  /**
   * Get LCD data by portal slug
   * Note: This calls the main projects.php endpoint
   */
  static async getLCDDataBySlug(slug: string): Promise<any | null> {
    try {
      // Get all projects and find matching slug
      const projects = await n4sFetch('/projects.php');

      for (const project of projects) {
        const fullProject = await n4sFetch(`/projects.php?id=${project.id}`);
        if (fullProject.lcdData?.portalSlug === slug && fullProject.lcdData?.portalActive) {
          return {
            ...fullProject.lcdData,
            projectId: project.id,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('[N4S API] getLCDDataBySlug error:', error);
      return null;
    }
  }

  /**
   * Get project data by portal slug
   */
  static async getProjectBySlug(slug: string): Promise<any | null> {
    try {
      const projects = await n4sFetch('/projects.php');

      for (const project of projects) {
        const fullProject = await n4sFetch(`/projects.php?id=${project.id}`);
        if (fullProject.lcdData?.portalSlug === slug) {
          // Get client name from kycData (N4S stores it in principal.portfolioContext)
          const portfolioContext = fullProject.kycData?.principal?.portfolioContext || {};
          const clientName = [
            portfolioContext.principalFirstName,
            portfolioContext.principalLastName
          ].filter(Boolean).join(' ') || 'Client';

          // Calculate KYC completion
          const kycSections = ['portfolioContext', 'familyHousehold', 'projectParameters', 'budgetFramework', 'designIdentity', 'lifestyleLiving'];
          const principalData = fullProject.kycData?.principal || {};
          const completedSections = kycSections.filter(s => principalData[s] && Object.keys(principalData[s]).length > 0).length;
          const kycCompleted = completedSections >= kycSections.length - 1; // 5/6 or more = complete

          return {
            id: project.id,
            projectName: project.project_name || fullProject.clientData?.projectName,
            clientName,
            advisorAuthorityLevel: fullProject.settingsData?.advisorAuthorityLevel || 'limited',
            kycCompleted,
            budgetRange: fullProject.clientData?.budgetRange || null,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('[N4S API] getProjectBySlug error:', error);
      return null;
    }
  }

  /**
   * Get KYC data by portal slug
   */
  static async getKYCDataBySlug(slug: string): Promise<any | null> {
    try {
      const projects = await n4sFetch('/projects.php');

      for (const project of projects) {
        const fullProject = await n4sFetch(`/projects.php?id=${project.id}`);
        if (fullProject.lcdData?.portalSlug === slug) {
          return fullProject.kycData || null;
        }
      }
      return null;
    } catch (error) {
      console.error('[N4S API] getKYCDataBySlug error:', error);
      return null;
    }
  }

  /**
   * Get FYI data by portal slug
   */
  static async getFYIDataBySlug(slug: string): Promise<any | null> {
    try {
      const projects = await n4sFetch('/projects.php');

      for (const project of projects) {
        const fullProject = await n4sFetch(`/projects.php?id=${project.id}`);
        if (fullProject.lcdData?.portalSlug === slug) {
          return fullProject.fyiData || null;
        }
      }
      return null;
    } catch (error) {
      console.error('[N4S API] getFYIDataBySlug error:', error);
      return null;
    }
  }

  /**
   * Get documents for a module
   */
  static async getDocuments(slug: string, module: string): Promise<any[]> {
    // Placeholder - actual implementation would check N4S file storage
    return [];
  }

  /**
   * Get PDF document by proxying to LuXeBrief's export/pdf endpoint
   *
   * Data flow (matching N4S P1.A.6 behavior):
   * 1. N4S stores LuXeBrief session IDs in kycData:
   *    - kycData.principal.lifestyleLiving.luxeBriefSessionId (Lifestyle questionnaire)
   *    - kycData.principal.lifestyleLiving.luxeLivingSessionId (Living questionnaire)
   *    - kycData.secondary.lifestyleLiving.luxeBriefSessionId (Secondary Lifestyle)
   *    - kycData.secondary.lifestyleLiving.luxeLivingSessionId (Secondary Living)
   * 2. LuXeBrief generates PDFs on-demand via /api/sessions/{sessionId}/export/pdf
   * 3. Portal fetches session ID from N4S, then proxies PDF from LuXeBrief
   */
  static async getPDF(slug: string, module: string, type: string): Promise<Buffer | null> {
    // Only KYC module has LuXeBrief reports for now
    if (module !== 'kyc') {
      console.log(`[N4S API] PDF for module ${module} not yet supported`);
      return null;
    }

    try {
      // First get the project by portal slug
      const projects = await n4sFetch('/projects.php');
      let projectData: any = null;

      for (const project of projects) {
        const fullProject = await n4sFetch(`/projects.php?id=${project.id}`);
        if (fullProject.lcdData?.portalSlug === slug) {
          projectData = fullProject;
          break;
        }
      }

      if (!projectData) {
        console.log(`[N4S API] No project found for slug: ${slug}`);
        return null;
      }

      /**
       * Document Types:
       *
       * RECORD Documents (immutable, dated, stored at completion):
       *   - Lifestyle Questionnaire: Completed once, timestamped, stored as record
       *   - Living Questionnaire: Completed once, timestamped, stored as record
       *   - Taste Exploration: Completed once, timestamped, stored as record
       *   → Use /stored-pdf endpoint to retrieve the original record
       *   → If retaken, new session created, old archived
       *
       * LIVE Documents (generated on-demand from current data):
       *   - KYC Profile Report: Rendered each time from current kycData
       *   - Partner Alignment: Rendered each time from current data
       *   → Generated fresh with current date on each request
       */

      const kycData = projectData.kycData || {};
      let sessionId: number | null = null;

      switch (type) {
        // ========== LIVE DOCUMENTS (generated on-demand) ==========
        case 'profile-report':
          // LIVE: KYC Profile Report - generated from current kycData each time
          console.log('[N4S API] LIVE Document: Generating KYC Profile Report PDF on-demand');
          return await this.generateKYCProfileReport(projectData);

        case 'partner-alignment':
          // LIVE: Partner Alignment Report - generated from current data
          console.log('[N4S API] Partner alignment report not yet implemented');
          return null;

        // ========== RECORD DOCUMENTS (retrieve stored, immutable) ==========
        case 'principal-lifestyle':
          // RECORD: Principal's Lifestyle questionnaire - retrieve stored record
          sessionId = kycData.principal?.lifestyleLiving?.luxeBriefSessionId;
          console.log(`[N4S API] RECORD Document: Principal Lifestyle, session ${sessionId}`);
          break;

        case 'principal-living':
          // RECORD: Principal's Living questionnaire - retrieve stored record
          sessionId = kycData.principal?.lifestyleLiving?.luxeLivingSessionId;
          console.log(`[N4S API] RECORD Document: Principal Living, session ${sessionId}`);
          break;

        case 'secondary-lifestyle':
          // RECORD: Secondary's Lifestyle questionnaire - retrieve stored record
          sessionId = kycData.secondary?.lifestyleLiving?.luxeBriefSessionId;
          console.log(`[N4S API] RECORD Document: Secondary Lifestyle, session ${sessionId}`);
          break;

        case 'secondary-living':
          // RECORD: Secondary's Living questionnaire - retrieve stored record
          sessionId = kycData.secondary?.lifestyleLiving?.luxeLivingSessionId;
          console.log(`[N4S API] RECORD Document: Secondary Living, session ${sessionId}`);
          break;

        case 'principal-taste':
          // RECORD: Principal's Taste Exploration - retrieve stored record
          sessionId = kycData.principal?.designIdentity?.tasteSessionId;
          console.log(`[N4S API] RECORD Document: Principal Taste, session ${sessionId}`);
          break;

        case 'secondary-taste':
          // RECORD: Secondary's Taste Exploration - retrieve stored record
          sessionId = kycData.secondary?.designIdentity?.tasteSessionId;
          console.log(`[N4S API] RECORD Document: Secondary Taste, session ${sessionId}`);
          break;

        default:
          console.log(`[N4S API] Unknown report type: ${type}`);
          return null;
      }

      if (!sessionId) {
        console.log(`[N4S API] No session ID found for RECORD document type: ${type}`);
        console.log(`[N4S API] kycData.principal.lifestyleLiving:`, JSON.stringify(kycData.principal?.lifestyleLiving || {}, null, 2));
        console.log(`[N4S API] kycData.secondary.lifestyleLiving:`, JSON.stringify(kycData.secondary?.lifestyleLiving || {}, null, 2));
        return null;
      }

      // RECORD Documents: Fetch from LuXeBrief export endpoint
      const LUXEBRIEF_URL = process.env.LUXEBRIEF_URL || 'https://luxebrief.not-4.sale';
      const pdfUrl = `${LUXEBRIEF_URL}/api/sessions/${sessionId}/export/pdf`;

      console.log(`[N4S API] Fetching RECORD PDF from: ${pdfUrl}`);

      const response = await fetch(pdfUrl);

      if (!response.ok) {
        console.log(`[N4S API] LuXeBrief returned ${response.status}: ${response.statusText}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      console.log(`[N4S API] Successfully retrieved RECORD PDF for ${type}, size: ${pdfBuffer.length} bytes`);
      return pdfBuffer;

    } catch (error) {
      console.error('[N4S API] getPDF error:', error);
      return null;
    }
  }

  /**
   * Log client activity
   */
  static async logActivity(slug: string, entry: ActivityEntry): Promise<void> {
    try {
      // Get project by slug first
      const projects = await n4sFetch('/projects.php');

      for (const project of projects) {
        const fullProject = await n4sFetch(`/projects.php?id=${project.id}`);
        if (fullProject.lcdData?.portalSlug === slug) {
          // Update with new activity
          const activity = fullProject.lcdData.clientActivity || [];
          activity.unshift(entry);
          if (activity.length > 100) activity.splice(100);

          await n4sFetch(`/projects.php?id=${project.id}&action=update`, {
            method: 'POST',
            body: JSON.stringify({
              lcdData: {
                ...fullProject.lcdData,
                clientActivity: activity,
              },
            }),
          });
          return;
        }
      }
    } catch (error) {
      console.error('[N4S API] logActivity error:', error);
    }
  }

  /**
   * Update milestone sign-off
   */
  static async updateMilestone(slug: string, module: string, data: SignOffData): Promise<void> {
    try {
      const projects = await n4sFetch('/projects.php');

      for (const project of projects) {
        const fullProject = await n4sFetch(`/projects.php?id=${project.id}`);
        if (fullProject.lcdData?.portalSlug === slug) {
          const milestones = fullProject.lcdData.milestones || {};
          milestones[module] = {
            ...milestones[module],
            ...data,
          };

          await n4sFetch(`/projects.php?id=${project.id}&action=update`, {
            method: 'POST',
            body: JSON.stringify({
              lcdData: {
                ...fullProject.lcdData,
                milestones,
              },
            }),
          });
          return;
        }
      }
    } catch (error) {
      console.error('[N4S API] updateMilestone error:', error);
    }
  }

  /**
   * Update phase status
   */
  static async updatePhases(slug: string, phases: PhaseData): Promise<void> {
    try {
      const projects = await n4sFetch('/projects.php');

      for (const project of projects) {
        const fullProject = await n4sFetch(`/projects.php?id=${project.id}`);
        if (fullProject.lcdData?.portalSlug === slug) {
          const currentPhases = fullProject.lcdData.phases || {};

          await n4sFetch(`/projects.php?id=${project.id}&action=update`, {
            method: 'POST',
            body: JSON.stringify({
              lcdData: {
                ...fullProject.lcdData,
                phases: { ...currentPhases, ...phases },
              },
            }),
          });
          return;
        }
      }
    } catch (error) {
      console.error('[N4S API] updatePhases error:', error);
    }
  }

  /**
   * Generate comprehensive KYC Profile Report PDF
   *
   * This matches the N4S dashboard's KYCReportGenerator.js output:
   * - 5 pages: Client Profile, Budget Parameters, Lifestyle & Working, Space Requirements, Design Identity
   * - Full extraction of all kycData sections
   * - N4S brand styling (Navy, Gold, KYC Blue)
   */
  private static async generateKYCProfileReport(projectData: any): Promise<Buffer> {
    // Dynamic import of PDFKit
    const PDFDocument = (await import('pdfkit')).default;

    return new Promise((resolve) => {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        bufferPages: true
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);

      // N4S Brand Colors
      const N4S_NAVY = '#1e3a5f';
      const N4S_GOLD = '#c9a227';
      const N4S_KYC_BLUE = '#315098';
      const N4S_TEXT = '#1a1a1a';
      const N4S_MUTED = '#6b6b6b';
      const N4S_ACCENT_LIGHT = '#f5f0e8';
      const N4S_BORDER = '#e5e5e0';

      const generatedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // ========== EXTRACT ALL KYC DATA ==========
      const clientData = projectData.clientData || {};
      const kycData = projectData.kycData || {};
      const principal = kycData.principal || {};
      const secondary = kycData.secondary || null;

      // P1.A.1 - Portfolio Context
      const portfolioContext = principal.portfolioContext || {};
      const principalFirstName = portfolioContext.principalFirstName || '';
      const principalLastName = portfolioContext.principalLastName || '';
      const clientName = [principalFirstName, principalLastName].filter(Boolean).join(' ') || 'Client';
      const secondaryFirstName = portfolioContext.secondaryFirstName || '';
      const secondaryLastName = portfolioContext.secondaryLastName || '';
      const secondaryName = [secondaryFirstName, secondaryLastName].filter(Boolean).join(' ') || null;
      const thisPropertyRole = portfolioContext.thisPropertyRole;
      const investmentHorizon = portfolioContext.investmentHorizon;
      const landAcquisitionCost = portfolioContext.landAcquisitionCost || 0;

      // P1.A.2 - Family & Household
      const familyHousehold = principal.familyHousehold || {};
      const familyMembers = familyHousehold.familyMembers || [];
      const adultsCount = secondary ? 2 : (secondaryName ? 2 : 1);
      const childrenCount = familyMembers.filter((m: any) =>
        m.role === 'teenager' || m.role === 'child' || m.role === 'young-child'
      ).length;
      const staffingLevel = familyHousehold.staffingLevel;

      // P1.A.3 - Project Parameters
      const projectParameters = principal.projectParameters || {};
      const projectName = projectParameters.projectName || clientData.projectName || 'Luxury Residence Project';
      const bedroomCount = projectParameters.bedroomCount;
      const targetGSF = projectParameters.targetGSF;

      // P1.A.4 - Budget Framework
      const budgetFramework = principal.budgetFramework || {};
      const totalProjectBudget = budgetFramework.totalProjectBudget || 0;
      const interiorBudget = budgetFramework.interiorBudget || 0;
      const grandTotal = landAcquisitionCost + totalProjectBudget;
      const interiorQualityTier = budgetFramework.interiorQualityTier;

      // P1.A.5 - Design Identity
      const designIdentity = principal.designIdentity || {};
      const principalTasteResults = designIdentity.principalTasteResults || null;
      const secondaryTasteResults = designIdentity.secondaryTasteResults || null;
      const hasPrincipalTaste = !!(principalTasteResults?.completedAt);
      const hasSecondaryTaste = !!(secondaryTasteResults?.completedAt);

      // P1.A.6 - Lifestyle & Living
      const lifestyleLiving = principal.lifestyleLiving || {};
      const workFromHome = lifestyleLiving.workFromHome;
      const dedicatedOffices = lifestyleLiving.wfhPeopleCount || 0;
      const entertainingStyle = lifestyleLiving.entertainingStyle;
      const entertainingFrequency = lifestyleLiving.entertainingFrequency;
      const hobbies = lifestyleLiving.hobbies || [];
      const wellnessPriorities = lifestyleLiving.wellnessPriorities || [];

      // P1.A.7 - Space Requirements
      const spaceRequirements = principal.spaceRequirements || {};
      const mustHaveSpaces = spaceRequirements.mustHaveSpaces || [];
      const niceToHaveSpaces = spaceRequirements.niceToHaveSpaces || [];

      // P1.A.8 - Cultural Context
      const culturalContext = principal.culturalContext || {};

      // P1.A.9 - Working Preferences
      const workingPreferences = principal.workingPreferences || {};

      // ========== HELPER FUNCTIONS ==========

      const formatCurrency = (value: number) => {
        if (!value && value !== 0) return 'Not specified';
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      };

      const getPropertyRoleLabel = (role: string) => {
        const labels: Record<string, string> = {
          'primary': 'Primary Residence',
          'secondary': 'Secondary/Vacation Home',
          'vacation': 'Vacation Property',
          'investment': 'Investment Property',
          'legacy': 'Legacy/Generational Asset',
        };
        return labels[role] || role || 'Not specified';
      };

      const getInvestmentHorizonLabel = (horizon: string) => {
        const labels: Record<string, string> = {
          'forever': 'Forever Home',
          '10yr': '10+ Years',
          '5yr': '5-10 Years',
          'generational': 'Generational (Multi-decade)',
        };
        return labels[horizon] || horizon || 'Not specified';
      };

      const getStaffingLevelLabel = (level: string) => {
        const labels: Record<string, string> = {
          'none': 'No Staff',
          'part_time': 'Part-Time Staff',
          'full_time': 'Full-Time Staff',
          'live_in': 'Live-In Staff',
        };
        return labels[level] || level || 'Not specified';
      };

      const getQualityTierLabel = (tier: string) => {
        const labels: Record<string, string> = {
          'select': 'I - Select: The Curated Standard',
          'reserve': 'II - Reserve: Exceptional Materials',
          'signature': 'III - Signature: Bespoke Design',
          'legacy': 'IV - Legacy: Enduring Heritage',
        };
        return labels[tier] || tier || 'Not specified';
      };

      const getWorkFromHomeLabel = (value: string) => {
        const labels: Record<string, string> = {
          'never': 'Never',
          'sometimes': 'Sometimes (1-2 days/week)',
          'often': 'Often (3-4 days/week)',
          'always': 'Always (Full Remote)',
        };
        return labels[value] || value || 'Not specified';
      };

      const getEntertainingStyleLabel = (value: string) => {
        const labels: Record<string, string> = {
          'formal': 'Formal (Seated dinners)',
          'casual': 'Casual (Relaxed gatherings)',
          'both': 'Both Formal & Casual',
        };
        return labels[value] || value || 'Not specified';
      };

      const getEntertainingFrequencyLabel = (value: string) => {
        const labels: Record<string, string> = {
          'rarely': 'Rarely (Few times/year)',
          'monthly': 'Monthly',
          'weekly': 'Weekly',
          'daily': 'Daily/Constantly',
        };
        return labels[value] || value || 'Not specified';
      };

      const getSpaceLabel = (spaceCode: string) => {
        const labels: Record<string, string> = {
          'primary-suite': 'Primary Suite',
          'secondary-suites': 'Guest Suites',
          'kids-bedrooms': "Children's Bedrooms",
          'great-room': 'Great Room/Living',
          'formal-living': 'Formal Living Room',
          'family-room': 'Family Room',
          'formal-dining': 'Formal Dining',
          'casual-dining': 'Casual Dining/Breakfast',
          'chef-kitchen': "Chef's Kitchen",
          'catering-kitchen': 'Catering Kitchen',
          'home-office': 'Home Office',
          'library': 'Library',
          'media-room': 'Media Room/Theater',
          'game-room': 'Game Room',
          'wine-cellar': 'Wine Cellar',
          'gym': 'Home Gym',
          'spa-wellness': 'Spa/Wellness Suite',
          'pool-indoor': 'Indoor Pool',
          'sauna': 'Sauna',
          'steam-room': 'Steam Room',
          'staff-quarters': 'Staff Quarters',
          'mudroom': 'Mudroom',
          'laundry': 'Laundry Room',
          'art-gallery': 'Art Gallery',
          'music-room': 'Music Room',
          'safe-room': 'Safe Room/Panic Room',
        };
        return labels[spaceCode] || spaceCode;
      };

      let currentY = 0;
      let pageNumber = 1;

      const addHeader = () => {
        doc.rect(0, 0, pageWidth, 35).fill(N4S_NAVY);
        doc.fontSize(12).fillColor('#ffffff').font('Helvetica-Bold').text('N4S', margin, 12);
        doc.fontSize(8).fillColor('#ffffff').font('Helvetica').text('Luxury Residential Advisory', margin, 24);
        doc.fontSize(9).fillColor('#ffffff').text('KYC Profile Report', pageWidth - margin - 120, 12, { width: 120, align: 'right' });
        doc.fontSize(8).text(generatedDate, pageWidth - margin - 120, 24, { width: 120, align: 'right' });
      };

      const addFooter = (pageNum: number, totalPages: number) => {
        doc.fontSize(7).fillColor(N4S_MUTED);
        doc.text('© 2026 Not4Sale LLC • Confidential', margin, pageHeight - 25);
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 60, pageHeight - 25, { width: 60, align: 'right' });
      };

      const addSectionTitle = (title: string) => {
        doc.fontSize(14).fillColor(N4S_NAVY).font('Helvetica-Bold').text(title, margin, currentY);
        currentY += 5;
        doc.moveTo(margin, currentY).lineTo(margin + 50, currentY).strokeColor(N4S_GOLD).lineWidth(2).stroke();
        currentY += 12;
      };

      const addSubsectionTitle = (title: string) => {
        doc.fontSize(11).fillColor(N4S_KYC_BLUE).font('Helvetica-Bold').text(title, margin, currentY);
        currentY += 10;
      };

      const addLabelValue = (label: string, value: any, indent = 0) => {
        doc.fontSize(9).fillColor(N4S_MUTED).font('Helvetica-Bold').text(label + ':', margin + indent, currentY);
        const displayValue = value !== undefined && value !== null && value !== '' ? String(value) : 'Not specified';
        doc.fontSize(10).fillColor(N4S_TEXT).font('Helvetica').text(displayValue, margin + indent + 100, currentY);
        currentY += 14;
      };

      const addBulletList = (items: string[], indent = 10) => {
        if (!items || items.length === 0) {
          doc.fontSize(9).fillColor(N4S_MUTED).font('Helvetica-Oblique').text('None specified', margin + indent, currentY);
          currentY += 12;
          return;
        }
        items.forEach(item => {
          doc.fontSize(9).fillColor(N4S_TEXT).font('Helvetica').text('• ' + getSpaceLabel(item), margin + indent, currentY);
          currentY += 12;
        });
      };

      // ========== PAGE 1: CLIENT PROFILE ==========

      addHeader();
      currentY = 55;

      // Title
      doc.fontSize(22).fillColor(N4S_NAVY).font('Helvetica-Bold').text('Client Profile', margin, currentY);
      currentY += 35;

      // Client info box
      doc.rect(margin, currentY, contentWidth, 55).fill(N4S_ACCENT_LIGHT);
      currentY += 12;
      doc.fontSize(8).fillColor(N4S_MUTED).font('Helvetica-Bold').text('CLIENT', margin + 10, currentY);
      currentY += 10;
      doc.fontSize(16).fillColor(N4S_NAVY).font('Helvetica-Bold').text(clientName, margin + 10, currentY);
      currentY += 18;
      doc.fontSize(11).fillColor(N4S_TEXT).font('Helvetica').text(projectName, margin + 10, currentY);
      if (secondaryName) {
        currentY += 14;
        doc.fontSize(9).fillColor(N4S_MUTED).text('Partner: ' + secondaryName, margin + 10, currentY);
      }
      currentY += 30;

      // Project Overview
      addSubsectionTitle('Project Overview');
      addLabelValue("Property's Role", getPropertyRoleLabel(thisPropertyRole));
      addLabelValue('Investment Horizon', getInvestmentHorizonLabel(investmentHorizon));
      if (targetGSF) addLabelValue('Target Size', targetGSF.toLocaleString() + ' SF');

      currentY += 8;

      // Household Composition
      addSubsectionTitle('Household Composition');
      addLabelValue('Adults', adultsCount);
      addLabelValue('Children', childrenCount);
      addLabelValue('Staffing Level', getStaffingLevelLabel(staffingLevel));

      // Family Members Details
      if (familyMembers.length > 0) {
        currentY += 5;
        doc.fontSize(9).fillColor(N4S_MUTED).font('Helvetica-Bold').text('Family Members:', margin, currentY);
        currentY += 12;
        familyMembers.forEach((member: any) => {
          const memberName = member.name || 'Unnamed';
          const memberRole = member.role || 'Member';
          const memberAge = member.age ? ` (${member.age})` : '';
          doc.fontSize(9).fillColor(N4S_TEXT).font('Helvetica').text(`• ${memberName} - ${memberRole}${memberAge}`, margin + 10, currentY);
          currentY += 12;
        });
      }

      addFooter(1, 5);

      // ========== PAGE 2: BUDGET PARAMETERS ==========

      doc.addPage();
      addHeader();
      currentY = 55;
      pageNumber = 2;

      addSectionTitle('Budget Parameters');

      addLabelValue('Land Acquisition Cost', formatCurrency(landAcquisitionCost));
      addLabelValue('Total Project Budget', formatCurrency(totalProjectBudget));
      addLabelValue('Interior Budget', formatCurrency(interiorBudget));

      currentY += 8;

      // Grand Total highlight box
      doc.rect(margin, currentY, contentWidth, 35).fill(N4S_KYC_BLUE);
      doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold').text('GRAND TOTAL (Land + Project)', margin + 10, currentY + 10);
      doc.fontSize(16).text(formatCurrency(grandTotal), pageWidth - margin - 10, currentY + 12, { width: contentWidth - 20, align: 'right' });
      currentY += 50;

      // Quality Standards
      addSubsectionTitle('Quality Standards');
      addLabelValue('Interior Quality Tier', getQualityTierLabel(interiorQualityTier));

      addFooter(2, 5);

      // ========== PAGE 3: LIFESTYLE & WORKING ==========

      doc.addPage();
      addHeader();
      currentY = 55;
      pageNumber = 3;

      addSectionTitle('Lifestyle & Working');

      // Work From Home
      addSubsectionTitle('Work From Home');
      addLabelValue('WFH Frequency', getWorkFromHomeLabel(workFromHome));
      addLabelValue('Dedicated Offices', dedicatedOffices > 0 ? dedicatedOffices : 'Not specified');

      currentY += 8;

      // Entertainment
      addSubsectionTitle('Entertainment');
      addLabelValue('Entertaining Style', getEntertainingStyleLabel(entertainingStyle));
      addLabelValue('Frequency', getEntertainingFrequencyLabel(entertainingFrequency));

      currentY += 8;

      // Hobbies & Activities
      if (hobbies.length > 0) {
        addSubsectionTitle('Hobbies & Activities');
        hobbies.forEach((hobby: string) => {
          doc.fontSize(9).fillColor(N4S_TEXT).font('Helvetica').text('• ' + hobby, margin + 10, currentY);
          currentY += 12;
        });
        currentY += 5;
      }

      // Wellness Priorities
      if (wellnessPriorities.length > 0) {
        addSubsectionTitle('Wellness Priorities');
        wellnessPriorities.forEach((priority: string) => {
          doc.fontSize(9).fillColor(N4S_TEXT).font('Helvetica').text('• ' + priority, margin + 10, currentY);
          currentY += 12;
        });
      }

      addFooter(3, 5);

      // ========== PAGE 4: SPACE REQUIREMENTS ==========

      doc.addPage();
      addHeader();
      currentY = 55;
      pageNumber = 4;

      addSectionTitle('Space Requirements');

      addLabelValue('Bedroom Count', bedroomCount !== undefined ? bedroomCount : 'Not specified');

      currentY += 8;

      // Must-Have Spaces
      addSubsectionTitle('Must-Have Spaces');
      addBulletList(mustHaveSpaces);

      currentY += 8;

      // Nice-to-Have Spaces
      addSubsectionTitle('Nice-to-Have Spaces');
      addBulletList(niceToHaveSpaces);

      addFooter(4, 5);

      // ========== PAGE 5: DESIGN IDENTITY ==========

      doc.addPage();
      addHeader();
      currentY = 55;
      pageNumber = 5;

      addSectionTitle('Design Identity');

      if (!hasPrincipalTaste && !hasSecondaryTaste) {
        // No taste data
        doc.rect(margin, currentY, contentWidth, 40).fill(N4S_ACCENT_LIGHT);
        doc.fontSize(10).fillColor(N4S_MUTED).font('Helvetica-Oblique').text('Taste Exploration not yet completed', margin + 10, currentY + 12);
        doc.fontSize(8).text('Complete the Design Identity module to generate Design DNA profile', margin + 10, currentY + 26);
        currentY += 55;
      } else {
        // Principal Design Profile
        if (hasPrincipalTaste && principalTasteResults?.profile?.scores) {
          const scores = principalTasteResults.profile.scores;
          addSubsectionTitle(`Principal Design Profile${principalFirstName ? ` (${principalFirstName})` : ''}`);

          const dimensions = [
            { key: 'tradition', label: 'Tradition', left: 'Contemporary', right: 'Traditional' },
            { key: 'formality', label: 'Formality', left: 'Casual', right: 'Formal' },
            { key: 'warmth', label: 'Warmth', left: 'Cool', right: 'Warm' },
            { key: 'drama', label: 'Drama', left: 'Subtle', right: 'Bold' },
            { key: 'openness', label: 'Openness', left: 'Enclosed', right: 'Open' },
            { key: 'art_focus', label: 'Art Focus', left: 'Understated', right: 'Gallery-like' },
          ];

          dimensions.forEach(dim => {
            const value = scores[dim.key];
            if (value !== undefined) {
              doc.fontSize(9).fillColor(N4S_TEXT).font('Helvetica-Bold').text(dim.label, margin, currentY);
              currentY += 10;

              // Score bar
              const barWidth = contentWidth - 80;
              const barX = margin + 40;
              doc.rect(barX, currentY, barWidth, 8).fill(N4S_BORDER);
              const markerPos = barX + (value / 10) * barWidth;
              doc.circle(markerPos, currentY + 4, 6).fill(N4S_KYC_BLUE);
              doc.fontSize(6).fillColor('#ffffff').text(value.toFixed(1), markerPos - 5, currentY + 2);

              doc.fontSize(7).fillColor(N4S_MUTED).text(dim.left, barX, currentY + 12);
              doc.text(dim.right, barX + barWidth - 40, currentY + 12, { width: 40, align: 'right' });
              currentY += 24;
            }
          });
        }

        // Secondary Design Profile
        if (hasSecondaryTaste && secondaryTasteResults?.profile?.scores) {
          currentY += 10;
          const scores = secondaryTasteResults.profile.scores;
          addSubsectionTitle(`Partner Design Profile${secondaryFirstName ? ` (${secondaryFirstName})` : ''}`);

          const dimensions = [
            { key: 'tradition', label: 'Tradition', left: 'Contemporary', right: 'Traditional' },
            { key: 'formality', label: 'Formality', left: 'Casual', right: 'Formal' },
            { key: 'warmth', label: 'Warmth', left: 'Cool', right: 'Warm' },
            { key: 'drama', label: 'Drama', left: 'Subtle', right: 'Bold' },
            { key: 'openness', label: 'Openness', left: 'Enclosed', right: 'Open' },
            { key: 'art_focus', label: 'Art Focus', left: 'Understated', right: 'Gallery-like' },
          ];

          dimensions.forEach(dim => {
            const value = scores[dim.key];
            if (value !== undefined) {
              doc.fontSize(9).fillColor(N4S_TEXT).font('Helvetica-Bold').text(dim.label, margin, currentY);
              currentY += 10;

              const barWidth = contentWidth - 80;
              const barX = margin + 40;
              doc.rect(barX, currentY, barWidth, 8).fill(N4S_BORDER);
              const markerPos = barX + (value / 10) * barWidth;
              doc.circle(markerPos, currentY + 4, 6).fill(N4S_KYC_BLUE);
              doc.fontSize(6).fillColor('#ffffff').text(value.toFixed(1), markerPos - 5, currentY + 2);

              doc.fontSize(7).fillColor(N4S_MUTED).text(dim.left, barX, currentY + 12);
              doc.text(dim.right, barX + barWidth - 40, currentY + 12, { width: 40, align: 'right' });
              currentY += 24;
            }
          });
        }

        // Partner Alignment Score
        if (hasPrincipalTaste && hasSecondaryTaste) {
          const pScores = principalTasteResults?.profile?.scores || {};
          const sScores = secondaryTasteResults?.profile?.scores || {};
          const dims = ['tradition', 'formality', 'warmth', 'drama', 'openness', 'art_focus'];
          let totalDiff = 0;
          dims.forEach(dim => {
            const p = pScores[dim] || 5;
            const s = sScores[dim] || 5;
            totalDiff += Math.abs(p - s);
          });
          const avgDiff = totalDiff / dims.length;
          const alignmentScore = Math.max(0, Math.round(100 - (avgDiff / 9 * 100)));

          currentY += 15;
          doc.rect(margin, currentY, contentWidth, 35).fill(N4S_ACCENT_LIGHT);
          doc.fontSize(10).fillColor(N4S_NAVY).font('Helvetica-Bold').text('PARTNER ALIGNMENT', margin + 10, currentY + 10);
          doc.fontSize(18).fillColor('#4caf50').text(`${alignmentScore}%`, pageWidth - margin - 10, currentY + 12, { width: contentWidth - 20, align: 'right' });
        }
      }

      addFooter(5, 5);

      doc.end();
    });
  }

  /**
   * Get questionnaire status from LuXeBrief sessions
   */
  static async getQuestionnaireStatus(slug: string): Promise<any> {
    // This queries the local LuXeBrief database, not N4S
    return {
      principal: {
        lifestyle: { status: 'not_started', sessionId: null },
        living: { status: 'not_started', sessionId: null },
        taste: { status: 'not_started', sessionId: null },
      },
      secondary: {
        lifestyle: { status: 'not_started', sessionId: null },
        living: { status: 'not_started', sessionId: null },
        taste: { status: 'not_started', sessionId: null },
      },
    };
  }

  /**
   * Close - no-op for API mode
   */
  static async close(): Promise<void> {
    // No connection to close in API mode
  }
}
