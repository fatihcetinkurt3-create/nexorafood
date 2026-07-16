(function () {
  const LEGACY_STORAGE_KEY = "nexoraFoodAiOwnerSetup.v1";
  const VERESIYE_STORAGE_KEY = "nexoraVeresiyeCustomers";
  const PRODUCTION_STORAGE_KEY = "nexoraProductionRecords";
  const WASTE_STORAGE_KEY = "nexoraWasteRecords";
  const CASH_CLOSING_STORAGE_KEY = "nexoraCashClosings";
  const MIGRATION_KEY = "nexoraFoodAiMigratedToSupabase.v1";

  function emptyData() {
    return {
      configured: false,
      setupCompleted: false,
      businessName: "",
      ownerName: "",
      whatsappNumber: "",
      categories: [],
      paymentMethods: [],
      products: [],
      sales: [],
      stockMovements: [],
      expenses: []
    };
  }

  function parseStorage(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  }

  function hasLegacyData() {
    const legacy = parseStorage(LEGACY_STORAGE_KEY, null);
    return Boolean(legacy && (Array.isArray(legacy.products) || Array.isArray(legacy.sales) || legacy.setupCompleted || legacy.configured));
  }

  function migrationDone(businessId) {
    const data = parseStorage(MIGRATION_KEY, {});
    return Boolean(data[businessId]);
  }

  function markMigrated(businessId) {
    const data = parseStorage(MIGRATION_KEY, {});
    data[businessId] = { migratedToSupabase: true, migratedAt: new Date().toISOString() };
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(data));
  }

  function productToDb(product, businessId) {
    return {
      id: product.id && /^[0-9a-f-]{36}$/i.test(product.id) ? product.id : undefined,
      business_id: businessId,
      name: product.name || "",
      category: product.category || "Genel",
      product_type: product.type || (product.product_type === "raw" ? "raw" : "sale"),
      sale_price: Number(product.price || product.sale_price || 0),
      purchase_price: Number(product.purchasePrice || product.purchase_price || 0),
      stock_quantity: Number(product.stock || product.stock_quantity || 0),
      stock_unit: product.unit || product.stock_unit || "Adet",
      critical_stock: Number(product.criticalLevel || product.critical_stock || 0),
      active: product.active !== false,
      metadata: {
        legacyId: product.id,
        initialStock: product.initialStock,
        packageSize: product.packageSize,
        supplier: product.supplier,
        note: product.note,
        sold: product.sold,
        recipe: product.recipe,
        saleType: product.saleType,
        rawMaterialId: product.rawMaterialId,
        supportsDoritos: product.supportsDoritos
      }
    };
  }

  function productFromDb(row) {
    const meta = row.metadata || {};
    return {
      id: meta.legacyId || row.id,
      supabaseId: row.id,
      name: row.name,
      category: row.category || "Genel",
      type: row.product_type || "sale",
      price: Number(row.sale_price || 0),
      purchasePrice: Number(row.purchase_price || 0),
      stock: Number(row.stock_quantity || 0),
      unit: row.stock_unit || "Adet",
      criticalLevel: Number(row.critical_stock || 0),
      active: row.active !== false,
      initialStock: Number(meta.initialStock ?? row.stock_quantity ?? 0),
      packageSize: Number(meta.packageSize || 0),
      supplier: meta.supplier || "",
      note: meta.note || "",
      sold: Number(meta.sold || 0),
      recipe: Array.isArray(meta.recipe) ? meta.recipe : [],
      saleType: meta.saleType,
      rawMaterialId: meta.rawMaterialId,
      supportsDoritos: meta.supportsDoritos === true
    };
  }

  function saleToDb(sale, businessId, userId) {
    return {
      id: sale.id && /^[0-9a-f-]{36}$/i.test(sale.id) ? sale.id : undefined,
      business_id: businessId,
      user_id: userId,
      payment_method: sale.paymentMethod || "Nakit",
      subtotal: Number(sale.subtotal ?? sale.total ?? 0),
      discount: Number(sale.discount || 0),
      total: Number(sale.total || 0),
      cash_received: Number(sale.cashReceived || 0),
      change_due: Number(sale.changeDue || 0),
      change_returned: Number(sale.changeReturned || 0),
      tip_amount: Number(sale.tipAmount || 0),
      custom_amount_sale: sale.customAmountSale === true,
      note: sale.note || "",
      client_generated_id: sale.client_generated_id || sale.id || null,
      created_at: sale.createdAt || sale.dateTime || `${sale.date || new Date().toISOString().slice(0, 10)}T${sale.time || "12:00"}:00`
    };
  }

  function saleFromDb(row, items = []) {
    return {
      id: row.id,
      paymentMethod: row.payment_method,
      subtotal: Number(row.subtotal || 0),
      discount: Number(row.discount || 0),
      total: Number(row.total || 0),
      cashReceived: Number(row.cash_received || 0),
      changeDue: Number(row.change_due || 0),
      changeReturned: Number(row.change_returned || 0),
      tipAmount: Number(row.tip_amount || 0),
      customAmountSale: row.custom_amount_sale === true,
      note: row.note || "",
      date: String(row.created_at || "").slice(0, 10),
      time: new Date(row.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      productId: items[0]?.productId || null,
      productName: items.length === 1 ? items[0].productName : `${items.length} ürün`,
      quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      unit: items.length === 1 ? items[0].unit || "Adet" : "kalem",
      unitPrice: Number(row.subtotal || row.total || 0),
      source: "supabase",
      items
    };
  }

  function saleItemToDb(item, saleId) {
    return {
      sale_id: saleId,
      product_id: item.supabaseProductId || (item.productId && /^[0-9a-f-]{36}$/i.test(item.productId) ? item.productId : null),
      product_name: item.productName || item.name || "Ürün",
      quantity: Number(item.quantity || item.quantityKg || 0),
      unit_price: Number(item.unitPrice || item.pricePerKg || 0),
      total: Number(item.total || item.lineTotal || 0),
      metadata: item
    };
  }

  function saleItemFromDb(row) {
    const meta = row.metadata || {};
    return {
      ...meta,
      id: row.id,
      productId: meta.productId || row.product_id,
      productName: row.product_name,
      name: meta.name || row.product_name,
      quantity: Number(row.quantity || 0),
      unitPrice: Number(row.unit_price || 0),
      total: Number(row.total || 0),
      lineTotal: Number(row.total || 0)
    };
  }

  async function getProfile() {
    const client = window.NexoraSupabase.getSupabaseClient();
    const session = await window.NexoraAuth.getSession();
    if (!session?.user) return null;
    const { data, error } = await client
      .from("profiles")
      .select("id,business_id,full_name,role,businesses(id,name,owner_name,phone)")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function loadBusinessData() {
    const client = window.NexoraSupabase.getSupabaseClient();
    const profile = await getProfile();
    if (!profile?.business_id) return { data: emptyData(), profile: null, hasRemoteData: false };
    const businessId = profile.business_id;

    const [settingsRes, productsRes, salesRes, stockRes, expensesRes, creditsRes, creditTxRes, closingsRes, wasteRes] = await Promise.all([
      client.from("business_settings").select("*").eq("business_id", businessId).maybeSingle(),
      client.from("products").select("*").eq("business_id", businessId).eq("active", true).order("created_at"),
      client.from("sales").select("*").eq("business_id", businessId).order("created_at"),
      client.from("stock_movements").select("*").eq("business_id", businessId).order("created_at"),
      client.from("expenses").select("*").eq("business_id", businessId).order("expense_date"),
      client.from("credit_accounts").select("*").eq("business_id", businessId).order("created_at"),
      client.from("credit_transactions").select("*").eq("business_id", businessId).order("created_at"),
      client.from("day_closings").select("*").eq("business_id", businessId).order("closing_date"),
      client.from("waste_records").select("*").eq("business_id", businessId).order("created_at")
    ]);

    [settingsRes, productsRes, salesRes, stockRes, expensesRes, creditsRes, creditTxRes, closingsRes, wasteRes].forEach((result) => {
      if (result.error) throw result.error;
    });

    const saleIds = (salesRes.data || []).map((sale) => sale.id);
    let saleItems = [];
    if (saleIds.length) {
      const { data, error } = await client.from("sale_items").select("*").in("sale_id", saleIds);
      if (error) throw error;
      saleItems = data || [];
    }

    const itemsBySale = saleItems.reduce((acc, item) => {
      if (!acc[item.sale_id]) acc[item.sale_id] = [];
      acc[item.sale_id].push(saleItemFromDb(item));
      return acc;
    }, {});

    const business = profile.businesses || {};
    const settings = settingsRes.data || {};
    const products = (productsRes.data || []).map(productFromDb);
    const data = {
      configured: settings.setup_completed === true,
      setupCompleted: settings.setup_completed === true,
      businessName: business.name || "",
      ownerName: business.owner_name || profile.full_name || "",
      whatsappNumber: settings.whatsapp_number || business.phone || "",
      categories: [...new Set(products.map((product) => product.category).filter(Boolean))],
      paymentMethods: Array.isArray(settings.payment_methods) ? settings.payment_methods : ["Nakit", "POS", "Online", "IBAN"],
      products,
      sales: (salesRes.data || []).map((sale) => saleFromDb(sale, itemsBySale[sale.id] || [])),
      stockMovements: (stockRes.data || []).map((row) => ({
        id: row.id,
        productId: row.product_id,
        productName: row.metadata?.productName || "",
        movementType: row.movement_type,
        entryType: row.movement_type,
        amount: Number(row.quantity || 0),
        quantity: Number(row.quantity || 0),
        unitCost: Number(row.unit_cost || 0),
        cost: Number(row.total_cost || 0),
        supplier: row.supplier || "",
        invoiceNumber: row.invoice_number || "",
        note: row.note || "",
        date: String(row.created_at || "").slice(0, 10)
      })),
      expenses: (expensesRes.data || []).map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        amount: Number(row.amount || 0),
        paymentMethod: row.payment_method || "Nakit",
        date: row.expense_date,
        note: row.note || ""
      }))
    };

    localStorage.setItem(VERESIYE_STORAGE_KEY, JSON.stringify((creditsRes.data || []).map((account) => ({
      id: account.id,
      name: account.customer_name,
      phone: account.phone,
      balance: Number(account.balance || 0),
      transactions: (creditTxRes.data || [])
        .filter((tx) => tx.credit_account_id === account.id)
        .map((tx) => ({ id: tx.id, type: tx.type, amount: Number(tx.amount || 0), note: tx.note || "", createdAt: tx.created_at }))
    }))));
    localStorage.setItem(WASTE_STORAGE_KEY, JSON.stringify(wasteRes.data || []));
    localStorage.setItem(CASH_CLOSING_STORAGE_KEY, JSON.stringify((closingsRes.data || []).map((row) => ({ id: row.id, date: row.closing_date, ...row.summary }))));

    return {
      data,
      profile,
      hasRemoteData: products.length || data.sales.length || data.expenses.length || data.stockMovements.length
    };
  }

  async function syncAllData(data) {
    const client = window.NexoraSupabase.getSupabaseClient();
    const session = await window.NexoraAuth.getSession();
    const profile = await getProfile();
    if (!session?.user || !profile?.business_id) throw new Error("Supabase oturumu bulunamadi.");
    const businessId = profile.business_id;

    const { error: businessError } = await client
      .from("businesses")
      .update({
        name: data.businessName || "Nexora Food",
        owner_name: data.ownerName || session.user.email,
        phone: data.whatsappNumber || ""
      })
      .eq("id", businessId);
    if (businessError) throw businessError;

    await client.from("business_settings").upsert({
      business_id: businessId,
      setup_completed: data.setupCompleted === true || data.configured === true,
      whatsapp_number: data.whatsappNumber || "",
      payment_methods: Array.isArray(data.paymentMethods) ? data.paymentMethods : [],
      settings: {
        categories: data.categories || [],
        businessName: data.businessName || "",
        ownerName: data.ownerName || ""
      },
      updated_at: new Date().toISOString()
    });

    for (const product of data.products || []) {
      const payload = productToDb(product, businessId);
      const { error } = await client.from("products").upsert(payload, { onConflict: "id" });
      if (error) throw error;
    }

    for (const sale of data.sales || []) {
      const salePayload = saleToDb(sale, businessId, session.user.id);
      const { data: savedSale, error } = await client.from("sales").upsert(salePayload, { onConflict: "id" }).select("id").single();
      if (error) throw error;
      if (Array.isArray(sale.items) && sale.items.length) {
        await client.from("sale_items").delete().eq("sale_id", savedSale.id);
        const rows = sale.items.map((item) => saleItemToDb(item, savedSale.id));
        const { error: itemError } = await client.from("sale_items").insert(rows);
        if (itemError && !String(itemError.message || "").includes("duplicate")) throw itemError;
      }
    }

    for (const movement of data.stockMovements || []) {
      const { error } = await client.from("stock_movements").insert({
        business_id: businessId,
        product_id: movement.productId && /^[0-9a-f-]{36}$/i.test(movement.productId) ? movement.productId : null,
        movement_type: movement.entryType || movement.movementType || "stock_in",
        quantity: Number(movement.quantity || movement.amount || movement.amountKg || 0),
        unit_cost: Number(movement.unitCost || movement.unitPrice || 0),
        total_cost: Number(movement.cost || movement.totalCost || 0),
        supplier: movement.supplier || "",
        invoice_number: movement.invoiceNumber || movement.invoice || "",
        note: movement.note || "",
        metadata: movement
      });
      if (error) throw error;
    }

    for (const expense of data.expenses || []) {
      const { error } = await client.from("expenses").insert({
        business_id: businessId,
        name: expense.name,
        category: expense.category,
        amount: Number(expense.amount || 0),
        payment_method: expense.paymentMethod || "Nakit",
        expense_date: expense.date || new Date().toISOString().slice(0, 10),
        note: expense.note || ""
      });
      if (error) throw error;
    }

    return { ok: true };
  }

  async function migrateLegacyData() {
    const profile = await getProfile();
    if (!profile?.business_id) throw new Error("Isletme profili bulunamadi.");
    if (migrationDone(profile.business_id)) return { ok: true, skipped: true };
    const legacy = parseStorage(LEGACY_STORAGE_KEY, emptyData());
    const merged = { ...emptyData(), ...legacy };
    await syncAllData(merged);
    markMigrated(profile.business_id);
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ ...legacy, migratedToSupabase: true }));
    return { ok: true };
  }

  function subscribeRealtime(onChange) {
    const client = window.NexoraSupabase.getSupabaseClient();
    if (!client?.channel) return null;
    const channel = client
      .channel("nexora-food-business-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, onChange)
      .subscribe();
    return channel;
  }

  window.NexoraDataService = {
    LEGACY_STORAGE_KEY,
    MIGRATION_KEY,
    hasLegacyData,
    migrationDone,
    loadBusinessData,
    syncAllData,
    migrateLegacyData,
    subscribeRealtime,
    getProfile
  };
})();
