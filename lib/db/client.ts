import { createBrowserClient } from "@supabase/ssr";

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type GenericSchema = {
  Tables: Record<string, GenericTable>;
  Views: Record<string, never>;
  Functions: Record<string, never>;
  Enums: Record<string, never>;
  CompositeTypes: Record<string, never>;
};

type GenericDatabase = {
  public: GenericSchema;
};

let browserClient:
  | ReturnType<typeof createBrowserClient<GenericDatabase>>
  | undefined;

export function createBrowserSupabaseClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  browserClient = createBrowserClient<GenericDatabase>(
    supabaseUrl,
    supabaseAnonKey
  );
  return browserClient;
}
