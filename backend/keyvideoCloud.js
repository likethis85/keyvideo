import express from 'express';
import { supabaseAdminRequest } from './supabaseAdmin.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSET_TYPES = {
  model: { table: 'model_assets', fields: 'id,name,src,created_at,is_public' },
  audio: { table: 'audio_assets', fields: 'id,name,src,desc,created_at,is_public' }
};

const safeUserId = (req) => String(req.authUser?.id || '').slice(0, 200);

const readJsonBody = (body) => body && typeof body === 'object' && !Array.isArray(body) ? body : {};

const projectPayload = (body, userId) => ({
  id: String(body.id || ''),
  name: String(body.name || '未命名项目').slice(0, 200),
  user_id: null,
  sso_user_id: userId,
  top_clothing_url: body.top_clothing_url || null,
  bottom_clothing_url: body.bottom_clothing_url || null,
  model_outfit_img_url: body.model_outfit_img_url || null,
  reference_outfit_url: body.reference_outfit_url || null,
  model_gender: body.model_gender === 'male' ? 'male' : 'female',
  model_region: body.model_region === 'western' ? 'western' : 'east-asian',
  model_scene: String(body.model_scene || 'street').slice(0, 100),
  i2v_master_prompt_15s: body.i2v_master_prompt_15s || null,
  i2v_prompts: body.i2v_prompts && typeof body.i2v_prompts === 'object' ? body.i2v_prompts : {},
  storyboards: Array.isArray(body.storyboards) ? body.storyboards : [],
  i2v_step: ['idle', 'storyboard_generated', 'video_generated'].includes(body.i2v_step) ? body.i2v_step : 'idle',
  status: String(body.status || 'idle').slice(0, 60),
  video_duration: body.video_duration === '3s' ? '3s' : '15s'
});

const projectOwner = async (id, env) => {
  const rows = await supabaseAdminRequest(`ai_video_projects?id=eq.${encodeURIComponent(id)}&select=id,sso_user_id,user_id`, { env });
  return Array.isArray(rows) ? rows[0] : null;
};

