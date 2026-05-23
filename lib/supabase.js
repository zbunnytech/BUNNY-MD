// lib/supabase.js
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import 'dotenv/config'

// 1. Get environment variables from Render
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

if (!supabaseUrl ||!supabaseKey) {
  console.log('⚠️ SUPABASE_URL or SUPABASE_KEY is missing in environment')
  process.exit(1)
}

// 2. Create Supabase client - FIX: Add ws for Node 20 WebSocket support
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    transport: ws // Required for Node.js 20.x
  }
})

// 3. Function to fetch bot settings on startup
export async function getBotSettings() {
  try {
    const { data, error } = await supabase
      .from('b_settings')
      .select('*')
      .eq('id', 'BUNNY_DEFAULT')
      .single()

    if (error) {
      console.log('⚠️ Failed to load b_settings:', error.message)
      // Return defaults if table doesn't exist or has error
      return {
        botname: 'BUNNY MD',
        owner_number: '255780470905',
        owner_name: 'Lupin Starnley',
        prefix: '!',
        public_mode: false,
        antilink: false,
        antispam: false,
        autoread: false,
        autotyping: false,
        autoviewstatus: false
      }
    }
    return data
  } catch (err) {
    console.log('⚠️ Supabase error:', err.message)
    return {
      botname: 'BUNNY MD',
      owner_number: '255780470905',
      owner_name: 'Lupin Starnley',
      prefix: '!',
      public_mode: false,
      antilink: false,
      antispam: false,
      autoread: false,
      autotyping: false,
      autoviewstatus: false
    }
  }
}

// 4. Function to listen for realtime settings updates
export function listenSettingsUpdates(callback) {
  supabase
    .channel('b_settings_changes')
    .on('postgres_changes', 
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'b_settings', 
        filter: 'id=eq.BUNNY_DEFAULT' 
      }, 
      (payload) => {
        console.log('🔥 Settings updated live:', payload.new)
        callback(payload.new) // Send new data to index.js
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Realtime settings listener active')
      }
    })
}