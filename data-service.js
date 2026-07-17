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

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  function stableNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
  }

  function productSignature(product) {
    return [
      normalizeText(product.name),
      normalizeText(product.category || "Genel"),
      stableNumber(product.price ?? product.sale_price),
      normalizeText(product.unit || product.stock_unit || "Adet")
    ].join("|");
  }

  function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function looksLikeProduct(value) {
    if (!isObject(value) || !value.name) return false;
    return [
      "price",
      "sale_price",
      "salePrice",
      "purchasePrice",
      "purchase_price",
      "stock",
      "stock_quantity",
      "unit",
      "stock_unit",
      "category"
    ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
  }

  function normalizeProductCandidate(product) {
    if (!looksLikeProduct(product)) return null;
    const name = String(product.name || "").trim();
    if (!name) return null;
    return {
      ...product,
      id: product.id,
      name,
      category: product.category || product.group || "Genel",
      type: product.type || product.product_type || "sale",
      price: stableNumber(product.price ?? product.sale_price ?? product.salePrice),
      purchasePrice: stableNumber(product.purchasePrice ?? product.purchase_price),
      stock: stableNumber(product.stock ?? product.stock_quantity ?? product.quantity),
      unit: product.unit || product.stock_unit || "Adet",
      criticalLevel: stableNumber(product.criticalLevel ?? product.critical_stock),
      active: product.active !== false,
      metadata: product.metadata || {}
    };
  }

  function mergeUniqueBySignature(target, candidates) {
    candidates.forEach((candidate) => {
      const normalized = normalizeProductCandidate(candidate);
      if (!normalized) return;
      const signature = productSignature(normalized);
      if (!signature.startsWith("|") && !target.has(signature)) {
        target.set(signature, normalized);
      }
    });
  }

  function collectLegacyDataFromValue(value, key, result, depth = 0) {
    if (depth > 5 || value == null) return;

    if (Array.isArray(value)) {
      const keyLooksProductish = /product|urun|ürün/i.test(key || "");
      const productCandidates = value.filter(looksLikeProduct);
      if (keyLooksProductish || productCandidates.length >= Math.max(1, Math.floor(value.length * 0.6))) {
        mergeUniqueBySignature(result.productsBySignature, productCandidates);
      }
      return;
    }

    if (!isObject(value)) return;

    Object.entries(value).forEach(([childKey, childValue]) => {
      if (!Array.isArray(childValue)) {
        collectLegacyDataFromValue(childValue, childKey, result, depth + 1);
        return;
      }

      const lowerKey = childKey.toLocaleLowerCase("tr-TR");
      if (/products|productlist|urunler|ürünler|items/.test(lowerKey)) {
        mergeUniqueBySignature(result.productsBySignature, childValue);
      } else if (/sales|satis|satış/.test(lowerKey)) {
        result.sales.push(...childValue.filter(isObject));
      } else if (/stockmovements|stock_movements|stok|movement/.test(lowerKey)) {
        result.stockMovements.push(...childValue.filter(isObject));
      } else if (/expenses|gider/.test(lowerKey)) {
        result.expenses.push(...childValue.filter(isObject));
      }
    });

    ["businessName", "ownerName", "whatsappNumber", "categories", "paymentMethods"].forEach((field) => {
      if (result.meta[field] === undefined && value[field] !== undefined) {
        result.meta[field] = value[field];
      }
    });
  }

  function scanLocalStorageData() {
    const result = {
      productsBySignature: new Map(),
      sales: [],
      stockMovements: [],
      expenses: [],
      meta: {},
      sources: []
    };

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      const raw = key ? localStorage.getItem(key) : null;
      if (!key || !raw) continue;

      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const lowerKey = key.toLocaleLowerCase("tr-TR");
      const keyLooksRelevant = /nexora|food|owner|setup|urun|ürün|product|stock|stok|expense|gider|sale|satis|satış/.test(lowerKey);
      const beforeCount = result.productsBySignature.size + result.sales.length + result.stockMovements.length + result.expenses.length;
      collectLegacyDataFromValue(parsed, key, result);
      const afterCount = result.productsBySignature.size + result.sales.length + result.stockMovements.length + result.expenses.length;
      if (keyLooksRelevant || afterCount > beforeCount) {
        result.sources.push(key);
      }
    }

    return {
      ...emptyData(),
      ...result.meta,
      configured: true,
      setupCompleted: true,
      products: Array.from(result.productsBySignature.values()),
      sales: result.sales,
      stockMovements: result.stockMovements,
      expenses: result.expenses,
      sources: [...new Set(result.sources)]
    };
  }

  function hasLegacyData() {
    const scanned = scanLocalStorageData();
    return hasOperationalData(scanned);
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
    const payload = {
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
    if (payload.metadata && product.metadata && typeof product.metadata === "object") {
      payload.metadata = { ...product.metadata, ...payload.metadata };
    }
    payload.metadata.localSignature = productSignature(product);
    return payload;
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

  function isSetupComplete(data = {}) {
    return data.setupCompleted === true || data.configured === true;
  }

  function hasOperationalData(data = {}) {
    return Boolean(
      (Array.isArray(data.products) && data.products.length) ||
      (Array.isArray(data.sales) && data.sales.length) ||
      (Array.isArray(data.stockMovements) && data.stockMovements.length) ||
      (Array.isArray(data.expenses) && data.expenses.length)
    );
  }

  function settingsPayload(data, businessId) {
    const backupMeta = data.backupMeta && typeof data.backupMeta === "object" ? data.backupMeta : {};
    return {
      business_id: businessId,
      setup_completed: isSetupComplete(data),
      whatsapp_number: data.whatsappNumber || "",
      payment_methods: Array.isArray(data.paymentMethods) && data.paymentMethods.length ? data.paymentMethods : ["Nakit", "POS", "Online", "IBAN"],
      settings: {
        categories: Array.isArray(data.categories) ? data.categories : [],
        businessName: data.businessName || "",
        ownerName: data.ownerName || "",
        backupMeta
      },
      updated_at: new Date().toISOString()
    };
  }

  async function upsertBusinessSettings(client, businessId, data) {
    const { data: savedSettings, error } = await client
      .from("business_settings")
      .upsert(settingsPayload(data, businessId), { onConflict: "business_id" })
      .select("*")
      .single();
    if (error) throw error;
    return savedSettings;
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
    const remoteHasOperationalData = Boolean(
      products.length ||
      (salesRes.data || []).length ||
      (stockRes.data || []).length ||
      (expensesRes.data || []).length
    );
    const setupCompleted = settings.setup_completed === true || remoteHasOperationalData;
    const settingsJson = settings.settings && typeof settings.settings === "object" ? settings.settings : {};
    const categories = Array.isArray(settingsJson.categories) && settingsJson.categories.length
      ? settingsJson.categories
      : [...new Set(products.map((product) => product.category).filter(Boolean))];
    const paymentMethods = Array.isArray(settings.payment_methods) && settings.payment_methods.length
      ? settings.payment_methods
      : ["Nakit", "POS", "Online", "IBAN"];

    if (!settingsRes.data || (setupCompleted && settings.setup_completed !== true)) {
      await upsertBusinessSettings(client, businessId, {
        configured: setupCompleted,
        setupCompleted,
        businessName: business.name || settingsJson.businessName || "",
        ownerName: business.owner_name || settingsJson.ownerName || profile.full_name || "",
        whatsappNumber: settings.whatsapp_number || business.phone || "",
        categories,
        paymentMethods
      });
    }

    const data = {
      configured: setupCompleted,
      setupCompleted,
      businessName: business.name || settingsJson.businessName || "",
      ownerName: business.owner_name || settingsJson.ownerName || profile.full_name || "",
      whatsappNumber: settings.whatsapp_number || business.phone || "",
      categories,
      paymentMethods,
      backupMeta: settingsJson.backupMeta || {},
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
      hasRemoteData: remoteHasOperationalData
    };
  }

  function dbProductSignature(row) {
    return productSignature({
      name: row.name,
      category: row.category || "Genel",
      price: row.sale_price,
      unit: row.stock_unit || "Adet"
    });
  }

  function productPayloadChanged(existing, payload) {
    return (
      String(existing.name || "") !== String(payload.name || "") ||
      String(existing.category || "") !== String(payload.category || "") ||
      String(existing.product_type || "") !== String(payload.product_type || "") ||
      stableNumber(existing.sale_price) !== stableNumber(payload.sale_price) ||
      stableNumber(existing.purchase_price) !== stableNumber(payload.purchase_price) ||
      stableNumber(existing.stock_quantity) !== stableNumber(payload.stock_quantity) ||
      String(existing.stock_unit || "") !== String(payload.stock_unit || "") ||
      stableNumber(existing.critical_stock) !== stableNumber(payload.critical_stock) ||
      existing.active !== payload.active ||
      existing.metadata?.legacyId !== payload.metadata?.legacyId
    );
  }

  async function syncProductsBySignature(client, businessId, products = []) {
    const { data: existingProducts, error } = await client
      .from("products")
      .select("*")
      .eq("business_id", businessId);
    if (error) throw error;

    const existingBySignature = new Map();
    const existingByLegacyId = new Map();
    (existingProducts || []).forEach((product) => {
      existingBySignature.set(product.metadata?.localSignature || dbProductSignature(product), product);
      if (product.metadata?.legacyId) existingByLegacyId.set(String(product.metadata.legacyId), product);
    });

    const localBySignature = new Map();
    (products || []).forEach((product) => {
      const normalized = normalizeProductCandidate(product);
      if (!normalized) return;
      const signature = productSignature(normalized);
      if (!localBySignature.has(signature)) localBySignature.set(signature, normalized);
    });

    const summary = {
      localProductCount: localBySignature.size,
      remoteProductCountBefore: (existingProducts || []).length,
      inserted: 0,
      updated: 0,
      skippedDuplicates: 0,
      remoteProductCountAfter: (existingProducts || []).length
    };

    for (const product of localBySignature.values()) {
      const payload = productToDb(product, businessId);
      const signature = payload.metadata.localSignature;
      const legacyMatch = payload.metadata.legacyId ? existingByLegacyId.get(String(payload.metadata.legacyId)) : null;
      const signatureMatch = existingBySignature.get(signature);
      const match = legacyMatch || signatureMatch;

      if (match) {
        const updatePayload = { ...payload, id: undefined };
        delete updatePayload.id;
        if (productPayloadChanged(match, updatePayload)) {
          const { data: updatedProduct, error: updateError } = await client
            .from("products")
            .update(updatePayload)
            .eq("id", match.id)
            .select("*")
            .single();
          if (updateError) throw updateError;
          summary.updated += 1;
          existingBySignature.set(signature, updatedProduct);
          if (updatedProduct.metadata?.legacyId) existingByLegacyId.set(String(updatedProduct.metadata.legacyId), updatedProduct);
        } else {
          summary.skippedDuplicates += 1;
        }
        continue;
      }

      const { data: insertedProduct, error: insertError } = await client
        .from("products")
        .insert(payload)
        .select("*")
        .single();
      if (insertError) throw insertError;
      summary.inserted += 1;
      summary.remoteProductCountAfter += 1;
      existingBySignature.set(signature, insertedProduct);
      if (insertedProduct.metadata?.legacyId) existingByLegacyId.set(String(insertedProduct.metadata.legacyId), insertedProduct);
    }

    const { count, error: countError } = await client
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("active", true);
    if (countError) throw countError;
    summary.remoteProductCountAfter = count ?? summary.remoteProductCountAfter;
    return summary;
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

    await upsertBusinessSettings(client, businessId, data);

    const productSummary = await syncProductsBySignature(client, businessId, data.products || []);

    for (const sale of data.sales || []) {
      const salePayload = saleToDb(sale, businessId, session.user.id);
      const saleConflict = salePayload.id ? "id" : salePayload.client_generated_id ? "business_id,client_generated_id" : "id";
      const { data: savedSale, error } = await client.from("sales").upsert(salePayload, { onConflict: saleConflict }).select("id").single();
      if (error) throw error;
      if (Array.isArray(sale.items) && sale.items.length) {
        await client.from("sale_items").delete().eq("sale_id", savedSale.id);
        const rows = sale.items.map((item) => saleItemToDb(item, savedSale.id));
        const { error: itemError } = await client.from("sale_items").insert(rows);
        if (itemError && !String(itemError.message || "").includes("duplicate")) throw itemError;
      }
    }

    for (const movement of data.stockMovements || []) {
      const payload = {
        business_id: businessId,
        product_id: movement.productId && /^[0-9a-f-]{36}$/i.test(movement.productId) ? movement.productId : null,
        movement_type: movement.entryType || movement.movementType || "stock_in",
        quantity: Number(movement.quantity || movement.amount || movement.amountKg || 0),
        unit_cost: Number(movement.unitCost || movement.unitPrice || 0),
        total_cost: Number(movement.cost || movement.totalCost || 0),
        supplier: movement.supplier || "",
        invoice_number: movement.invoiceNumber || movement.invoice || "",
        note: movement.note || "",
        metadata: movement,
        client_generated_id: movement.client_generated_id || movement.id || null
      };
      const query = payload.client_generated_id
        ? client.from("stock_movements").upsert(payload, { onConflict: "business_id,client_generated_id" })
        : client.from("stock_movements").insert(payload);
      const { error } = await query;
      if (error) throw error;
    }

    for (const expense of data.expenses || []) {
      const payload = {
        business_id: businessId,
        name: expense.name,
        category: expense.category,
        amount: Number(expense.amount || 0),
        payment_method: expense.paymentMethod || "Nakit",
        expense_date: expense.date || new Date().toISOString().slice(0, 10),
        note: expense.note || "",
        client_generated_id: expense.client_generated_id || expense.id || null
      };
      const query = payload.client_generated_id
        ? client.from("expenses").upsert(payload, { onConflict: "business_id,client_generated_id" })
        : client.from("expenses").insert(payload);
      const { error } = await query;
      if (error) throw error;
    }

    return { ok: true, productSummary };
  }

  async function getClientContext() {
    const client = window.NexoraSupabase.getSupabaseClient();
    const session = await window.NexoraAuth.getSession();
    const profile = await getProfile();
    if (!client || !session?.user || !profile?.business_id) {
      throw new Error("Supabase oturumu ve isletme profili gerekli.");
    }
    return { client, session, profile, businessId: profile.business_id };
  }

  async function fetchBusinessProducts(includeInactive = true) {
    const { client, businessId } = await getClientContext();
    let query = client.from("products").select("*").eq("business_id", businessId).order("created_at");
    if (!includeInactive) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function saveImportedProducts(products = [], options = {}) {
    const { client, businessId } = await getClientContext();
    const summary = { inserted: 0, updated: 0, skipped: 0, failed: 0, rows: [] };
    const batchSize = Number(options.batchSize || 100);
    const chunks = [];
    for (let index = 0; index < products.length; index += batchSize) {
      chunks.push(products.slice(index, index + batchSize));
    }

    for (const chunk of chunks) {
      for (const item of chunk) {
        try {
          const product = item.product || item;
          if (item.action === "skip") {
            summary.skipped += 1;
            summary.rows.push({ rowNumber: item.rowNumber, ok: true, action: "skip", name: product.name });
            continue;
          }
          const payload = productToDb(product, businessId);
          const existingId = item.match?.id || (product.supabaseId && /^[0-9a-f-]{36}$/i.test(product.supabaseId) ? product.supabaseId : null);
          if (existingId && item.action !== "insert") {
            delete payload.id;
            const { error } = await client.from("products").update(payload).eq("id", existingId).eq("business_id", businessId);
            if (error) throw error;
            summary.updated += 1;
            summary.rows.push({ rowNumber: item.rowNumber, ok: true, action: "update", name: product.name });
          } else {
            const { error } = await client.from("products").insert(payload);
            if (error) throw error;
            summary.inserted += 1;
            summary.rows.push({ rowNumber: item.rowNumber, ok: true, action: "insert", name: product.name });
          }
        } catch (error) {
          summary.failed += 1;
          summary.rows.push({ rowNumber: item.rowNumber, ok: false, action: item.action, name: item.product?.name || "", error: error.message });
        }
      }
    }
    return summary;
  }

  async function updateBackupMeta(meta = {}) {
    const { client, businessId } = await getClientContext();
    const { data: current, error: readError } = await client
      .from("business_settings")
      .select("settings")
      .eq("business_id", businessId)
      .maybeSingle();
    if (readError) throw readError;
    const settings = current?.settings && typeof current.settings === "object" ? current.settings : {};
    const { error } = await client
      .from("business_settings")
      .upsert({
        business_id: businessId,
        settings: { ...settings, backupMeta: { ...(settings.backupMeta || {}), ...meta } },
        updated_at: new Date().toISOString()
      }, { onConflict: "business_id" });
    if (error) throw error;
    return { ...(settings.backupMeta || {}), ...meta };
  }

  async function migrateLegacyData() {
    const profile = await getProfile();
    if (!profile?.business_id) throw new Error("Isletme profili bulunamadi.");
    if (migrationDone(profile.business_id)) return { ok: true, skipped: true };
    const scanned = scanLocalStorageData();
    const legacy = hasOperationalData(scanned) ? scanned : parseStorage(LEGACY_STORAGE_KEY, emptyData());
    const legacySetupCompleted = legacy.setupCompleted === true || legacy.configured === true || hasOperationalData(legacy);
    const merged = {
      ...emptyData(),
      ...legacy,
      configured: legacySetupCompleted,
      setupCompleted: legacySetupCompleted
    };
    const syncResult = await syncAllData(merged);
    markMigrated(profile.business_id);
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ ...legacy, migratedToSupabase: true }));
    return { ok: true, summary: syncResult.productSummary, sources: legacy.sources || [] };
  }

  async function rescanAndRepairLocalData() {
    const profile = await getProfile();
    if (!profile?.business_id) throw new Error("Isletme profili bulunamadi.");

    const scanned = scanLocalStorageData();
    if (!hasOperationalData(scanned)) {
      throw new Error("localStorage icinde aktarilacak Nexora Food verisi bulunamadi.");
    }

    const syncResult = await syncAllData(scanned);
    markMigrated(profile.business_id);
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ ...scanned, migratedToSupabase: true }));
    return {
      ok: true,
      summary: syncResult.productSummary,
      sources: scanned.sources || []
    };
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
    rescanAndRepairLocalData,
    subscribeRealtime,
    getProfile,
    getClientContext,
    fetchBusinessProducts,
    saveImportedProducts,
    updateBackupMeta,
    productToDb,
    productFromDb
  };
})();
