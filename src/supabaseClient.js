import { createClient } from '@supabase/supabase-js'

// 1. Cole a "Project URL" aqui dentro das aspas
const supabaseUrl = 'https://mlbeublglpxuzqbxqtqx.supabase.co'

// 2. Cole a chave "anon / public" aqui dentro das aspas
const supabaseKey = 'sb_publishable_MrsRuOPJOEPMOXSkmcR-Ig_wup-6FOj'

export const supabase = createClient(supabaseUrl, supabaseKey)