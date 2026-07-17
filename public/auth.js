(function () {
  const AUTH_PARAM_NAMES = new Set([
    "access_token",
    "refresh_token",
    "expires_at",
    "expires_in",
    "provider_token",
    "provider_refresh_token",
    "token_type",
    "token_hash",
    "type",
    "code",
    "error",
    "error_code",
    "error_description"
  ]);

  function readAuthParams() {
    const query = new URLSearchParams(window.location.search || "");
    const hashText = String(window.location.hash || "").replace(/^#/, "");
    const hash = new URLSearchParams(hashText);
    const get = (key) => query.get(key) || hash.get(key) || "";
    return {
      code: get("code"),
      accessToken: get("access_token"),
      refreshToken: get("refresh_token"),
      tokenHash: get("token_hash"),
      type: get("type"),
      error: get("error"),
      errorCode: get("error_code"),
      errorDescription: get("error_description"),
      hasAuthParams: [...query.keys(), ...hash.keys()].some((key) => AUTH_PARAM_NAMES.has(key))
    };
  }

  function cleanAuthUrl() {
    const url = new URL(window.location.href);
    AUTH_PARAM_NAMES.forEach((key) => url.searchParams.delete(key));
    const hashText = String(url.hash || "").replace(/^#/, "");
    if (hashText) {
      const hash = new URLSearchParams(hashText);
      AUTH_PARAM_NAMES.forEach((key) => hash.delete(key));
      const nextHash = hash.toString();
      url.hash = nextHash ? `#${nextHash}` : "";
    }
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }

  function normalizeOtpType(type) {
    const normalized = String(type || "").trim().toLowerCase();
    if (["signup", "invite", "magiclink", "recovery", "email_change", "email"].includes(normalized)) return normalized;
    return "signup";
  }

  async function getSession() {
    const client = window.NexoraSupabase?.getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function verifyTokenHash(client, tokenHash, type) {
    const firstType = normalizeOtpType(type);
    const attempts = firstType === "signup" ? ["signup"] : [firstType, "signup"];
    let lastError = null;
    for (const otpType of attempts) {
      const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
      if (!error) return data;
      lastError = error;
    }
    throw lastError;
  }

  async function handleAuthCallback() {
    const client = window.NexoraSupabase?.getSupabaseClient();
    if (!client) return { handled: false, session: null };
    const params = readAuthParams();
    if (!params.hasAuthParams) {
      const session = await getSession();
      return { handled: false, session };
    }

    try {
      if (params.error || params.errorDescription) {
        throw new Error(params.errorDescription || params.errorCode || params.error || "Email dogrulama basarisiz.");
      }

      let authData = null;
      if (params.code) {
        const { data, error } = await client.auth.exchangeCodeForSession(params.code);
        if (error) throw error;
        authData = data;
      } else if (params.accessToken && params.refreshToken) {
        const { data, error } = await client.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken
        });
        if (error) throw error;
        authData = data;
      } else if (params.tokenHash) {
        authData = await verifyTokenHash(client, params.tokenHash, params.type);
      }

      const session = authData?.session || (await getSession());
      if (!session) {
        throw new Error("Email dogrulandi ancak oturum olusturulamadi. Link suresi dolmus olabilir.");
      }
      cleanAuthUrl();
      return { handled: true, ok: true, session, type: params.type || "callback" };
    } catch (error) {
      cleanAuthUrl();
      return { handled: true, ok: false, session: null, error };
    }
  }

  async function signIn(email, password) {
    const client = window.NexoraSupabase.getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const client = window.NexoraSupabase.getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function resetPassword(email) {
    const client = window.NexoraSupabase.getSupabaseClient();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/demo/food/admin"
    });
    if (error) throw error;
  }

  async function registerBusiness(form) {
    const client = window.NexoraSupabase.getSupabaseClient();
    const metadata = {
      business_name: form.businessName,
      owner_name: form.ownerName,
      phone: form.phone,
      full_name: form.ownerName
    };
    const { data, error } = await client.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: metadata,
        emailRedirectTo: window.location.origin + "/demo/food/admin"
      }
    });
    if (error) throw error;

    if (data.session) {
      await ensureBusinessProfile({
        businessName: form.businessName,
        ownerName: form.ownerName,
        phone: form.phone,
        fullName: form.ownerName
      });
    }

    return data;
  }

  async function ensureBusinessProfile(form = {}) {
    const client = window.NexoraSupabase.getSupabaseClient();
    const session = await getSession();
    if (!session?.user) throw new Error("Oturum bulunamadi.");

    const rpcPayload = {
      p_business_name: form.businessName || session.user.user_metadata?.business_name || "Nexora Food",
      p_owner_name: form.ownerName || session.user.user_metadata?.owner_name || session.user.email,
      p_phone: form.phone || session.user.user_metadata?.phone || "",
      p_full_name: form.fullName || form.ownerName || session.user.user_metadata?.full_name || session.user.email
    };
    const { data: ensuredProfile, error: ensureError } = await client.rpc("ensure_user_business", rpcPayload);
    if (!ensureError && Array.isArray(ensuredProfile) && ensuredProfile[0]?.business_id) {
      return ensuredProfile[0];
    }
    if (ensureError && ensureError.code !== "42883" && !String(ensureError.message || "").includes("ensure_user_business")) {
      throw ensureError;
    }

    const { data: existingProfile, error: profileError } = await client
      .from("profiles")
      .select("id,business_id,full_name,role")
      .eq("id", session.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (existingProfile?.business_id) return existingProfile;

    const { data: business, error: businessError } = await client
      .from("businesses")
      .insert({
        owner_id: session.user.id,
        name: form.businessName || session.user.user_metadata?.business_name || "Nexora Food",
        owner_name: form.ownerName || session.user.user_metadata?.owner_name || session.user.email,
        phone: form.phone || session.user.user_metadata?.phone || ""
      })
      .select("id,name,owner_name,phone")
      .single();
    if (businessError) throw businessError;

    const { data: profile, error } = await client
      .from("profiles")
      .upsert({
        id: session.user.id,
        business_id: business.id,
        full_name: form.fullName || form.ownerName || session.user.user_metadata?.full_name || session.user.email,
        role: "owner"
      })
      .select("id,business_id,full_name,role")
      .single();
    if (error) throw error;

    await client.from("business_settings").upsert({
      business_id: business.id,
      setup_completed: false,
      whatsapp_number: business.phone || "",
      payment_methods: ["Nakit", "POS", "Online", "IBAN"],
      settings: {}
    });

    return profile;
  }

  window.NexoraAuth = {
    handleAuthCallback,
    getSession,
    signIn,
    signOut,
    resetPassword,
    registerBusiness,
    ensureBusinessProfile
  };
})();
