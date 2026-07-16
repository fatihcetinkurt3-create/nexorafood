(function () {
  async function getSession() {
    const client = window.NexoraSupabase?.getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session || null;
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
      options: { data: metadata }
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
    getSession,
    signIn,
    signOut,
    resetPassword,
    registerBusiness,
    ensureBusinessProfile
  };
})();