export function createKeyvideoCloudRouter({ env = process.env, logger = console } = {}) {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!safeUserId(req)) return res.status(401).json({ error: 'unauthorized' });
    return next();
  });

  router.get('/projects', async (req, res) => {
    try {
      const rows = await supabaseAdminRequest(
        `ai_video_projects?sso_user_id=eq.${encodeURIComponent(safeUserId(req))}&select=*&order=created_at.asc`,
        { env }
      );
      return res.json({ projects: Array.isArray(rows) ? rows : [] });
    } catch (error) {
      logger.error('[KeyVideo cloud] project read failed:', error.message);
      return res.status(error.code === 'SUPABASE_SERVER_NOT_CONFIGURED' ? 503 : 502)
        .json({ error: 'cloud_storage_unavailable' });
    }
  });

  router.put('/projects/:id', async (req, res) => {
    const id = String(req.params.id || '');
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'invalid_project_id' });
    try {
      const existing = await projectOwner(id, env);
      if (existing && existing.sso_user_id !== safeUserId(req)) {
        return res.status(403).json({ error: 'project_owned_by_another_user' });
      }
      const payload = projectPayload({ ...readJsonBody(req.body), id }, safeUserId(req));
      const rows = await supabaseAdminRequest('ai_video_projects', {
        env,
        method: 'POST',
        body: payload,
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' }
      });
      return res.json({ project: Array.isArray(rows) ? rows[0] : rows });
    } catch (error) {
      logger.error('[KeyVideo cloud] project write failed:', error.message);
      return res.status(error.code === 'SUPABASE_SERVER_NOT_CONFIGURED' ? 503 : 502)
        .json({ error: 'cloud_storage_unavailable' });
    }
  });

  router.delete('/projects/:id', async (req, res) => {
    const id = String(req.params.id || '');
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'invalid_project_id' });
    try {
      await supabaseAdminRequest(
        `ai_video_projects?id=eq.${encodeURIComponent(id)}&sso_user_id=eq.${encodeURIComponent(safeUserId(req))}`,
        { env, method: 'DELETE' }
      );
      return res.json({ ok: true });
    } catch (error) {
      logger.error('[KeyVideo cloud] project delete failed:', error.message);
      return res.status(error.code === 'SUPABASE_SERVER_NOT_CONFIGURED' ? 503 : 502)
        .json({ error: 'cloud_storage_unavailable' });
    }
  });

  router.get('/assets/:type', async (req, res) => {
    const config = ASSET_TYPES[req.params.type];
    if (!config) return res.status(400).json({ error: 'invalid_asset_type' });
    try {
      const own = await supabaseAdminRequest(
        `${config.table}?sso_user_id=eq.${encodeURIComponent(safeUserId(req))}&select=${config.fields}&order=created_at.desc`,
        { env }
      );
      const shared = await supabaseAdminRequest(
        `${config.table}?is_public=eq.true&select=${config.fields}&order=created_at.desc`,
        { env }
      );
      const seen = new Set();
      const assets = [...(Array.isArray(own) ? own : []), ...(Array.isArray(shared) ? shared : [])]
        .filter(item => item && !seen.has(item.id) && seen.add(item.id));
      return res.json({ assets });
    } catch (error) {
      logger.error('[KeyVideo cloud] asset read failed:', error.message);
      return res.status(error.code === 'SUPABASE_SERVER_NOT_CONFIGURED' ? 503 : 502)
        .json({ error: 'cloud_storage_unavailable' });
    }
  });

  router.post('/assets/:type', async (req, res) => {
    const config = ASSET_TYPES[req.params.type];
    if (!config) return res.status(400).json({ error: 'invalid_asset_type' });
    const body = readJsonBody(req.body);
    const name = String(body.name || '').trim().slice(0, 200);
    const src = String(body.src || '').trim();
    if (!name || !src || src.length > 8_000) return res.status(400).json({ error: 'invalid_asset' });
    try {
      // The browser can retry after a network timeout. Reusing the same source
      // for this owner makes the migration and normal uploads idempotent.
      const existing = await supabaseAdminRequest(
        `${config.table}?sso_user_id=eq.${encodeURIComponent(safeUserId(req))}&src=eq.${encodeURIComponent(src)}&select=${config.fields}&limit=1`,
        { env }
      );
      if (Array.isArray(existing) && existing[0]) return res.json({ asset: existing[0] });

      const payload = {
        name: req.params.type === 'model' && body.is_scene ? `[BG] ${name}` : name,
        src,
        desc: req.params.type === 'audio' ? String(body.desc || '').slice(0, 500) || null : undefined,
        user_id: null,
        sso_user_id: safeUserId(req),
        is_public: body.is_public === true
      };
      if (payload.desc === undefined) delete payload.desc;
      const rows = await supabaseAdminRequest(config.table, {
        env,
        method: 'POST',
        body: payload,
        headers: { Prefer: 'return=representation' }
      });
      return res.json({ asset: Array.isArray(rows) ? rows[0] : rows });
    } catch (error) {
      logger.error('[KeyVideo cloud] asset write failed:', error.message);
      return res.status(error.code === 'SUPABASE_SERVER_NOT_CONFIGURED' ? 503 : 502)
        .json({ error: 'cloud_storage_unavailable' });
    }
  });

  router.patch('/assets/:type/:id', async (req, res) => {
    const config = ASSET_TYPES[req.params.type];
    if (!config || !UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'invalid_asset' });
    const body = readJsonBody(req.body);
    const payload = {};
    if (typeof body.name === 'string' && body.name.trim()) payload.name = body.name.trim().slice(0, 200);
    if (typeof body.src === 'string' && body.src.trim()) payload.src = body.src.trim().slice(0, 8_000);
    if (req.params.type === 'audio' && typeof body.desc === 'string') payload.desc = body.desc.slice(0, 500);
    if (!Object.keys(payload).length) return res.status(400).json({ error: 'empty_update' });
    try {
      const rows = await supabaseAdminRequest(
        `${config.table}?id=eq.${encodeURIComponent(req.params.id)}&sso_user_id=eq.${encodeURIComponent(safeUserId(req))}`,
        { env, method: 'PATCH', body: payload, headers: { Prefer: 'return=representation' } }
      );
      return res.json({ asset: Array.isArray(rows) ? rows[0] : rows });
    } catch (error) {
      logger.error('[KeyVideo cloud] asset update failed:', error.message);
      return res.status(error.code === 'SUPABASE_SERVER_NOT_CONFIGURED' ? 503 : 502)
        .json({ error: 'cloud_storage_unavailable' });
    }
  });

  router.delete('/assets/:type/:id', async (req, res) => {
    const config = ASSET_TYPES[req.params.type];
    if (!config || !UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'invalid_asset' });
    try {
      await supabaseAdminRequest(
        `${config.table}?id=eq.${encodeURIComponent(req.params.id)}&sso_user_id=eq.${encodeURIComponent(safeUserId(req))}`,
        { env, method: 'DELETE' }
      );
      return res.json({ ok: true });
    } catch (error) {
      logger.error('[KeyVideo cloud] asset delete failed:', error.message);
      return res.status(error.code === 'SUPABASE_SERVER_NOT_CONFIGURED' ? 503 : 502)
        .json({ error: 'cloud_storage_unavailable' });
    }
  });

  return router;
}
