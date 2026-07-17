(function () {
  const BACKUP_VERSION = 1;
  const TABLES = [
    "businesses",
    "business_settings",
    "products",
    "sales",
    "sale_items",
    "stock_movements",
    "expenses",
    "waste_records",
    "credit_accounts",
    "credit_transactions",
    "day_closings",
    "whatsapp_logs"
  ];
  const BUSINESS_TABLES = TABLES.filter((table) => !["sale_items", "credit_transactions"].includes(table));

  function timestampFilePart(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-") + "-" + [pad(date.getHours()), pad(date.getMinutes())].join("-");
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function selectAll(client, table, businessId) {
    if (table === "businesses") {
      const { data, error } = await client.from("businesses").select("*").eq("id", businessId);
      if (error) throw error;
      return data || [];
    }
    if (table === "sale_items") {
      const { data: sales, error: salesError } = await client.from("sales").select("id").eq("business_id", businessId);
      if (salesError) throw salesError;
      const saleIds = (sales || []).map((sale) => sale.id);
      if (!saleIds.length) return [];
      const { data, error } = await client.from("sale_items").select("*").in("sale_id", saleIds);
      if (error) throw error;
      return data || [];
    }
    if (table === "credit_transactions") {
      const { data: accounts, error: accountError } = await client.from("credit_accounts").select("id").eq("business_id", businessId);
      if (accountError) throw accountError;
      const accountIds = (accounts || []).map((account) => account.id);
      if (!accountIds.length) return [];
      const { data, error } = await client.from("credit_transactions").select("*").in("credit_account_id", accountIds);
      if (error) throw error;
      return data || [];
    }
    const { data, error } = await client.from(table).select("*").eq("business_id", businessId);
    if (error) throw error;
    return data || [];
  }

  function recordCounts(data) {
    return Object.fromEntries(TABLES.map((table) => [table, Array.isArray(data[table]) ? data[table].length : 0]));
  }

  async function createFullBackup(appVersion = "1.0.0") {
    const { client, businessId } = await window.NexoraDataService.getClientContext();
    const data = {};
    for (const table of TABLES) {
      data[table] = await selectAll(client, table, businessId);
    }
    const backup = {
      metadata: {
        backupVersion: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        businessId,
        appVersion,
        recordCounts: recordCounts(data)
      },
      data
    };
    await window.NexoraDataService.updateBackupMeta({ lastManualBackupAt: backup.metadata.createdAt });
    downloadJson(backup, `nexora-tam-yedek-${timestampFilePart()}.json`);
    return backup.metadata;
  }

  function validateBackup(payload, currentBusinessId) {
    if (!payload || typeof payload !== "object") throw new Error("Yedek JSON formati gecersiz.");
    if (!payload.metadata || !payload.data) throw new Error("Yedek metadata veya data alani eksik.");
    if (Number(payload.metadata.backupVersion || 0) < 1) throw new Error("Yedek surumu desteklenmiyor.");
    if (payload.metadata.businessId !== currentBusinessId) {
      throw new Error("Bu yedek baska bir business_id icin olusturulmus. Guvenlik nedeniyle yazilmadi.");
    }
    const counts = recordCounts(payload.data);
    return {
      metadata: payload.metadata,
      counts,
      summary: {
        products: counts.products || 0,
        sales: counts.sales || 0,
        expenses: counts.expenses || 0,
        stockMovements: counts.stock_movements || 0,
        creditAccounts: counts.credit_accounts || 0
      }
    };
  }

  async function readBackupFile(file) {
    if (!file) throw new Error("Yedek dosyasi secilmedi.");
    if (!/\.json$/i.test(file.name)) throw new Error("Yalnizca JSON yedek dosyasi yuklenebilir.");
    const text = await file.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("JSON okunamadi veya bozuk.");
    }
    const { businessId } = await window.NexoraDataService.getClientContext();
    return { payload, validation: validateBackup(payload, businessId) };
  }

  function stripGeneratedColumns(row, businessId, table) {
    const cleaned = table === "businesses" ? { ...row, id: businessId } : { ...row, business_id: businessId };
    delete cleaned.created_at;
    delete cleaned.updated_at;
    return cleaned;
  }

  async function deleteCurrentData(client, businessId, report) {
    const deletions = [
      ["sale_items", async () => {
        const sales = await selectAll(client, "sales", businessId);
        const ids = sales.map((sale) => sale.id);
        if (!ids.length) return;
        const { error } = await client.from("sale_items").delete().in("sale_id", ids);
        if (error) throw error;
      }],
      ["credit_transactions", async () => {
        const accounts = await selectAll(client, "credit_accounts", businessId);
        const ids = accounts.map((account) => account.id);
        if (!ids.length) return;
        const { error } = await client.from("credit_transactions").delete().in("credit_account_id", ids);
        if (error) throw error;
      }],
      ...["whatsapp_logs", "day_closings", "waste_records", "expenses", "stock_movements", "sales", "products", "credit_accounts"].map((table) => [table, async () => {
        const { error } = await client.from(table).delete().eq("business_id", businessId);
        if (error) throw error;
      }])
    ];
    for (const [table, action] of deletions) {
      try {
        await action();
        report.tables[table] = { ...(report.tables[table] || {}), deleted: true };
      } catch (error) {
        report.tables[table] = { ...(report.tables[table] || {}), ok: false, error: error.message };
        throw new Error(`${table}: ${error.message}`);
      }
    }
  }

  async function upsertRows(client, table, rows, businessId, report) {
    const safeRows = (rows || []).map((row) => stripGeneratedColumns(row, businessId, table));
    if (!safeRows.length) {
      report.tables[table] = { ok: true, count: 0 };
      return;
    }
    const { error } = await client.from(table).upsert(safeRows);
    if (error) throw error;
    report.tables[table] = { ok: true, count: safeRows.length };
  }

  async function restoreBackup(payload, mode = "merge") {
    const { client, businessId } = await window.NexoraDataService.getClientContext();
    validateBackup(payload, businessId);
    const report = { mode, ok: true, tables: {} };
    if (mode === "replace") {
      await deleteCurrentData(client, businessId, report);
    }

    for (const table of BUSINESS_TABLES) {
      try {
        await upsertRows(client, table, payload.data[table], businessId, report);
      } catch (error) {
        report.ok = false;
        report.tables[table] = { ok: false, error: error.message };
        throw Object.assign(new Error(`${table}: ${error.message}`), { report });
      }
    }

    for (const table of ["sale_items", "credit_transactions"]) {
      const rows = payload.data[table] || [];
      try {
        if (rows.length) {
          const { error } = await client.from(table).upsert(rows.map((row) => {
            const cleaned = { ...row };
            delete cleaned.created_at;
            delete cleaned.updated_at;
            return cleaned;
          }));
          if (error) throw error;
        }
        report.tables[table] = { ok: true, count: rows.length };
      } catch (error) {
        report.ok = false;
        report.tables[table] = { ok: false, error: error.message };
        throw Object.assign(new Error(`${table}: ${error.message}`), { report });
      }
    }

    await window.NexoraDataService.updateBackupMeta({ lastRestoreAt: new Date().toISOString(), lastRestoreMode: mode });
    return report;
  }

  function needsBackupWarning(backupMeta = {}) {
    const last = backupMeta.lastManualBackupAt;
    if (!last) return true;
    return Date.now() - new Date(last).getTime() > 7 * 24 * 60 * 60 * 1000;
  }

  window.NexoraBackupService = {
    TABLES,
    createFullBackup,
    readBackupFile,
    restoreBackup,
    validateBackup,
    needsBackupWarning
  };
})();
