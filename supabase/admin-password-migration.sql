-- Additive administrator account security migration. Run as the database owner.
-- Apply before deploying the corresponding app changes. Safe to rerun.
BEGIN;

-- The service-only functions below bind login, bootstrap and password changes to
-- a locked admin row. A login verified against an old hash cannot survive a
-- concurrent password change; password rotation and session revocation commit
-- together. The API verifies the current password with bcrypt before rotation.
CREATE OR REPLACE FUNCTION public.mtc_create_admin_session(
  p_admin_id uuid, p_session_id uuid, p_expected_hash text, p_expires_at timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_admin_id IS NULL OR p_session_id IS NULL OR p_expected_hash IS NULL
     OR p_expires_at IS NULL OR p_expires_at <= clock_timestamp()
     OR p_expires_at > clock_timestamp() + interval '8 hours 1 minute' THEN
    RETURN false;
  END IF;
  PERFORM id FROM admins WHERE id=p_admin_id AND is_active AND password_hash=p_expected_hash FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO auth_sessions(id,user_id,role,expires_at) VALUES (p_session_id,p_admin_id,'admin',p_expires_at);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.mtc_change_admin_password(
  p_admin_id uuid, p_session_id uuid, p_expected_hash text, p_new_hash text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_admin_id IS NULL OR p_session_id IS NULL OR p_expected_hash IS NULL
     OR p_new_hash IS NULL OR p_new_hash='' OR p_new_hash=p_expected_hash THEN RETURN false; END IF;
  PERFORM id FROM admins WHERE id=p_admin_id AND is_active AND password_hash=p_expected_hash FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM id FROM auth_sessions WHERE id=p_session_id AND user_id=p_admin_id AND role='admin'
    AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE admins SET password_hash=p_new_hash WHERE id=p_admin_id;
  UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE user_id=p_admin_id AND role='admin' AND revoked_at IS NULL;
  RETURN true;
END $$;

-- This trusted bootstrap RPC is callable only by the server's service role.
-- It serializes case-insensitive usernames and revokes prior sessions atomically.
CREATE OR REPLACE FUNCTION public.mtc_bootstrap_admin(
  p_username text, p_password_hash text, p_full_name text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid; v_username text:=trim(p_username); matches integer;
BEGIN
  IF v_username IS NULL OR length(v_username) NOT BETWEEN 1 AND 100
     OR p_password_hash IS NULL OR p_password_hash=''
     OR p_full_name IS NULL OR length(trim(p_full_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Invalid administrator details';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('mtc-admin-bootstrap:'||lower(v_username),0));
  SELECT count(*) INTO matches FROM admins WHERE lower(username)=lower(v_username);
  IF matches>1 THEN RAISE EXCEPTION 'Duplicate administrator usernames require review'; END IF;
  SELECT id INTO v_id FROM admins WHERE lower(username)=lower(v_username) FOR UPDATE;
  IF v_id IS NULL THEN
    INSERT INTO admins(username,password_hash,full_name,is_active) VALUES(v_username,p_password_hash,trim(p_full_name),true) RETURNING id INTO v_id;
  ELSE
    UPDATE admins SET password_hash=p_password_hash,full_name=trim(p_full_name),is_active=true WHERE id=v_id;
  END IF;
  UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE user_id=v_id AND role='admin' AND revoked_at IS NULL;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.mtc_create_admin_session(uuid,uuid,text,timestamptz),
  public.mtc_change_admin_password(uuid,uuid,text,text), public.mtc_bootstrap_admin(text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mtc_create_admin_session(uuid,uuid,text,timestamptz),
  public.mtc_change_admin_password(uuid,uuid,text,text), public.mtc_bootstrap_admin(text,text,text)
  TO service_role;

COMMIT;
