import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://api.marius.vip';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU3NjA2NDAwLCJleHAiOjE5MTUzNzI4MDB9.tFw_n6nAD2jJzy054jsRtIc8pi7ZQvg1lBp43V-X-2Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
