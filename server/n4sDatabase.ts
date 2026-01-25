/**
 * N4S Database Connection
 *
 * This module provides read/write access to the N4S database
 * for portal data synchronization.
 *
 * The N4S system uses a PHP/MySQL backend hosted on IONOS.
 * We connect to read project data and write sign-offs/activity logs.
 */

import mysql from 'mysql2/promise';

// Database connection pool
let pool: mysql.Pool | null = null;

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

export class N4SDatabase {
  /**
   * Initialize database connection pool
   */
  static async initialize(): Promise<void> {
    const databaseUrl = process.env.N4S_DATABASE_URL;

    if (!databaseUrl) {
      console.warn('[N4S DB] N4S_DATABASE_URL not set - portal features will be limited');
      return;
    }

    try {
      // Parse MySQL URL
      const url = new URL(databaseUrl);

      pool = mysql.createPool({
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading /
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // Test connection
      const connection = await pool.getConnection();
      console.log('[N4S DB] Connected to N4S database');
      connection.release();
    } catch (error) {
      console.error('[N4S DB] Failed to connect:', error);
      pool = null;
    }
  }

  /**
   * Get LCD data by portal slug
   */
  static async getLCDDataBySlug(slug: string): Promise<any | null> {
    if (!pool) return null;

    try {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT p.id as projectId, p.lcd_data
         FROM projects p
         WHERE JSON_UNQUOTE(JSON_EXTRACT(p.lcd_data, '$.portalSlug')) = ?
         AND JSON_EXTRACT(p.lcd_data, '$.portalActive') = true`,
        [slug]
      );

      if (rows.length === 0) return null;

      const lcdData = typeof rows[0].lcd_data === 'string'
        ? JSON.parse(rows[0].lcd_data)
        : rows[0].lcd_data;

      return {
        ...lcdData,
        projectId: rows[0].projectId,
      };
    } catch (error) {
      console.error('[N4S DB] getLCDDataBySlug error:', error);
      return null;
    }
  }

  /**
   * Get project data by portal slug
   */
  static async getProjectBySlug(slug: string): Promise<any | null> {
    if (!pool) return null;

    try {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT p.id, p.project_name, p.client_data, p.settings_data
         FROM projects p
         WHERE JSON_UNQUOTE(JSON_EXTRACT(p.lcd_data, '$.portalSlug')) = ?`,
        [slug]
      );

      if (rows.length === 0) return null;

      const clientData = typeof rows[0].client_data === 'string'
        ? JSON.parse(rows[0].client_data)
        : rows[0].client_data;

      const settingsData = typeof rows[0].settings_data === 'string'
        ? JSON.parse(rows[0].settings_data)
        : rows[0].settings_data;

      return {
        id: rows[0].id,
        projectName: rows[0].project_name || clientData?.projectName,
        clientName: clientData?.clientName || 'Client',
        advisorAuthorityLevel: settingsData?.advisorAuthorityLevel || 'limited',
        kycCompleted: clientData?.kycCompleted || false,
        budgetRange: clientData?.budgetRange || null,
      };
    } catch (error) {
      console.error('[N4S DB] getProjectBySlug error:', error);
      return null;
    }
  }

  /**
   * Get KYC data by portal slug
   */
  static async getKYCDataBySlug(slug: string): Promise<any | null> {
    if (!pool) return null;

    try {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT p.kyc_data
         FROM projects p
         WHERE JSON_UNQUOTE(JSON_EXTRACT(p.lcd_data, '$.portalSlug')) = ?`,
        [slug]
      );

      if (rows.length === 0) return null;

      return typeof rows[0].kyc_data === 'string'
        ? JSON.parse(rows[0].kyc_data)
        : rows[0].kyc_data;
    } catch (error) {
      console.error('[N4S DB] getKYCDataBySlug error:', error);
      return null;
    }
  }

  /**
   * Get FYI data by portal slug
   */
  static async getFYIDataBySlug(slug: string): Promise<any | null> {
    if (!pool) return null;

    try {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT p.fyi_data
         FROM projects p
         WHERE JSON_UNQUOTE(JSON_EXTRACT(p.lcd_data, '$.portalSlug')) = ?`,
        [slug]
      );

      if (rows.length === 0) return null;

      return typeof rows[0].fyi_data === 'string'
        ? JSON.parse(rows[0].fyi_data)
        : rows[0].fyi_data;
    } catch (error) {
      console.error('[N4S DB] getFYIDataBySlug error:', error);
      return null;
    }
  }

