-- 20261030_01_sso_cloud_storage.sql
-- Adds a KeyVideo-owned SSO identity column. This does not touch media_assets
-- or any table outside the three KeyVideo tables.
--
-- SSO users are verified by the KeyVideo backend. The backend uses the
-- Supabase service role key server-side only and filters every read/write by
-- this column. The browser never receives that key.

BEGIN;

ALTER TABLE public.ai_video_projects
  ADD COLUMN IF NOT EXISTS sso_user_id TEXT;

ALTER TABLE public.model_assets
  ADD COLUMN IF NOT EXISTS sso_user_id TEXT;

ALTER TABLE public.audio_assets
  ADD COLUMN IF NOT EXISTS sso_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_keyvideo_projects_sso_user_id
  ON public.ai_video_projects(sso_user_id);
CREATE INDEX IF NOT EXISTS idx_keyvideo_models_sso_user_id
  ON public.model_assets(sso_user_id);
CREATE INDEX IF NOT EXISTS idx_keyvideo_audio_sso_user_id
  ON public.audio_assets(sso_user_id);

COMMIT;
