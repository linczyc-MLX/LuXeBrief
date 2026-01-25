/**
 * Portal Routes - LuXeBrief Client Portal API
 *
 * These routes handle client portal authentication and data access.
 * They connect to the N4S database to read project data and write sign-offs.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { N4SDatabase } from "./n4sDatabase";
import { createHash } from "crypto";

// Session store for portal authentication (in-memory, consider Redis for production)
const portalSessions: Map<string, {
  projectId: string;
  slug: string;
  role: 'client' | 'advisor';
  expiresAt: Date;
}> = new Map();

// Simple hash function for password comparison
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// Verify portal password
async function verifyPortalPassword(
  slug: string,
  password: string,
  role: 'client' | 'advisor'
): Promise<{ valid: boolean; projectId?: string }> {
  try {
    const lcdData = await N4SDatabase.getLCDDataBySlug(slug);
    if (!lcdData) {
      return { valid: false };
    }

    // Check password based on role
    const passwordField = role === 'client' ? 'clientPasswordPlain' : 'advisorPasswordPlain';
    const storedPassword = lcdData[passwordField];

    if (storedPassword && storedPassword === password) {
      return { valid: true, projectId: lcdData.projectId };
    }

    return { valid: false };
  } catch (error) {
    console.error('[Portal] Password verification error:', error);
    return { valid: false };
  }
}

// Portal authentication middleware
function portalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.replace('Bearer ', '');

  if (!sessionToken) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  const session = portalSessions.get(sessionToken);
  if (!session) {
    return res.status(401).json({ error: 'Invalid session token' });
  }

  if (session.expiresAt < new Date()) {
    portalSessions.delete(sessionToken);
    return res.status(401).json({ error: 'Session expired' });
  }

  // Attach session data to request
  (req as any).portalSession = session;
  next();
}

// Extract subdomain from request
function getSubdomain(req: Request): string | null {
  // First check X-Subdomain header (set by Nginx)
  const subdomainHeader = req.headers['x-subdomain'] as string;
  if (subdomainHeader) {
    return subdomainHeader;
  }

  // Fallback: extract from Host header
  const host = req.hostname || req.headers.host;
  if (!host) return null;

  // Match [slug].luxebrief.not-4.sale
  const match = host.match(/^([^.]+)\.luxebrief\.not-4\.sale$/);
  if (match) {
    return match[1];
  }

  return null;
}

export async function registerPortalRoutes(app: Express): Promise<void> {
  console.log('[Portal] Registering portal routes...');

  // Initialize N4S database connection
  await N4SDatabase.initialize();

  // ===== PORTAL AUTHENTICATION =====

  // Login to portal
  app.post('/api/portal/auth/login', async (req: Request, res: Response) => {
    try {
      const { password, role = 'client' } = req.body;
      const slug = getSubdomain(req);

      if (!slug) {
        return res.status(400).json({ error: 'Invalid portal URL' });
      }

      if (!password) {
        return res.status(400).json({ error: 'Password is required' });
      }

      if (!['client', 'advisor'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const result = await verifyPortalPassword(slug, password, role as 'client' | 'advisor');

      if (!result.valid) {
        // Log failed attempt
        await N4SDatabase.logActivity(slug, {
          action: 'login_failed',
          details: `Failed login attempt as ${role}`,
          timestamp: new Date().toISOString(),
        });
        return res.status(401).json({ error: 'Invalid password' });
      }

      // Create session
      const sessionToken = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      portalSessions.set(sessionToken, {
        projectId: result.projectId!,
        slug,
        role: role as 'client' | 'advisor',
        expiresAt,
      });

      // Log successful login
      await N4SDatabase.logActivity(slug, {
        action: 'login',
        details: `Logged in as ${role}`,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        token: sessionToken,
        role,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error('[Portal] Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Logout
  app.post('/api/portal/auth/logout', portalAuth, async (req: Request, res: Response) => {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (sessionToken) {
      portalSessions.delete(sessionToken);
    }
    res.json({ success: true });
  });

  // ===== PORTAL DATA =====

  // Get portal configuration (no auth required - for login page)
  app.get('/api/portal/config', async (req: Request, res: Response) => {
    try {
      const slug = getSubdomain(req);
      if (!slug) {
        return res.status(400).json({ error: 'Invalid portal URL' });
      }

      const lcdData = await N4SDatabase.getLCDDataBySlug(slug);
      if (!lcdData) {
        return res.status(404).json({ error: 'Portal not found' });
      }

      if (!lcdData.portalActive) {
        return res.status(403).json({ error: 'Portal is not active' });
      }

      // Return only public config (no passwords)
      const projectData = await N4SDatabase.getProjectBySlug(slug);

      res.json({
        slug,
        projectName: projectData?.projectName || 'Your Project',
        clientName: projectData?.clientName || 'Client',
        parker: lcdData.parker || { greetingStyle: 'professional', customWelcome: '' },
        active: true,
      });
    } catch (error) {
      console.error('[Portal] Config error:', error);
      res.status(500).json({ error: 'Failed to load portal configuration' });
    }
  });

  // Get full portal data (auth required)
  app.get('/api/portal/data', portalAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).portalSession;
      const { slug, role } = session;

      const [lcdData, projectData, kycData, fyiData] = await Promise.all([
        N4SDatabase.getLCDDataBySlug(slug),
        N4SDatabase.getProjectBySlug(slug),
        N4SDatabase.getKYCDataBySlug(slug),
        N4SDatabase.getFYIDataBySlug(slug),
      ]);

      if (!lcdData || !projectData) {
        return res.status(404).json({ error: 'Portal not found' });
      }

      // Build response based on visibility settings
      const visibility = lcdData.visibility || {};
      const milestones = lcdData.milestones || {};
      const phases = lcdData.phases || { p1Complete: false, p2Unlocked: false, p3Unlocked: false };

      // Calculate progress
      const moduleOrder = ['kyc', 'fyi', 'mvp', 'kym', 'kys', 'vmx'];
      const completedModules = moduleOrder.filter(m => milestones[m]?.signed).length;
      const progressPercentage = Math.round((completedModules / moduleOrder.length) * 100);

      // Build visible modules data
      const modules: Record<string, any> = {};

      // KYC Module
      if (visibility.kyc?.enabled) {
        modules.kyc = {
          visible: true,
          signed: milestones.kyc?.signed || false,
          signedAt: milestones.kyc?.signedAt || null,
          // kycCompleted indicates actual data completion (not sign-off)
          kycCompleted: projectData.kycCompleted || false,
          deliverables: {
            profileReport: visibility.kyc.profileReport && projectData.kycCompleted,
            // Separate Lifestyle and Living reports for Principal
            principalLifestyle: visibility.kyc.luxebriefPrincipal && projectData.kycCompleted,
            principalLiving: visibility.kyc.luxebriefPrincipal && projectData.kycCompleted,
            // Separate Lifestyle and Living reports for Secondary (if applicable)
            secondaryLifestyle: visibility.kyc.luxebriefSecondary && kycData?.secondary,
            secondaryLiving: visibility.kyc.luxebriefSecondary && kycData?.secondary,
            partnerAlignment: visibility.kyc.partnerAlignment && kycData?.partnerAlignmentScore,
          },
          // PDF URLs for each deliverable
          pdfUrls: {
            profileReport: `/api/portal/pdf/kyc/profile-report`,
            principalLifestyle: `/api/portal/pdf/kyc/principal-lifestyle`,
            principalLiving: `/api/portal/pdf/kyc/principal-living`,
            secondaryLifestyle: `/api/portal/pdf/kyc/secondary-lifestyle`,
            secondaryLiving: `/api/portal/pdf/kyc/secondary-living`,
            partnerAlignment: `/api/portal/pdf/kyc/partner-alignment`,
          },
          partnerAlignmentScore: kycData?.partnerAlignmentScore || null,
        };
      }

      // FYI Module
      if (visibility.fyi?.enabled) {
        modules.fyi = {
          visible: true,
          signed: milestones.fyi?.signed || false,
          signedAt: milestones.fyi?.signedAt || null,
          deliverables: {
            spaceProgram: visibility.fyi.spaceProgram && fyiData?.spaceProgramComplete,
            zoneBreakdown: visibility.fyi.zoneBreakdown,
          },
          pdfUrls: {
            spaceProgram: `/api/portal/pdf/fyi/space-program`,
            zoneBreakdown: `/api/portal/pdf/fyi/zone-breakdown`,
          },
          totalSqFt: fyiData?.totalSquareFootage || null,
        };
      }

      // MVP Module (simplified for now)
      if (visibility.mvp?.enabled) {
        modules.mvp = {
          visible: true,
          signed: milestones.mvp?.signed || false,
          signedAt: milestones.mvp?.signedAt || null,
          deliverables: {
            validationResults: visibility.mvp.validationResults,
            designBrief: visibility.mvp.designBrief,
          },
          pdfUrls: {
            validationResults: `/api/portal/pdf/mvp/validation-results`,
            designBrief: `/api/portal/pdf/mvp/design-brief`,
          },
        };
      }

      // KYM Module
      if (visibility.kym?.enabled) {
        modules.kym = {
          visible: true,
          signed: milestones.kym?.signed || false,
          signedAt: milestones.kym?.signedAt || null,
          deliverables: {
            propertyShortlist: visibility.kym.propertyShortlist,
            marketSnapshot: visibility.kym.marketSnapshot,
          },
          pdfUrls: {
            propertyShortlist: `/api/portal/pdf/kym/property-shortlist`,
            marketSnapshot: `/api/portal/pdf/kym/market-snapshot`,
          },
        };
      }

      // KYS Module
      if (visibility.kys?.enabled) {
        modules.kys = {
          visible: true,
          signed: milestones.kys?.signed || false,
          signedAt: milestones.kys?.signedAt || null,
          deliverables: {
            recommendedSites: visibility.kys.recommendedSites,
            siteComparison: visibility.kys.siteComparison,
          },
          pdfUrls: {
            recommendedSites: `/api/portal/pdf/kys/recommended-sites`,
            siteComparison: `/api/portal/pdf/kys/site-comparison`,
          },
        };
      }

      // VMX Module
      if (visibility.vmx?.enabled) {
        modules.vmx = {
          visible: true,
          signed: milestones.vmx?.signed || false,
          signedAt: milestones.vmx?.signedAt || null,
          deliverables: {
            budgetSummary: visibility.vmx.budgetSummary,
          },
          pdfUrls: {
            budgetSummary: `/api/portal/pdf/vmx/budget-summary`,
          },
          budgetRange: projectData.budgetRange || null,
        };
      }

      // Log activity
      await N4SDatabase.logActivity(slug, {
        action: 'view_dashboard',
        details: `Viewed dashboard as ${role}`,
        timestamp: new Date().toISOString(),
      });

      res.json({
        project: {
          name: projectData.projectName,
          clientName: projectData.clientName,
        },
        parker: lcdData.parker || { greetingStyle: 'professional', customWelcome: '' },
        progress: {
          currentPhase: phases.p2Unlocked ? 2 : 1,
          percentage: progressPercentage,
          completedModules,
          totalModules: moduleOrder.length,
        },
        phases,
        modules,
        role,
      });
    } catch (error) {
      console.error('[Portal] Data error:', error);
      res.status(500).json({ error: 'Failed to load portal data' });
    }
  });

  // ===== DOCUMENTS =====

  // Get available documents for a module
  app.get('/api/portal/documents/:module', portalAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).portalSession;
      const { slug } = session;
      const module = req.params.module as string;

      const documents = await N4SDatabase.getDocuments(slug, module);

      // Log activity
      await N4SDatabase.logActivity(slug, {
        action: 'view_documents',
        details: `Viewed ${module} documents`,
        timestamp: new Date().toISOString(),
      });

      res.json({ documents });
    } catch (error) {
      console.error('[Portal] Documents error:', error);
      res.status(500).json({ error: 'Failed to load documents' });
    }
  });

  // Stream PDF document - supports both header auth and query token
  app.get('/api/portal/pdf/:module/:type', async (req: Request, res: Response) => {
    try {
      // Support both Authorization header and query token (for new tab opening)
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string;
      const sessionToken = authHeader?.replace('Bearer ', '') || queryToken;

      if (!sessionToken) {
        return res.status(401).json({ error: 'No session token provided' });
      }

      const session = portalSessions.get(sessionToken);
      if (!session) {
        return res.status(401).json({ error: 'Invalid session token' });
      }

      if (session.expiresAt < new Date()) {
        portalSessions.delete(sessionToken);
        return res.status(401).json({ error: 'Session expired' });
      }

      const { slug } = session;
      const module = req.params.module as string;
      const type = req.params.type as string;

      // Get PDF content from N4S database or generate on-demand
      const pdfBuffer = await N4SDatabase.getPDF(slug, module, type);

      if (!pdfBuffer) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Log activity
      await N4SDatabase.logActivity(slug, {
        action: 'view_document',
        details: `Viewed ${module}/${type} PDF`,
        timestamp: new Date().toISOString(),
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${module}-${type}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[Portal] PDF error:', error);
      res.status(500).json({ error: 'Failed to load document' });
    }
  });

  // ===== SIGN-OFF =====

  // Sign off on a module milestone
  app.post('/api/portal/sign-off/:module', portalAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).portalSession;
      const { slug, role, projectId } = session;
      const module = req.params.module as string;

      const validModules = ['kyc', 'fyi', 'mvp', 'kym', 'kys', 'vmx'];
      if (!validModules.includes(module)) {
        return res.status(400).json({ error: 'Invalid module' });
      }

      // Check if advisor has authority to sign off
      if (role === 'advisor') {
        const projectData = await N4SDatabase.getProjectBySlug(slug);
        if (projectData?.advisorAuthorityLevel !== 'full') {
          return res.status(403).json({
            error: 'Advisor does not have authority to sign off. Client signature required.'
          });
        }
      }

      // Record sign-off
      const signOffData = {
        signed: true,
        signedAt: new Date().toISOString(),
        signedBy: role,
      };

      await N4SDatabase.updateMilestone(slug, module, signOffData);

      // Log activity
      await N4SDatabase.logActivity(slug, {
        action: 'sign_off',
        details: `Signed off on ${module.toUpperCase()} milestone`,
        timestamp: new Date().toISOString(),
      });

      // Check if P1 is complete (all milestones signed)
      const lcdData = await N4SDatabase.getLCDDataBySlug(slug);
      const milestones = lcdData?.milestones || {};
      const p1Complete = validModules.every(m => milestones[m]?.signed);

      if (p1Complete && !lcdData?.phases?.p1Complete) {
        await N4SDatabase.updatePhases(slug, {
          p1Complete: true,
          p2Unlocked: true,
        });
      }

      res.json({
        success: true,
        module,
        signedAt: signOffData.signedAt,
        p1Complete,
      });
    } catch (error) {
      console.error('[Portal] Sign-off error:', error);
      res.status(500).json({ error: 'Failed to record sign-off' });
    }
  });

  // ===== QUESTIONNAIRE STATUS =====

  // Get LuXeBrief questionnaire status
  app.get('/api/portal/questionnaire/status', portalAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).portalSession;
      const { slug } = session;

      // Get questionnaire status from LuXeBrief sessions
      const status = await N4SDatabase.getQuestionnaireStatus(slug);

      res.json(status);
    } catch (error) {
      console.error('[Portal] Questionnaire status error:', error);
      res.status(500).json({ error: 'Failed to load questionnaire status' });
    }
  });

  console.log('[Portal] Portal routes registered successfully');
}