  /**
   * Get documents for a module
   */
  static async getDocuments(slug: string, module: string): Promise<any[]> {
    // For now, return placeholder - actual implementation would check
    // which PDFs exist in the N4S file storage or generate on-demand
    return [];
  }

  /**
   * Get PDF document
   */
  static async getPDF(slug: string, module: string, type: string): Promise<Buffer | null> {
    // Placeholder - actual implementation would:
    // 1. Check if PDF exists in N4S file storage
    // 2. Generate on-demand if not
    // 3. Return buffer
    return null;
  }

  /**
   * Log client activity
   */
  static async logActivity(slug: string, entry: ActivityEntry): Promise<void> {
    if (!pool) return;

    try {
      // Get current activity log
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        `SELECT p.id, JSON_EXTRACT(p.lcd_data, '$.clientActivity') as activity
         FROM projects p
         WHERE JSON_UNQUOTE(JSON_EXTRACT(p.lcd_data, '$.portalSlug')) = ?`,
        [slug]
      );

      if (rows.length === 0) return;

      const projectId = rows[0].id;
      let activity = rows[0].activity || [];
      if (typeof activity === 'string') {
        activity = JSON.parse(activity);
      }

      // Add new entry (keep last 100)
      activity.unshift(entry);
      if (activity.length > 100) {
        activity = activity.slice(0, 100);
      }

      // Update database
      await pool.execute(
        `UPDATE projects
         SET lcd_data = JSON_SET(lcd_data, '$.clientActivity', ?)
         WHERE id = ?`,
        [JSON.stringify(activity), projectId]
      );
    } catch (error) {
      console.error('[N4S DB] logActivity error:', error);
    }
  }

  /**
   * Update milestone sign-off
   */
  static async updateMilestone(slug: string, module: string, data: SignOffData): Promise<void> {
    if (!pool) return;

    try {
      await pool.execute(
        `UPDATE projects
         SET lcd_data = JSON_SET(
           lcd_data,
           '$.milestones.${module}.signed', ?,
           '$.milestones.${module}.signedAt', ?,
           '$.milestones.${module}.signedBy', ?
         )
         WHERE JSON_UNQUOTE(JSON_EXTRACT(lcd_data, '$.portalSlug')) = ?`,
        [data.signed, data.signedAt, data.signedBy, slug]
      );
    } catch (error) {
      console.error('[N4S DB] updateMilestone error:', error);
    }
  }

  /**
   * Update phase status
   */
  static async updatePhases(slug: string, phases: PhaseData): Promise<void> {
    if (!pool) return;

    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (phases.p1Complete !== undefined) {
        updates.push("'$.phases.p1Complete', ?");
        values.push(phases.p1Complete);
      }
      if (phases.p2Unlocked !== undefined) {
        updates.push("'$.phases.p2Unlocked', ?");
        values.push(phases.p2Unlocked);
      }
      if (phases.p3Unlocked !== undefined) {
        updates.push("'$.phases.p3Unlocked', ?");
        values.push(phases.p3Unlocked);
      }

      if (updates.length === 0) return;

      values.push(slug);

      await pool.execute(
        `UPDATE projects
         SET lcd_data = JSON_SET(lcd_data, ${updates.join(', ')})
         WHERE JSON_UNQUOTE(JSON_EXTRACT(lcd_data, '$.portalSlug')) = ?`,
        values
      );
    } catch (error) {
      console.error('[N4S DB] updatePhases error:', error);
    }
  }

  /**
   * Get questionnaire status from LuXeBrief sessions
   */
  static async getQuestionnaireStatus(slug: string): Promise<any> {
    // This would query the LuXeBrief sessions table
    // For now, return placeholder structure
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
   * Close database connection pool
   */
  static async close(): Promise<void> {
    if (pool) {
      await pool.end();
      pool = null;
    }
  }
}
