-- ============================================================
-- CaragaSense Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ──────────────────────────────────────────────────
-- 1. ENUMS
-- ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE damage_type AS ENUM (
    'pothole', 'longitudinal_crack', 'transverse_crack',
    'rutting', 'faded_markings', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM (
    'reported', 'verified', 'scheduled',
    'in_progress', 'fixed', 'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('citizen', 'admin', 'engineer');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ──────────────────────────────────────────────────
-- 2. PROFILES TABLE (extends Supabase auth.users)
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  role        user_role NOT NULL DEFAULT 'citizen',
  avatar_url  TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create a profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ──────────────────────────────────────────────────
-- 3. REPORTS TABLE (road damage reports)
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  damage_type       damage_type NOT NULL,
  severity          severity_level NOT NULL,
  confidence        REAL CHECK (confidence >= 0 AND confidence <= 1),
  description       TEXT,
  latitude          DOUBLE PRECISION NOT NULL,
  longitude         DOUBLE PRECISION NOT NULL,
  address           TEXT,
  image_url         TEXT,
  status            report_status NOT NULL DEFAULT 'reported',
  assigned_to       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ai_detection_data JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for geospatial queries (bounding box lookups)
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports (latitude, longitude);

-- Index for status-based filtering (triage queue)
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);

-- Index for severity-based sorting (priority queue)
CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports (severity);

-- ──────────────────────────────────────────────────
-- 4. REPORT STATUS HISTORY (transparency timeline)
-- ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  old_status  report_status,
  new_status  report_status NOT NULL,
  changed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_report ON report_status_history (report_id);

-- ──────────────────────────────────────────────────
-- 5. AUTO-UPDATE TIMESTAMPS
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ──────────────────────────────────────────────────
-- 6. AUTO-LOG STATUS CHANGES
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_report_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO report_status_history (report_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_report_status_change ON reports;
CREATE TRIGGER on_report_status_change
  AFTER UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION log_report_status_change();

-- ──────────────────────────────────────────────────
-- 7. ROW-LEVEL SECURITY (RLS)
-- ──────────────────────────────────────────────────

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed for displaying reporter names)
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can only update their own profile (names, avatar, phone)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Security: Prevent unauthorized role escalation
-- Ensures users cannot update their own role column to admin/engineer
CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Only allow role changes if performed by an existing admin or service_role
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify your own or another user role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_profile_role ON profiles;
CREATE TRIGGER tr_protect_profile_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_role();

-- REPORTS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read all reports
CREATE POLICY "Reports are viewable by authenticated users"
  ON reports FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can create a report
CREATE POLICY "Authenticated users can create reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- Only admins/engineers can update reports (change status, assign)
CREATE POLICY "Admins and engineers can update reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'engineer')
    )
  );

-- Reporters can update their own reports (only while status = 'reported')
CREATE POLICY "Reporters can update own pending reports"
  ON reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = reporter_id AND status = 'reported');

-- STATUS HISTORY
ALTER TABLE report_status_history ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read status history
CREATE POLICY "Status history viewable by authenticated users"
  ON report_status_history FOR SELECT
  TO authenticated
  USING (true);

-- ──────────────────────────────────────────────────
-- 8. ANALYTICS FUNCTION
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_report_stats()
RETURNS TABLE (
  total_reports    BIGINT,
  critical_count   BIGINT,
  high_count       BIGINT,
  medium_count     BIGINT,
  low_count        BIGINT,
  reported_count   BIGINT,
  verified_count   BIGINT,
  scheduled_count  BIGINT,
  in_progress_count BIGINT,
  fixed_count      BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_reports,
    COUNT(*) FILTER (WHERE severity = 'critical')::BIGINT AS critical_count,
    COUNT(*) FILTER (WHERE severity = 'high')::BIGINT AS high_count,
    COUNT(*) FILTER (WHERE severity = 'medium')::BIGINT AS medium_count,
    COUNT(*) FILTER (WHERE severity = 'low')::BIGINT AS low_count,
    COUNT(*) FILTER (WHERE status = 'reported')::BIGINT AS reported_count,
    COUNT(*) FILTER (WHERE status = 'verified')::BIGINT AS verified_count,
    COUNT(*) FILTER (WHERE status = 'scheduled')::BIGINT AS scheduled_count,
    COUNT(*) FILTER (WHERE status = 'in_progress')::BIGINT AS in_progress_count,
    COUNT(*) FILTER (WHERE status = 'fixed')::BIGINT AS fixed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ──────────────────────────────────────────────────
-- 9. STORAGE BUCKET FOR ROAD IMAGES
-- ──────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-images', 'report-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'report-images');

-- Allow public read access to images
CREATE POLICY "Public can view report images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-images');

-- ──────────────────────────────────────────────────
-- 10. SEED DATA (Optional — for testing)
-- ──────────────────────────────────────────────────
-- Uncomment below to add sample data after creating test accounts

/*
INSERT INTO reports (reporter_id, damage_type, severity, confidence, description, latitude, longitude, address, image_url, status) VALUES
  (NULL, 'pothole', 'high', 0.98, 'Deep pothole near intersection, approximately 30cm diameter', 8.9475, 125.5406, 'J.C. Aquino Ave & A. D. Curato St, Butuan City', NULL, 'reported'),
  (NULL, 'longitudinal_crack', 'medium', 0.85, 'Long crack running along the road edge, ~3m length', 8.9550, 125.5500, 'Montilla Blvd, Butuan City', NULL, 'verified'),
  (NULL, 'transverse_crack', 'critical', 0.96, 'Wide transverse crack across full lane width', 8.9380, 125.5320, 'Agusan-Davao Hwy near Ampayon', NULL, 'reported'),
  (NULL, 'rutting', 'medium', 0.78, 'Wheel-path rutting in both lanes', 8.9520, 125.5450, 'T. Calo St, Butuan City', NULL, 'scheduled'),
  (NULL, 'faded_markings', 'low', 0.92, 'Pedestrian crossing markings barely visible', 8.9490, 125.5380, 'Father Saturnino Urios University Area', NULL, 'fixed'),
  (NULL, 'pothole', 'critical', 0.99, 'Very deep pothole in center lane, risk of vehicle damage', 8.9300, 125.5300, 'Langihan Rd, Butuan City', NULL, 'reported');
*/
