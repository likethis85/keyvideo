-- ===================================================================
-- Supabase Table Schema for KeyVideo Custom Audio Assets
-- ===================================================================
-- This SQL script creates the table structure for storing custom bgm 
-- details and configures Row Level Security (RLS) policies.
-- Execute this SQL in the Supabase SQL Editor.
-- ===================================================================

-- 1. Create the audio_assets table
CREATE TABLE IF NOT EXISTS public.audio_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    src TEXT NOT NULL,
    "desc" TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.audio_assets ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Allow anyone (including anonymous users if public) to read assets
-- Note: You can change this to "auth.uid() = user_id" if assets must be strictly private.
CREATE POLICY "Allow public read access" 
ON public.audio_assets FOR SELECT 
TO public 
USING (true);

-- Allow authenticated users to insert their own upload records
CREATE POLICY "Allow individual insert" 
ON public.audio_assets FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Allow individual delete" 
ON public.audio_assets FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- 4. Enable indexes for faster query resolution
CREATE INDEX IF NOT EXISTS idx_audio_assets_user_id ON public.audio_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_assets_created_at ON public.audio_assets(created_at DESC);


-- ===================================================================
-- Supabase Table Schema for KeyVideo AI Model Assets
-- ===================================================================

-- 1. Create the model_assets table
CREATE TABLE IF NOT EXISTS public.model_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    src TEXT NOT NULL, -- The public OSS URL of the model image
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.model_assets ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Allow anyone to read models
CREATE POLICY "Allow public read access for model_assets" 
ON public.model_assets FOR SELECT 
TO public 
USING (true);

-- Allow authenticated users to insert their own model uploads
CREATE POLICY "Allow individual insert for model_assets" 
ON public.model_assets FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete their own models
CREATE POLICY "Allow individual delete for model_assets" 
ON public.model_assets FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- 4. Enable indexes for faster query resolution
CREATE INDEX IF NOT EXISTS idx_model_assets_user_id ON public.model_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_model_assets_created_at ON public.model_assets(created_at DESC);


-- ===================================================================
-- Supabase Table Schema for KeyVideo AI Video Projects
-- ===================================================================

-- 1. Create the ai_video_projects table
CREATE TABLE IF NOT EXISTS public.ai_video_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    top_clothing_url TEXT,
    bottom_clothing_url TEXT,
    model_outfit_img_url TEXT,
    reference_outfit_url TEXT,
    model_gender TEXT DEFAULT 'female'::text NOT NULL,
    model_region TEXT DEFAULT 'east-asian'::text NOT NULL,
    model_scene TEXT DEFAULT 'street'::text NOT NULL,
    i2v_master_prompt_15s TEXT,
    i2v_prompts JSONB DEFAULT '{}'::jsonb NOT NULL,
    storyboards JSONB DEFAULT '[]'::jsonb NOT NULL,
    i2v_step TEXT DEFAULT 'idle'::text NOT NULL,
    status TEXT DEFAULT 'idle'::text NOT NULL, -- 'idle', 'generating_outfit', 'generating_storyboard', 'storyboard_generated', 'generating_video', 'video_generated'
    video_duration TEXT DEFAULT '15s'::text NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.ai_video_projects ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Allow authenticated users to view only their own video projects
CREATE POLICY "Allow individual read for video projects" 
ON public.ai_video_projects FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own video projects
CREATE POLICY "Allow individual insert for video projects" 
ON public.ai_video_projects FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own video projects
CREATE POLICY "Allow individual update for video projects" 
ON public.ai_video_projects FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to delete their own video projects
CREATE POLICY "Allow individual delete for video projects" 
ON public.ai_video_projects FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- 4. Enable indexes for faster query resolution
CREATE INDEX IF NOT EXISTS idx_ai_video_projects_user_id ON public.ai_video_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_video_projects_created_at ON public.ai_video_projects(created_at DESC);

-- 5. Auto-update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_ai_video_projects_updated_at
    BEFORE UPDATE ON public.ai_video_projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
