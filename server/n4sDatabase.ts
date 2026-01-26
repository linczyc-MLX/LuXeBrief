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

      // Extract the LuXeBrief session ID from kycData based on report type
      const kycData = projectData.kycData || {};
      let sessionId: number | null = null;

      switch (type) {
        case 'profile-report':
          // Generate KYC Profile Report PDF on-demand
          console.log('[N4S API] Generating KYC Profile Report PDF');
          return await this.generateKYCProfileReport(projectData);

        case 'principal-lifestyle':
          // Principal's Lifestyle questionnaire session
          sessionId = kycData.principal?.lifestyleLiving?.luxeBriefSessionId;
          console.log(`[N4S API] Looking for principal lifestyle session ID in kycData.principal.lifestyleLiving.luxeBriefSessionId: ${sessionId}`);
          break;

        case 'principal-living':
          // Principal's Living questionnaire session
          sessionId = kycData.principal?.lifestyleLiving?.luxeLivingSessionId;
          console.log(`[N4S API] Looking for principal living session ID in kycData.principal.lifestyleLiving.luxeLivingSessionId: ${sessionId}`);
          break;

        case 'secondary-lifestyle':
          // Secondary's Lifestyle questionnaire session
          sessionId = kycData.secondary?.lifestyleLiving?.luxeBriefSessionId;
          console.log(`[N4S API] Looking for secondary lifestyle session ID in kycData.secondary.lifestyleLiving.luxeBriefSessionId: ${sessionId}`);
          break;

        case 'secondary-living':
          // Secondary's Living questionnaire session
          sessionId = kycData.secondary?.lifestyleLiving?.luxeLivingSessionId;
          console.log(`[N4S API] Looking for secondary living session ID in kycData.secondary.lifestyleLiving.luxeLivingSessionId: ${sessionId}`);
          break;

        case 'partner-alignment':
          // Partner alignment is calculated/generated client-side
          console.log('[N4S API] Partner alignment report not yet implemented');
          return null;

        default:
          console.log(`[N4S API] Unknown report type: ${type}`);
          return null;
      }

      if (!sessionId) {
        console.log(`[N4S API] No session ID found for ${type} in kycData`);
        console.log(`[N4S API] kycData.principal.lifestyleLiving:`, JSON.stringify(kycData.principal?.lifestyleLiving || {}, null, 2));
        console.log(`[N4S API] kycData.secondary.lifestyleLiving:`, JSON.stringify(kycData.secondary?.lifestyleLiving || {}, null, 2));
        return null;
      }

      // Fetch PDF from LuXeBrief's export endpoint (generates on-demand)
      // This generates the PDF dynamically from the session data
      const LUXEBRIEF_URL = process.env.LUXEBRIEF_URL || 'https://luxebrief.not-4.sale';
      const pdfUrl = `${LUXEBRIEF_URL}/api/sessions/${sessionId}/export/pdf`;

      console.log(`[N4S API] Fetching PDF from LuXeBrief export: ${pdfUrl}`);

      const response = await fetch(pdfUrl);

      if (!response.ok) {
        console.log(`[N4S API] LuXeBrief returned ${response.status}: ${response.statusText}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      console.log(`[N4S API] Successfully retrieved PDF for ${type}, size: ${pdfBuffer.length} bytes`);
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
   * Generate KYC Profile Report PDF
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

      // N4S Brand Colors
      const N4S_NAVY = '#1e3a5f';
      const N4S_GOLD = '#c9a227';
      const N4S_TEXT = '#1a1a1a';
      const N4S_MUTED = '#6b6b6b';

      const generatedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Get project and KYC data
      const clientData = projectData.clientData || {};
      const kycData = projectData.kycData || {};
      const principal = kycData.principal || {};
      const secondary = kycData.secondary || {};

      const projectName = clientData.projectName || 'Luxury Residence Project';
      const portfolioContext = principal.portfolioContext || {};
      const designIdentity = principal.designIdentity || {};
      const lifestyleLiving = principal.lifestyleLiving || {};

      const principalName = `${portfolioContext.principalFirstName || ''} ${portfolioContext.principalLastName || ''}`.trim() || 'Principal';
      const secondaryName = `${portfolioContext.secondaryFirstName || ''} ${portfolioContext.secondaryLastName || ''}`.trim();

      // ========== PAGE 1: Title Page ==========

      // Navy header bar
      doc.rect(0, 0, pageWidth, 60).fill(N4S_NAVY);
      doc.fontSize(14).fillColor('#ffffff').text('N4S', margin, 22);
      doc.fontSize(9).fillColor('#ffffff').text('Luxury Residential Advisory', margin, 38);
      doc.fontSize(10).fillColor('#ffffff').text('KYC Profile Report', pageWidth - margin - 150, 22, { width: 150, align: 'right' });
      doc.fontSize(9).fillColor('#ffffff').text(generatedDate, pageWidth - margin - 150, 38, { width: 150, align: 'right' });

      doc.y = 100;

      // Project and Client info
      doc.fontSize(11).fillColor(N4S_TEXT).font('Helvetica-Bold').text('Project: ', margin, doc.y, { continued: true });
      doc.font('Helvetica').text(projectName);
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text('Client: ', { continued: true });
      doc.font('Helvetica').text(principalName);
      if (secondaryName) {
        doc.moveDown(0.3);
        doc.font('Helvetica-Bold').text('Secondary: ', { continued: true });
        doc.font('Helvetica').text(secondaryName);
      }

      doc.moveDown(3);

      // Main Title
      doc.fontSize(24).fillColor(N4S_NAVY).font('Helvetica-Bold').text('Know Your Client', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).text('Profile Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor(N4S_MUTED).font('Helvetica').text('Comprehensive client profile for luxury residence planning', { align: 'center' });

      doc.moveDown(3);

      // ========== Portfolio Context ==========
      doc.fontSize(14).fillColor(N4S_NAVY).font('Helvetica-Bold').text('Portfolio Context');
      doc.moveDown(0.5);
      doc.moveTo(margin, doc.y).lineTo(margin + 60, doc.y).strokeColor(N4S_GOLD).lineWidth(2).stroke();
      doc.moveDown(0.8);

      const contextItems = [
        { label: 'Property Type', value: portfolioContext.propertyType },
        { label: 'Project Timeline', value: portfolioContext.projectTimeline },
        { label: 'Budget Range', value: portfolioContext.budgetRange },
        { label: 'Location Preference', value: portfolioContext.locationPreference },
      ];

      doc.fontSize(11).fillColor(N4S_TEXT).font('Helvetica');
      for (const item of contextItems) {
        if (item.value) {
          doc.font('Helvetica-Bold').text(`${item.label}: `, { continued: true });
          doc.font('Helvetica').text(item.value);
          doc.moveDown(0.3);
        }
      }

      doc.moveDown(1.5);

      // ========== Design Identity ==========
      if (Object.keys(designIdentity).length > 0) {
        if (doc.y > pageHeight - 200) doc.addPage();

        doc.fontSize(14).fillColor(N4S_NAVY).font('Helvetica-Bold').text('Design Identity');
        doc.moveDown(0.5);
        doc.moveTo(margin, doc.y).lineTo(margin + 60, doc.y).strokeColor(N4S_GOLD).lineWidth(2).stroke();
        doc.moveDown(0.8);

        doc.fontSize(11).fillColor(N4S_TEXT).font('Helvetica');

        if (designIdentity.architecturalStyle) {
          doc.font('Helvetica-Bold').text('Architectural Style: ', { continued: true });
          doc.font('Helvetica').text(designIdentity.architecturalStyle);
          doc.moveDown(0.3);
        }

        if (designIdentity.materialPreferences?.length) {
          doc.font('Helvetica-Bold').text('Material Preferences: ', { continued: true });
          doc.font('Helvetica').text(designIdentity.materialPreferences.join(', '));
          doc.moveDown(0.3);
        }

        if (designIdentity.colorPalette?.length) {
          doc.font('Helvetica-Bold').text('Color Palette: ', { continued: true });
          doc.font('Helvetica').text(designIdentity.colorPalette.join(', '));
          doc.moveDown(0.3);
        }

        doc.moveDown(1.5);
      }

      // ========== Lifestyle & Living ==========
      if (Object.keys(lifestyleLiving).length > 0) {
        if (doc.y > pageHeight - 200) doc.addPage();

        doc.fontSize(14).fillColor(N4S_NAVY).font('Helvetica-Bold').text('Lifestyle & Living');
        doc.moveDown(0.5);
        doc.moveTo(margin, doc.y).lineTo(margin + 60, doc.y).strokeColor(N4S_GOLD).lineWidth(2).stroke();
        doc.moveDown(0.8);

        doc.fontSize(11).fillColor(N4S_TEXT).font('Helvetica');

        if (lifestyleLiving.workFromHome) {
          const wfhLabels: Record<string, string> = {
            'never': 'Never',
            'sometimes': 'Sometimes (1-2 days/week)',
            'often': 'Often (3-4 days/week)',
            'always': 'Always (Full Remote)'
          };
          doc.font('Helvetica-Bold').text('Work From Home: ', { continued: true });
          doc.font('Helvetica').text(wfhLabels[lifestyleLiving.workFromHome] || lifestyleLiving.workFromHome);
          doc.moveDown(0.3);
        }

        if (lifestyleLiving.entertainingFrequency) {
          doc.font('Helvetica-Bold').text('Entertaining Frequency: ', { continued: true });
          doc.font('Helvetica').text(lifestyleLiving.entertainingFrequency);
          doc.moveDown(0.3);
        }

        if (lifestyleLiving.wellnessPriorities?.length) {
          doc.font('Helvetica-Bold').text('Wellness Priorities: ', { continued: true });
          doc.font('Helvetica').text(lifestyleLiving.wellnessPriorities.join(', '));
          doc.moveDown(0.3);
        }

        if (lifestyleLiving.hobbies?.length) {
          doc.font('Helvetica-Bold').text('Hobbies: ', { continued: true });
          doc.font('Helvetica').text(lifestyleLiving.hobbies.join(', '));
          doc.moveDown(0.3);
        }
      }

      // ========== Add Page Numbers ==========
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        // Footer - use separate text calls with lineBreak: false to prevent extra pages
        doc.fontSize(8).fillColor(N4S_MUTED);
        doc.text('© 2026 Not4Sale LLC', margin, pageHeight - 30, { lineBreak: false });
        doc.text(`Page ${i + 1} of ${pageCount}`, pageWidth - margin - 80, pageHeight - 30, {
          width: 80,
          align: 'right',
          lineBreak: false
        });
      }

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
