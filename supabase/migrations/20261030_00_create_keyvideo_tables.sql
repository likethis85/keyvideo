-- 20261030_00_create_keyvideo_tables.sql
-- Creates only the tables owned by KeyVideo.
--
-- This migration intentionally does not inspect or alter media_assets or any
-- other existing table. It is safe to run before the asset policy migrations.
-- Existing local browser/Tauri data is not imported by this DDL migration.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_video_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    top_clothing_url TEXT,
    bottom_clothing_url TEXT,
    model_outfit_img_url TEXT,
    reference_outfit_url TEXT,
    model_gender TEXT NOT NULL DEFAULT 'female',
    model_region TEXT NOT NULL DEFAULT 'east-asian',
    model_scene TEXT NOT NULL DEFAULT 'street',
    i2v_master_prompt_15s TEXT,
    i2v_prompts JSONB NOT NULL DEFAULT '{}'::jsonb,
    storyboards JSONB NOT NULL DEFAULT '[]'::jsonb,
    i2v_step TEXT NOT NULL DEFAULT 'idle',
    status TEXT NOT NULL DEFAULT 'idle',
    video_duration TEXT NOT NULL DEFAULT '15s',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.model_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    src TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audio_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    src TEXT NOT NULL,
    "desc" TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow individual read for video projects" ON public.ai_video_projects;
DROP POLICY IF EXISTS "Allow individual insert for video projects" ON public.ai_video_projects;
DROP POLICY IF EXISTS "Allow individual update for video projects" ON public.ai_video_projects;
DROP POLICY IF EXISTS "Allow individual delete for video projects" ON public.ai_video_projects;

CREATE POLICY "Allow individual read for video projects"
ON public.ai_video_projects FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow individual insert for video projects"
ON public.ai_video_projects FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual update for video projects"
ON public.ai_video_projects FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual delete for video projects"
ON public.ai_video_projects FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow owner or public read for model_assets" ON public.model_assets;
DROP POLICY IF EXISTS "Allow individual insert for model_assets" ON public.model_assets;
DROP POLICY IF EXISTS "Allow individual update for model_assets" ON public.model_assets;
DROP POLICY IF EXISTS "Allow individual delete for model_assets" ON public.model_assets;

CREATE POLICY "Allow owner or public read for model_assets"
ON public.model_assets FOR SELECT
TO authenticated
USING (is_public OR auth.uid() = user_id);

CREATE POLICY "Allow individual insert for model_assets"
ON public.model_assets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual update for model_assets"
ON public.model_assets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual delete for model_assets"
ON public.model_assets FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow owner or public read for audio_assets" ON public.audio_assets;
DROP POLICY IF EXISTS "Allow individual insert" ON public.audio_assets;
DROP POLICY IF EXISTS "Allow individual delete" ON public.audio_assets;

CREATE POLICY "Allow owner or public read for audio_assets"
ON public.audio_assets FOR SELECT
TO authenticated
USING (is_public OR auth.uid() = user_id);

CREATE POLICY "Allow individual insert"
ON public.audio_assets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual delete"
ON public.audio_assets FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_keyvideo_projects_user_id
    ON public.ai_video_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_keyvideo_projects_created_at
    ON public.ai_video_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keyvideo_models_user_id
    ON public.model_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_keyvideo_models_created_at
    ON public.model_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_keyvideo_audio_user_id
    ON public.audio_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_keyvideo_audio_created_at
    ON public.audio_assets(created_at DESC);

-- Use a KeyVideo-specific function so an unrelated public function with the
-- same generic name can never be replaced by this migration.
CREATE OR REPLACE FUNCTION public.keyvideo_projects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keyvideo_projects_updated_at ON public.ai_video_projects;
CREATE TRIGGER keyvideo_projects_updated_at
    BEFORE UPDATE ON public.ai_video_projects
    FOR EACH ROW
    EXECUTE FUNCTION public.keyvideo_projects_updated_at();

COMMIT;
