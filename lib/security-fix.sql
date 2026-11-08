-- ============================================================
-- CaragaSense Security Patch: Prevent Role Escalation Bypass
-- Run this in your Supabase SQL Editor: Dashboard > SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Only allow role changes if performed by an existing admin
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Access Denied: You cannot modify user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_profile_role ON profiles;
CREATE TRIGGER tr_protect_profile_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_role();

