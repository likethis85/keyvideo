-- 20261030_asset_privacy.sql
-- Makes audio/model asset rows private by default while allowing an explicit
-- shared library. Apply with the Supabase SQL editor or `supabase db push`.
--
-- Rollback: drop the is_public columns and recreate the previous public SELECT
-- policies only if you intentionally want anonymous enumeration again.

BEGIN;

ALTER TABLE public.audio_assets
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.model_assets
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- Remove the old anonymous `USING (true)` SELECT policies.
DROP POLICY IF EXISTS "Allow public read access" ON public.audio_assets;
DROP POLICY IF EXISTS "Allow public read access for model_assets" ON public.model_assets;

-- Owners read their own rows; authenticated users may also read shared rows.
DROP POLICY IF EXISTS "Allow owner or public read for audio_assets" ON public.audio_assets;
CREATE POLICY "Allow owner or public read for audio_assets"
ON public.audio_assets FOR SELECT
TO authenticated
USING (is_public OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow owner or public read for model_assets" ON public.model_assets;
CREATE POLICY "Allow owner or public read for model_assets"
ON public.model_assets FOR SELECT
TO authenticated
USING (is_public OR auth.uid() = user_id);

-- Existing rows become private to their owner. To intentionally share a set of
-- brand assets, mark them explicitly, for example:
--   UPDATE public.model_assets SET is_public = true WHERE user_id = '<curator-uuid>';

COMMIT;
