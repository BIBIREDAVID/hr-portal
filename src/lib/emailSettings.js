import { supabase } from './supabaseClient'

const SETTINGS_KEY = 'stage_email_triggers'

// { [stage]: boolean } — which stage transitions send the candidate an
// automatic email (Section 7, item 18). Missing/false = no email.
export async function getStageEmailSettings() {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle()
  if (error) throw error
  return data?.value ?? {}
}

export async function setStageEmailSettings(value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: SETTINGS_KEY, value, updated_at: new Date().toISOString() })
  if (error) throw error
}
