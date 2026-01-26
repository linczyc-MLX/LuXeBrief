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
          // Profile report is the KYC report generator - generated client-side in N4S
          console.log('[N4S API] Profile report is generated client-side in N4S, not stored in LuXeBrief');
          return null;

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
