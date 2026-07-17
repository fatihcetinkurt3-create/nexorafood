(function () {
  const state = {
    config: null,
    client: null,
    ready: false,
    error: null
  };

  async function loadConfig() {
    const response = await fetch("/api/config", { headers: { Accept: "application/json" } });
    const config = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(config.error || "Supabase config okunamadi.");
    return config;
  }

  async function initSupabaseClient() {
    if (state.ready) return state.client;
    try {
      state.config = await loadConfig();
      if (!state.config.supabaseUrl || !state.config.supabaseAnonKey) {
        throw new Error("SUPABASE_URL veya SUPABASE_ANON_KEY eksik.");
      }
      if (!window.supabase?.createClient) {
        throw new Error("Supabase istemci kutuphanesi yuklenemedi.");
      }
      state.client = window.supabase.createClient(state.config.supabaseUrl, state.config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce"
        }
      });
      state.ready = true;
      state.error = null;
      return state.client;
    } catch (error) {
      state.error = error;
      state.ready = false;
      return null;
    }
  }

  function getSupabaseClient() {
    return state.client;
  }

  function isSupabaseReady() {
    return Boolean(state.ready && state.client);
  }

  function getSupabaseStatus() {
    return { ...state };
  }

  window.NexoraSupabase = {
    initSupabaseClient,
    getSupabaseClient,
    getSupabaseStatus,
    isSupabaseReady
  };
})();
