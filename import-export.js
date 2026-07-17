(function () {
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_ROWS = 5000;
  const TEMPLATE_ROWS = [
    ["Normal Durum", "Durumler", "sale", 100, 55, 25, "Adet", 8, "Evet"],
    ["Mega Durum", "Durumler", "sale", 130, 70, 18, "Adet", 8, "Evet"],
    ["Ultra Durum", "Durumler", "sale", 160, 90, 12, "Adet", 6, "Evet"],
    ["Double Durum", "Durumler", "sale", 190, 110, 10, "Adet", 5, "Evet"],
    ["Ayran", "Icecekler", "sale", 30, 18, 40, "Adet", 12, "Evet"],
    ["Kola", "Icecekler", "sale", 45, 28, 32, "Adet", 10, "Evet"],
    ["Su", "Icecekler", "sale", 12, 6, 60, "Adet", 20, "Evet"],
    ["Firik", "Tartili Urunler", "raw", 0, 85, 15, "Kg", 3, "Evet"]
  ];
  const EXPORT_HEADERS = [
    "Urun Adi",
    "Kategori",
    "Urun Turu",
    "Satis Fiyati",
    "Alis Fiyati",
    "Stok",
    "Stok Birimi",
    "Kritik Stok",
    "Aktif",
    "Supabase product id"
  ];
  const HEADER_ALIASES = {
    id: ["id", "product id", "product_id", "supabase product id", "supabase_product_id"],
    name: ["urun adi", "urun adı", "product name", "name", "adi", "ad"],
    category: ["kategori", "category", "group"],
    type: ["urun turu", "urun türü", "product type", "type", "product_type"],
    price: ["satis fiyati", "satış fiyatı", "sale price", "price", "sale_price"],
    purchasePrice: ["alis fiyati", "alış fiyatı", "purchase price", "cost", "purchase_price"],
    stock: ["stok", "stock", "stock quantity", "stock_quantity", "quantity"],
    unit: ["stok birimi", "birim", "unit", "stock_unit"],
    criticalLevel: ["kritik stok", "critical stock", "critical_stock", "critical level"],
    active: ["aktif", "active", "enabled"]
  };

  function normalizeHeader(value) {
    return String(value || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ");
  }

  function parseNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const raw = String(value ?? "").trim();
    if (!raw) return 0;
    const cleaned = raw.replace(/[^\d,.-]/g, "");
    const comma = cleaned.lastIndexOf(",");
    const dot = cleaned.lastIndexOf(".");
    let normalized = cleaned;
    if (comma > -1 && dot > -1) {
      normalized = comma > dot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
    } else if (comma > -1) {
      normalized = cleaned.replace(",", ".");
    }
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function parseBoolean(value) {
    const normalized = normalizeHeader(value);
    if (!normalized) return true;
    return !["hayir", "hayır", "no", "false", "0", "pasif", "inactive"].includes(normalized);
  }

  function productKey(product, mode) {
    if (mode === "id" && product.supabaseId) return String(product.supabaseId);
    if (mode === "categoryUnit") return [product.name, product.category, product.unit].map(normalizeHeader).join("|");
    return [product.name, Number(product.price || 0)].map((value) => normalizeHeader(value)).join("|");
  }

  function mapHeaders(headers) {
    const normalized = headers.map(normalizeHeader);
    return Object.fromEntries(Object.entries(HEADER_ALIASES).map(([field, aliases]) => {
      const index = normalized.findIndex((header) => aliases.map(normalizeHeader).includes(header));
      return [field, index];
    }));
  }

  function rowToProduct(row, map) {
    const get = (field) => map[field] > -1 ? row[map[field]] : "";
    const type = normalizeHeader(get("type")).includes("raw") || normalizeHeader(get("type")).includes("hammadde") ? "raw" : "sale";
    return {
      supabaseId: String(get("id") || "").trim(),
      name: String(get("name") || "").trim(),
      category: String(get("category") || "Genel").trim() || "Genel",
      type,
      price: parseNumber(get("price")),
      purchasePrice: parseNumber(get("purchasePrice")),
      stock: parseNumber(get("stock")),
      initialStock: parseNumber(get("stock")),
      unit: String(get("unit") || (type === "raw" ? "Kg" : "Adet")).trim() || "Adet",
      criticalLevel: parseNumber(get("criticalLevel")),
      active: parseBoolean(get("active")),
      sold: 0,
      recipe: []
    };
  }

  async function readWorkbook(file) {
    if (!file) throw new Error("Dosya secilmedi.");
    if (file.size > MAX_FILE_SIZE) throw new Error("Dosya boyutu 10 MB sinirini asiyor.");
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error("Sadece .xlsx, .xls veya .csv dosyalari desteklenir.");
    if (!window.XLSX) throw new Error("Excel kutuphanesi yuklenemedi. Internet/CDN baglantisini kontrol edin.");
    const buffer = await file.arrayBuffer();
    return window.XLSX.read(buffer, { type: "array" });
  }

  function sheetRows(workbook) {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: "" });
  }

  function buildPreviewFromRows(rows, existingProducts = []) {
    const [headers = [], ...body] = rows.filter((row) => row.some((cell) => String(cell || "").trim()));
    if (!headers.length) throw new Error("Dosyada baslik satiri bulunamadi.");
    if (body.length > MAX_ROWS) throw new Error("En fazla 5000 urun satiri ice aktarilabilir.");
    const map = mapHeaders(headers);
    if (map.name < 0) throw new Error("Urun adi/Product Name/name sutunu zorunludur.");

    const existingById = new Map(existingProducts.filter((p) => p.supabaseId).map((p) => [String(p.supabaseId), p]));
    const existingByCategoryUnit = new Map(existingProducts.map((p) => [productKey(p, "categoryUnit"), p]));
    const existingByNamePrice = new Map(existingProducts.map((p) => [productKey(p, "namePrice"), p]));
    const seen = new Set();
    const items = body.map((row, index) => {
      const product = rowToProduct(row, map);
      const rowNumber = index + 2;
      const errors = [];
      const warnings = [];
      if (!product.name) errors.push("Urun adi bos.");
      if (product.price <= 0 && product.type !== "raw") warnings.push("Satis fiyati 0 veya negatif.");
      let match = product.supabaseId ? existingById.get(product.supabaseId) : null;
      if (!match) match = existingByCategoryUnit.get(productKey(product, "categoryUnit"));
      if (!match) match = existingByNamePrice.get(productKey(product, "namePrice"));
      const duplicateKey = productKey(product, "categoryUnit");
      const duplicateInFile = seen.has(duplicateKey);
      seen.add(duplicateKey);
      const action = errors.length ? "invalid" : match ? "update" : duplicateInFile ? "skip" : "insert";
      return { rowNumber, product, match, action, defaultAction: match ? "update" : action, errors, warnings, duplicateInFile };
    });

    return summarizePreview(items);
  }

  function summarizePreview(items) {
    const counts = items.reduce((acc, item) => {
      acc.total += 1;
      if (item.errors.length) acc.invalid += 1;
      else acc.valid += 1;
      if (item.action === "insert") acc.insert += 1;
      if (item.action === "update") acc.update += 1;
      if (item.action === "skip") acc.skip += 1;
      return acc;
    }, { total: 0, valid: 0, invalid: 0, insert: 0, update: 0, skip: 0 });
    return { items, counts };
  }

  async function previewFile(file, existingProducts) {
    const workbook = await readWorkbook(file);
    return buildPreviewFromRows(sheetRows(workbook), existingProducts);
  }

  function productToExportRow(product) {
    return [
      product.name || "",
      product.category || "Genel",
      product.type || "sale",
      Number(product.price || 0),
      Number(product.purchasePrice || 0),
      Number(product.stock || 0),
      product.unit || "Adet",
      Number(product.criticalLevel || 0),
      product.active === false ? "Hayir" : "Evet",
      product.supabaseId || (/^[0-9a-f-]{36}$/i.test(product.id || "") ? product.id : "")
    ];
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function exportProducts(products, type) {
    const rows = [EXPORT_HEADERS, ...(products || []).map(productToExportRow)];
    if (type === "csv") {
      const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
      downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), `nexora-urunler-${dateStamp()}.csv`);
      return;
    }
    if (!window.XLSX) throw new Error("Excel kutuphanesi yuklenemedi. Internet/CDN baglantisini kontrol edin.");
    const workbook = window.XLSX.utils.book_new();
    const sheet = window.XLSX.utils.aoa_to_sheet(rows);
    window.XLSX.utils.book_append_sheet(workbook, sheet, "Urunler");
    window.XLSX.writeFile(workbook, `nexora-urunler-${dateStamp()}.xlsx`);
  }

  function downloadTemplate() {
    if (!window.XLSX) throw new Error("Excel kutuphanesi yuklenemedi. Internet/CDN baglantisini kontrol edin.");
    const workbook = window.XLSX.utils.book_new();
    const sheet = window.XLSX.utils.aoa_to_sheet([EXPORT_HEADERS.slice(0, 9), ...TEMPLATE_ROWS]);
    window.XLSX.utils.book_append_sheet(workbook, sheet, "Sablon");
    window.XLSX.writeFile(workbook, `nexora-urun-sablonu-${dateStamp()}.xlsx`);
  }

  window.NexoraImportExport = {
    MAX_FILE_SIZE,
    MAX_ROWS,
    previewFile,
    summarizePreview,
    exportProducts,
    downloadTemplate,
    parseNumber
  };
})();
