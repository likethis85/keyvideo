-- 20261030_model_assets_update.sql
-- The frontend renames models and updates scene rows after regeneration. Without
-- an UPDATE policy those writes silently fail under RLS. Restrict updates to the
-- authenticated owner, matching the insert/delete policies.
--
-- Apply after 20261030_asset_privacy.sql.

BEGIN;

DROP POLICY IF EXISTS "Allow individual update for model_assets" ON public.model_assets;
CREATE POLICY "Allow individual update for model_assets"
ON public.model_assets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMIT;
