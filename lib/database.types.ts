/**
 * TypeScript type definitions for the CaragaSense Supabase database.
 * These types mirror the SQL schema and provide full type safety
 * when using the Supabase client.
 */

export type DamageType =
  | 'pothole'
  | 'open_manhole'
  | 'alligator_crack'
  | 'block_crack'
  | 'longitudinal_crack'
  | 'transverse_crack'
  | 'rutting'
  | 'other';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type ReportStatus =
  | 'reported'
  | 'verified'
  | 'scheduled'
  | 'in_progress'
  | 'fixed'
  | 'dismissed';

export type UserRole = 'citizen' | 'admin' | 'engineer';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: UserRole;
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          role?: UserRole;
          avatar_url?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          damage_type: DamageType;
          severity: SeverityLevel;
          confidence: number | null;
          description: string | null;
          latitude: number;
          longitude: number;
          address: string | null;
          image_url: string | null;
          status: ReportStatus;
          assigned_to: string | null;
          ai_detection_data: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_id?: string | null;
          damage_type: DamageType;
          severity: SeverityLevel;
          confidence?: number | null;
          description?: string | null;
          latitude: number;
          longitude: number;
          address?: string | null;
          image_url?: string | null;
          status?: ReportStatus;
          assigned_to?: string | null;
          ai_detection_data?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          reporter_id?: string | null;
          damage_type?: DamageType;
          severity?: SeverityLevel;
          confidence?: number | null;
          description?: string | null;
          latitude?: number;
          longitude?: number;
          address?: string | null;
          image_url?: string | null;
          status?: ReportStatus;
          assigned_to?: string | null;
          ai_detection_data?: Record<string, unknown> | null;
          updated_at?: string;
        };
      };
      report_status_history: {
        Row: {
          id: string;
          report_id: string;
          old_status: ReportStatus | null;
          new_status: ReportStatus;
          changed_by: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          old_status?: ReportStatus | null;
          new_status: ReportStatus;
          changed_by?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          report_id?: string;
          old_status?: ReportStatus | null;
          new_status?: ReportStatus;
          changed_by?: string | null;
          note?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_report_stats: {
        Args: Record<string, never>;
        Returns: {
          total_reports: number;
          critical_count: number;
          high_count: number;
          medium_count: number;
          low_count: number;
          reported_count: number;
          verified_count: number;
          scheduled_count: number;
          in_progress_count: number;
          fixed_count: number;
        }[];
      };
    };
    Enums: {
      damage_type: DamageType;
      severity_level: SeverityLevel;
      report_status: ReportStatus;
      user_role: UserRole;
    };
  };
}

/** Convenience aliases */
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Report = Database['public']['Tables']['reports']['Row'];
export type ReportInsert = Database['public']['Tables']['reports']['Insert'];
export type ReportUpdate = Database['public']['Tables']['reports']['Update'];
export type StatusHistory = Database['public']['Tables']['report_status_history']['Row'];
