import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const missingConfigError = { message: 'Supabase env belum diset di Vercel: VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.' };

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';

const createEmptyBuilder = () => {
  const builder = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: async () => ({ data: null, error: missingConfigError }),
    upsert: async () => ({ data: null, error: missingConfigError }),
    update: () => ({
      eq: async () => ({ data: null, error: missingConfigError })
    }),
    then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject)
  };

  return builder;
};

const fallbackSupabase = {
  from: () => createEmptyBuilder(),
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
    signUp: async () => ({ data: null, error: missingConfigError }),
    signInWithPassword: async () => ({ data: null, error: missingConfigError }),
    resend: async () => ({ data: null, error: missingConfigError }),
    updateUser: async () => ({ data: null, error: missingConfigError })
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: missingConfigError }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
      createSignedUrl: async () => ({ data: null, error: missingConfigError })
    })
  }
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : fallbackSupabase;
