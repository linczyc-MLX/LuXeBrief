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
   * Get PDF document from stored LuXeBrief sessions
   * Reports are already generated and stored - we just need to find and return them
   */
  static async getPDF(slug: string, module: string, type: string): Promise<Buffer | null> {
    // Only KYC module has LuXeBrief reports for now
    if (module !== 'kyc') {
      console.log(`[N4S API] PDF for module ${module} not yet supported`);
      return null;
    }

    try {
      // First get the project ID for this portal slug
      const projects = await n4sFetch('/projects.php');
      let n4sProjectId: string | null = null;

      for (const project of projects) {
        const fullProject = await n4sFetch(`/projects.php?id=${project.id}`);
        if (fullProject.lcdData?.portalSlug === slug) {
          n4sProjectId = project.id;
          break;
        }
      }

      if (!n4sProjectId) {
        console.log(`[N4S API] No project found for slug: ${slug}`);
        return null;
      }

      // Import the storage module to query sessions
      const { storage } = await import('./storage');
      const { CloudStorageService } = await import('./cloudStorage');

      // Determine session type and principal type based on report type
      let sessionType: string;
      let principalType: string;

      switch (type) {
        case 'profile-report':
        case 'principal-lifestyle':
          sessionType = 'lifestyle';
          principalType = 'principal';
          break;
        case 'principal-living':
          sessionType = 'living';
          principalType = 'principal';
          break;
        case 'secondary-lifestyle':
          sessionType = 'lifestyle';
          principalType = 'secondary';
          break;
        case 'secondary-living':
          sessionType = 'living';
          principalType = 'secondary';
          break;
        case 'partner-alignment':
          // This would need special handling - for now return null
          console.log('[N4S API] Partner alignment report not yet implemented');
          return null;
        default:
          console.log(`[N4S API] Unknown report type: ${type}`);
          return null;
      }

      // Find session with matching n4sProjectId and principal type
      const session = await storage.getSessionByN4SProject(n4sProjectId, sessionType, principalType);

      if (!session) {
        console.log(`[N4S API] No ${sessionType} session found for project ${n4sProjectId}, ${principalType}`);
        return null;
      }

      // Read the PDF from storage
      const sessionPath = CloudStorageService.getSessionPath(session.clientName, session.id);
      const pdfPath = `${sessionPath}/reports/report.pdf`;

      const pdfBuffer = await CloudStorageService.readFile(pdfPath);

      if (!pdfBuffer) {
        console.log(`[N4S API] No PDF found at: ${pdfPath}`);
        return null;
      }

      console.log(`[N4S API] Found PDF for ${type}: ${pdfPath}`);
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
