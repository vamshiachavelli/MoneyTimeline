import Constants from "expo-constants";

type ExtraConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

const readPublicEnv = (value: string | undefined) => {
  if (!value || value.startsWith("$")) {
    return "";
  }

  return value;
};

export const env = {
  supabaseUrl: readPublicEnv(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl
  ),
  supabaseAnonKey: readPublicEnv(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey
  )
};

export const isSupabaseConfigured =
  env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
