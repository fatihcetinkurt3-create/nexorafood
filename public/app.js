(function () {
  const storageKey = "nexoraFoodAiOwnerSetup.v1";
  const VERESIYE_STORAGE_KEY = "nexoraVeresiyeCustomers";
  const PRODUCTION_STORAGE_KEY = "nexoraProductionRecords";
  const WASTE_STORAGE_KEY = "nexoraWasteRecords";
  const CASH_CLOSING_STORAGE_KEY = "nexoraCashClosings";
  const fallbackPaymentMethods = ["Nakit", "POS", "Online", "IBAN"];
  const stockUnits = ["Adet", "Koli", "Kg", "Gram", "Litre"];
  const productTypes = [
    { id: "sale", label: "Satış ürünü" },
    { id: "raw", label: "Hammadde" }
  ];
  const rawMaterialDefaults = [
    { name: "Firik", category: "Hammadde", unit: "Kg", purchasePrice: 280, stock: 0, criticalLevel: 1 },
    { name: "Çiğköfte", category: "Hammadde", unit: "Kg", purchasePrice: 0, stock: 0, criticalLevel: 1 }
  ];
  const navItems = [
    { id: "Dashboard", label: "🏠 Dashboard" },
    { id: "Hızlı Satış", label: "⚡ Hızlı Satış (POS)" },
    { id: "Gün Sonu Kasa", label: "Gün Sonu Kasa" },
    { id: "Satis Yap", label: "💰 Satış Yap" },
    { id: "Urunler", label: "📦 Ürünler" },
    { id: "Stok Girişi", label: "📥 Stok Girişi" },
    { id: "Zayiat ve Sayım", label: "Zayiat ve Sayım" },
    { id: "Odemeler", label: "💳 Ödemeler" },
    { id: "Veresiye", label: "Veresiye Defteri" },
    { id: "Raporlar", label: "📊 Raporlar" },
    { id: "WhatsApp Bildirimleri", label: "📱 WhatsApp Bildirimleri" },
    { id: "Giderler", label: "💸 Giderler" },
    { id: "Analiz Merkezi", label: "📈 Analiz Merkezi" },
    { id: "Ayarlar", label: "⚙️ Ayarlar" }
  ];
  const expenseCategories = ["Kira", "Elektrik", "Su", "Personel", "Malzeme", "Diğer"];
  const money = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  });

  const sampleProducts = [
    productSeed("Jelibon", "Atistirmalik", 40, "Adet", 20, 5, 24, "Ana Tedarikci", "Demo urun"),
    productSeed("Kucuk Ayran", "Icecek", 30, "Adet", 18, 8, 20, "Sut Tedarikcisi", ""),
    productSeed("Su 0.5 L", "Icecek", 10, "Adet", 30, 12, 24, "Su Tedarikcisi", ""),
    productSeed("Normal Kofte", "Cigkofte", 100, "Adet", 25, 8, 1, "Merkez Uretim", ""),
    productSeed("Mega Kofte", "Cigkofte", 130, "Adet", 18, 8, 1, "Merkez Uretim", ""),
    productSeed("Duble Kofte", "Cigkofte", 160, "Adet", 12, 6, 1, "Merkez Uretim", "")
  ];

  const state = {
    page: "Dashboard",
    selectedProductId: null,
    quantity: 1,
    paymentMethod: "",
    saleSearch: "",
    saleCategory: "Tumu",
    cart: [],
    posCart: [],
    posDiscount: 0,
    posPaymentMethod: "Nakit",
    posVeresiyeCustomerId: "",
    posSearch: "",
    posCategory: "Tumu",
    posCashReceived: "",
    posCashHandling: "returned",
    whatsappSendingType: "",
    productionWasteBusy: false,
    authMode: "login",
    authLoading: true,
    authSession: null,
    authProfile: null,
    supabaseEnabled: false,
    supabaseError: "",
    authCallbackHandled: false,
    syncStatus: "",
    syncBusy: false,
    productImportPreview: null,
    backupRestoreDraft: null,
    migrationAvailable: false,
    realtimeChannel: null,
    offline: !navigator.onLine,
    toast: "",
    setupProductDrafts: [],
    data: loadData()
  };

  function productSeed(name, category, price, unit, stock, criticalLevel, packageSize, supplier, note) {
    return {
      id: createId(),
      name,
      category,
      price,
      unit,
      stock,
      initialStock: stock,
      criticalLevel,
      packageSize,
      supplier,
      note,
      sold: 0
    };
  }

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

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || typeof saved !== "object") return emptyData();

      const setupCompleted = saved.setupCompleted === true || saved.configured === true;
      return normalizeLoadedData({
        ...emptyData(),
        ...saved,
        configured: setupCompleted,
        setupCompleted,
        categories: Array.isArray(saved.categories) ? saved.categories : [],
        paymentMethods: Array.isArray(saved.paymentMethods) ? saved.paymentMethods : [],
        products: Array.isArray(saved.products) ? saved.products : [],
        sales: Array.isArray(saved.sales) ? saved.sales : [],
        stockMovements: Array.isArray(saved.stockMovements) ? saved.stockMovements : [],
        expenses: Array.isArray(saved.expenses) ? saved.expenses : []
      });
    } catch (error) {
      return emptyData();
    }
  }

  function saveData() {
    localStorage.setItem(storageKey, JSON.stringify(state.data));
    if (state.supabaseEnabled && state.authSession && !state.syncBusy) {
      state.syncStatus = navigator.onLine ? "Senkron bekliyor" : "Çevrimdışı kuyruğa alındı";
      if (navigator.onLine) {
        state.syncBusy = true;
        window.NexoraDataService?.syncAllData(state.data)
          .then(() => {
            state.syncStatus = "Supabase senkronize";
          })
          .catch((error) => {
            console.error("[Supabase] sync failed", error);
            state.syncStatus = `Senkron hatası: ${error.message}`;
            window.NexoraOfflineSync?.enqueue({ type: "sync-all", payload: state.data });
          })
          .finally(() => {
            state.syncBusy = false;
            render();
          });
      } else {
        window.NexoraOfflineSync?.enqueue({ type: "sync-all", payload: state.data });
      }
    }
  }

  function isSetupCompleted() {
    return state.data.setupCompleted === true || state.data.configured === true;
  }

  function render() {
    const isAdmin = window.location.pathname === "/demo/food/admin";
    if (!isAdmin) {
      document.getElementById("app").innerHTML = `<div class="app-shell">${topbar(false)}${landingView()}</div>`;
      bindEvents();
      return;
    }

    if (state.authLoading) {
      document.getElementById("app").innerHTML = `<div class="app-shell">${topbar(true)}<section class="panel auth-panel"><h2>Oturum kontrol ediliyor</h2><p class="muted">Supabase bağlantısı hazırlanıyor...</p></section></div>`;
      return;
    }

    if (state.supabaseEnabled && !state.authSession) {
      document.getElementById("app").innerHTML = `<div class="app-shell">${topbar(true)}${authView()}</div>${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}`;
      bindEvents();
      return;
    }

    document.getElementById("app").innerHTML = `
      <div class="app-shell">
        ${topbar(true)}
        ${supabaseStatusBanner()}
        ${migrationBanner()}
        ${isSetupCompleted() ? adminView() : setupView()}
      </div>
      ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
    `;
    bindDelegatedAppEvents();
    bindEvents();
  }

  function topbar(isAdmin) {
    const title = state.data.businessName || "Nexora Food AI";
    const subtitle = isSetupCompleted()
      ? `${state.data.ownerName || "Isletme sahibi"} icin operasyon paneli`
      : "Kurulum bekleniyor";

    return `
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">N</div>
          <div>
            <p class="eyebrow">Nexora Food AI</p>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
        </div>
        <div class="top-actions">
          ${state.authSession ? `<button class="button" type="button" id="logoutSupabase">Çıkış yap</button>` : ""}
          <a class="button ${isAdmin ? "" : "primary"}" href="/demo/food">Demo</a>
          <a class="button ${isAdmin ? "primary" : ""}" href="/demo/food/admin">Admin Panel</a>
        </div>
      </header>
    `;
  }

  function supabaseStatusBanner() {
    if (!state.supabaseEnabled) {
      return `<section class="panel sync-banner warning"><strong>Yerel mod</strong><span>${escapeHtml(state.supabaseError || "Supabase ayarları bulunamadı. Uygulama mevcut localStorage verisiyle çalışıyor.")}</span></section>`;
    }
    const offlineText = state.offline ? "Çevrimdışı" : "Çevrimiçi";
    const queueCount = window.NexoraOfflineSync?.count?.() || 0;
    return `<section class="panel sync-banner ${state.offline ? "warning" : "success"}"><strong>${offlineText}</strong><span>${escapeHtml(state.syncStatus || "Supabase oturumu aktif.")}${queueCount ? ` | Kuyruk: ${queueCount}` : ""}</span></section>`;
  }

  function migrationBanner() {
    const repairAvailable = Boolean(state.supabaseEnabled && state.authSession && window.NexoraDataService?.hasLegacyData?.());
    if (!state.migrationAvailable && !repairAvailable) return "";
    return `
      <section class="panel sync-banner warning">
        <div>
          <strong>Bu cihazda eski localStorage verileri bulundu.</strong>
          <span>Eksik kalan ürünleri ve operasyon kayıtlarını Supabase hesabına güvenli şekilde aktarabilirsin.</span>
        </div>
        <div class="notification-actions">
          ${state.migrationAvailable ? `<button class="button primary" type="button" id="migrateLocalData">Bu cihazdaki verileri hesabıma aktar</button>` : ""}
          ${repairAvailable ? `<button class="button" type="button" id="repairLocalData">Yerel verileri yeniden tara ve eksikleri aktar</button>` : ""}
        </div>
      </section>
    `;
  }

  function authView() {
    const isRegister = state.authMode === "register";
    const isReset = state.authMode === "reset";
    return `
      <main class="auth-shell">
        <section class="panel auth-panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Çok cihazlı işletme hesabı</p>
              <h2>${isRegister ? "İşletme hesabı oluştur" : isReset ? "Şifremi unuttum" : "Giriş yap"}</h2>
            </div>
          </div>
          <form id="supabaseAuthForm">
            ${isRegister ? `
              <div class="form-grid two">
                ${field("authBusinessName", "İşletme adı", "", "Nexora Çiğköfte")}
                ${field("authOwnerName", "Yetkili adı", "", "Mustafa")}
                ${field("authPhone", "Telefon", "", "05381234567")}
                ${field("authEmail", "E-posta", "", "mail@ornek.com", "email")}
                ${field("authPassword", "Şifre", "", "En az 6 karakter", "password")}
              </div>
            ` : isReset ? `
              ${field("authEmail", "E-posta", "", "mail@ornek.com", "email")}
            ` : `
              <div class="form-grid two">
                ${field("authEmail", "E-posta", "", "mail@ornek.com", "email")}
                ${field("authPassword", "Şifre", "", "Şifre", "password")}
              </div>
            `}
            <div class="modal-actions">
              <button class="button primary" type="submit">${isRegister ? "Hesap oluştur" : isReset ? "Sıfırlama bağlantısı gönder" : "Giriş yap"}</button>
            </div>
          </form>
          <div class="auth-switches">
            <button class="button compact" type="button" data-auth-mode="login">Giriş yap</button>
            <button class="button compact" type="button" data-auth-mode="register">İşletme hesabı oluştur</button>
            <button class="button compact" type="button" data-auth-mode="reset">Şifremi unuttum</button>
          </div>
        </section>
      </main>
    `;
  }

  function landingView() {
    return `
      <main class="hero">
        <section>
          <p class="eyebrow">Sahibinin kurdugu restoran operasyon paneli</p>
          <h1>Nexora Food AI</h1>
          <p>Urunleri, stoklari, odeme yontemlerini ve WhatsApp bildirim numarasini isletme sahibi belirler. Admin panel ilk acilista bos gelir ve kurulumla baslar.</p>
          <div class="top-actions" style="margin-top: 24px;">
            <a class="button primary" href="/demo/food/admin">Kuruluma Basla</a>
          </div>
        </section>
        <aside class="hero-panel">
          <div class="hero-screen">
            <div class="receipt-head">
              <div>
                <p class="eyebrow">Kurulum Durumu</p>
                <div class="receipt-total">${isSetupCompleted() ? "Hazir" : "Bos Sistem"}</div>
              </div>
            </div>
            <div class="hero-products">
              <div><strong>Urunler</strong><span>${state.data.products.length}</span></div>
              <div><strong>Kategoriler</strong><span>${state.data.categories.length}</span></div>
              <div><strong>Odeme Yontemleri</strong><span>${state.data.paymentMethods.length}</span></div>
            </div>
          </div>
        </aside>
      </main>
    `;
  }

  function setupView() {
    const categoriesValue = state.data.categories.join(", ");
    const paymentValue = (state.data.paymentMethods.length ? state.data.paymentMethods : fallbackPaymentMethods).join(", ");
    const products = state.setupProductDrafts;

    return `
      <main class="setup-shell">
        <section class="section-head">
          <div>
            <p class="eyebrow">Ilk giris</p>
            <h2>Kurulum Başlangıcı</h2>
          </div>
        </section>

        <div class="setup-grid">
          <section class="panel">
            <h3>Isletme bilgileri</h3>
            <form id="setupForm">
              <div class="form-grid two">
                ${field("businessName", "Isletme adi", state.data.businessName, "Mustafa Abi Cigkofte")}
                ${field("ownerName", "Isletme sahibi adi", state.data.ownerName, "Mustafa Abi")}
                ${field("whatsappNumber", "WhatsApp bildirim numarasi", state.data.whatsappNumber, "905380381234")}
                ${field("paymentMethods", "Odeme yontemleri", paymentValue, "Nakit, POS, Online, IBAN")}
              </div>
              <div class="field">
                <label for="categories">Urun kategorileri</label>
                <textarea id="categories" rows="3" placeholder="Icecek, Cigkofte, Tatli">${escapeHtml(categoriesValue)}</textarea>
              </div>
            </form>
          </section>

          <section class="panel">
            <h3>Urun ekle</h3>
            ${productForm("setup")}
            <div class="notification-actions">
              <button class="button" id="addSetupProduct" type="button">Urunu Listeye Ekle</button>
              <button class="button" id="loadSampleProducts" type="button">Örnek çiğköfte ürünlerini yükle</button>
            </div>
          </section>
        </div>

        <section class="panel" style="margin-top: 14px;">
          <div class="section-head">
            <div>
              <p class="eyebrow">Kuruluma eklenecek urunler</p>
              <h2>${products.length} urun</h2>
            </div>
            <button class="button primary" id="finishSetup" type="button">Kurulumu Tamamla</button>
          </div>
          ${products.length ? productTable(products, true) : `<div class="empty">Sistem bos gelir. Urunleri buradan ekleyin veya ornek cigkofte listesini yukleyin.</div>`}
        </section>
      </main>
    `;
  }

  function adminView() {
    return `
      <main class="admin-layout">
        <aside class="sidebar">
          <nav class="nav-list">
            ${navItems.map((item) => `<button class="nav-button ${state.page === item.id ? "active" : ""}" data-page="${escapeHtml(item.id)}"><span>${escapeHtml(item.label)}</span><span>&gt;</span></button>`).join("")}
          </nav>
        </aside>
        <section class="content">${pageContent()}</section>
      </main>
    `;
  }

  function pageContent() {
    const summary = getSummary();
    if (state.page === "Dashboard") return dashboard(summary);
    if (state.page === "Hızlı Satış") return quickPosPage();
    if (state.page === "Gün Sonu Kasa") return cashClosingPage();
    if (state.page === "Satis Yap") return salePage();
    if (state.page === "Urunler") return productsPage();
    if (state.page === "Stok Girişi") return stockEntryPage();
    if (state.page === "Zayiat ve Sayım") return productionWastePage();
    if (state.page === "Stoklar") return stocksPage(summary);
    if (state.page === "Giderler") return expensesPage(summary);
    if (state.page === "Odemeler") return paymentsPage(summary);
    if (state.page === "Veresiye") return renderVeresiyePage();
    if (state.page === "Raporlar") return reportsPage(summary);
    if (state.page === "WhatsApp Bildirimleri") return whatsAppPage(summary);
    if (state.page === "Analiz Merkezi") return analyticsPage(summary);
    return settingsPage();
  }

  function dashboard(summary) {
    const veresiyeSummary = getVeresiyeSummary();
    const productionWasteSummary = getProductionWasteSummary();
    const purchaseSummary = getMaterialPurchaseSummary();
    const cigkofteStock = getCigkofteRawMaterial()?.stock || 0;
    const cashClosingToday = getCashClosingByDate(new Date().toISOString().slice(0, 10));
    const cashClosingSummary = calculateDailyCashSummary(new Date().toISOString().slice(0, 10));

    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Canli operasyon ozeti</p>
          <h2>Dashboard</h2>
        </div>
        <button class="button primary" data-page="Satis Yap">Yeni Satis</button>
      </div>
      <div class="grid metrics">
        ${metric("Ürün satış cirosu", money.format(summary.revenue))}
        ${metric("Bahşiş / Bırakılan Para", money.format(summary.tipAmount || 0))}
        ${metric("Gerçek nakit girişi", money.format(summary.realCashIn || 0))}
        ${metric("Verilen para üstü", money.format(summary.changeReturned || 0))}
        ${metric("Toplam gider", money.format(summary.expenseTotal))}
        ${metric("Net kar", money.format(summary.netProfit))}
        ${metric("Toplam satis sayisi", summary.count)}
      </div>
      <div class="grid metrics" style="margin-top: 14px;">
        ${state.data.paymentMethods.map((method) => metric(`${method} toplami`, money.format(summary.payments[method] || 0))).join("")}
      </div>
      <div class="grid metrics" style="margin-top: 14px;">
        ${metric("En cok satan urun", summary.bestSeller ? summary.bestSeller.name : "-")}
        ${metric("Kritik stoklar", `${summary.criticalStocks.length} urun`)}
        <article class="metric dashboard-card clickable-card" id="dashboardVeresiyeCard">
          <span>Toplam Veresiye Alacağı</span>
          <strong>${formatTRY(veresiyeSummary.remainingDebt)}</strong>
        </article>
        ${metric("Bugünkü Mal Girişi", formatStock(purchaseSummary.todayIncomingKg, "Kg"))}
        ${metric("Bu Ay Alınan Çiğköfte", formatStock(purchaseSummary.monthlyCigkofteKg, "Kg"))}
        ${metric("Bu Ay Mal Alış Maliyeti", formatTRY(purchaseSummary.monthlyPurchaseCost))}
        ${metric("Bugünkü zayiat", formatStock(productionWasteSummary.todayWasteKg, "Kg"))}
        ${metric("Mevcut Çiğköfte Stoku", formatStock(cigkofteStock, "Kg"))}
        <article class="metric dashboard-card clickable-card" id="dashboardCashClosingCard"><span>Bugünkü Kasa Durumu</span><strong>${cashClosingToday ? "Gün Sonu Kapatıldı" : "Gün sonu henüz kapatılmadı."}</strong></article>
        ${metric("Beklenen Nakit", formatTRY(cashClosingToday?.expectedCash ?? calculateExpectedCash(cashClosingSummary, { openingCash: getPreviousDayCarryOver(new Date().toISOString().slice(0, 10)) })))}
        ${metric("Son Kasa Farkı", formatTRY(cashClosingToday?.cashDifference || 0))}
      </div>
      <div class="grid dashboard-grid">
        <section class="panel">
          <h3>En cok satan urunler</h3>
          ${summary.topProducts.length ? summary.topProducts.map((product, index) => listRow(`${index + 1}. ${product.name}`, `${product.sold} ${product.unit}`, money.format(product.price))).join("") : empty("Henuz satis yok.")}
        </section>
        <section class="panel">
          <h3>Son satislar</h3>
          ${recentSales(summary.recentSales)}
        </section>
        <section class="panel">
          <h3>Kritik stok uyarilari</h3>
          ${criticalStocks(summary.criticalStocks)}
        </section>
        <section class="panel">
          <h3>WhatsApp bildirimleri</h3>
          <div class="notification-actions">
            ${whatsAppButton("critical-stock", "Kritik Stok Bildirimi Gonder", "button primary")}
            ${whatsAppButton("end-of-day", "Gun Sonu Raporu Gonder", "button")}
          </div>
          <p class="muted">Bildirimler ${escapeHtml(normalizePhone(state.data.whatsappNumber) || "tanimsiz")} numarasina gonderilir.</p>
        </section>
      </div>
    `;
  }

  function salePage() {
    const products = state.data.products.filter(isSaleProduct);
    if (!products.length) {
      return `
        <div class="section-head">
          <div>
            <p class="eyebrow">Hizli satis terminali</p>
            <h2>Satis Yap</h2>
          </div>
          <button class="button primary" data-page="Urunler">Urun Ekle</button>
        </div>
        ${empty("Satis yapabilmek icin once isletme sahibinin urun eklemesi gerekir.")}
      `;
    }

    if (!state.paymentMethod) state.paymentMethod = state.data.paymentMethods[0] || "Nakit";
    const categories = ["Tumu", ...state.data.categories.filter((category) => products.some((product) => product.category === category))];
    const visibleProducts = filteredSaleProducts();
    const total = cartTotal();

    return `
      <div class="section-head" id="sale">
        <div>
          <p class="eyebrow">Sepetli satis terminali</p>
          <h2>Satis Yap</h2>
        </div>
      </div>
      <div class="sale-layout">
        <section class="panel">
          <div class="sale-toolbar">
            <div class="field">
              <label for="saleSearch">Urun ara</label>
              <input id="saleSearch" value="${escapeAttribute(state.saleSearch)}" placeholder="Urun adina gore ara" />
            </div>
            <div class="field">
              <label for="saleCategory">Kategori</label>
              <select id="saleCategory">
                ${categories.map((category) => `<option value="${escapeAttribute(category)}" ${state.saleCategory === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="product-grid sale-products">
            ${visibleProducts.length ? visibleProducts.map(saleProductCard).join("") : empty("Aramaniza uygun urun bulunamadi.")}
          </div>
        </section>
        ${cartPanel(total)}
      </div>
    `;
  }

  function productsPage() {
    const importPreview = state.productImportPreview;
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Isletme sahibinin urunleri</p>
          <h2>Urunler</h2>
        </div>
        <div class="top-actions">
          <input id="productImportFile" type="file" accept=".xlsx,.xls,.csv" hidden />
          <button class="button" id="downloadProductTemplate" type="button">Ornek Sablonu Indir</button>
          <button class="button" id="openProductImport" type="button">Excel / CSV Ice Aktar</button>
          <button class="button" id="exportProductsExcel" type="button">Excel'e Aktar</button>
          <button class="button" id="exportProductsCsv" type="button">CSV'ye Aktar</button>
        </div>
      </div>
      ${importPreview ? productImportPreviewPanel(importPreview) : ""}
      <div class="split">
        <section class="panel">
          <h3>Yeni urun</h3>
          ${productForm("admin")}
          <button class="button primary" id="addAdminProduct" style="width: 100%;">Urun Ekle</button>
        </section>
        <section class="panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">Kayitli urunler</p>
              <h2>${state.data.products.length} urun</h2>
            </div>
            <button class="button" id="loadSampleProductsAdmin">Örnek çiğköfte ürünlerini yükle</button>
          </div>
          ${state.data.products.length ? productTable(state.data.products, false) : empty("Henuz urun eklenmedi.")}
        </section>
      </div>
    `;
  }

  function stockEntryPage() {
    if (!state.data.products.length) {
      return `
        <div class="section-head">
          <div>
            <p class="eyebrow">Stok operasyonu</p>
            <h2>Stok Girişi</h2>
          </div>
          <button class="button primary" data-page="Urunler">Urun Ekle</button>
        </div>
        ${empty("Stok girisi yapabilmek icin once urun ekleyin.")}
      `;
    }

    const selectedProduct = state.data.products[0];
    const defaultPurchasePrice = Number(selectedProduct?.purchasePrice || 0);
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Alim ve stok hareketi</p>
          <h2>Stok Girişi</h2>
        </div>
      </div>
      <div class="split">
        <section class="panel">
          <h3>Yeni stok girisi</h3>
          <form id="stockEntryForm">
            <div class="field">
              <label for="stockProduct">Urun secimi</label>
              <select id="stockProduct">
                ${state.data.products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)} - mevcut: ${formatStock(product.stock, product.unit)}</option>`).join("")}
              </select>
            </div>
            <div class="form-grid two">
              <div class="field">
                <label for="stockEntryType">Giris tipi</label>
                <select id="stockEntryType">
                  ${stockUnits.map((unit) => `<option value="${unit}">${unit}</option>`).join("")}
                </select>
              </div>
              ${field("stockEntryAmount", "Miktar", "", "5", "number")}
              ${field("stockEntryUnitPrice", "Kg alis fiyati", defaultPurchasePrice, "280", "number")}
              ${field("stockEntryCost", "Toplam alis maliyeti", "", "1200", "number")}
              ${field("stockEntrySupplier", "Tedarikci adi", "", "Ana tedarikci")}
              ${field("stockEntryDate", "Tarih", new Date().toISOString().slice(0, 10), "", "date")}
            </div>
            <div class="field">
              <label for="stockEntryNote">Not</label>
              <textarea id="stockEntryNote" rows="3" placeholder="Fatura, teslimat veya kalite notu"></textarea>
            </div>
            <button class="button primary" id="saveStockEntry" type="button" style="width: 100%;">Stoğa Ekle</button>
          </form>
        </section>
        <section class="panel">
          <h3>Son stok hareketleri</h3>
          ${stockMovementsTable(state.data.stockMovements)}
        </section>
      </div>
    `;
  }

  function stocksPage(summary) {
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Stok takibi</p>
          <h2>Stoklar</h2>
        </div>
        <span class="button">${summary.criticalStocks.length} kritik urun</span>
      </div>
      <section class="panel">
        ${state.data.products.length ? state.data.products.map((product) => `
          <div class="stock-row">
            <div>
              <strong>${escapeHtml(product.name)}</strong>
              <div class="muted">${getProductTypeLabel(product)} - ${escapeHtml(product.category)}${isRawMaterial(product) ? ` - kg alış: ${formatTRY(product.purchasePrice || 0)} - değer: ${formatTRY((product.stock || 0) * (product.purchasePrice || 0))}` : ` - koli ici: ${product.packageSize || 0}`}</div>
            </div>
            <div class="${product.stock <= product.criticalLevel ? "danger" : ""}">
              ${formatStock(product.stock, product.unit)}
              <div class="muted">Kritik: ${formatStock(product.criticalLevel, product.unit)}</div>
            </div>
          </div>
        `).join("") : empty("Stok takibi icin urun ekleyin.")}
      </section>
    `;
  }

  function expensesPage() {
    const today = new Date().toISOString().slice(0, 10);
    const paymentMethods = state.data.paymentMethods.length ? state.data.paymentMethods : ["Nakit"];

    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Masraf ve karlilik</p>
          <h2>Giderler</h2>
        </div>
      </div>
      <div class="split">
        <section class="panel">
          <h3>Yeni gider</h3>
          <form id="expenseForm">
            <div class="form-grid two">
              ${field("expenseName", "Gider adi", "", "Haziran kira")}
              <div class="field">
                <label for="expenseCategory">Gider kategorisi</label>
                <select id="expenseCategory">
                  ${expenseCategories.map((category) => `<option value="${escapeAttribute(category)}">${escapeHtml(category)}</option>`).join("")}
                </select>
              </div>
              ${field("expenseAmount", "Tutar", "", "1500", "number")}
              <div class="field">
                <label for="expensePaymentMethod">Odeme yontemi</label>
                <select id="expensePaymentMethod">
                  ${paymentMethods.map((method) => `<option value="${escapeAttribute(method)}">${escapeHtml(method)}</option>`).join("")}
                </select>
              </div>
              ${field("expenseDate", "Tarih", today, "", "date")}
            </div>
            <div class="field">
              <label for="expenseNote">Not</label>
              <textarea id="expenseNote" rows="3" placeholder="Gider notu"></textarea>
            </div>
            <button class="button primary" id="saveExpense" type="button" style="width: 100%;">Gider Ekle</button>
          </form>
        </section>
        <section class="panel">
          <h3>Giderler tablosu</h3>
          ${expensesTable(state.data.expenses)}
        </section>
      </div>
    `;
  }

  function paymentsPage(summary) {
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Odeme yontemleri</p>
          <h2>Odemeler</h2>
        </div>
      </div>
      <div class="grid metrics">
        ${state.data.paymentMethods.map((method) => metric(method, money.format(summary.payments[method] || 0))).join("")}
      </div>
      <section class="panel" style="margin-top: 14px;">
        <h3>Odeme hareketleri</h3>
        ${summary.recentSales.length ? summary.recentSales.map((sale) => listRow(sale.productName, sale.paymentMethod, money.format(sale.total))).join("") : empty("Henuz odeme hareketi yok.")}
      </section>
    `;
  }

  function reportsPage(summary) {
    const productionWasteSummary = getProductionWasteSummary();
    const categoryTotals = state.data.products.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + product.sold * product.price;
      return acc;
    }, {});

    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Raporlar</p>
          <h2>Gun Sonu Ozeti</h2>
        </div>
      </div>
      <div class="grid dashboard-grid">
        <section class="panel">
          <h3>Kategori cirolari</h3>
          ${Object.keys(categoryTotals).length ? Object.entries(categoryTotals).map(([category, total]) => reportRow(category, money.format(total))).join("") : empty("Kategori cirosu icin satis gerekir.")}
        </section>
        <section class="panel">
          <h3>Net kar ozeti</h3>
          ${reportRow("Toplam ciro", money.format(summary.revenue))}
          ${reportRow("Toplam gider", money.format(summary.expenseTotal))}
          ${reportRow("Net kar", money.format(summary.netProfit))}
          ${reportRow("Üretim maliyeti", formatTRY(productionWasteSummary.totalProductionCost))}
          ${reportRow("Zayiat maliyeti", formatTRY(productionWasteSummary.totalWasteCost))}
          ${reportRow("Net operasyon kârı", formatTRY(summary.netProfit - productionWasteSummary.totalWasteCost))}
          ${reportRow("Toplam satis adedi", summary.count)}
          ${reportRow("En cok satan", summary.bestSeller ? summary.bestSeller.name : "-")}
          ${reportRow("Kritik stok adedi", summary.criticalStocks.length)}
        </section>
        <section class="panel">
          <h3>Gunluk gider ozeti</h3>
          ${Object.keys(summary.expenseDailyTotals).length ? Object.entries(summary.expenseDailyTotals).map(([day, total]) => reportRow(day, money.format(total))).join("") : empty("Henuz gider yok.")}
        </section>
        <section class="panel">
          <h3>Gider kategorilerine gore toplamlar</h3>
          ${Object.keys(summary.expenseCategoryTotals).length ? Object.entries(summary.expenseCategoryTotals).map(([category, total]) => reportRow(category, money.format(total))).join("") : empty("Henuz gider kategorisi yok.")}
        </section>
      </div>
    `;
  }

  function whatsAppPage(summary) {
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Gercek veriyle bildirim</p>
          <h2>WhatsApp Bildirimleri</h2>
        </div>
      </div>
      <div class="grid dashboard-grid">
        <section class="panel">
          <h3>Bildirim gonder</h3>
          <div class="notification-actions">
            ${whatsAppButton("critical-stock", "Kritik Stok Bildirimi Gonder", "button primary")}
            ${whatsAppButton("end-of-day", "Gun Sonu Raporu Gonder", "button")}
          </div>
          <p class="muted">Bildirimler ${escapeHtml(normalizePhone(state.data.whatsappNumber) || "tanimsiz")} numarasina gonderilir.</p>
        </section>
        <section class="panel">
          <h3>Gonderilecek veri ozeti</h3>
          ${reportRow("Toplam ciro", money.format(summary.revenue))}
          ${reportRow("Toplam gider", money.format(summary.expenseTotal))}
          ${reportRow("Net kar", money.format(summary.netProfit))}
          ${reportRow("Kritik stok", `${summary.criticalStocks.length} urun`)}
          ${reportRow("Son satis", summary.recentSales[0] ? saleLabel(summary.recentSales[0]) : "-")}
        </section>
      </div>
    `;
  }

  function analyticsPage(summary) {
    const analytics = getAnalyticsData(summary);

    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">LocalStorage verilerinden otomatik analiz</p>
          <h2>Analiz Merkezi</h2>
        </div>
      </div>
      <div class="analysis-grid">
        ${analysisCard("En çok satan 10 ürün", analytics.bestSellers, "sold")}
        ${analysisCard("En az satan 10 ürün", analytics.lowSellers, "sold")}
        ${analysisCard("En çok ciro getiren ürünler", analytics.revenueProducts, "money")}
        ${analysisCard("Kritik stok riski taşıyan ürünler", analytics.stockRiskProducts, "stock")}
        ${analysisCard("Son 7 gün satış özeti", analytics.last7Rows, "summary")}
        ${analysisCard("Son 30 gün satış özeti", analytics.last30Rows, "summary")}
        ${analysisCard("En çok kullanılan ödeme yöntemi", analytics.topPaymentRows, "money")}
        ${analysisCard("En fazla gider oluşturan kategori", analytics.topExpenseRows, "money")}
        ${analysisMetricCard("Günlük ortalama ciro", money.format(analytics.averageDailyRevenue), "Son 30 gün baz alınır")}
        ${analysisMetricCard("Günlük ortalama net kâr", money.format(analytics.averageDailyNetProfit), "Son 30 gün baz alınır")}
      </div>
      <div class="grid dashboard-grid" style="margin-top: 14px;">
        <section class="panel assistant-panel">
          <h3>AI İşletme Asistanı</h3>
          <div class="assistant-list">
            ${analytics.suggestions.map((suggestion) => `<div class="assistant-tip">${escapeHtml(suggestion)}</div>`).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function settingsPage() {
    const backupMeta = state.data.backupMeta || {};
    const needsBackup = window.NexoraBackupService?.needsBackupWarning?.(backupMeta);
    const restoreDraft = state.backupRestoreDraft;
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Kurulum bilgileri</p>
          <h2>Ayarlar</h2>
        </div>
      </div>
      <section class="panel">
        <form id="settingsForm">
          <div class="form-grid two">
            ${field("businessName", "Isletme adi", state.data.businessName, "")}
            ${field("ownerName", "Isletme sahibi adi", state.data.ownerName, "")}
            ${field("whatsappNumber", "WhatsApp bildirim numarasi", state.data.whatsappNumber, "")}
            ${field("paymentMethods", "Odeme yontemleri", state.data.paymentMethods.join(", "), "")}
          </div>
          <div class="field">
            <label for="categories">Urun kategorileri</label>
            <textarea id="categories" rows="3">${escapeHtml(state.data.categories.join(", "))}</textarea>
          </div>
          <div class="notification-actions">
            <button class="button primary" id="saveSettings" type="button">Ayarlari Kaydet</button>
            <button class="button" id="resetSetup" type="button">Kurulumu Sıfırla</button>
          </div>
        </form>
      </section>
      <section class="panel backup-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Yedekleme</p>
            <h2>Tam Yedek</h2>
          </div>
          <div class="top-actions">
            <input id="restoreBackupFile" type="file" accept=".json" hidden />
            <button class="button" id="downloadFullBackup" type="button">Tam Yedek Indir</button>
            <button class="button" id="openRestoreBackup" type="button">Yedegi Geri Yukle</button>
          </div>
        </div>
        ${needsBackup ? `<div class="sync-banner warning"><strong>Yedek onerisi</strong><span>Son 7 gun icinde manuel yedek alinmamis. Otomatik indirme baslatilmaz.</span></div>` : `<div class="sync-banner success"><strong>Yedek guncel</strong><span>Son yedek: ${escapeHtml(new Date(backupMeta.lastManualBackupAt).toLocaleString("tr-TR"))}</span></div>`}
        ${restoreDraft ? backupRestorePreviewPanel(restoreDraft) : ""}
      </section>
    `;
  }

  function productImportPreviewPanel(preview) {
    const rows = preview.items.slice(0, 25).map((item) => `
      <tr class="${item.errors.length ? "danger-row" : ""}">
        <td>${item.rowNumber}</td>
        <td>${escapeHtml(item.product.name || "-")}</td>
        <td>${escapeHtml(item.product.category || "Genel")}</td>
        <td>${formatTRY(item.product.price || 0)}</td>
        <td>${item.errors.length ? escapeHtml(item.errors.join(", ")) : escapeHtml(item.warnings.join(", ") || "Hazir")}</td>
        <td>
          ${item.match && !item.errors.length ? `
            <select data-import-action="${item.rowNumber}">
              <option value="update" ${item.action === "update" ? "selected" : ""}>Mevcut urunu guncelle</option>
              <option value="skip" ${item.action === "skip" ? "selected" : ""}>Atla</option>
              <option value="insert" ${item.action === "insert" ? "selected" : ""}>Yeni urun olarak ekle</option>
            </select>
          ` : escapeHtml(item.action)}
        </td>
      </tr>
    `).join("");
    return `
      <section class="panel import-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Ice aktarma onizleme</p>
            <h2>${preview.counts.total} satir</h2>
          </div>
          <div class="top-actions">
            <button class="button primary" id="confirmProductImport" type="button">Onayla ve Supabase'e Yaz</button>
            <button class="button" id="cancelProductImport" type="button">Vazgec</button>
          </div>
        </div>
        <div class="grid metrics">
          ${metric("Toplam satir", String(preview.counts.total))}
          ${metric("Gecerli kayit", String(preview.counts.valid))}
          ${metric("Hatali kayit", String(preview.counts.invalid))}
          ${metric("Yeni eklenecek", String(preview.counts.insert))}
          ${metric("Guncellenecek", String(preview.counts.update))}
          ${metric("Atlanacak duplicate", String(preview.counts.skip))}
        </div>
        <div class="table-wrap import-table">
          <table>
            <thead><tr><th>Satir</th><th>Urun</th><th>Kategori</th><th>Fiyat</th><th>Durum</th><th>Islem</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function backupRestorePreviewPanel(draft) {
    const summary = draft.validation.summary;
    return `
      <div class="backup-restore-preview">
        <div class="grid metrics">
          ${metric("Urun", String(summary.products))}
          ${metric("Satis", String(summary.sales))}
          ${metric("Gider", String(summary.expenses))}
          ${metric("Stok hareketi", String(summary.stockMovements))}
          ${metric("Veresiye kaydi", String(summary.creditAccounts))}
        </div>
        <div class="top-actions">
          <button class="button primary" id="restoreBackupMerge" type="button">Mevcut verilerle birlestir</button>
          <button class="button danger-button" id="restoreBackupReplace" type="button">Mevcut verileri silip yedegi yukle</button>
          <button class="button" id="cancelBackupRestore" type="button">Vazgec</button>
        </div>
      </div>
    `;
  }

  function productForm(prefix) {
    const categoryOptions = state.data.categories.length ? state.data.categories : ["Genel"];
    return `
      <form id="${prefix}ProductForm">
        <div class="form-grid two">
          ${field(`${prefix}ProductName`, "Urun adi", "", "Normal Kofte")}
          <div class="field">
            <label for="${prefix}ProductType">Urun tipi</label>
            <select id="${prefix}ProductType">
              ${productTypes.map((type) => `<option value="${type.id}">${escapeHtml(type.label)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="${prefix}Category">Kategori</label>
            <input id="${prefix}Category" list="${prefix}CategoryList" value="${escapeAttribute(categoryOptions[0] || "Genel")}" placeholder="Icecek" />
            <datalist id="${prefix}CategoryList">
              ${categoryOptions.map((category) => `<option value="${escapeHtml(category)}"></option>`).join("")}
            </datalist>
          </div>
          ${field(`${prefix}Price`, "Satis fiyati", "", "100", "number")}
          <div class="field">
            <label for="${prefix}Unit">Stok birimi</label>
            <select id="${prefix}Unit">
              ${stockUnits.map((unit) => `<option value="${unit}">${unit}</option>`).join("")}
            </select>
          </div>
          ${field(`${prefix}Stock`, "Baslangic stogu", "", "20", "number")}
          ${field(`${prefix}Critical`, "Kritik stok seviyesi", "", "5", "number")}
          ${field(`${prefix}PurchasePrice`, "Kg alis fiyati", "", "280", "number")}
          ${field(`${prefix}PackageSize`, "Koli ici adet", "", "24", "number")}
          ${field(`${prefix}Supplier`, "Tedarikci adi", "", "Ana tedarikci")}
        </div>
        <div class="field">
          <label for="${prefix}Recipe">Recete</label>
          <textarea id="${prefix}Recipe" rows="4" placeholder="Firik: 40 gram&#10;Çiğköfte: 120 gram"></textarea>
        </div>
        <div class="field">
          <label for="${prefix}Note">Not</label>
          <textarea id="${prefix}Note" rows="3" placeholder="Urun notu"></textarea>
        </div>
      </form>
    `;
  }

  function field(id, label, value, placeholder, type = "text") {
    return `
      <div class="field">
        <label for="${id}">${escapeHtml(label)}</label>
        <input id="${id}" type="${type}" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" />
      </div>
    `;
  }

  function getSummary() {
    const payments = state.data.paymentMethods.reduce((acc, method) => {
      acc[method] = 0;
      return acc;
    }, {});

    const totals = state.data.sales.reduce(
      (acc, sale) => {
        const total = parseMoneyValue(sale.total);
        const tipAmount = parseMoneyValue(sale.tipAmount);
        const changeReturned = parseMoneyValue(sale.changeReturned);
        acc.revenue += total;
        acc.count += Number(sale.quantity || 0);
        acc.tipAmount += tipAmount;
        acc.changeReturned += changeReturned;
        if (normalizePaymentMethod(sale.paymentMethod) === "cash") {
          acc.realCashIn += total + tipAmount;
        }
        acc.payments[sale.paymentMethod] = (acc.payments[sale.paymentMethod] || 0) + total;
        return acc;
      },
      { revenue: 0, count: 0, tipAmount: 0, changeReturned: 0, realCashIn: 0, payments }
    );

    const soldProducts = [...state.data.products].filter((product) => product.sold > 0).sort((a, b) => b.sold - a.sold);
    const expenseTotal = state.data.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const expenseCategoryTotals = state.data.expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0);
      return acc;
    }, {});
    const expenseDailyTotals = state.data.expenses.reduce((acc, expense) => {
      const day = expense.date || "Tarihsiz";
      acc[day] = (acc[day] || 0) + Number(expense.amount || 0);
      return acc;
    }, {});

    return {
      ...totals,
      expenseTotal,
      netProfit: totals.revenue - expenseTotal,
      expenseCategoryTotals,
      expenseDailyTotals,
      bestSeller: soldProducts[0] || null,
      criticalStocks: state.data.products.filter((product) => Number(product.stock) <= Number(product.criticalLevel)),
      recentSales: [...state.data.sales].slice(-7).reverse(),
      topProducts: soldProducts.slice(0, 7)
    };
  }

  function filteredSaleProducts() {
    const query = state.saleSearch.trim().toLocaleLowerCase("tr-TR");
    return state.data.products.filter((product) => {
      const matchesName = !query || product.name.toLocaleLowerCase("tr-TR").includes(query);
      const matchesCategory = state.saleCategory === "Tumu" || product.category === state.saleCategory;
      return isSaleProduct(product) && matchesName && matchesCategory;
    });
  }

  function refreshSaleProductGrid() {
    const grid = document.querySelector(".sale-products");
    if (!grid) return;
    const products = filteredSaleProducts();
    grid.innerHTML = products.length ? products.map(saleProductCard).join("") : empty("Aramaniza uygun urun bulunamadi.");
    grid.querySelectorAll("[data-cart-add]").forEach((button) => {
      button.addEventListener("click", () => addToCart(button.dataset.cartAdd));
    });
  }

  function cartQuantity(productId) {
    const item = state.cart.find((entry) => entry.productId === productId);
    return item ? item.quantity : 0;
  }

  function cartTotal() {
    return state.cart.reduce((total, item) => {
      const product = state.data.products.find((entry) => entry.id === item.productId);
      return total + (product ? saleLineTotal(product, item.quantity) : 0);
    }, 0);
  }

  function metric(label, value) {
    return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  }

  function analysisMetricCard(title, value, note) {
    return `
      <section class="analysis-card">
        <div class="analysis-card-head">
          <h3>${escapeHtml(title)}</h3>
        </div>
        <strong class="analysis-value">${escapeHtml(value)}</strong>
        <p class="muted">${escapeHtml(note)}</p>
      </section>
    `;
  }

  function analysisCard(title, rows, type) {
    return `
      <section class="analysis-card">
        <div class="analysis-card-head">
          <h3>${escapeHtml(title)}</h3>
          <span>${rows.length}</span>
        </div>
        <div class="analysis-list">
          ${rows.length ? rows.map((row, index) => analysisRow(row, index, type)).join("") : empty("Analiz icin yeterli veri yok.")}
        </div>
      </section>
    `;
  }

  function analysisRow(row, index, type) {
    const width = Math.max(8, Math.min(100, Number(row.percent || 0)));
    const value = type === "money"
      ? money.format(row.value || 0)
      : type === "stock"
        ? `${row.value} / ${row.limit}`
        : type === "summary"
          ? `${money.format(row.revenue || 0)} - ${row.count || 0} satis`
          : `${row.value || 0}`;

    return `
      <div class="analysis-row">
        <div class="analysis-row-top">
          <span>${index + 1}. ${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
        <div class="analysis-bar"><span style="width:${width}%"></span></div>
      </div>
    `;
  }

  function getAnalyticsData(summary) {
    const productStats = state.data.products.map((product) => ({
      id: product.id,
      label: product.name,
      unit: product.unit,
      sold: Number(product.sold || 0),
      revenue: productRevenue(product.id),
      stock: Number(product.stock || 0),
      criticalLevel: Number(product.criticalLevel || 0)
    }));
    const maxSold = Math.max(1, ...productStats.map((item) => item.sold));
    const maxRevenue = Math.max(1, ...productStats.map((item) => item.revenue));
    const bestSellers = [...productStats]
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 10)
      .map((item) => ({ label: item.label, value: `${item.sold} ${item.unit}`, percent: (item.sold / maxSold) * 100 }));
    const lowSellers = [...productStats]
      .sort((a, b) => a.sold - b.sold || a.label.localeCompare(b.label, "tr"))
      .slice(0, 10)
      .map((item) => ({ label: item.label, value: `${item.sold} ${item.unit}`, percent: (item.sold / maxSold) * 100 }));
    const revenueProducts = [...productStats]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((item) => ({ label: item.label, value: item.revenue, percent: (item.revenue / maxRevenue) * 100 }));
    const stockRiskProducts = [...productStats]
      .filter((item) => item.criticalLevel > 0 && item.stock <= item.criticalLevel * 1.5)
      .sort((a, b) => (a.stock / Math.max(a.criticalLevel, 1)) - (b.stock / Math.max(b.criticalLevel, 1)))
      .slice(0, 10)
      .map((item) => ({
        label: item.label,
        value: `${item.stock} ${item.unit}`,
        limit: `${item.criticalLevel} ${item.unit}`,
        percent: Math.max(8, Math.min(100, (item.stock / Math.max(item.criticalLevel * 1.5, 1)) * 100))
      }));
    const last7 = summarizePeriod(7);
    const last30 = summarizePeriod(30);
    const topPaymentRows = paymentAnalysisRows(summary);
    const topExpenseRows = expenseAnalysisRows(summary);
    const suggestions = buildAssistantSuggestions({
      summary,
      bestSellers,
      revenueProducts,
      stockRiskProducts,
      topPaymentRows,
      topExpenseRows,
      last30
    });

    return {
      bestSellers,
      lowSellers,
      revenueProducts,
      stockRiskProducts,
      last7Rows: last7.rows,
      last30Rows: last30.rows,
      topPaymentRows,
      topExpenseRows,
      averageDailyRevenue: last30.averageRevenue,
      averageDailyNetProfit: last30.averageNetProfit,
      suggestions
    };
  }

  function productRevenue(productId) {
    return state.data.sales.reduce((total, sale) => {
      if (Array.isArray(sale.items)) {
        return total + sale.items.filter((item) => item.productId === productId).reduce((sum, item) => sum + Number(item.total || 0), 0);
      }

      return total + (sale.productId === productId ? Number(sale.total || 0) : 0);
    }, 0);
  }

  function summarizePeriod(days) {
    const labels = lastDateKeys(days);
    const salesByDay = labels.reduce((acc, day) => ({ ...acc, [day]: { revenue: 0, count: 0 } }), {});
    const expensesByDay = labels.reduce((acc, day) => ({ ...acc, [day]: 0 }), {});
    state.data.sales.forEach((sale) => {
      const key = recordDateKey(sale);
      if (!salesByDay[key]) return;
      salesByDay[key].revenue += Number(sale.total || 0);
      salesByDay[key].count += Number(sale.quantity || 0);
    });
    state.data.expenses.forEach((expense) => {
      const key = recordDateKey(expense);
      if (!expensesByDay[key]) return;
      expensesByDay[key] += Number(expense.amount || 0);
    });
    const maxRevenue = Math.max(1, ...labels.map((day) => salesByDay[day].revenue));
    const rows = labels.slice(-Math.min(days, 10)).reverse().map((day) => ({
      label: day,
      revenue: salesByDay[day].revenue,
      count: salesByDay[day].count,
      percent: (salesByDay[day].revenue / maxRevenue) * 100
    }));
    const revenue = labels.reduce((sum, day) => sum + salesByDay[day].revenue, 0);
    const expenses = labels.reduce((sum, day) => sum + expensesByDay[day], 0);

    return {
      rows,
      averageRevenue: revenue / days,
      averageNetProfit: (revenue - expenses) / days
    };
  }

  function paymentAnalysisRows(summary) {
    const entries = Object.entries(summary.payments).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map((entry) => entry[1]));
    return entries.map(([label, value]) => ({ label, value, percent: (value / max) * 100 }));
  }

  function expenseAnalysisRows(summary) {
    const entries = Object.entries(summary.expenseCategoryTotals).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map((entry) => entry[1]));
    return entries.map(([label, value]) => ({ label, value, percent: (value / max) * 100 }));
  }

  function buildAssistantSuggestions(data) {
    const suggestions = [];
    const bestProduct = data.bestSellers[0];
    const topExpense = data.topExpenseRows[0];
    const topPayment = data.topPaymentRows[0];
    const topRevenue = data.revenueProducts[0];

    if (bestProduct && bestProduct.value !== "0") {
      suggestions.push(`${bestProduct.label} en cok satan urunlerden biri. Stok artirilmasi onerilir.`);
    }
    if (topExpense && data.summary.expenseTotal > 0) {
      const percent = Math.round((topExpense.value / data.summary.expenseTotal) * 100);
      suggestions.push(`${topExpense.label} giderleri toplam giderlerin %${percent}'ini olusturuyor.`);
    }
    if (topPayment && data.summary.revenue > 0) {
      const percent = Math.round((topPayment.value / data.summary.revenue) * 100);
      suggestions.push(`${topPayment.label} odemeleri toplam satislarin %${percent}'ini olusturuyor.`);
    }
    if (topRevenue && topRevenue.value > 0) {
      suggestions.push(`Son 30 gun verisinde ${topRevenue.label} en yuksek ciro saglayan urunlerden biri.`);
    }
    if (data.stockRiskProducts.length) {
      suggestions.push("Kritik stokta bulunan urunler icin yeni siparis verilmesi onerilir.");
    }
    if (!suggestions.length) {
      suggestions.push("Analiz uretmek icin satis, gider ve stok verisi ekleyin.");
    }

    return suggestions;
  }

  function productCard(product) {
    const active = product.id === state.selectedProductId ? "active" : "";
    return `
      <button class="product-card ${active}" data-product="${product.id}">
        <h4>${escapeHtml(product.name)}</h4>
        <p>${escapeHtml(product.category)} - ${escapeHtml(product.unit)}</p>
        <div class="price">${money.format(product.price)}</div>
      </button>
    `;
  }

  function saleProductCard(product) {
    const inCart = cartQuantity(product.id);
    const available = calculateAvailableRecipeQuantity(product);
    const disabled = available <= inCart ? "disabled" : "";
    const recipeCost = calculateRecipeCost(product);
    const grossProfit = Number(product.price || 0) - recipeCost;
    return `
      <button class="product-card sale-product-card" data-cart-add="${product.id}" type="button" ${disabled}>
        <h4>${escapeHtml(product.name)}</h4>
        <p>${escapeHtml(product.category)} - ${escapeHtml(product.unit)}</p>
        <div class="product-card-meta">
          <span class="price">${money.format(product.price)}</span>
          <span class="${available <= product.criticalLevel ? "danger" : "muted"}">Stok: ${formatStock(available, product.unit)}</span>
        </div>
        ${Array.isArray(product.recipe) && product.recipe.length ? `<p class="muted">Maliyet: ${formatTRY(recipeCost)} | Brüt kâr: ${formatTRY(grossProfit)}</p>` : ""}
      </button>
    `;
  }

  function cartPanel(total) {
    return `
      <aside class="panel cart-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Sepet</p>
            <h2>${state.cart.length} urun</h2>
          </div>
        </div>
        <div class="cart-list">
          ${state.cart.length ? state.cart.map(cartRow).join("") : empty("Urun kartina tiklayarak sepete ekleyin.")}
        </div>
        <div class="field">
          <label>Odeme yontemi</label>
          <div class="payment-grid">
            ${state.data.paymentMethods.map((method) => `<button class="payment-option ${state.paymentMethod === method ? "active" : ""}" data-payment="${escapeHtml(method)}" type="button">${escapeHtml(method)}</button>`).join("")}
          </div>
        </div>
        <div class="sale-summary">
          <div class="summary-line"><span>Toplam tutar</span><strong class="price">${money.format(total)}</strong></div>
        </div>
        <button class="button primary" style="width: 100%;" id="saveSale" type="button" ${state.cart.length ? "" : "disabled"}>Satışı Kaydet</button>
      </aside>
    `;
  }

  function cartRow(item) {
    const product = state.data.products.find((entry) => entry.id === item.productId);
    if (!product) return "";
    return `
      <div class="cart-row">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <div class="muted">${money.format(product.price)} - Stok: ${formatStock(calculateAvailableRecipeQuantity(product), product.unit)}</div>
        </div>
        ${String(product.unit).toLowerCase() === "kg" ? `
          <input class="cart-quantity-input" data-cart-quantity="${product.id}" type="number" min="0.001" step="0.001" value="${item.quantity}" />
        ` : `
          <div class="cart-stepper">
            <button class="button icon-button" type="button" data-cart-decrease="${product.id}">-</button>
            <strong>${item.quantity}</strong>
            <button class="button icon-button" type="button" data-cart-increase="${product.id}">+</button>
          </div>
        `}
      </div>
    `;
  }

  function productTable(products, isSetup) {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Urun</th><th>Tip</th><th>Kategori</th><th>Fiyat</th><th>Birim</th><th>Stok</th><th>Kritik</th><th>Maliyet</th><th>Tedarikci</th><th></th></tr>
          </thead>
          <tbody>
            ${products.map((product) => `
              <tr>
                <td>${escapeHtml(product.name)}</td>
                <td>${getProductTypeLabel(product)}</td>
                <td>${escapeHtml(product.category)}</td>
                <td>${money.format(product.price)}</td>
                <td>${escapeHtml(product.unit)}</td>
                <td>${formatStock(product.stock, product.unit)}</td>
                <td>${formatStock(product.criticalLevel, product.unit)}</td>
                <td>${isRawMaterial(product) ? `${formatTRY(product.purchasePrice || 0)}/kg` : formatTRY(calculateRecipeCost(product))}</td>
                <td>${escapeHtml(product.supplier || "-")}</td>
                <td><button class="button" data-remove-${isSetup ? "setup" : "product"}="${product.id}">Sil</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function stockMovementsTable(movements) {
    if (!movements.length) return empty("Henuz stok hareketi yok.");

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tarih/saat</th>
              <th>Urun adi</th>
              <th>Giris tipi</th>
              <th>Miktar</th>
              <th>Stoga eklenen miktar</th>
              <th>Kg alis fiyati</th>
              <th>Alis maliyeti</th>
              <th>Tedarikci</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            ${[...movements].reverse().map((movement) => `
              <tr>
                <td>${escapeHtml(movement.dateTime)}</td>
                <td>${escapeHtml(movement.productName)}</td>
                <td>${escapeHtml(movement.entryType)}</td>
                <td>${movement.amount}</td>
                <td>${formatStock(movement.addedQuantity, movement.addedUnit || "Adet")}</td>
                <td>${movement.unitPrice ? formatTRY(movement.unitPrice) : "-"}</td>
                <td>${money.format(movement.cost || 0)}</td>
                <td>${escapeHtml(movement.supplier || "-")}</td>
                <td>${escapeHtml(movement.note || "-")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function expensesTable(expenses) {
    if (!expenses.length) return empty("Henuz gider eklenmedi.");

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Gider adi</th>
              <th>Kategori</th>
              <th>Tutar</th>
              <th>Odeme yontemi</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            ${[...expenses].reverse().map((expense) => `
              <tr>
                <td>${escapeHtml(expense.date)}</td>
                <td>${escapeHtml(expense.name)}</td>
                <td>${escapeHtml(expense.category)}</td>
                <td>${money.format(expense.amount || 0)}</td>
                <td>${escapeHtml(expense.paymentMethod || "-")}</td>
                <td>${escapeHtml(expense.note || "-")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function listRow(left, middle, right) {
    return `<div class="list-row"><strong>${escapeHtml(left)}</strong><span class="muted">${escapeHtml(middle)}</span><span>${escapeHtml(right)}</span></div>`;
  }

  function reportRow(left, right) {
    return `<div class="report-row"><span>${escapeHtml(left)}</span><strong>${escapeHtml(String(right))}</strong></div>`;
  }

  function recentSales(sales) {
    if (!sales.length) return empty("Henuz satis yok.");
    return sales.map((sale) => `
      <div class="sale-item">
        <div class="summary-line">
          <div><strong>${escapeHtml(sale.productName)}</strong><div class="muted">${sale.quantity} ${escapeHtml(sale.unit)} - ${escapeHtml(sale.paymentMethod)} - ${escapeHtml(sale.time)}</div></div>
          <strong>${money.format(sale.total)}</strong>
        </div>
      </div>
    `).join("");
  }

  function criticalStocks(items) {
    if (!items.length) return empty("Kritik stok bulunmuyor.");
    return items.map((product) => `
      <div class="alert-row">
        <div class="summary-line">
          <div><strong>${escapeHtml(product.name)}</strong><div class="muted">Esik: ${product.criticalLevel} ${escapeHtml(product.unit)}</div></div>
          <strong class="danger">${product.stock} ${escapeHtml(product.unit)}</strong>
        </div>
      </div>
    `).join("");
  }

  function whatsAppButton(type, label, className) {
    const isSending = state.whatsappSendingType === type;
    const action = type === "critical-stock" ? "send-critical-stock-whatsapp" : "send-end-of-day-whatsapp";
    return `<button class="${className}" data-action="${escapeAttribute(action)}" type="button" ${isSending ? "disabled" : ""}>${isSending ? "Gönderiliyor..." : escapeHtml(label)}</button>`;
  }

  function empty(message) {
    return `<div class="empty">${escapeHtml(message)}</div>`;
  }

  function roundStock(value) {
    const number = Number(value) || 0;
    return Math.round(number * 1000) / 1000;
  }

  function formatStock(value, unit) {
    const amount = roundStock(value);
    if (String(unit).toLowerCase() === "kg") {
      return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
    }

    return `${Number.isInteger(amount) ? amount : amount.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ${escapeHtml(unit || "Adet")}`;
  }

  function isRawMaterial(product) {
    return product?.type === "raw";
  }

  function isSaleProduct(product) {
    return !isRawMaterial(product);
  }

  function normalizeProduct(product) {
    const name = String(product?.name || "");
    const defaultRaw = rawMaterialDefaults.find((item) => item.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"));
    const type = product?.type === "raw" || product?.type === "hammadde" ? "raw" : "sale";
    const unit = type === "raw" ? "Kg" : (product?.unit || "Adet");
    const purchasePrice = Number(product?.purchasePrice ?? product?.costPerKg ?? defaultRaw?.purchasePrice ?? 0) || 0;

    return {
      ...product,
      id: product?.id || createId(),
      name,
      category: product?.category || (type === "raw" ? "Hammadde" : "Genel"),
      type,
      price: Number(product?.price || 0),
      unit,
      stock: roundStock(product?.stock || 0),
      initialStock: roundStock(product?.initialStock ?? product?.stock ?? 0),
      criticalLevel: roundStock(product?.criticalLevel || 0),
      purchasePrice,
      packageSize: Number(product?.packageSize || 0),
      supplier: product?.supplier || "",
      note: product?.note || "",
      sold: roundStock(product?.sold || 0),
      recipe: Array.isArray(product?.recipe)
        ? product.recipe
            .filter((item) => item && item.materialId && Number(item.amount) > 0)
            .map((item) => ({
              materialId: item.materialId,
              amount: Number(item.amount) || 0,
              unit: String(item.unit || "gram").toLowerCase() === "kilogram" || String(item.unit || "").toLowerCase() === "kg" ? "kilogram" : "gram"
            }))
        : []
    };
  }

  function ensureDefaultRawMaterials(data) {
    rawMaterialDefaults.forEach((raw) => {
      const exists = data.products.some((product) => product.type === "raw" && product.name.toLocaleLowerCase("tr-TR") === raw.name.toLocaleLowerCase("tr-TR"));
      if (!exists) {
        data.products.push(normalizeProduct({
          id: createId(),
          name: raw.name,
          category: raw.category,
          type: "raw",
          price: 0,
          unit: raw.unit,
          stock: raw.stock,
          initialStock: raw.stock,
          criticalLevel: raw.criticalLevel,
          purchasePrice: raw.purchasePrice,
          packageSize: 0,
          supplier: "",
          note: "",
          sold: 0,
          recipe: []
        }));
      }
    });
  }

  function normalizeLoadedData(data) {
    const normalized = {
      ...emptyData(),
      ...data,
      products: Array.isArray(data.products) ? data.products.map(normalizeProduct) : [],
      sales: Array.isArray(data.sales) ? data.sales : [],
      stockMovements: Array.isArray(data.stockMovements) ? data.stockMovements : [],
      expenses: Array.isArray(data.expenses) ? data.expenses : []
    };

    if (normalized.setupCompleted || normalized.configured) {
      ensureDefaultRawMaterials(normalized);
    }

    return normalized;
  }

  function recipeAmountToKg(amount, unit) {
    const value = Number(amount) || 0;
    const normalizedUnit = String(unit || "gram").toLowerCase();
    return roundStock(normalizedUnit === "kilogram" || normalizedUnit === "kg" ? value : value / 1000);
  }

  function findProductById(productId) {
    return state.data.products.find((product) => product.id === productId);
  }

  function parseRecipeInput(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(.+?)\s*[:,-]\s*([\d.,]+)\s*(gram|gr|g|kilogram|kg)?$/i);
        if (!match) return null;

        const materialName = match[1].trim().toLocaleLowerCase("tr-TR");
        const material = state.data.products.find((product) => product.type === "raw" && product.name.toLocaleLowerCase("tr-TR") === materialName);
        if (!material) return null;

        return {
          materialId: material.id,
          amount: parseMoneyValue(match[2]),
          unit: /kg|kilogram/i.test(match[3] || "") ? "kilogram" : "gram"
        };
      })
      .filter((item) => item && item.amount > 0);
  }

  function calculateRecipeCost(product, quantity = 1) {
    const recipe = Array.isArray(product?.recipe) ? product.recipe : [];
    return recipe.reduce((total, item) => {
      const material = findProductById(item.materialId);
      const amountKg = recipeAmountToKg(item.amount, item.unit) * Number(quantity || 1);
      return total + amountKg * (Number(material?.purchasePrice) || 0);
    }, 0);
  }

  function calculateRecipeUsage(items) {
    const usageMap = new Map();

    items.forEach(({ cartItem, product }) => {
      if (!product || !Array.isArray(product.recipe) || !product.recipe.length) return;

      product.recipe.forEach((recipeItem) => {
        const amountKg = roundStock(recipeAmountToKg(recipeItem.amount, recipeItem.unit) * Number(cartItem.quantity || 0));
        const current = usageMap.get(recipeItem.materialId) || 0;
        usageMap.set(recipeItem.materialId, roundStock(current + amountKg));
      });
    });

    return usageMap;
  }

  function validateRecipeStock(usageMap) {
    const missing = [];

    usageMap.forEach((amountKg, materialId) => {
      const material = findProductById(materialId);
      if (!material || roundStock(material.stock) < amountKg) {
        missing.push(`${material ? material.name : "Hammadde"} eksik: gerekli ${formatStock(amountKg, "Kg")}, mevcut ${formatStock(material?.stock || 0, "Kg")}`);
      }
    });

    return missing;
  }

  function calculateAvailableRecipeQuantity(product) {
    const recipe = Array.isArray(product?.recipe) ? product.recipe : [];
    if (!recipe.length) return Number(product?.stock || 0);

    const limits = recipe.map((item) => {
      const material = findProductById(item.materialId);
      const perUnitKg = recipeAmountToKg(item.amount, item.unit);
      if (!material || perUnitKg <= 0) return 0;
      return Math.floor((roundStock(material.stock) / perUnitKg) * 1000) / 1000;
    });

    return limits.length ? Math.max(0, Math.min(...limits)) : 0;
  }

  function saleLineTotal(product, quantity) {
    return (Number(product?.price) || 0) * Number(quantity || 0);
  }

  function getProductTypeLabel(product) {
    return isRawMaterial(product) ? "Hammadde" : "Satış ürünü";
  }

  function generateVeresiyeId(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function getVeresiyeCustomers() {
    try {
      const rawData = localStorage.getItem(VERESIYE_STORAGE_KEY);
      if (!rawData) return [];

      const parsedData = JSON.parse(rawData);
      return Array.isArray(parsedData) ? parsedData : [];
    } catch (error) {
      console.error("Veresiye kayıtları okunamadı:", error);
      return [];
    }
  }

  function saveVeresiyeCustomers(customers) {
    try {
      localStorage.setItem(VERESIYE_STORAGE_KEY, JSON.stringify(Array.isArray(customers) ? customers : []));
      return true;
    } catch (error) {
      console.error("Veresiye kayıtları kaydedilemedi:", error);
      return false;
    }
  }

  function parseMoneyValue(value) {
    const normalizedValue = String(value ?? "").replace(/\s/g, "").replace(",", ".");
    const amount = Number.parseFloat(normalizedValue);
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount * 100) / 100;
  }

  function formatTRY(value) {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2
    }).format(amount);
  }

  function calculateCustomerDebt(customer) {
    const transactions = Array.isArray(customer?.transactions) ? customer.transactions : [];
    const totalDebt = transactions
      .filter((transaction) => transaction.type === "debt")
      .reduce((total, transaction) => total + (Number(transaction.amount) || 0), 0);
    const totalPayment = transactions
      .filter((transaction) => transaction.type === "payment")
      .reduce((total, transaction) => total + (Number(transaction.amount) || 0), 0);
    const remainingDebt = Math.max(0, Math.round((totalDebt - totalPayment) * 100) / 100);

    return { totalDebt, totalPayment, remainingDebt };
  }

  function getCustomerDebtStatus(customer) {
    const { remainingDebt } = calculateCustomerDebt(customer);
    if (remainingDebt <= 0) return "paid";

    if (customer.dueDate) {
      const dueDate = new Date(`${customer.dueDate}T23:59:59`);
      const now = new Date();
      if (!Number.isNaN(dueDate.getTime()) && dueDate < now) return "overdue";
    }

    return "active";
  }

  function getCustomerDebtStatusLabel(customer) {
    const labels = {
      active: "Borcu Var",
      paid: "Ödendi",
      overdue: "Vadesi Geçti"
    };
    return labels[getCustomerDebtStatus(customer)] || "Borcu Var";
  }

  function getVeresiyeSummary() {
    return getVeresiyeCustomers().reduce(
      (summary, customer) => {
        const totals = calculateCustomerDebt(customer);
        summary.customerCount += 1;
        summary.totalDebt += totals.totalDebt;
        summary.totalPayment += totals.totalPayment;
        summary.remainingDebt += totals.remainingDebt;
        return summary;
      },
      { customerCount: 0, totalDebt: 0, totalPayment: 0, remainingDebt: 0 }
    );
  }

  function createVeresiyeCustomer(formData) {
    const name = String(formData.name || "").trim();
    const startingDebt = parseMoneyValue(formData.startingDebt);

    if (!name) throw new Error("Müşteri adı zorunludur.");
    if (startingDebt <= 0) throw new Error("Başlangıç borcu sıfırdan büyük olmalıdır.");

    const now = new Date().toISOString();
    const customers = getVeresiyeCustomers();
    const customer = {
      id: generateVeresiyeId("customer"),
      name,
      phone: String(formData.phone || "").trim(),
      address: String(formData.address || "").trim(),
      note: String(formData.note || "").trim(),
      dueDate: String(formData.dueDate || "").trim(),
      createdAt: now,
      updatedAt: now,
      transactions: [
        {
          id: generateVeresiyeId("transaction"),
          type: "debt",
          amount: startingDebt,
          paymentMethod: null,
          description: String(formData.description || "").trim() || "Başlangıç borcu",
          createdAt: now,
          createdBy: "Admin"
        }
      ]
    };

    customers.unshift(customer);
    if (!saveVeresiyeCustomers(customers)) throw new Error("Müşteri kaydedilemedi.");
    return customer;
  }

  function addDebtToCustomer(customerId, formData) {
    const amount = parseMoneyValue(formData.amount);
    if (amount <= 0) throw new Error("Borç tutarı sıfırdan büyük olmalıdır.");

    const customers = getVeresiyeCustomers();
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) throw new Error("Müşteri bulunamadı.");

    const now = new Date().toISOString();
    if (!Array.isArray(customer.transactions)) customer.transactions = [];

    customer.transactions.unshift({
      id: generateVeresiyeId("transaction"),
      type: "debt",
      amount,
      paymentMethod: null,
      description: String(formData.description || "").trim() || "Yeni borç eklendi",
      createdAt: formData.date ? new Date(`${formData.date}T12:00:00`).toISOString() : now,
      createdBy: "Admin"
    });
    customer.updatedAt = now;

    if (!saveVeresiyeCustomers(customers)) throw new Error("Borç kaydedilemedi.");
    return customer;
  }

  function addPaymentToCustomer(customerId, formData) {
    const amount = parseMoneyValue(formData.amount);
    const customers = getVeresiyeCustomers();
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) throw new Error("Müşteri bulunamadı.");

    const { remainingDebt } = calculateCustomerDebt(customer);
    if (amount <= 0) throw new Error("Tahsilat tutarı sıfırdan büyük olmalıdır.");
    if (amount > remainingDebt) {
      throw new Error(`Tahsilat kalan borçtan fazla olamaz. Kalan borç: ${formatTRY(remainingDebt)}`);
    }

    const now = new Date().toISOString();
    if (!Array.isArray(customer.transactions)) customer.transactions = [];

    customer.transactions.unshift({
      id: generateVeresiyeId("transaction"),
      type: "payment",
      amount,
      paymentMethod: String(formData.paymentMethod || "Nakit"),
      description: String(formData.description || "").trim() || "Tahsilat alındı",
      createdAt: formData.date ? new Date(`${formData.date}T12:00:00`).toISOString() : now,
      createdBy: "Admin"
    });
    customer.updatedAt = now;

    if (!saveVeresiyeCustomers(customers)) throw new Error("Tahsilat kaydedilemedi.");
    return customer;
  }

  function deleteVeresiyeCustomer(customerId) {
    const customers = getVeresiyeCustomers();
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) throw new Error("Müşteri bulunamadı.");

    const transactionCount = Array.isArray(customer.transactions) ? customer.transactions.length : 0;
    const confirmationMessage = transactionCount > 0
      ? "Bu müşterinin borç ve tahsilat geçmişi bulunmaktadır. Silmek istediğinize emin misiniz?"
      : "Bu müşteriyi silmek istediğinize emin misiniz?";

    if (!window.confirm(confirmationMessage)) return false;

    if (!saveVeresiyeCustomers(customers.filter((item) => item.id !== customerId))) {
      throw new Error("Müşteri silinemedi.");
    }

    return true;
  }

  function renderVeresiyePage() {
    const customers = getVeresiyeCustomers();
    const summary = getVeresiyeSummary();

    return `
      <section class="veresiye-page">
        <div class="section-head">
          <div>
            <p class="eyebrow">Müşteri alacak takibi</p>
            <h2>Veresiye Defteri</h2>
          </div>
          <button type="button" class="button primary" id="openNewVeresiyeCustomer">Yeni Veresiye Kaydı</button>
        </div>

        <div class="grid metrics">
          ${metric("Veresiye Müşteri", summary.customerCount)}
          ${metric("Toplam Verilen Veresiye", formatTRY(summary.totalDebt))}
          ${metric("Toplam Tahsil Edilen", formatTRY(summary.totalPayment))}
          ${metric("Toplam Kalan Alacak", formatTRY(summary.remainingDebt))}
        </div>

        <div class="panel veresiye-filter-panel">
          <div class="veresiye-filter-bar">
            <input type="search" id="veresiyeSearch" placeholder="Müşteri adı veya telefon ara" />
            <select id="veresiyeStatusFilter">
              <option value="all">Tümü</option>
              <option value="active">Borcu olanlar</option>
              <option value="paid">Ödenenler</option>
              <option value="overdue">Vadesi geçenler</option>
            </select>
            <select id="veresiyeSort">
              <option value="newest">En yeni kayıt</option>
              <option value="debt-desc">Borcu yüksekten düşüğe</option>
              <option value="debt-asc">Borcu düşükten yükseğe</option>
            </select>
          </div>
        </div>

        <div id="veresiyeCustomerList">
          ${renderVeresiyeCustomerTable(customers)}
        </div>
      </section>
    `;
  }

  function formatDateTR(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }

  function renderVeresiyeCustomerTable(customers) {
    if (!customers.length) {
      return `
        <div class="empty veresiye-empty">
          <h3>Henüz veresiye kaydı yok</h3>
          <p>İlk müşteri kaydını oluşturarak başlayın.</p>
        </div>
      `;
    }

    const rows = customers.map((customer) => {
      const totals = calculateCustomerDebt(customer);
      const status = getCustomerDebtStatus(customer);
      const statusLabel = getCustomerDebtStatusLabel(customer);
      const customerId = escapeAttribute(customer.id);

      return `
        <tr>
          <td><strong>${escapeHtml(customer.name)}</strong></td>
          <td>${escapeHtml(customer.phone || "-")}</td>
          <td>${formatTRY(totals.totalDebt)}</td>
          <td>${formatTRY(totals.totalPayment)}</td>
          <td><strong>${formatTRY(totals.remainingDebt)}</strong></td>
          <td>${formatDateTR(customer.updatedAt)}</td>
          <td>${formatDateTR(customer.dueDate)}</td>
          <td><span class="status-badge status-${status}">${statusLabel}</span></td>
          <td>
            <div class="table-actions">
              <button type="button" class="button compact" data-veresiye-action="detail" data-customer-id="${customerId}">Detay</button>
              <button type="button" class="button compact" data-veresiye-action="payment" data-customer-id="${customerId}" ${totals.remainingDebt <= 0 ? "disabled" : ""}>Tahsilat</button>
              <button type="button" class="button compact danger-button" data-veresiye-action="delete" data-customer-id="${customerId}">Sil</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="table-wrap veresiye-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Müşteri</th>
              <th>Telefon</th>
              <th>Toplam Borç</th>
              <th>Tahsilat</th>
              <th>Kalan Borç</th>
              <th>Son İşlem</th>
              <th>Son Ödeme</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function filterVeresiyeCustomers() {
    const searchValue = String(document.getElementById("veresiyeSearch")?.value || "")
      .trim()
      .toLocaleLowerCase("tr-TR");
    const statusValue = document.getElementById("veresiyeStatusFilter")?.value || "all";
    const sortValue = document.getElementById("veresiyeSort")?.value || "newest";

    const customers = getVeresiyeCustomers().filter((customer) => {
      const searchableText = `${customer.name || ""} ${customer.phone || ""}`.toLocaleLowerCase("tr-TR");
      const searchMatches = !searchValue || searchableText.includes(searchValue);
      const statusMatches = statusValue === "all" || getCustomerDebtStatus(customer) === statusValue;
      return searchMatches && statusMatches;
    });

    customers.sort((firstCustomer, secondCustomer) => {
      if (sortValue === "debt-desc") {
        return calculateCustomerDebt(secondCustomer).remainingDebt - calculateCustomerDebt(firstCustomer).remainingDebt;
      }

      if (sortValue === "debt-asc") {
        return calculateCustomerDebt(firstCustomer).remainingDebt - calculateCustomerDebt(secondCustomer).remainingDebt;
      }

      return new Date(secondCustomer.createdAt).getTime() - new Date(firstCustomer.createdAt).getTime();
    });

    const listElement = document.getElementById("veresiyeCustomerList");
    if (listElement) listElement.innerHTML = renderVeresiyeCustomerTable(customers);
  }

  function bindVeresiyeEvents() {
    bindClick("openNewVeresiyeCustomer", openNewVeresiyeCustomerModal);

    const searchInput = document.getElementById("veresiyeSearch");
    const statusFilter = document.getElementById("veresiyeStatusFilter");
    const sortSelect = document.getElementById("veresiyeSort");
    const customerList = document.getElementById("veresiyeCustomerList");

    searchInput?.addEventListener("input", filterVeresiyeCustomers);
    statusFilter?.addEventListener("change", filterVeresiyeCustomers);
    sortSelect?.addEventListener("change", filterVeresiyeCustomers);

    customerList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-veresiye-action]");
      if (!button) return;

      const action = button.dataset.veresiyeAction;
      const customerId = button.dataset.customerId;
      if (!customerId) return;

      if (action === "detail") openVeresiyeCustomerDetail(customerId);
      if (action === "payment") openVeresiyePaymentModal(customerId);
      if (action === "delete") {
        try {
          if (deleteVeresiyeCustomer(customerId)) refreshVeresiyePage();
        } catch (error) {
          alert(error.message);
        }
      }
    });
  }

  function refreshVeresiyePage() {
    render();
  }

  function openModal(title, bodyHtml) {
    closeActiveModal();
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-head">
          <h3 id="modalTitle">${escapeHtml(title)}</h3>
          <button type="button" class="button icon-button" data-close-modal aria-label="Kapat">×</button>
        </div>
        ${bodyHtml}
      </section>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-close-modal]")) closeActiveModal();
    });
    return modal;
  }

  function closeActiveModal() {
    document.querySelector(".modal-backdrop")?.remove();
  }

  function openNewVeresiyeCustomerModal() {
    const modal = openModal("Yeni Veresiye Kaydı", `
      <form id="newVeresiyeCustomerForm">
        <div class="form-grid two">
          <input name="name" placeholder="Müşteri adı soyadı" required />
          <input name="phone" placeholder="Telefon numarası" />
        </div>
        <textarea name="address" placeholder="Adres"></textarea>
        <textarea name="note" placeholder="Not"></textarea>
        <div class="form-grid two">
          <input name="startingDebt" type="number" min="0.01" step="0.01" placeholder="Başlangıç borcu" required />
          <input name="dueDate" type="date" />
        </div>
        <textarea name="description" placeholder="Borç açıklaması"></textarea>
        <div class="modal-actions">
          <button type="button" class="button" data-close-modal>İptal</button>
          <button type="submit" class="button primary">Kaydet</button>
        </div>
      </form>
    `);

    modal.querySelector("#newVeresiyeCustomerForm")?.addEventListener("submit", handleNewVeresiyeCustomerSubmit);
  }

  function handleNewVeresiyeCustomerSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      createVeresiyeCustomer({
        name: formData.get("name"),
        phone: formData.get("phone"),
        address: formData.get("address"),
        note: formData.get("note"),
        startingDebt: formData.get("startingDebt"),
        dueDate: formData.get("dueDate"),
        description: formData.get("description")
      });
      closeActiveModal();
      refreshVeresiyePage();
    } catch (error) {
      alert(error.message);
    }
  }

  function openVeresiyePaymentModal(customerId) {
    const customer = getVeresiyeCustomers().find((item) => item.id === customerId);
    if (!customer) {
      alert("Müşteri bulunamadı.");
      return;
    }

    const totals = calculateCustomerDebt(customer);
    const modal = openModal("Tahsilat Al", `
      <div class="modal-summary">
        <strong>${escapeHtml(customer.name)}</strong>
        <span>Kalan borç: ${formatTRY(totals.remainingDebt)}</span>
      </div>
      <form id="veresiyePaymentForm">
        <input name="amount" type="number" min="0.01" max="${totals.remainingDebt}" step="0.01" required />
        <select name="paymentMethod" required>
          <option value="Nakit">Nakit</option>
          <option value="POS">POS</option>
          <option value="IBAN">IBAN</option>
          <option value="Diğer">Diğer</option>
        </select>
        <input name="date" type="date" />
        <textarea name="description" placeholder="Açıklama"></textarea>
        <div class="modal-actions">
          <button type="button" class="button" data-close-modal>İptal</button>
          <button type="submit" class="button primary">Tahsilatı Kaydet</button>
        </div>
      </form>
    `);

    modal.querySelector("#veresiyePaymentForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      try {
        addPaymentToCustomer(customerId, {
          amount: formData.get("amount"),
          paymentMethod: formData.get("paymentMethod"),
          date: formData.get("date"),
          description: formData.get("description")
        });
        closeActiveModal();
        refreshVeresiyePage();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  function openVeresiyeDebtModal(customerId) {
    const customer = getVeresiyeCustomers().find((item) => item.id === customerId);
    if (!customer) {
      alert("Müşteri bulunamadı.");
      return;
    }

    const modal = openModal("Borç Ekle", `
      <div class="modal-summary"><strong>${escapeHtml(customer.name)}</strong></div>
      <form id="veresiyeDebtForm">
        <input name="amount" type="number" min="0.01" step="0.01" required />
        <input name="date" type="date" />
        <textarea name="description" placeholder="Borç açıklaması"></textarea>
        <div class="modal-actions">
          <button type="button" class="button" data-close-modal>İptal</button>
          <button type="submit" class="button primary">Borcu Kaydet</button>
        </div>
      </form>
    `);

    modal.querySelector("#veresiyeDebtForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      try {
        addDebtToCustomer(customerId, {
          amount: formData.get("amount"),
          date: formData.get("date"),
          description: formData.get("description")
        });
        closeActiveModal();
        openVeresiyeCustomerDetail(customerId);
        refreshVeresiyePage();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  function openVeresiyeCustomerDetail(customerId) {
    const customer = getVeresiyeCustomers().find((item) => item.id === customerId);
    if (!customer) {
      alert("Müşteri bulunamadı.");
      return;
    }

    const totals = calculateCustomerDebt(customer);
    const transactions = Array.isArray(customer.transactions) ? customer.transactions : [];
    const rows = transactions.length
      ? transactions.map((transaction) => `
          <tr class="transaction-${transaction.type}">
            <td>${formatDateTR(transaction.createdAt)}</td>
            <td>${transaction.type === "payment" ? "Tahsilat" : "Borç"}</td>
            <td><strong>${formatTRY(transaction.amount)}</strong></td>
            <td>${escapeHtml(transaction.paymentMethod || "-")}</td>
            <td>${escapeHtml(transaction.description || "-")}</td>
            <td>${escapeHtml(transaction.createdBy || "-")}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="6">${empty("İşlem geçmişi yok.")}</td></tr>`;

    const modal = openModal("Veresiye Detayı", `
      <div class="detail-grid">
        <div><span>Müşteri</span><strong>${escapeHtml(customer.name)}</strong></div>
        <div><span>Telefon</span><strong>${escapeHtml(customer.phone || "-")}</strong></div>
        <div><span>Adres</span><strong>${escapeHtml(customer.address || "-")}</strong></div>
        <div><span>Not</span><strong>${escapeHtml(customer.note || "-")}</strong></div>
        <div><span>Toplam borç</span><strong>${formatTRY(totals.totalDebt)}</strong></div>
        <div><span>Toplam tahsilat</span><strong>${formatTRY(totals.totalPayment)}</strong></div>
        <div><span>Kalan borç</span><strong>${formatTRY(totals.remainingDebt)}</strong></div>
        <div><span>Son ödeme tarihi</span><strong>${formatDateTR(customer.dueDate)}</strong></div>
        <div><span>Durum</span><strong>${getCustomerDebtStatusLabel(customer)}</strong></div>
      </div>
      <div class="modal-actions detail-actions">
        <button type="button" class="button" id="openVeresiyeDebtForm">Borç Ekle</button>
        <button type="button" class="button primary" id="openVeresiyePaymentForm" ${totals.remainingDebt <= 0 ? "disabled" : ""}>Tahsilat Al</button>
      </div>
      <div class="table-wrap veresiye-history">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>İşlem Tipi</th>
              <th>Tutar</th>
              <th>Ödeme Yöntemi</th>
              <th>Açıklama</th>
              <th>İşlemi Yapan</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);

    modal.querySelector("#openVeresiyeDebtForm")?.addEventListener("click", () => openVeresiyeDebtModal(customerId));
    modal.querySelector("#openVeresiyePaymentForm")?.addEventListener("click", () => openVeresiyePaymentModal(customerId));
  }

  async function handleProductImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      showToast("Dosya okunuyor, onizleme hazirlaniyor...");
      const preview = await window.NexoraImportExport.previewFile(file, state.data.products || []);
      state.productImportPreview = preview;
      showToast("Onizleme hazir. Onay vermeden Supabase'e yazilmaz.");
      render();
    } catch (error) {
      showToast(`Ice aktarma hatasi: ${error.message}`);
    }
  }

  function handleDownloadProductTemplate() {
    try {
      window.NexoraImportExport.downloadTemplate();
    } catch (error) {
      showToast(`Sablon indirilemedi: ${error.message}`);
    }
  }

  function handleExportProducts(type) {
    try {
      window.NexoraImportExport.exportProducts(state.data.products || [], type);
      showToast(type === "csv" ? "CSV disa aktarildi." : "Excel disa aktarildi.");
    } catch (error) {
      showToast(`Disa aktarma hatasi: ${error.message}`);
    }
  }

  async function handleConfirmProductImport() {
    if (!state.productImportPreview) return;
    const validItems = state.productImportPreview.items.filter((item) => !item.errors.length && item.action !== "invalid");
    if (!validItems.length) {
      showToast("Ice aktarilacak gecerli satir yok.");
      return;
    }
    try {
      state.syncBusy = true;
      showToast("Urunler Supabase'e aktariliyor...");
      const summary = await window.NexoraDataService.saveImportedProducts(validItems);
      state.productImportPreview = null;
      await hydrateFromSupabase();
      showToast(`Ice aktarma tamamlandi. Yeni: ${summary.inserted} | Guncel: ${summary.updated} | Atlanan: ${summary.skipped} | Hatali: ${summary.failed}`);
    } catch (error) {
      showToast(`Ice aktarma hatasi: ${error.message}`);
    } finally {
      state.syncBusy = false;
      render();
    }
  }

  async function handleDownloadFullBackup() {
    try {
      showToast("Tam yedek hazirlaniyor...");
      const metadata = await window.NexoraBackupService.createFullBackup("1.0.0");
      state.data.backupMeta = { ...(state.data.backupMeta || {}), lastManualBackupAt: metadata.createdAt };
      localStorage.setItem(storageKey, JSON.stringify(state.data));
      showToast("Tam JSON yedek indirildi.");
      render();
    } catch (error) {
      showToast(`Yedek alinamadi: ${error.message}`);
    }
  }

  async function handleBackupFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const draft = await window.NexoraBackupService.readBackupFile(file);
      state.backupRestoreDraft = draft;
      showToast("Yedek dogrulandi. Geri yukleme turunu secin.");
      render();
    } catch (error) {
      showToast(`Yedek dosyasi hatasi: ${error.message}`);
    }
  }

  async function handleRestoreBackup(mode) {
    if (!state.backupRestoreDraft?.payload) return;
    if (mode === "replace") {
      const first = window.confirm("Mevcut isletme verileri silinip yedek yuklenecek. Devam edilsin mi?");
      if (!first) return;
      const second = window.confirm("Son onay: Bu islem mevcut urun, satis, stok, gider ve veresiye kayitlarini silecek.");
      if (!second) return;
    }
    try {
      state.syncBusy = true;
      showToast(mode === "replace" ? "Veriler silinip yedek yukleniyor..." : "Yedek mevcut verilerle birlestiriliyor...");
      const report = await window.NexoraBackupService.restoreBackup(state.backupRestoreDraft.payload, mode);
      state.backupRestoreDraft = null;
      await hydrateFromSupabase();
      const failedTable = Object.entries(report.tables).find(([, value]) => value.ok === false);
      showToast(failedTable ? `Geri yukleme kismi tamamlandi, hata: ${failedTable[0]}` : "Yedek geri yuklendi.");
    } catch (error) {
      const failedTable = error.report ? Object.entries(error.report.tables).find(([, value]) => value.ok === false) : null;
      showToast(`Geri yukleme hatasi${failedTable ? ` (${failedTable[0]})` : ""}: ${error.message}`);
    } finally {
      state.syncBusy = false;
      render();
    }
  }

  function bindEvents() {
    bindAuthEvents();

    document.querySelectorAll("[data-page]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.page === "Hızlı Satış") console.log("[QuickPOS] menu clicked");
        state.page = button.dataset.page;
        if (state.page === "Hızlı Satış") console.log("[QuickPOS] page value", state.page);
        render();
      });
    });

    document.querySelectorAll("[data-product]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedProductId = button.dataset.product;
        state.quantity = 1;
        state.page = "Satis Yap";
        render();
      });
    });

    document.querySelectorAll("[data-payment]").forEach((button) => {
      button.addEventListener("click", () => {
        state.paymentMethod = button.dataset.payment;
        render();
      });
    });

    document.querySelectorAll("[data-cart-add]").forEach((button) => {
      button.addEventListener("click", () => addToCart(button.dataset.cartAdd));
    });

    document.querySelectorAll("[data-cart-increase]").forEach((button) => {
      button.addEventListener("click", () => changeCartQuantity(button.dataset.cartIncrease, 1));
    });

    document.querySelectorAll("[data-cart-decrease]").forEach((button) => {
      button.addEventListener("click", () => changeCartQuantity(button.dataset.cartDecrease, -1));
    });

    document.querySelectorAll("[data-cart-quantity]").forEach((input) => {
      input.addEventListener("input", () => setCartQuantity(input.dataset.cartQuantity, input.value));
    });

    const saleSearch = document.getElementById("saleSearch");
    if (saleSearch) {
      saleSearch.addEventListener("input", () => {
        state.saleSearch = saleSearch.value;
        refreshSaleProductGrid();
      });
    }

    const saleCategory = document.getElementById("saleCategory");
    if (saleCategory) {
      saleCategory.addEventListener("change", () => {
        state.saleCategory = saleCategory.value;
        render();
      });
    }

    bindClick("addSetupProduct", () => addProductFromForm("setup", state.setupProductDrafts));
    bindClick("loadSampleProducts", () => loadSampleProducts(state.setupProductDrafts));
    bindClick("finishSetup", finishSetup);
    const finishButton = document.getElementById("finishSetup");
    if (finishButton) console.log("finish button found", finishButton);
    bindSubmitPreventDefault("setupForm");
    bindSubmitPreventDefault("setupProductForm");
    bindClick("addAdminProduct", () => {
      addProductFromForm("admin", state.data.products);
      saveData();
    });
    bindClick("loadSampleProductsAdmin", () => {
      loadSampleProducts(state.data.products);
      saveData();
    });
    bindClick("downloadProductTemplate", handleDownloadProductTemplate);
    bindClick("openProductImport", () => document.getElementById("productImportFile")?.click());
    bindClick("exportProductsExcel", () => handleExportProducts("xlsx"));
    bindClick("exportProductsCsv", () => handleExportProducts("csv"));
    bindClick("confirmProductImport", handleConfirmProductImport);
    bindClick("cancelProductImport", () => {
      state.productImportPreview = null;
      render();
    });
    bindClick("downloadFullBackup", handleDownloadFullBackup);
    bindClick("openRestoreBackup", () => document.getElementById("restoreBackupFile")?.click());
    bindClick("restoreBackupMerge", () => handleRestoreBackup("merge"));
    bindClick("restoreBackupReplace", () => handleRestoreBackup("replace"));
    bindClick("cancelBackupRestore", () => {
      state.backupRestoreDraft = null;
      render();
    });
    bindClick("saveSale", recordSale);
    bindClick("saveStockEntry", recordStockEntry);
    bindClick("saveExpense", recordExpense);
    bindClick("saveSettings", saveSettings);
    bindClick("logoutSupabase", handleSupabaseLogout);
    bindClick("migrateLocalData", handleMigrateLocalData);
    bindClick("repairLocalData", handleRepairLocalData);
    bindClick("resetSetup", resetSetup);
    bindClick("dashboardVeresiyeCard", () => {
      state.page = "Veresiye";
      render();
    });
    bindClick("dashboardCashClosingCard", () => {
      state.page = "Gün Sonu Kasa";
      render();
    });

    if (state.page === "Veresiye") {
      bindVeresiyeEvents();
    }
    if (state.page === "Hızlı Satış") {
      bindQuickPosEvents();
    }
    if (state.page === "Zayiat ve Sayım") {
      bindProductionWasteEvents();
    }
    if (state.page === "Gün Sonu Kasa") {
      bindCashClosingEvents();
    }

    const importFile = document.getElementById("productImportFile");
    if (importFile) importFile.addEventListener("change", handleProductImportFile);

    const restoreFile = document.getElementById("restoreBackupFile");
    if (restoreFile) restoreFile.addEventListener("change", handleBackupFile);

    document.querySelectorAll("[data-import-action]").forEach((select) => {
      select.addEventListener("change", () => {
        if (!state.productImportPreview) return;
        const rowNumber = Number(select.dataset.importAction);
        const item = state.productImportPreview.items.find((entry) => entry.rowNumber === rowNumber);
        if (!item) return;
        item.action = select.value;
        state.productImportPreview = window.NexoraImportExport.summarizePreview(state.productImportPreview.items);
        render();
      });
    });

    document.querySelectorAll("[data-remove-setup]").forEach((button) => {
      button.addEventListener("click", () => {
        state.setupProductDrafts = state.setupProductDrafts.filter((product) => product.id !== button.dataset.removeSetup);
        render();
      });
    });

    document.querySelectorAll("[data-remove-product]").forEach((button) => {
      button.addEventListener("click", () => {
        state.data.products = state.data.products.filter((product) => product.id !== button.dataset.removeProduct);
        saveData();
        render();
      });
    });

    const select = document.getElementById("productSelect");
    if (select) {
      select.addEventListener("change", () => {
        state.selectedProductId = select.value;
        state.quantity = 1;
        render();
      });
    }

    const stockProduct = document.getElementById("stockProduct");
    if (stockProduct) {
      stockProduct.addEventListener("change", updateStockEntryDefaults);
    }

    const quantity = document.getElementById("quantityInput");
    if (quantity) {
      quantity.addEventListener("input", () => {
        const selected = state.data.products.find((product) => product.id === state.selectedProductId);
        state.quantity = Math.max(1, Math.min(Number(quantity.value || 1), selected ? selected.stock || 1 : 1));
      });
    }
  }

  function bindAuthEvents() {
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.authMode = button.dataset.authMode || "login";
        render();
      });
    });
    const form = document.getElementById("supabaseAuthForm");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleAuthSubmit();
    });
  }

  async function handleAuthSubmit() {
    try {
      state.syncStatus = "Oturum işleniyor...";
      if (state.authMode === "register") {
        await window.NexoraAuth.registerBusiness({
          businessName: valueOf("authBusinessName"),
          ownerName: valueOf("authOwnerName"),
          phone: normalizePhone(valueOf("authPhone")),
          email: valueOf("authEmail"),
          password: valueOf("authPassword")
        });
        showToast("İşletme hesabı oluşturuldu.");
      } else if (state.authMode === "reset") {
        await window.NexoraAuth.resetPassword(valueOf("authEmail"));
        showToast("Şifre sıfırlama bağlantısı gönderildi.");
        return;
      } else {
        await window.NexoraAuth.signIn(valueOf("authEmail"), valueOf("authPassword"));
        showToast("Giriş yapıldı.");
      }
      await hydrateFromSupabase();
    } catch (error) {
      console.error("[Auth] failed", error);
      showToast(`Oturum hatası: ${error.message}`);
      render();
    }
  }

  async function handleSupabaseLogout() {
    try {
      await window.NexoraAuth.signOut();
      state.authSession = null;
      state.authProfile = null;
      state.migrationAvailable = false;
      showToast("Çıkış yapıldı.");
      render();
    } catch (error) {
      showToast(`Çıkış hatası: ${error.message}`);
    }
  }

  async function handleMigrateLocalData() {
    try {
      state.syncBusy = true;
      state.syncStatus = "LocalStorage verileri aktarılıyor...";
      render();
      const result = await window.NexoraDataService.migrateLegacyData();
      state.migrationAvailable = false;
      await hydrateFromSupabase();
      showToast(formatMigrationSummary(result.summary) || "Bu cihazdaki veriler Supabase hesabına aktarıldı.");
    } catch (error) {
      console.error("[Migration] failed", error);
      showToast(`Aktarım hatası: ${error.message}`);
    } finally {
      state.syncBusy = false;
      render();
    }
  }

  async function handleRepairLocalData() {
    try {
      state.syncBusy = true;
      state.syncStatus = "Yerel veriler yeniden taranıyor...";
      render();
      const result = await window.NexoraDataService.rescanAndRepairLocalData();
      state.migrationAvailable = false;
      await hydrateFromSupabase();
      showToast(formatMigrationSummary(result.summary) || "Yerel veriler yeniden tarandı ve eksikler aktarıldı.");
    } catch (error) {
      console.error("[Migration repair] failed", error);
      showToast(`Eksik aktarım hatası: ${error.message}`);
    } finally {
      state.syncBusy = false;
      render();
    }
  }

  function formatMigrationSummary(summary) {
    if (!summary) return "";
    return [
      `Yerel ürün: ${summary.localProductCount}`,
      `Supabase önce: ${summary.remoteProductCountBefore}`,
      `Yeni: ${summary.inserted}`,
      `Güncellenen: ${summary.updated}`,
      `Atlanan duplicate: ${summary.skippedDuplicates}`,
      `Supabase şimdi: ${summary.remoteProductCountAfter}`
    ].join(" | ");
  }

  async function hydrateFromSupabase() {
    if (!window.NexoraSupabase?.isSupabaseReady?.()) return;
    const session = await window.NexoraAuth.getSession();
    state.authSession = session;
    if (!session) {
      render();
      return;
    }
    await window.NexoraAuth.ensureBusinessProfile({
      businessName: state.data.businessName,
      ownerName: state.data.ownerName,
      phone: state.data.whatsappNumber
    });
    const remote = await window.NexoraDataService.loadBusinessData();
    state.authProfile = remote.profile;
    state.data = normalizeLoadedData({ ...emptyData(), ...remote.data });
    localStorage.setItem(storageKey, JSON.stringify(state.data));
    state.migrationAvailable = !remote.hasRemoteData && window.NexoraDataService.hasLegacyData() && !window.NexoraDataService.migrationDone(remote.profile.business_id);
    state.syncStatus = "Supabase verileri yüklendi.";
    if (isSetupCompleted()) state.page = "Dashboard";
    setupRealtimeSync();
    render();
  }

  function setupRealtimeSync() {
    if (state.realtimeChannel || !window.NexoraDataService?.subscribeRealtime) return;
    state.realtimeChannel = window.NexoraDataService.subscribeRealtime(async () => {
      if (state.syncBusy) return;
      try {
        state.syncStatus = "Uzak değişiklik alındı.";
        const remote = await window.NexoraDataService.loadBusinessData();
        state.data = normalizeLoadedData({ ...emptyData(), ...remote.data });
        render();
      } catch (error) {
        console.error("[Realtime] refresh failed", error);
      }
    });
  }

  async function flushOfflineQueue() {
    if (!state.supabaseEnabled || !state.authSession || !navigator.onLine) return;
    const result = await window.NexoraOfflineSync.flush(async (item) => {
      if (item.type === "sync-all") await window.NexoraDataService.syncAllData(item.payload);
    });
    if (result.flushed || result.failed) {
      state.syncStatus = result.failed ? `${result.failed} senkron hatası var.` : `${result.flushed} kuyruk kaydı gönderildi.`;
      render();
    }
  }

  async function bootstrapSupabase() {
    state.offline = !navigator.onLine;
    window.addEventListener("online", () => {
      state.offline = false;
      flushOfflineQueue().catch((error) => {
        state.syncStatus = `Kuyruk hatası: ${error.message}`;
        render();
      });
      render();
    });
    window.addEventListener("offline", () => {
      state.offline = true;
      state.syncStatus = "Çevrimdışı";
      render();
    });

    const client = await window.NexoraSupabase?.initSupabaseClient?.();
    state.supabaseEnabled = Boolean(client);
    state.supabaseError = window.NexoraSupabase?.getSupabaseStatus?.().error?.message || "";
    state.authLoading = false;
    if (!client) {
      render();
      return;
    }

    const callbackResult = await window.NexoraAuth.handleAuthCallback();
    state.authCallbackHandled = callbackResult.handled;
    if (callbackResult.handled && !callbackResult.ok) {
      state.authSession = null;
      state.syncStatus = `Email doğrulama hatası: ${callbackResult.error.message}`;
      showToast(state.syncStatus);
      render();
      return;
    }
    if (callbackResult.session) {
      state.authSession = callbackResult.session;
      if (callbackResult.handled) state.syncStatus = "Email doğrulandı, oturum açıldı.";
    }

    client.auth.onAuthStateChange(async (_event, session) => {
      state.authSession = session;
      if (session) {
        try {
          await hydrateFromSupabase();
        } catch (error) {
          console.error("[Supabase] hydrate failed", error);
          state.syncStatus = `Yükleme hatası: ${error.message}`;
          render();
        }
      } else {
        render();
      }
    });

    try {
      await hydrateFromSupabase();
      await flushOfflineQueue();
    } catch (error) {
      console.error("[Supabase] bootstrap failed", error);
      state.authSession = await window.NexoraAuth.getSession().catch(() => null);
      state.syncStatus = `Supabase hatası: ${error.message}`;
      render();
    }
  }

  function bindDelegatedAppEvents() {
    const app = document.getElementById("app");
    if (!app || app.dataset.delegatedEvents === "true") return;
    app.dataset.delegatedEvents = "true";
    app.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-action]");
      if (!actionButton || !app.contains(actionButton)) return;
      const action = actionButton.dataset.action;
      if (action === "send-critical-stock-whatsapp" || action === "send-end-of-day-whatsapp") {
        event.preventDefault();
        console.log("[WhatsApp] button click detected", action);
        sendWhatsAppNotification(action === "send-critical-stock-whatsapp" ? "critical-stock" : "end-of-day");
      }
    });
  }

  function bindClick(id, handler) {
    const element = document.getElementById(id);
    if (element) element.addEventListener("click", handler);
  }

  function bindSubmitPreventDefault(id) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("submit", (event) => event.preventDefault());
    }
  }

  function updateStockEntryDefaults() {
    const product = findProductById(valueOf("stockProduct"));
    const unitPriceInput = document.getElementById("stockEntryUnitPrice");
    const typeSelect = document.getElementById("stockEntryType");

    if (!product) return;

    if (unitPriceInput) unitPriceInput.value = String(Number(product.purchasePrice || 0));
    if (typeSelect && isRawMaterial(product)) typeSelect.value = "Kg";
  }

  function collectSetupFields() {
    return {
      businessName: valueOf("businessName"),
      ownerName: valueOf("ownerName"),
      whatsappNumber: normalizePhone(valueOf("whatsappNumber")),
      categories: splitList(valueOf("categories")),
      paymentMethods: splitList(valueOf("paymentMethods"))
    };
  }

  function finishSetup() {
    console.log("finish setup clicked");
    try {
      const fields = collectSetupFields();
      console.log("setup form values", {
        businessName: fields.businessName,
        ownerName: fields.ownerName
      });
      fields.categories = Array.isArray(fields.categories) ? fields.categories : [];
      fields.paymentMethods = Array.isArray(fields.paymentMethods) ? fields.paymentMethods : [];

      if (!fields.businessName) {
        showToast("İşletme adı zorunludur.");
        return;
      }
      if (!fields.ownerName || !fields.whatsappNumber) {
        showToast("Isletme sahibi adi ve WhatsApp numarasi zorunlu.");
        return;
      }
      if (!fields.categories.length || !fields.paymentMethods.length) {
        showToast("En az bir kategori ve odeme yontemi girin.");
        return;
      }

      const setupProducts = Array.isArray(state.setupProductDrafts)
        ? state.setupProductDrafts.filter(Boolean)
        : [];
      if (!setupProducts.length) {
        showToast("En az 1 ürün eklemelisiniz.");
        return;
      }

      state.data = normalizeLoadedData({
        configured: true,
        setupCompleted: true,
        ...fields,
        products: setupProducts,
        sales: [],
        stockMovements: [],
        expenses: []
      });
      state.paymentMethod = fields.paymentMethods[0] || "";
      state.selectedProductId = setupProducts[0] ? setupProducts[0].id : null;
      state.setupProductDrafts = [];
      state.page = "Dashboard";
      saveData();
      console.log("setup saved");

      showToast("Kurulum tamamlandi.");
      render();
      console.log("dashboard rendered");
    } catch (err) {
      console.error("finishSetup error", err);
      alert(err.message);
    }
  }

  function addProductFromForm(prefix, target) {
    if (prefix === "setup") {
      const fields = collectSetupFields();
      state.data = { ...state.data, ...fields };
    }

    const productType = valueOf(`${prefix}ProductType`) || "sale";
    const product = normalizeProduct({
      id: createId(),
      name: valueOf(`${prefix}ProductName`),
      category: valueOf(`${prefix}Category`) || "Genel",
      type: productType,
      price: Number(valueOf(`${prefix}Price`) || 0),
      unit: productType === "raw" ? "Kg" : valueOf(`${prefix}Unit`) || "Adet",
      stock: parseMoneyValue(valueOf(`${prefix}Stock`) || 0),
      initialStock: parseMoneyValue(valueOf(`${prefix}Stock`) || 0),
      criticalLevel: parseMoneyValue(valueOf(`${prefix}Critical`) || 0),
      purchasePrice: parseMoneyValue(valueOf(`${prefix}PurchasePrice`) || 0),
      packageSize: Number(valueOf(`${prefix}PackageSize`) || 0),
      supplier: valueOf(`${prefix}Supplier`),
      note: valueOf(`${prefix}Note`),
      sold: 0,
      recipe: productType === "sale" ? parseRecipeInput(valueOf(`${prefix}Recipe`)) : []
    });

    if (!product.name || (product.type === "sale" && !product.price) || product.stock <= 0) {
      showToast(product.type === "raw" ? "Hammadde adi ve baslangic kg stogu zorunlu." : "Urun adi, satis fiyati ve baslangic stogu zorunlu.");
      return;
    }

    if (!state.data.categories.includes(product.category)) {
      state.data.categories.push(product.category);
    }

    target.push(product);
    showToast(`${product.name} eklendi.`);
    render();
  }

  function loadSampleProducts(target) {
    const existingNames = new Set(target.map((product) => product.name));
    sampleProducts.forEach((sample) => {
      if (!existingNames.has(sample.name)) target.push({ ...sample, id: createId() });
    });

    ["Atistirmalik", "Icecek", "Cigkofte"].forEach((category) => {
      if (!state.data.categories.includes(category)) state.data.categories.push(category);
    });

    showToast("Ornek cigkofte urunleri yuklendi.");
    render();
  }

  function saveSettings() {
    const fields = collectSetupFields();
    state.data = { ...state.data, ...fields };
    if (!state.data.paymentMethods.includes(state.paymentMethod)) {
      state.paymentMethod = state.data.paymentMethods[0] || "";
    }
    saveData();
    showToast("Ayarlar kaydedildi.");
    render();
  }

  function resetSetup() {
    localStorage.removeItem(storageKey);
    state.data = emptyData();
    state.setupProductDrafts = [];
    state.cart = [];
    state.page = "Dashboard";
    showToast("Kurulum sifirlandi.");
    render();
  }

  function addToCart(productId) {
    const product = state.data.products.find((item) => item.id === productId);
    if (!product) return;

    const item = state.cart.find((entry) => entry.productId === productId);
    const currentQuantity = item ? item.quantity : 0;
    if (currentQuantity >= product.stock) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    if (item) {
      item.quantity += 1;
    } else {
      state.cart.push({ productId, quantity: 1 });
    }
    render();
  }

  function changeCartQuantity(productId, delta) {
    const product = state.data.products.find((item) => item.id === productId);
    const item = state.cart.find((entry) => entry.productId === productId);
    if (!product || !item) return;

    const nextQuantity = item.quantity + delta;
    if (nextQuantity <= 0) {
      state.cart = state.cart.filter((entry) => entry.productId !== productId);
      render();
      return;
    }

    if (nextQuantity > product.stock) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    item.quantity = nextQuantity;
    render();
  }

  function addToCart(productId) {
    const product = state.data.products.find((item) => item.id === productId);
    if (!product) return;

    const item = state.cart.find((entry) => entry.productId === productId);
    const currentQuantity = item ? item.quantity : 0;
    const step = String(product.unit).toLowerCase() === "kg" ? 0.5 : 1;
    const nextQuantity = roundStock(currentQuantity + step);

    if (nextQuantity > calculateAvailableRecipeQuantity(product)) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    if (item) {
      item.quantity = nextQuantity;
    } else {
      state.cart.push({ productId, quantity: step });
    }
    render();
  }

  function changeCartQuantity(productId, delta) {
    const product = state.data.products.find((item) => item.id === productId);
    const item = state.cart.find((entry) => entry.productId === productId);
    if (!product || !item) return;

    const nextQuantity = roundStock(item.quantity + delta);
    if (nextQuantity <= 0) {
      state.cart = state.cart.filter((entry) => entry.productId !== productId);
      render();
      return;
    }

    if (nextQuantity > calculateAvailableRecipeQuantity(product)) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    item.quantity = nextQuantity;
    render();
  }

  function setCartQuantity(productId, value) {
    const product = state.data.products.find((item) => item.id === productId);
    const item = state.cart.find((entry) => entry.productId === productId);
    if (!product || !item) return;

    const nextQuantity = roundStock(parseMoneyValue(value));
    if (nextQuantity <= 0) {
      state.cart = state.cart.filter((entry) => entry.productId !== productId);
      render();
      return;
    }

    if (nextQuantity > calculateAvailableRecipeQuantity(product)) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    item.quantity = nextQuantity;
  }

  function recordSale() {
    const method = state.paymentMethod || state.data.paymentMethods[0];

    if (!state.cart.length) {
      showToast("Satis icin sepete urun ekleyin.");
      return;
    }

    const items = state.cart.map((cartItem) => {
      const product = state.data.products.find((entry) => entry.id === cartItem.productId);
      return { cartItem, product };
    });

    if (items.some((item) => !item.product || item.product.stock < item.cartItem.quantity)) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    items.forEach(({ cartItem, product }) => {
      product.stock -= cartItem.quantity;
      product.sold += cartItem.quantity;
    });

    const now = new Date();
    const saleItems = items.map(({ cartItem, product }) => ({
      productId: product.id,
      productName: product.name,
      quantity: cartItem.quantity,
      unit: product.unit,
      unitPrice: product.price,
      total: product.price * cartItem.quantity
    }));
    const total = saleItems.reduce((sum, item) => sum + item.total, 0);
    const quantity = saleItems.reduce((sum, item) => sum + item.quantity, 0);

    state.data.sales.push({
      id: createId(),
      productId: saleItems[0].productId,
      productName: saleItems.length === 1 ? saleItems[0].productName : `${saleItems.length} urun`,
      quantity,
      unit: saleItems.length === 1 ? saleItems[0].unit : "kalem",
      unitPrice: total,
      total,
      paymentMethod: method,
      date: now.toISOString().slice(0, 10),
      time: now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      items: saleItems
    });

    state.quantity = 1;
    state.cart = [];
    state.page = "Dashboard";
    saveData();
    showToast("Satış kaydedildi. Stok ve kasa güncellendi.");
    render();
  }

  function recordSale() {
    const method = state.paymentMethod || state.data.paymentMethods[0];

    if (!state.cart.length) {
      showToast("Satis icin sepete urun ekleyin.");
      return;
    }

    const items = state.cart.map((cartItem) => {
      const product = state.data.products.find((entry) => entry.id === cartItem.productId);
      return { cartItem, product };
    });

    const invalidItem = items.find((item) => !item.product || (!Array.isArray(item.product.recipe) || !item.product.recipe.length) && item.product.stock < item.cartItem.quantity);
    if (invalidItem) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    const recipeUsage = calculateRecipeUsage(items);
    const missingMaterials = validateRecipeStock(recipeUsage);
    if (missingMaterials.length) {
      showToast(missingMaterials.join(" | "));
      return;
    }

    items.forEach(({ cartItem, product }) => {
      if (!Array.isArray(product.recipe) || !product.recipe.length) {
        product.stock = roundStock(product.stock - cartItem.quantity);
      }
      product.sold = roundStock(product.sold + cartItem.quantity);
    });

    recipeUsage.forEach((amountKg, materialId) => {
      const material = findProductById(materialId);
      if (material) material.stock = roundStock(material.stock - amountKg);
    });

    const now = new Date();
    const saleItems = items.map(({ cartItem, product }) => ({
      productId: product.id,
      productName: product.name,
      quantity: cartItem.quantity,
      unit: product.unit,
      unitPrice: product.price,
      recipeCost: calculateRecipeCost(product, cartItem.quantity),
      total: saleLineTotal(product, cartItem.quantity)
    }));
    const total = saleItems.reduce((sum, item) => sum + item.total, 0);
    const quantity = saleItems.reduce((sum, item) => sum + item.quantity, 0);

    state.data.sales.push({
      id: createId(),
      productId: saleItems[0].productId,
      productName: saleItems.length === 1 ? saleItems[0].productName : `${saleItems.length} urun`,
      quantity,
      unit: saleItems.length === 1 ? saleItems[0].unit : "kalem",
      unitPrice: total,
      total,
      recipeCost: saleItems.reduce((sum, item) => sum + item.recipeCost, 0),
      grossProfit: total - saleItems.reduce((sum, item) => sum + item.recipeCost, 0),
      paymentMethod: method,
      date: now.toISOString().slice(0, 10),
      time: now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      items: saleItems
    });

    state.quantity = 1;
    state.cart = [];
    state.page = "Dashboard";
    saveData();
    showToast("Satış kaydedildi. Stok ve kasa güncellendi.");
    render();
  }

  function recordStockEntry() {
    const productId = valueOf("stockProduct");
    const product = state.data.products.find((item) => item.id === productId);
    const entryType = valueOf("stockEntryType") || "Adet";
    const amount = Number(valueOf("stockEntryAmount") || 0);
    const cost = Number(valueOf("stockEntryCost") || 0);
    const supplier = valueOf("stockEntrySupplier");
    const note = valueOf("stockEntryNote");

    if (!product) {
      showToast("Stok girisi icin urun secin.");
      return;
    }
    if (amount <= 0) {
      showToast("Stok girisi icin miktar girin.");
      return;
    }

    const packageSize = Number(product.packageSize || 0);
    const addedQuantity = entryType === "Koli" ? amount * packageSize : amount;
    if (entryType === "Koli" && packageSize <= 0) {
      showToast("Bu urunun koli ici adet bilgisi yok.");
      return;
    }

    product.stock += addedQuantity;
    if (supplier) product.supplier = supplier;

    const now = new Date();
    state.data.stockMovements.push({
      id: createId(),
      dateTime: now.toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      productId: product.id,
      productName: product.name,
      entryType,
      amount,
      addedQuantity,
      addedUnit: entryType === "Koli" ? "Adet" : entryType,
      cost,
      supplier,
      note
    });

    saveData();
    showToast("Stok girisi kaydedildi. Urun stogu guncellendi.");
    render();
  }

  function recordStockEntry() {
    const productId = valueOf("stockProduct");
    const product = state.data.products.find((item) => item.id === productId);
    const entryType = valueOf("stockEntryType") || "Adet";
    const amount = parseMoneyValue(valueOf("stockEntryAmount") || 0);
    const unitPrice = parseMoneyValue(valueOf("stockEntryUnitPrice") || 0);
    const manualCost = parseMoneyValue(valueOf("stockEntryCost") || 0);
    const supplier = valueOf("stockEntrySupplier");
    const note = valueOf("stockEntryNote");
    const date = valueOf("stockEntryDate") || new Date().toISOString().slice(0, 10);

    if (!product) {
      showToast("Stok girisi icin urun secin.");
      return;
    }
    if (amount <= 0) {
      showToast("Stok girisi icin miktar girin.");
      return;
    }

    const isRaw = isRawMaterial(product);
    const packageSize = Number(product.packageSize || 0);
    const addedQuantity = isRaw ? amount : entryType === "Koli" ? amount * packageSize : amount;
    if (!isRaw && entryType === "Koli" && packageSize <= 0) {
      showToast("Bu urunun koli ici adet bilgisi yok.");
      return;
    }

    if (isRaw && unitPrice > 0) product.purchasePrice = unitPrice;
    product.stock = roundStock(product.stock + addedQuantity);
    if (supplier) product.supplier = supplier;

    const cost = isRaw ? roundStock(addedQuantity * unitPrice) : manualCost;
    const now = new Date();
    state.data.stockMovements.push({
      id: createId(),
      date,
      dateTime: now.toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      productId: product.id,
      productName: product.name,
      productType: product.type,
      entryType: isRaw ? "Kg" : entryType,
      amount,
      addedQuantity: roundStock(addedQuantity),
      addedUnit: isRaw ? "Kg" : entryType === "Koli" ? "Adet" : entryType,
      unitPrice: isRaw ? unitPrice : null,
      cost,
      supplier,
      note
    });

    saveData();
    showToast("Stok girisi kaydedildi. Urun stogu guncellendi.");
    render();
  }

  function recordExpense() {
    const name = valueOf("expenseName");
    const category = valueOf("expenseCategory") || "Diğer";
    const amount = Number(valueOf("expenseAmount") || 0);
    const paymentMethod = valueOf("expensePaymentMethod") || (state.data.paymentMethods[0] || "Nakit");
    const date = valueOf("expenseDate") || new Date().toISOString().slice(0, 10);
    const note = valueOf("expenseNote");

    if (!name) {
      showToast("Gider adi zorunlu.");
      return;
    }
    if (amount <= 0) {
      showToast("Gider tutari girin.");
      return;
    }

    state.data.expenses.push({
      id: createId(),
      name,
      category,
      amount,
      paymentMethod,
      date,
      note
    });

    saveData();
    showToast("Gider eklendi. Net kar guncellendi.");
    render();
  }

  async function sendWhatsAppNotification(type) {
    const message = type === "critical-stock" ? buildCriticalStockMessage() : buildEndOfDayMessage();
    const label = type === "critical-stock" ? "Kritik stok bildirimi" : "Gun sonu raporu";
    const to = normalizePhone(state.data.whatsappNumber);

    if (state.whatsappSendingType) return;

    state.whatsappSendingType = type;
    showToast(`${label} gonderiliyor...`);
    render();

    try {
      const response = await fetch("/api/food/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          to,
          message
        })
      });
      const responseText = await response.text();
      let data = null;
      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch (parseError) {
        data = { raw: responseText };
      }
      if (!response.ok || !data?.ok) {
        const error = new Error(data?.error || `WhatsApp bildirimi gonderilemedi. HTTP ${response.status}`);
        error.status = response.status;
        error.details = data;
        throw error;
      }
      showToast(`${label} ${data.to} numarasina gonderildi.`);
    } catch (error) {
      console.error("[WhatsApp] Bildirim gönderilemedi", {
        type,
        to,
        message,
        status: error.status,
        details: error.details,
        error
      });
      showToast(`WhatsApp hata: ${error.message || "Bildirim gonderilemedi."}`);
    } finally {
      state.whatsappSendingType = "";
      render();
    }
  }

  function buildCriticalStockMessage() {
    const summary = getSummary();
    if (!summary.criticalStocks.length) {
      return `Kritik Stok Uyarisi

Kritik stok bulunmuyor.`;
    }

    const rows = summary.criticalStocks
      .map((product) => `- ${product.name}: ${product.stock} ${product.unit} kaldi | Kritik: ${product.criticalLevel} ${product.unit}`)
      .join("\n");

    return `Kritik Stok Uyarisi

${rows}`;
  }

  function buildEndOfDayMessage() {
    const summary = getSummary();
    const paymentRows = state.data.paymentMethods
      .map((method) => `- ${method}: ${formatTL(summary.payments[method] || 0)}`)
      .join("\n") || "- Odeme yok";
    const topRows = summary.topProducts
      .slice(0, 5)
      .map((product, index) => `${index + 1}. ${product.name} - ${product.sold} ${product.unit}`)
      .join("\n") || "- Satis yok";
    const criticalRows = summary.criticalStocks
      .map((product) => `- ${product.name}: ${product.stock}/${product.criticalLevel} ${product.unit}`)
      .join("\n") || "- Kritik stok bulunmuyor";
    const recentRows = summary.recentSales
      .slice(0, 5)
      .map((sale) => `- ${saleLabel(sale)}: ${formatTL(sale.total)} (${sale.paymentMethod})`)
      .join("\n");
    const recentSales = recentRows || "- Son satis yok";

    return `Gun Sonu Ozeti

Ciro: ${formatTL(summary.revenue)}
Bahsis / Birakilan Para: ${formatTL(summary.tipAmount || 0)}
Gercek Nakit Girisi: ${formatTL(summary.realCashIn || 0)}
Verilen Para Ustu: ${formatTL(summary.changeReturned || 0)}
Gider: ${formatTL(summary.expenseTotal)}
Net Kar: ${formatTL(summary.netProfit)}

Odemeler:
${paymentRows}

En Cok Satan 5:
${topRows}

Kritik Stoklar:
${criticalRows}

Son 5 Satis:
${recentSales}`;
  }

  function saleLabel(sale) {
    if (Array.isArray(sale.items) && sale.items.length) {
      return sale.items.slice(0, 2).map((item) => `${item.productName} x${item.quantity}`).join(", ") + (sale.items.length > 2 ? "..." : "");
    }

    return sale.productName;
  }

  function valueOf(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
  }

  function splitList(value) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  function normalizePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 10 && digits.startsWith("5")) return `90${digits}`;
    if (digits.length === 11 && digits.startsWith("0")) return `9${digits}`;
    return digits;
  }

  function formatTL(value) {
    return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(value)} TL`;
  }

  function recordDateKey(record) {
    if (record.date) return String(record.date).slice(0, 10);
    if (record.dateTime) {
      const parts = String(record.dateTime).match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (parts) return `${parts[3]}-${parts[2]}-${parts[1]}`;
    }

    return new Date().toISOString().slice(0, 10);
  }

  function lastDateKeys(days) {
    return Array.from({ length: days }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - index));
      return date.toISOString().slice(0, 10);
    });
  }

  function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function showToast(message) {
    state.toast = message;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      state.toast = "";
      render();
    }, 3200);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function getMaterialPurchaseSummary() {
    const today = new Date().toISOString().slice(0, 10);
    const monthKey = today.slice(0, 7);
    const cigkofte = getCigkofteRawMaterial();
    const purchases = state.data.stockMovements.filter((movement) => movement.entryType !== "stock_adjustment");
    const todayPurchases = purchases.filter((movement) => String(movement.date || "").slice(0, 10) === today);
    const monthPurchases = purchases.filter((movement) => String(movement.date || "").slice(0, 7) === monthKey);
    const monthlyCigkoftePurchases = monthPurchases.filter((movement) => movement.productId === cigkofte?.id);
    const monthlyCigkofteKg = monthlyCigkoftePurchases.reduce((sum, movement) => sum + Number(movement.addedQuantity || 0), 0);
    const monthlyPurchaseCost = monthPurchases.reduce((sum, movement) => sum + Number(movement.cost || 0), 0);
    return {
      todayIncomingKg: todayPurchases.reduce((sum, movement) => sum + (String(movement.addedUnit).toLowerCase() === "kg" ? Number(movement.addedQuantity || 0) : 0), 0),
      monthlyCigkofteKg,
      monthlyPurchaseCost,
      averageCigkoftePurchasePrice: monthlyCigkofteKg > 0
        ? monthlyCigkoftePurchases.reduce((sum, movement) => sum + Number(movement.cost || 0), 0) / monthlyCigkofteKg
        : Number(cigkofte?.purchasePrice || 0)
    };
  }

  function stockEntryPage() {
    if (!state.data.products.length) {
      return `
        <div class="section-head">
          <div>
            <p class="eyebrow">Mal alımı ve stok</p>
            <h2>Stok Girişi</h2>
          </div>
          <button class="button primary" data-page="Urunler">Urun Ekle</button>
        </div>
        ${empty("Stok girisi yapabilmek icin once urun ekleyin.")}
      `;
    }

    const selectedProduct = state.data.products[0];
    const defaultPurchasePrice = Number(selectedProduct?.purchasePrice || 0);
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Mal alımı ve stok hareketi</p>
          <h2>Stok Girişi</h2>
        </div>
      </div>
      <div class="split">
        <section class="panel">
          <h3>Yeni mal alımı</h3>
          <form id="stockEntryForm">
            <div class="field">
              <label for="stockProduct">Ürün / Hammadde</label>
              <select id="stockProduct">
                ${state.data.products.map((product) => `<option value="${product.id}">${escapeHtml(product.name)} - mevcut: ${formatStock(product.stock, product.unit)}</option>`).join("")}
              </select>
            </div>
            <div class="form-grid two">
              ${field("stockEntryAmount", "Gelen miktar", "", "20", "number")}
              <div class="field">
                <label for="stockEntryType">Birim</label>
                <select id="stockEntryType">
                  <option value="Kg">kg</option>
                  <option value="Gram">gram</option>
                  <option value="Adet">adet</option>
                  <option value="Koli">koli</option>
                </select>
              </div>
              ${field("stockEntryUnitPrice", "Kg veya adet alış fiyatı", defaultPurchasePrice, "240", "number")}
              ${field("stockEntryCost", "Toplam alış maliyeti", "", "4800", "number")}
              ${field("stockEntrySupplier", "Tedarikçi", "", "Ana tedarikçi")}
              ${field("stockEntryInvoice", "Fatura / fiş no", "", "FIS-001")}
              <div class="field">
                <label for="stockEntryPaymentStatus">Ödeme durumu</label>
                <select id="stockEntryPaymentStatus">
                  <option value="Ödendi">Ödendi</option>
                  <option value="Veresiye">Veresiye</option>
                  <option value="Kısmi ödendi">Kısmi ödendi</option>
                </select>
              </div>
              ${field("stockEntryPaidAmount", "Ödenen tutar", "", "0", "number")}
              ${field("stockEntrySupplierDebt", "Kalan tedarikçi borcu", "", "0", "number")}
              ${field("stockEntryDate", "Teslim tarihi", new Date().toISOString().slice(0, 10), "", "date")}
              ${field("stockEntryExpiryDate", "Son kullanma tarihi", "", "", "date")}
            </div>
            <div class="field">
              <label for="stockEntryNote">Not</label>
              <textarea id="stockEntryNote" rows="3" placeholder="Fatura, teslimat veya kalite notu"></textarea>
            </div>
            <button class="button primary" id="saveStockEntry" type="button" style="width: 100%;">Mal Alımını Kaydet</button>
          </form>
        </section>
        <section class="panel">
          <h3>Son stok hareketleri</h3>
          ${stockMovementsTable(state.data.stockMovements)}
        </section>
      </div>
    `;
  }

  function updateStockEntryDefaults() {
    const product = findProductById(valueOf("stockProduct"));
    const unitPriceInput = document.getElementById("stockEntryUnitPrice");
    const typeSelect = document.getElementById("stockEntryType");
    const costInput = document.getElementById("stockEntryCost");
    const amountInput = document.getElementById("stockEntryAmount");
    const paidInput = document.getElementById("stockEntryPaidAmount");
    const debtInput = document.getElementById("stockEntrySupplierDebt");
    if (!product) return;
    if (unitPriceInput) unitPriceInput.value = String(Number(product.purchasePrice || 0));
    if (typeSelect && isRawMaterial(product)) typeSelect.value = "Kg";
    const recalc = () => {
      const amount = parseMoneyValue(amountInput?.value || 0);
      const unit = typeSelect?.value || "Adet";
      const normalizedAmount = unit === "Gram" ? amount / 1000 : amount;
      const unitPrice = parseMoneyValue(unitPriceInput?.value || 0);
      const total = Math.round(normalizedAmount * unitPrice * 100) / 100;
      if (costInput && total > 0) costInput.value = String(total);
      const paid = parseMoneyValue(paidInput?.value || 0);
      if (debtInput) debtInput.value = String(Math.max(0, total - paid));
    };
    [amountInput, typeSelect, unitPriceInput, paidInput].forEach((element) => {
      element?.addEventListener("input", recalc);
      element?.addEventListener("change", recalc);
    });
    recalc();
  }

  function recordStockEntry() {
    const productId = valueOf("stockProduct");
    const product = state.data.products.find((item) => item.id === productId);
    const entryType = valueOf("stockEntryType") || "Adet";
    const amount = parseMoneyValue(valueOf("stockEntryAmount") || 0);
    const unitPrice = parseMoneyValue(valueOf("stockEntryUnitPrice") || 0);
    const manualCost = parseMoneyValue(valueOf("stockEntryCost") || 0);
    const supplier = valueOf("stockEntrySupplier");
    const invoiceNumber = valueOf("stockEntryInvoice");
    const paymentStatus = valueOf("stockEntryPaymentStatus") || "Ödendi";
    const paidAmount = parseMoneyValue(valueOf("stockEntryPaidAmount") || 0);
    const supplierDebt = parseMoneyValue(valueOf("stockEntrySupplierDebt") || 0);
    const date = valueOf("stockEntryDate") || new Date().toISOString().slice(0, 10);
    const expiryDate = valueOf("stockEntryExpiryDate");
    const note = valueOf("stockEntryNote");
    if (!product) {
      showToast("Stok girisi icin urun secin.");
      return;
    }
    if (amount <= 0) {
      showToast("Stok girisi icin miktar girin.");
      return;
    }
    const isRaw = isRawMaterial(product);
    const packageSize = Number(product.packageSize || 0);
    let addedQuantity = amount;
    let addedUnit = entryType;
    if (entryType === "Gram") {
      addedQuantity = roundStock(amount / 1000);
      addedUnit = "Kg";
    }
    if (!isRaw && entryType === "Koli") {
      if (packageSize <= 0) {
        showToast("Bu urunun koli ici adet bilgisi yok.");
        return;
      }
      addedQuantity = amount * packageSize;
      addedUnit = "Adet";
    }
    const oldStock = roundStock(product.stock || 0);
    const oldCost = Number(product.purchasePrice || 0);
    const normalizedCostQuantity = addedUnit === "Kg" || isRaw ? roundStock(addedQuantity) : addedQuantity;
    const cost = manualCost > 0 ? manualCost : Math.round(normalizedCostQuantity * unitPrice * 100) / 100;
    if (isRaw && unitPrice > 0) {
      product.purchasePrice = calculateWeightedAverageCost(oldStock, oldCost, normalizedCostQuantity, unitPrice);
    }
    product.stock = roundStock(oldStock + addedQuantity);
    if (supplier) product.supplier = supplier;
    state.data.stockMovements.push({
      id: createId(),
      date,
      dateTime: new Date().toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      productId: product.id,
      productName: product.name,
      productType: product.type,
      entryType,
      amount,
      addedQuantity: roundStock(addedQuantity),
      addedUnit,
      unitPrice,
      cost,
      supplier,
      invoiceNumber,
      paymentStatus,
      paidAmount,
      supplierDebt: supplierDebt || Math.max(0, cost - paidAmount),
      deliveryDate: date,
      expiryDate,
      note,
      oldStock,
      newStock: product.stock,
      weightedAverageCost: product.purchasePrice || 0
    });
    saveData();
    showToast("Mal alımı kaydedildi. Stok ve ortalama maliyet güncellendi.");
    render();
  }

  function productionWastePage() {
    const summary = getProductionWasteSummary();
    return `
      <section class="production-waste-page">
        <div class="section-head">
          <div>
            <p class="eyebrow">Zayiat ve gün sonu kontrolü</p>
            <h2>Zayiat ve Sayım</h2>
          </div>
          <div class="top-actions">
            <button class="button" type="button" id="openWasteModal">Yeni Zayiat</button>
            <button class="button" type="button" id="openStockCountModal">Gün Sonu Sayımı</button>
          </div>
        </div>
        <div class="grid metrics">
          ${metric("Bugünkü zayiat", formatStock(summary.todayWasteKg, "Kg"))}
          ${metric("Toplam zayiat", formatStock(summary.totalWasteKg, "Kg"))}
          ${metric("Toplam zayiat maliyeti", formatTRY(summary.totalWasteCost))}
          ${metric("Mevcut çiğköfte stoku", formatStock(getCigkofteRawMaterial()?.stock || 0, "Kg"))}
        </div>
        <div class="grid dashboard-grid" style="margin-top: 14px;">
          <section class="panel">
            <h3>Zayiat geçmişi</h3>
            ${wasteRecordsTable(summary.wasteRecords)}
          </section>
          <section class="panel">
            <h3>Geçmiş üretim kayıtları</h3>
            <p class="muted">Bu işletme profilinde çiğköfte hazır kg olarak alındığı için yeni üretim kaydı kapalıdır. Eski kayıtlar silinmeden korunur.</p>
            ${productionRecordsTable(summary.productionRecords)}
          </section>
        </div>
      </section>
    `;
  }

  function reportsPage(summary) {
    const productionWasteSummary = getProductionWasteSummary();
    const purchaseSummary = getMaterialPurchaseSummary();
    const cashReportSummary = getCashClosingReportSummary();
    const categoryTotals = state.data.products.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + product.sold * product.price;
      return acc;
    }, {});
    return `
      <div class="section-head">
        <div>
          <p class="eyebrow">Raporlar</p>
          <h2>Gun Sonu Ozeti</h2>
        </div>
      </div>
      <div class="grid dashboard-grid">
        <section class="panel">
          <h3>Kategori cirolari</h3>
          ${Object.keys(categoryTotals).length ? Object.entries(categoryTotals).map(([category, total]) => reportRow(category, money.format(total))).join("") : empty("Kategori cirosu icin satis gerekir.")}
        </section>
        <section class="panel">
          <h3>Net kar ozeti</h3>
          ${reportRow("Toplam ciro", money.format(summary.revenue))}
          ${reportRow("Toplam gider", money.format(summary.expenseTotal))}
          ${reportRow("Zayiat maliyeti", formatTRY(productionWasteSummary.totalWasteCost))}
          ${reportRow("Net operasyon kârı", formatTRY(summary.netProfit - productionWasteSummary.totalWasteCost))}
          ${reportRow("Toplam satis adedi", summary.count)}
          ${reportRow("En cok satan", summary.bestSeller ? summary.bestSeller.name : "-")}
        </section>
        <section class="panel">
          <h3>Mal alımı</h3>
          ${reportRow("Günlük mal girişi", formatStock(purchaseSummary.todayIncomingKg, "Kg"))}
          ${reportRow("Aylık alınan çiğköfte", formatStock(purchaseSummary.monthlyCigkofteKg, "Kg"))}
          ${reportRow("Ortalama alış fiyatı", formatTRY(purchaseSummary.averageCigkoftePurchasePrice))}
          ${reportRow("Toplam mal alış maliyeti", formatTRY(purchaseSummary.monthlyPurchaseCost))}
        </section>
        <section class="panel">
          <h3>Kasa kapanışları</h3>
          ${reportRow("Günlük kasa farkı", formatTRY(cashReportSummary.dailyCashDifference))}
          ${reportRow("Haftalık toplam kasa farkı", formatTRY(cashReportSummary.weeklyCashDifference))}
          ${reportRow("Aylık kasa farkı", formatTRY(cashReportSummary.monthlyCashDifference))}
          ${reportRow("Ödeme yöntemi mutabakat farkları", formatTRY(cashReportSummary.paymentDifference))}
          ${reportRow("Kapanışı yapılmayan günler", cashReportSummary.unclosedDays.length ? cashReportSummary.unclosedDays.join(", ") : "Yok")}
          ${reportRow("Ortalama günlük nakit", formatTRY(cashReportSummary.averageDailyCash))}
          ${reportRow("Ortalama fiş tutarı", formatTRY(cashReportSummary.averageReceipt))}
          ${reportRow("Günlük net operasyon kârı", formatTRY(cashReportSummary.dailyNetOperatingProfit))}
        </section>
        <section class="panel">
          <h3>Gider kategorilerine gore toplamlar</h3>
          ${Object.keys(summary.expenseCategoryTotals).length ? Object.entries(summary.expenseCategoryTotals).map(([category, total]) => reportRow(category, money.format(total))).join("") : empty("Henuz gider kategorisi yok.")}
        </section>
      </div>
    `;
  }

  function getProductionRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PRODUCTION_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Üretim kayıtları okunamadı:", error);
      return [];
    }
  }

  function saveProductionRecords(records) {
    try {
      localStorage.setItem(PRODUCTION_STORAGE_KEY, JSON.stringify(Array.isArray(records) ? records : []));
      return true;
    } catch (error) {
      console.error("Üretim kayıtları kaydedilemedi:", error);
      return false;
    }
  }

  function getWasteRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(WASTE_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Zayiat kayıtları okunamadı:", error);
      return [];
    }
  }

  function saveWasteRecords(records) {
    try {
      localStorage.setItem(WASTE_STORAGE_KEY, JSON.stringify(Array.isArray(records) ? records : []));
      return true;
    } catch (error) {
      console.error("Zayiat kayıtları kaydedilemedi:", error);
      return false;
    }
  }

  function calculateWeightedAverageCost(currentKg, currentCost, addedKg, addedCost) {
    const stockKg = roundStock(currentKg);
    const productionKg = roundStock(addedKg);
    const totalKg = roundStock(stockKg + productionKg);
    if (totalKg <= 0) return roundStock(addedCost);
    const weighted = ((stockKg * (Number(currentCost) || 0)) + (productionKg * (Number(addedCost) || 0))) / totalKg;
    return Math.round(weighted * 100) / 100;
  }

  function getCigkofteRawMaterial() {
    return findRawMaterialByName("Çiğköfte");
  }

  function createProductionRecord(formData) {
    if (state.productionWasteBusy) throw new Error("İşlem devam ediyor.");
    state.productionWasteBusy = true;
    try {
      const product = getCigkofteRawMaterial();
      if (!product) throw new Error("Çiğköfte hammaddesi bulunamadı.");
      const amountKg = roundStock(parseMoneyValue(formData.amountKg));
      const unitCost = parseMoneyValue(formData.unitCost || product.purchasePrice || 0);
      const date = String(formData.date || new Date().toISOString().slice(0, 10));
      if (amountKg <= 0) throw new Error("Üretim miktarı sıfırdan büyük olmalıdır.");
      if (unitCost <= 0) throw new Error("Kg üretim maliyeti girilmelidir.");

      const beforeStock = roundStock(product.stock || 0);
      const beforeCost = Number(product.purchasePrice || 0);
      const newCost = calculateWeightedAverageCost(beforeStock, beforeCost, amountKg, unitCost);
      product.stock = roundStock(beforeStock + amountKg);
      product.purchasePrice = newCost;

      const record = {
        id: generateVeresiyeId("production"),
        productId: product.id,
        productName: product.name,
        amountKg,
        unitCost,
        totalCost: Math.round(amountKg * unitCost * 100) / 100,
        beforeStock,
        afterStock: product.stock,
        previousUnitCost: beforeCost,
        newUnitCost: newCost,
        date,
        note: String(formData.note || "").trim(),
        createdAt: new Date().toISOString(),
        createdBy: "Admin"
      };
      const records = getProductionRecords();
      records.unshift(record);
      if (!saveProductionRecords(records)) throw new Error("Üretim kaydedilemedi.");
      saveData();
      return record;
    } finally {
      state.productionWasteBusy = false;
    }
  }

  function deleteProductionRecord(recordId) {
    const records = getProductionRecords();
    const record = records.find((item) => item.id === recordId);
    if (!record) throw new Error("Üretim kaydı bulunamadı.");
    const product = findProductById(record.productId);
    if (product) {
      product.stock = roundStock((Number(product.stock) || 0) - Number(record.amountKg || 0));
      product.purchasePrice = Number(record.previousUnitCost || product.purchasePrice || 0);
    }
    if (!saveProductionRecords(records.filter((item) => item.id !== recordId))) throw new Error("Üretim silinemedi.");
    saveData();
    return true;
  }

  function createWasteRecord(formData) {
    if (state.productionWasteBusy) throw new Error("İşlem devam ediyor.");
    state.productionWasteBusy = true;
    try {
      const product = findProductById(formData.productId) || getCigkofteRawMaterial();
      if (!product) throw new Error("Zayiat ürünü bulunamadı.");
      const amountKg = roundStock(parseMoneyValue(formData.amountKg));
      const date = String(formData.date || new Date().toISOString().slice(0, 10));
      if (amountKg <= 0) throw new Error("Zayiat miktarı sıfırdan büyük olmalıdır.");
      if (amountKg > Number(product.stock || 0)) throw new Error("Zayiat için yeterli stok yok.");
      const unitCost = Number(product.purchasePrice || 0);
      product.stock = roundStock(Number(product.stock || 0) - amountKg);
      const record = {
        id: generateVeresiyeId("waste"),
        productId: product.id,
        productName: product.name,
        amountKg,
        unitCost,
        totalCost: Math.round(amountKg * unitCost * 100) / 100,
        reason: String(formData.reason || "Zayiat").trim(),
        date,
        note: String(formData.note || "").trim(),
        createdAt: new Date().toISOString(),
        createdBy: "Admin"
      };
      const records = getWasteRecords();
      records.unshift(record);
      if (!saveWasteRecords(records)) throw new Error("Zayiat kaydedilemedi.");
      saveData();
      return record;
    } finally {
      state.productionWasteBusy = false;
    }
  }

  function deleteWasteRecord(recordId) {
    const records = getWasteRecords();
    const record = records.find((item) => item.id === recordId);
    if (!record) throw new Error("Zayiat kaydı bulunamadı.");
    const product = findProductById(record.productId);
    if (product) product.stock = roundStock((Number(product.stock) || 0) + Number(record.amountKg || 0));
    if (!saveWasteRecords(records.filter((item) => item.id !== recordId))) throw new Error("Zayiat silinemedi.");
    saveData();
    return true;
  }

  function saveStockCountAdjustment(formData) {
    const product = findProductById(formData.productId) || getCigkofteRawMaterial();
    if (!product) throw new Error("Sayım ürünü bulunamadı.");
    const countedKg = roundStock(parseMoneyValue(formData.countedKg));
    if (countedKg < 0) throw new Error("Sayım miktarı geçersiz.");
    const beforeStock = roundStock(product.stock || 0);
    const differenceKg = roundStock(countedKg - beforeStock);
    product.stock = countedKg;
    state.data.stockMovements.push({
      id: createId(),
      date: String(formData.date || new Date().toISOString().slice(0, 10)),
      dateTime: new Date().toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      productId: product.id,
      productName: product.name,
      productType: product.type,
      entryType: "stock_adjustment",
      amount: differenceKg,
      addedQuantity: differenceKg,
      addedUnit: product.unit || "Kg",
      unitPrice: product.purchasePrice || 0,
      cost: Math.round(Math.abs(differenceKg) * (Number(product.purchasePrice) || 0) * 100) / 100,
      supplier: "",
      note: String(formData.note || "Gün sonu sayım farkı").trim(),
      beforeStock,
      countedStock: countedKg,
      differenceKg
    });
    saveData();
    return { product, beforeStock, countedKg, differenceKg };
  }

  function getProductionWasteSummary() {
    const today = new Date().toISOString().slice(0, 10);
    const productionRecords = getProductionRecords();
    const wasteRecords = getWasteRecords();
    return {
      productionRecords,
      wasteRecords,
      todayProductionKg: productionRecords.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.amountKg || 0), 0),
      todayWasteKg: wasteRecords.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.amountKg || 0), 0),
      totalProductionKg: productionRecords.reduce((sum, item) => sum + Number(item.amountKg || 0), 0),
      totalWasteKg: wasteRecords.reduce((sum, item) => sum + Number(item.amountKg || 0), 0),
      totalProductionCost: productionRecords.reduce((sum, item) => sum + Number(item.totalCost || 0), 0),
      totalWasteCost: wasteRecords.reduce((sum, item) => sum + Number(item.totalCost || 0), 0)
    };
  }

  function productionWastePage() {
    const summary = getProductionWasteSummary();
    return `
      <section class="production-waste-page">
        <div class="section-head">
          <div>
            <p class="eyebrow">Zayiat ve gün sonu kontrolü</p>
            <h2>Zayiat ve Sayım</h2>
          </div>
          <div class="top-actions">
            <button class="button" type="button" id="openWasteModal">Yeni Zayiat</button>
            <button class="button" type="button" id="openStockCountModal">Gün Sonu Sayımı</button>
          </div>
        </div>
        <div class="grid metrics">
          ${metric("Bugünkü zayiat", formatStock(summary.todayWasteKg, "Kg"))}
          ${metric("Toplam zayiat", formatStock(summary.totalWasteKg, "Kg"))}
          ${metric("Toplam zayiat maliyeti", formatTRY(summary.totalWasteCost))}
          ${metric("Mevcut çiğköfte stoku", formatStock(getCigkofteRawMaterial()?.stock || 0, "Kg"))}
        </div>
        <div class="grid dashboard-grid" style="margin-top: 14px;">
          <section class="panel">
            <h3>Zayiat geçmişi</h3>
            ${wasteRecordsTable(summary.wasteRecords)}
          </section>
          <section class="panel">
            <h3>Geçmiş üretim kayıtları</h3>
            <p class="muted">Bu işletme profilinde çiğköfte hazır kg olarak alındığı için yeni üretim kaydı kapalıdır. Eski kayıtlar silinmeden korunur.</p>
            ${productionRecordsTable(summary.productionRecords)}
          </section>
        </div>
      </section>
    `;
  }

  function productionRecordsTable(records) {
    if (!records.length) return empty("Henüz üretim kaydı yok.");
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tarih</th><th>Ürün</th><th>Miktar</th><th>Kg maliyet</th><th>Toplam</th><th>Yeni ort.</th><th>Not</th><th></th></tr></thead>
          <tbody>${records.map((record) => `
            <tr>
              <td>${escapeHtml(record.date)}</td>
              <td>${escapeHtml(record.productName)}</td>
              <td>${formatStock(record.amountKg, "Kg")}</td>
              <td>${formatTRY(record.unitCost)}</td>
              <td>${formatTRY(record.totalCost)}</td>
              <td>${formatTRY(record.newUnitCost)}</td>
              <td>${escapeHtml(record.note || "-")}</td>
              <td><button class="button compact danger-button" type="button" data-delete-production="${escapeAttribute(record.id)}">Sil</button></td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function wasteRecordsTable(records) {
    if (!records.length) return empty("Henüz zayiat kaydı yok.");
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tarih</th><th>Ürün</th><th>Miktar</th><th>Sebep</th><th>Maliyet</th><th>Not</th><th></th></tr></thead>
          <tbody>${records.map((record) => `
            <tr>
              <td>${escapeHtml(record.date)}</td>
              <td>${escapeHtml(record.productName)}</td>
              <td>${formatStock(record.amountKg, "Kg")}</td>
              <td>${escapeHtml(record.reason || "-")}</td>
              <td>${formatTRY(record.totalCost)}</td>
              <td>${escapeHtml(record.note || "-")}</td>
              <td><button class="button compact danger-button" type="button" data-delete-waste="${escapeAttribute(record.id)}">Sil</button></td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function openProductionModal() {
    const product = getCigkofteRawMaterial();
    const modal = openModal("Yeni Üretim", `
      <form id="productionForm">
        <div class="form-grid two">
          <input name="amountKg" type="number" min="0.001" step="0.001" placeholder="Üretilen kg" required />
          <input name="unitCost" type="number" min="0.01" step="0.01" value="${Number(product?.purchasePrice || "")}" placeholder="Kg maliyet" required />
          <input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
        <textarea name="note" placeholder="Not"></textarea>
        <div class="modal-actions">
          <button type="button" class="button" data-close-modal>İptal</button>
          <button type="submit" class="button primary">Üretimi Kaydet</button>
        </div>
      </form>
    `);
    modal.querySelector("#productionForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button[type='submit']");
      button.disabled = true;
      const data = new FormData(event.currentTarget);
      try {
        createProductionRecord({ amountKg: data.get("amountKg"), unitCost: data.get("unitCost"), date: data.get("date"), note: data.get("note") });
        closeActiveModal();
        render();
      } catch (error) {
        button.disabled = false;
        showToast(error.message);
      }
    });
  }

  function openWasteModal() {
    const product = getCigkofteRawMaterial();
    const modal = openModal("Yeni Zayiat", `
      <form id="wasteForm">
        <div class="form-grid two">
          <input name="amountKg" type="number" min="0.001" step="0.001" placeholder="Zayiat kg" required />
          <select name="reason">
            <option value="Bozulma">Bozulma</option>
            <option value="Dökülme">Dökülme</option>
            <option value="Personel kullanımı">Personel kullanımı</option>
            <option value="Sayım farkı">Sayım farkı</option>
            <option value="Diğer">Diğer</option>
          </select>
          <input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
        <p class="muted">Mevcut çiğköfte stoku: ${formatStock(product?.stock || 0, "Kg")}</p>
        <textarea name="note" placeholder="Not"></textarea>
        <div class="modal-actions">
          <button type="button" class="button" data-close-modal>İptal</button>
          <button type="submit" class="button primary">Zayiatı Kaydet</button>
        </div>
      </form>
    `);
    modal.querySelector("#wasteForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button[type='submit']");
      button.disabled = true;
      const data = new FormData(event.currentTarget);
      try {
        createWasteRecord({ productId: product?.id, amountKg: data.get("amountKg"), reason: data.get("reason"), date: data.get("date"), note: data.get("note") });
        closeActiveModal();
        render();
      } catch (error) {
        button.disabled = false;
        showToast(error.message);
      }
    });
  }

  function openStockCountModal() {
    const product = getCigkofteRawMaterial();
    const modal = openModal("Gün Sonu Sayımı", `
      <form id="stockCountForm">
        <div class="form-grid two">
          <input name="countedKg" type="number" min="0" step="0.001" value="${roundStock(product?.stock || 0)}" placeholder="Sayım kg" required />
          <input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" />
        </div>
        <p class="muted">Sistem stoku: ${formatStock(product?.stock || 0, "Kg")}</p>
        <textarea name="note" placeholder="Sayım notu"></textarea>
        <div class="modal-actions">
          <button type="button" class="button" data-close-modal>İptal</button>
          <button type="submit" class="button primary">Sayımı Kaydet</button>
        </div>
      </form>
    `);
    modal.querySelector("#stockCountForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button[type='submit']");
      button.disabled = true;
      const data = new FormData(event.currentTarget);
      try {
        saveStockCountAdjustment({ productId: product?.id, countedKg: data.get("countedKg"), date: data.get("date"), note: data.get("note") });
        closeActiveModal();
        render();
      } catch (error) {
        button.disabled = false;
        showToast(error.message);
      }
    });
  }

  function bindProductionWasteEvents() {
    bindClick("openWasteModal", openWasteModal);
    bindClick("openStockCountModal", openStockCountModal);
    document.querySelectorAll("[data-delete-production]").forEach((button) => {
      button.addEventListener("click", () => {
        try {
          deleteProductionRecord(button.dataset.deleteProduction);
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });
    document.querySelectorAll("[data-delete-waste]").forEach((button) => {
      button.addEventListener("click", () => {
        try {
          deleteWasteRecord(button.dataset.deleteWaste);
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });
  }


  function getCashClosings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CASH_CLOSING_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Kasa kapanış kayıtları okunamadı:", error);
      return [];
    }
  }

  function saveCashClosings(records) {
    try {
      localStorage.setItem(CASH_CLOSING_STORAGE_KEY, JSON.stringify(Array.isArray(records) ? records : []));
      return true;
    } catch (error) {
      console.error("Kasa kapanış kayıtları kaydedilemedi:", error);
      return false;
    }
  }

  function normalizePaymentMethod(method) {
    const normalized = String(method || "")
      .trim()
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .replace(/İ/g, "i")
      .replace(/[^a-z0-9]/g, "");
    if (normalized.includes("nakit") || normalized.includes("cash")) return "cash";
    if (normalized.includes("pos") || normalized.includes("kart") || normalized.includes("kredi")) return "pos";
    if (normalized.includes("iban") || normalized.includes("havale") || normalized.includes("eft")) return "iban";
    if (normalized.includes("online") || normalized.includes("web")) return "online";
    if (normalized.includes("veresiye") || normalized.includes("krediye")) return "credit";
    return "unknown";
  }

  function cashClosingDateKey(value) {
    if (!value) return new Date().toISOString().slice(0, 10);
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
  }

  function isCanceledSale(sale) {
    const status = String(sale?.status || sale?.state || "").toLocaleLowerCase("tr-TR");
    return Boolean(sale?.cancelled || sale?.canceled || sale?.isCancelled || status.includes("iptal") || status.includes("cancel"));
  }

  function isRefundedSale(sale) {
    const status = String(sale?.status || sale?.state || "").toLocaleLowerCase("tr-TR");
    return Boolean(sale?.refunded || sale?.isRefund || status.includes("iade") || status.includes("refund"));
  }

  function saleAmountForCashClosing(sale) {
    const total = parseMoneyValue(sale?.total ?? sale?.amount ?? 0);
    if (isCanceledSale(sale)) return 0;
    return isRefundedSale(sale) ? -Math.abs(total) : total;
  }

  function saleCostForCashClosing(sale) {
    const cost = parseMoneyValue(sale?.recipeCost ?? sale?.cost ?? 0);
    if (isCanceledSale(sale)) return 0;
    return isRefundedSale(sale) ? -Math.abs(cost) : cost;
  }

  function getDailyCreditCollections(date) {
    const totals = { total: 0, cash: 0, pos: 0, iban: 0, online: 0, unknown: 0 };
    getVeresiyeCustomers().forEach((customer) => {
      (Array.isArray(customer.transactions) ? customer.transactions : []).forEach((transaction) => {
        if (transaction.type !== "payment") return;
        if (cashClosingDateKey(transaction.createdAt) !== date) return;
        const amount = parseMoneyValue(transaction.amount);
        const method = normalizePaymentMethod(transaction.paymentMethod || "Nakit");
        totals.total += amount;
        if (method === "cash") totals.cash += amount;
        else if (method === "pos") totals.pos += amount;
        else if (method === "iban") totals.iban += amount;
        else if (method === "online") totals.online += amount;
        else totals.unknown += amount;
      });
    });
    Object.keys(totals).forEach((key) => totals[key] = Math.round(totals[key] * 100) / 100);
    return totals;
  }

  function getDailyExpenseBreakdown(date) {
    const totals = { total: 0, cash: 0, pos: 0, iban: 0, online: 0, unknown: 0 };
    state.data.expenses.forEach((expense) => {
      if (cashClosingDateKey(expense.date) !== date) return;
      const amount = parseMoneyValue(expense.amount);
      const method = normalizePaymentMethod(expense.paymentMethod || "");
      totals.total += amount;
      if (method === "cash") totals.cash += amount;
      else if (method === "pos") totals.pos += amount;
      else if (method === "iban") totals.iban += amount;
      else if (method === "online") totals.online += amount;
      else totals.unknown += amount;
    });
    Object.keys(totals).forEach((key) => totals[key] = Math.round(totals[key] * 100) / 100);
    return totals;
  }

  function getDailySupplierPayments(date) {
    return { total: 0, cash: 0, pos: 0, iban: 0, online: 0 };
  }

  function calculateDailyCashSummary(date) {
    const day = cashClosingDateKey(date);
    const sales = state.data.sales.filter((sale) => cashClosingDateKey(sale.date || sale.createdAt) === day);
    const paymentTotals = { cash: 0, pos: 0, iban: 0, online: 0, credit: 0, unknown: 0 };
    let totalSales = 0;
    let soldProductCost = 0;
    let saleCount = 0;
    let tipAmount = 0;
    let changeReturned = 0;
    const productCounts = {};

    sales.forEach((sale) => {
      const amount = saleAmountForCashClosing(sale);
      const cost = saleCostForCashClosing(sale);
      const method = normalizePaymentMethod(sale.paymentMethod);
      const saleTip = isCanceledSale(sale) || isRefundedSale(sale) ? 0 : parseMoneyValue(sale.tipAmount);
      const saleChangeReturned = isCanceledSale(sale) || isRefundedSale(sale) ? 0 : parseMoneyValue(sale.changeReturned);
      totalSales += amount;
      soldProductCost += cost;
      tipAmount += saleTip;
      changeReturned += saleChangeReturned;
      paymentTotals[method] = (paymentTotals[method] || 0) + amount;
      if (!isCanceledSale(sale) && !isRefundedSale(sale)) saleCount += 1;
      const items = Array.isArray(sale.items) && sale.items.length ? sale.items : [sale];
      items.forEach((item) => {
        const name = item.productName || item.name || sale.productName || "Ürün";
        productCounts[name] = (productCounts[name] || 0) + Number(item.quantity || 1);
      });
    });

    const creditCollections = getDailyCreditCollections(day);
    const expenses = getDailyExpenseBreakdown(day);
    const supplierPayments = getDailySupplierPayments(day);
    const wasteCost = getWasteRecords().filter((record) => cashClosingDateKey(record.date) === day).reduce((sum, record) => sum + parseMoneyValue(record.totalCost), 0);
    const grossProfit = totalSales - soldProductCost;
    const netOperatingProfit = grossProfit - expenses.total - wasteCost;
    const bestSeller = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];
    const refunds = sales.filter(isRefundedSale).reduce((sum, sale) => sum + Math.abs(parseMoneyValue(sale.total)), 0);
    const cancelled = sales.filter(isCanceledSale).reduce((sum, sale) => sum + Math.abs(parseMoneyValue(sale.total)), 0);

    return {
      date: day,
      totalSales: Math.round(totalSales * 100) / 100,
      productSalesRevenue: Math.round(totalSales * 100) / 100,
      tipAmount: Math.round(tipAmount * 100) / 100,
      changeReturned: Math.round(changeReturned * 100) / 100,
      cashProductSalesForExpected: Math.round(((paymentTotals.cash || 0) + changeReturned) * 100) / 100,
      realCashIn: Math.round(((paymentTotals.cash || 0) + tipAmount) * 100) / 100,
      cashSales: Math.round((paymentTotals.cash || 0) * 100) / 100,
      posSales: Math.round((paymentTotals.pos || 0) * 100) / 100,
      ibanSales: Math.round((paymentTotals.iban || 0) * 100) / 100,
      onlineSales: Math.round((paymentTotals.online || 0) * 100) / 100,
      creditSales: Math.round((paymentTotals.credit || 0) * 100) / 100,
      unknownSales: Math.round((paymentTotals.unknown || 0) * 100) / 100,
      creditCollections,
      expenses,
      supplierPayments,
      refunds,
      cancelled,
      wasteCost: Math.round(wasteCost * 100) / 100,
      soldProductCost: Math.round(soldProductCost * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      netOperatingProfit: Math.round(netOperatingProfit * 100) / 100,
      saleCount,
      averageReceipt: saleCount > 0 ? Math.round((totalSales / saleCount) * 100) / 100 : 0,
      bestSeller: bestSeller ? bestSeller[0] : "-",
      posExpected: Math.round(((paymentTotals.pos || 0) + creditCollections.pos) * 100) / 100,
      ibanExpected: Math.round(((paymentTotals.iban || 0) + creditCollections.iban) * 100) / 100,
      onlineExpected: Math.round(((paymentTotals.online || 0) + creditCollections.online) * 100) / 100
    };
  }

  function calculateExpectedCash(summary, values = {}) {
    const openingCash = parseMoneyValue(values.openingCash);
    const otherIn = parseMoneyValue(values.otherCashIn);
    const otherOut = parseMoneyValue(values.otherCashOut);
    return Math.round((openingCash + (summary.cashProductSalesForExpected ?? summary.cashSales) + (summary.tipAmount || 0) - (summary.changeReturned || 0) + summary.creditCollections.cash - summary.expenses.cash - summary.supplierPayments.cash - Math.abs(summary.refunds || 0) + otherIn - otherOut) * 100) / 100;
  }

  function calculateDenominationTotal(values = {}) {
    const denominations = [200, 100, 50, 20, 10, 5];
    const bills = denominations.reduce((sum, amount) => {
      const count = Math.max(0, parseMoneyValue(values[`denom${amount}`]));
      return sum + (count * amount);
    }, 0);
    return Math.round((bills + Math.max(0, parseMoneyValue(values.denomCoins))) * 100) / 100;
  }

  function getCashClosingByDate(date) {
    const day = cashClosingDateKey(date);
    return getCashClosings().find((record) => record.date === day) || null;
  }

  function getPreviousDayCarryOver(date) {
    const day = cashClosingDateKey(date);
    const previous = getCashClosings()
      .filter((record) => record.date < day)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return previous ? parseMoneyValue(previous.carryOverCash ?? previous.nextOpeningCash ?? 0) : 0;
  }

  function cashClosingStatusLabel(difference) {
    if (difference === 0) return "Kasa Tam";
    return difference > 0 ? "Kasa Fazlası" : "Kasa Eksiği";
  }

  function createOrUpdateCashClosing(formData) {
    if (state.cashClosingBusy) throw new Error("Kapanış işlemi devam ediyor.");
    state.cashClosingBusy = true;
    try {
      const date = cashClosingDateKey(formData.date);
      const summary = calculateDailyCashSummary(date);
      const values = {
        openingCash: parseMoneyValue(formData.openingCash),
        otherCashIn: parseMoneyValue(formData.otherCashIn),
        otherCashOut: parseMoneyValue(formData.otherCashOut)
      };
      const countedCash = parseMoneyValue(formData.countedCash);
      const posCounted = parseMoneyValue(formData.posCounted);
      const ibanCounted = parseMoneyValue(formData.ibanCounted);
      const onlineCounted = parseMoneyValue(formData.onlineCounted);
      const carryOverCash = parseMoneyValue(formData.carryOverCash);
      const cashTaken = parseMoneyValue(formData.cashTaken);
      const note = String(formData.note || "").trim();
      if (!date) throw new Error("Tarih seçilmelidir.");
      if (countedCash <= 0 && String(formData.countedCash || "").trim() === "") throw new Error("Gerçek sayılan nakit girilmelidir.");
      const denominationTotal = calculateDenominationTotal(formData);
      const expectedCash = calculateExpectedCash(summary, values);
      const cashDifference = Math.round((countedCash - expectedCash) * 100) / 100;
      const posDifference = Math.round((posCounted - summary.posExpected) * 100) / 100;
      const ibanDifference = Math.round((ibanCounted - summary.ibanExpected) * 100) / 100;
      const onlineDifference = Math.round((onlineCounted - summary.onlineExpected) * 100) / 100;
      if ((cashDifference !== 0 || posDifference !== 0 || ibanDifference !== 0 || onlineDifference !== 0) && !note) throw new Error("Fark varsa açıklama/not zorunludur.");
      if (Math.round((cashTaken + carryOverCash - countedCash) * 100) / 100 !== 0) throw new Error("Kasadan alınan para + ertesi güne devir, sayılan nakit ile eşleşmelidir.");

      const closings = getCashClosings();
      const existingIndex = closings.findIndex((record) => record.date === date);
      if (existingIndex >= 0 && !formData.allowUpdate && !window.confirm(`${date} tarihi için kapanış var. Kapanışı güncellemek istiyor musunuz?`)) return closings[existingIndex];

      const record = {
        id: existingIndex >= 0 ? closings[existingIndex].id : generateVeresiyeId("cash_closing"),
        date,
        openingCash: values.openingCash,
        expectedCash,
        countedCash,
        cashDifference,
        posExpected: summary.posExpected,
        posCounted,
        posDifference,
        ibanExpected: summary.ibanExpected,
        ibanCounted,
        ibanDifference,
        onlineExpected: summary.onlineExpected,
        onlineCounted,
        onlineDifference,
        creditSales: summary.creditSales,
        creditCollections: summary.creditCollections.total,
        cashCreditCollections: summary.creditCollections.cash,
        supplierPayments: summary.supplierPayments.total,
        expenses: summary.expenses.total,
        cashExpenses: summary.expenses.cash,
        unspecifiedExpenses: summary.expenses.unknown,
        cashSales: summary.cashSales,
        productSalesRevenue: summary.productSalesRevenue,
        tipAmount: summary.tipAmount,
        realCashIn: summary.realCashIn,
        changeReturned: summary.changeReturned,
        cashProductSalesForExpected: summary.cashProductSalesForExpected,
        posSales: summary.posSales,
        ibanSales: summary.ibanSales,
        onlineSales: summary.onlineSales,
        totalSales: summary.totalSales,
        saleCount: summary.saleCount,
        averageReceipt: summary.averageReceipt,
        bestSeller: summary.bestSeller,
        soldProductCost: summary.soldProductCost,
        grossProfit: summary.grossProfit,
        wasteCost: summary.wasteCost,
        netOperatingProfit: summary.netOperatingProfit,
        refunds: summary.refunds,
        cancelled: summary.cancelled,
        otherCashIn: values.otherCashIn,
        otherCashOut: values.otherCashOut,
        cashTaken,
        carryOverCash,
        denominationTotal,
        note,
        closedBy: String(formData.closedBy || state.data.ownerName || "Admin").trim() || "Admin",
        status: cashClosingStatusLabel(cashDifference),
        createdAt: existingIndex >= 0 ? closings[existingIndex].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) closings[existingIndex] = record;
      else closings.unshift(record);
      if (!saveCashClosings(closings)) throw new Error("Kapanış kaydedilemedi.");
      return record;
    } finally {
      state.cashClosingBusy = false;
    }
  }

  function deleteCashClosing(id) {
    const closings = getCashClosings();
    const record = closings.find((item) => item.id === id);
    if (!record) throw new Error("Kapanış kaydı bulunamadı.");
    if (!window.confirm(`${record.date} tarihli kasa kapanışı silinsin mi? Satış ve gider kayıtları silinmez.`)) return false;
    if (!saveCashClosings(closings.filter((item) => item.id !== id))) throw new Error("Kapanış silinemedi.");
    return true;
  }

  function cashClosingDifferenceClass(value) {
    const amount = Number(value) || 0;
    if (amount === 0) return "success";
    return amount > 0 ? "warning" : "danger";
  }

  function cashClosingReconcileRows(summary, values) {
    const expectedCash = calculateExpectedCash(summary, values);
    const rows = [
      ["Nakit", expectedCash, parseMoneyValue(values.countedCash)],
      ["POS", summary.posExpected, parseMoneyValue(values.posCounted)],
      ["IBAN", summary.ibanExpected, parseMoneyValue(values.ibanCounted)],
      ["Online", summary.onlineExpected, parseMoneyValue(values.onlineCounted)]
    ];
    return rows.map(([label, expected, counted]) => {
      const diff = Math.round((counted - expected) * 100) / 100;
      return `<div class="cash-reconcile-row ${cashClosingDifferenceClass(diff)}"><span>${escapeHtml(label)}</span><span>Beklenen: ${formatTRY(expected)}</span><span>Gerçek: ${formatTRY(counted)}</span><strong>Fark: ${formatTRY(diff)}</strong></div>`;
    }).join("");
  }

  function cashClosingPage() {
    const date = state.cashClosingDate || new Date().toISOString().slice(0, 10);
    const summary = calculateDailyCashSummary(date);
    const existing = getCashClosingByDate(date);
    const openingCash = existing ? existing.openingCash : getPreviousDayCarryOver(date);
    return `
      <section class="cash-closing-page">
        <div class="section-head">
          <div><p class="eyebrow">Gün sonu mutabakat</p><h2>Gün Sonu Kasa</h2></div>
          <button class="button" type="button" id="printCashClosing">Yazdır</button>
        </div>
        <div class="grid metrics">
          ${metric("Toplam satış", formatTRY(summary.totalSales))}
          ${metric("Nakit satış", formatTRY(summary.cashSales))}
        ${metric("Veresiye satış", formatTRY(summary.creditSales))}
          ${metric("Bahşiş / Bırakılan Para", formatTRY(summary.tipAmount || 0))}
          ${metric("Gerçek nakit girişi", formatTRY(summary.realCashIn || 0))}
          ${metric("Verilen para üstü", formatTRY(summary.changeReturned || 0))}
          ${metric("Beklenen kasa nakdi", formatTRY(calculateExpectedCash(summary, { openingCash })))}
          ${metric("Net operasyon kârı", formatTRY(summary.netOperatingProfit))}
        </div>
        ${existing ? `<div class="panel cash-closing-alert success">${escapeHtml(date)} için kapanış kayıtlı. Formu kaydederseniz aynı kayıt güncellenir.</div>` : `<div class="panel cash-closing-alert warning">${escapeHtml(date)} için gün sonu henüz kapatılmadı.</div>`}
        <div class="grid dashboard-grid cash-closing-grid">
          <section class="panel">
            <h3>Kapanış formu</h3>
            <form id="cashClosingForm">
              <div class="form-grid two">
                ${field("cashClosingDate", "Tarih", date, "", "date")}
                ${field("cashClosingOpeningCash", "Açılış kasası", openingCash, "500", "number")}
                ${field("cashClosingCountedCash", "Gerçek sayılan nakit", existing?.countedCash ?? "", "4300", "number")}
                ${field("cashClosingPosCounted", "Gerçek POS toplamı", existing?.posCounted ?? summary.posExpected, "2300", "number")}
                ${field("cashClosingIbanCounted", "Gerçek IBAN toplamı", existing?.ibanCounted ?? summary.ibanExpected, "700", "number")}
                ${field("cashClosingOnlineCounted", "Gerçek Online toplamı", existing?.onlineCounted ?? summary.onlineExpected, "350", "number")}
                ${field("cashClosingCarryOver", "Ertesi güne bırakılacak devir", existing?.carryOverCash ?? "", "500", "number")}
                ${field("cashClosingTaken", "Kasadan alınan para", existing?.cashTaken ?? "", "3800", "number")}
                ${field("cashClosingOtherIn", "Diğer kasa girişi", existing?.otherCashIn ?? 0, "0", "number")}
                ${field("cashClosingOtherOut", "Diğer kasa çıkışı", existing?.otherCashOut ?? 0, "0", "number")}
              </div>
              <div class="field"><label for="cashClosingNote">Açıklama/not</label><textarea id="cashClosingNote" rows="3" placeholder="Fark varsa açıklama zorunludur.">${escapeHtml(existing?.note || "")}</textarea></div>
              <div class="cash-closing-reconcile" id="cashClosingLiveSummary">${cashClosingReconcileRows(summary, { openingCash, countedCash: existing?.countedCash || 0, posCounted: existing?.posCounted ?? summary.posExpected, ibanCounted: existing?.ibanCounted ?? summary.ibanExpected, onlineCounted: existing?.onlineCounted ?? summary.onlineExpected, otherCashIn: existing?.otherCashIn || 0, otherCashOut: existing?.otherCashOut || 0 })}</div>
              <button class="button primary cash-closing-submit" type="submit">${existing ? "Kapanışı Güncelle" : "Gün Sonunu Kapat"}</button>
            </form>
          </section>
          <section class="panel">
            <h3>Kupür sayımı</h3>
            <div class="form-grid two denomination-grid">
              ${[200, 100, 50, 20, 10, 5].map((amount) => field(`denom${amount}`, `${amount} TL adet`, "", "0", "number")).join("")}
              ${field("denomCoins", "Madeni para toplamı", "", "0", "number")}
            </div>
            <div class="cash-denomination-total"><span>Kupür toplamı</span><strong id="denominationTotal">0 TL</strong></div>
            <button class="button" type="button" id="applyDenominationTotal">Toplamı Sayılan Nakde Aktar</button>
            <h3 style="margin-top: 18px;">Gün özeti</h3>
            ${reportRow("Ürün satış cirosu", formatTRY(summary.productSalesRevenue ?? summary.totalSales))}
            ${reportRow("Bahşiş / bırakılan para", formatTRY(summary.tipAmount || 0))}
            ${reportRow("Gerçek nakit girişi", formatTRY(summary.realCashIn || 0))}
            ${reportRow("Verilen para üstü", formatTRY(summary.changeReturned || 0))}
            ${reportRow("Beklenen kasa nakdi", formatTRY(calculateExpectedCash(summary, { openingCash })))}
            ${reportRow("POS beklenen", formatTRY(summary.posExpected))}
            ${reportRow("IBAN beklenen", formatTRY(summary.ibanExpected))}
            ${reportRow("Online beklenen", formatTRY(summary.onlineExpected))}
            ${reportRow("Bugünkü veresiye tahsilatı", formatTRY(summary.creditCollections.total))}
            ${reportRow("Nakit gider", formatTRY(summary.expenses.cash))}
            ${summary.expenses.unknown ? `<div class="cash-closing-alert warning">Ödeme yöntemi belirtilmemiş gider: ${formatTRY(summary.expenses.unknown)}</div>` : ""}
          </section>
        </div>
        <section class="panel cash-closing-print-area" style="margin-top: 14px;"><h3>Kapanış sonrası özet</h3>${existing ? cashClosingDetailHtml(existing) : empty("Bu tarih için kapanış kaydedildiğinde özet burada görünür.")}</section>
        <section class="panel" style="margin-top: 14px;"><h3>Geçmiş kapanışlar</h3>${renderCashClosingHistory()}</section>
      </section>
    `;
  }

  function renderCashClosingHistory() {
    const closings = getCashClosings().sort((a, b) => b.date.localeCompare(a.date));
    if (!closings.length) return empty("Henüz kasa kapanışı yok.");
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tarih</th><th>Toplam satış</th><th>Beklenen nakit</th><th>Sayılan nakit</th><th>Nakit farkı</th><th>POS farkı</th><th>Net kâr</th><th>Kapatan</th><th>Durum</th><th>İşlemler</th></tr></thead>
          <tbody>${closings.map((record) => `
            <tr>
              <td>${escapeHtml(record.date)}</td><td>${formatTRY(record.totalSales)}</td><td>${formatTRY(record.expectedCash)}</td><td>${formatTRY(record.countedCash)}</td><td>${formatTRY(record.cashDifference)}</td><td>${formatTRY(record.posDifference)}</td><td>${formatTRY(record.netOperatingProfit)}</td><td>${escapeHtml(record.closedBy || "Admin")}</td><td>${escapeHtml(record.status || cashClosingStatusLabel(record.cashDifference))}</td>
              <td class="table-actions"><button class="button compact" type="button" data-cash-detail="${escapeAttribute(record.id)}">Detay</button><button class="button compact" type="button" data-cash-edit="${escapeAttribute(record.date)}">Düzenle</button><button class="button compact danger-button" type="button" data-cash-delete="${escapeAttribute(record.id)}">Sil</button></td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>`;
  }

  function cashClosingDetailHtml(record) {
    return `
      <div class="cash-closing-detail">
        ${reportRow("Tarih", record.date)}
        ${reportRow("Ürün satış cirosu", formatTRY(record.productSalesRevenue ?? record.totalSales))}
        ${reportRow("Bahşiş / bırakılan para", formatTRY(record.tipAmount || 0))}
        ${reportRow("Gerçek nakit girişi", formatTRY(record.realCashIn || 0))}
        ${reportRow("Verilen para üstü", formatTRY(record.changeReturned || 0))}
        ${reportRow("Toplam satış", formatTRY(record.totalSales))}
        ${reportRow("Nakit satış", formatTRY(record.cashSales))}
        ${reportRow("POS", formatTRY(record.posSales))}
        ${reportRow("IBAN", formatTRY(record.ibanSales))}
        ${reportRow("Online", formatTRY(record.onlineSales))}
        ${reportRow("Veresiye", formatTRY(record.creditSales))}
        ${reportRow("Giderler", formatTRY(record.expenses))}
        ${reportRow("Zayiat maliyeti", formatTRY(record.wasteCost))}
        ${reportRow("Net operasyon kârı", formatTRY(record.netOperatingProfit))}
        ${reportRow("Beklenen nakit", formatTRY(record.expectedCash))}
        ${reportRow("Sayılan nakit", formatTRY(record.countedCash))}
        ${reportRow("Kasa farkı", formatTRY(record.cashDifference))}
        ${reportRow("Kasadan alınan", formatTRY(record.cashTaken))}
        ${reportRow("Ertesi güne devir", formatTRY(record.carryOverCash))}
        ${reportRow("Kapatan", record.closedBy || "Admin")}
        ${record.note ? reportRow("Not", escapeHtml(record.note)) : ""}
      </div>`;
  }

  function openCashClosingDetail(id) {
    const record = getCashClosings().find((item) => item.id === id);
    if (!record) return showToast("Kapanış kaydı bulunamadı.");
    const modal = openModal(`Kasa kapanışı - ${record.date}`, `<div class="cash-closing-print-area">${cashClosingDetailHtml(record)}</div><div class="modal-actions"><button type="button" class="button" data-close-modal>Kapat</button><button type="button" class="button primary" id="printCashClosingDetail">Yazdır</button></div>`);
    modal.querySelector("#printCashClosingDetail")?.addEventListener("click", () => window.print());
  }

  function readCashClosingForm() {
    return {
      date: valueOf("cashClosingDate"),
      openingCash: valueOf("cashClosingOpeningCash"),
      countedCash: valueOf("cashClosingCountedCash"),
      posCounted: valueOf("cashClosingPosCounted"),
      ibanCounted: valueOf("cashClosingIbanCounted"),
      onlineCounted: valueOf("cashClosingOnlineCounted"),
      carryOverCash: valueOf("cashClosingCarryOver"),
      cashTaken: valueOf("cashClosingTaken"),
      otherCashIn: valueOf("cashClosingOtherIn"),
      otherCashOut: valueOf("cashClosingOtherOut"),
      note: valueOf("cashClosingNote"),
      closedBy: state.data.ownerName || "Admin",
      denom200: valueOf("denom200"),
      denom100: valueOf("denom100"),
      denom50: valueOf("denom50"),
      denom20: valueOf("denom20"),
      denom10: valueOf("denom10"),
      denom5: valueOf("denom5"),
      denomCoins: valueOf("denomCoins")
    };
  }

  function refreshCashClosingLiveSummary() {
    const date = valueOf("cashClosingDate") || state.cashClosingDate || new Date().toISOString().slice(0, 10);
    const summary = calculateDailyCashSummary(date);
    const values = readCashClosingForm();
    const target = document.getElementById("cashClosingLiveSummary");
    if (target) target.innerHTML = cashClosingReconcileRows(summary, values);
    const denomTarget = document.getElementById("denominationTotal");
    if (denomTarget) denomTarget.textContent = formatTRY(calculateDenominationTotal(values));
  }

  function bindCashClosingEvents() {
    const dateInput = document.getElementById("cashClosingDate");
    if (dateInput) dateInput.addEventListener("change", () => { state.cashClosingDate = dateInput.value; render(); });
    document.querySelectorAll("#cashClosingForm input, #cashClosingForm textarea, .denomination-grid input").forEach((input) => input.addEventListener("input", refreshCashClosingLiveSummary));
    bindClick("applyDenominationTotal", () => {
      const counted = document.getElementById("cashClosingCountedCash");
      if (counted) counted.value = String(calculateDenominationTotal(readCashClosingForm()));
      refreshCashClosingLiveSummary();
    });
    bindClick("printCashClosing", () => window.print());
    const form = document.getElementById("cashClosingForm");
    if (form) form.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      try {
        const record = createOrUpdateCashClosing(readCashClosingForm());
        showToast(`${new Date(`${record.date}T12:00:00`).toLocaleDateString("tr-TR")} gün sonu kapanışı tamamlandı.`);
        state.cashClosingDate = record.date;
        render();
      } catch (error) {
        if (button) button.disabled = false;
        showToast(error.message);
      }
    });
    document.querySelectorAll("[data-cash-detail]").forEach((button) => button.addEventListener("click", () => openCashClosingDetail(button.dataset.cashDetail)));
    document.querySelectorAll("[data-cash-edit]").forEach((button) => button.addEventListener("click", () => { state.cashClosingDate = button.dataset.cashEdit; render(); }));
    document.querySelectorAll("[data-cash-delete]").forEach((button) => button.addEventListener("click", () => {
      try { if (deleteCashClosing(button.dataset.cashDelete)) render(); } catch (error) { showToast(error.message); }
    }));
  }

  function getCashClosingReportSummary() {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const closings = getCashClosings();
    const thisMonth = closings.filter((record) => String(record.date).startsWith(month));
    const last7 = closings.filter((record) => {
      const diff = (new Date(`${today}T12:00:00`) - new Date(`${record.date}T12:00:00`)) / 86400000;
      return diff >= 0 && diff < 7;
    });
    const salesDays = [...new Set(state.data.sales.map((sale) => cashClosingDateKey(sale.date || sale.createdAt)))];
    const closedDays = new Set(closings.map((record) => record.date));
    const unclosedDays = salesDays.filter((day) => !closedDays.has(day));
    const avgCash = closings.length ? closings.reduce((sum, record) => sum + parseMoneyValue(record.countedCash), 0) / closings.length : 0;
    const todayClosing = getCashClosingByDate(today);
    return {
      dailyCashDifference: todayClosing?.cashDifference || 0,
      weeklyCashDifference: last7.reduce((sum, record) => sum + parseMoneyValue(record.cashDifference), 0),
      monthlyCashDifference: thisMonth.reduce((sum, record) => sum + parseMoneyValue(record.cashDifference), 0),
      paymentDifference: thisMonth.reduce((sum, record) => sum + parseMoneyValue(record.posDifference) + parseMoneyValue(record.ibanDifference) + parseMoneyValue(record.onlineDifference), 0),
      unclosedDays,
      averageDailyCash: Math.round(avgCash * 100) / 100,
      averageReceipt: todayClosing?.averageReceipt || calculateDailyCashSummary(today).averageReceipt,
      dailyNetOperatingProfit: todayClosing?.netOperatingProfit || calculateDailyCashSummary(today).netOperatingProfit
    };
  }
  function quickPosSaleProducts() {
    return state.data.products.filter(isSaleProduct);
  }

  function quickPosCategories(products) {
    const categoryNames = new Set();
    state.data.categories.forEach((category) => {
      if (products.some((product) => product.category === category)) categoryNames.add(category);
    });
    products.forEach((product) => categoryNames.add(product.category || "Genel"));
    return ["Tumu", ...categoryNames];
  }

  function quickPosFilteredProducts(products) {
    const query = state.posSearch.trim().toLocaleLowerCase("tr-TR");
    return products.filter((product) => {
      const matchesCategory = state.posCategory === "Tumu" || product.category === state.posCategory;
      const matchesQuery = !query || product.name.toLocaleLowerCase("tr-TR").includes(query);
      return matchesCategory && matchesQuery;
    });
  }

  function quickPosProductGroups(products) {
    return products.reduce((groups, product) => {
      const category = product.category || "Genel";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(product);
      return groups;
    }, new Map());
  }

  function quickPosCashInfo(total = quickPosTotal()) {
    const received = parseMoneyValue(state.posCashReceived);
    const changeDue = Math.max(0, Math.round((received - total) * 100) / 100);
    const shortfall = Math.max(0, Math.round((total - received) * 100) / 100);
    const customerLeftChange = state.posCashHandling === "tip" && changeDue > 0;
    return {
      received,
      changeDue,
      shortfall,
      changeReturned: customerLeftChange ? 0 : changeDue,
      tipAmount: customerLeftChange ? changeDue : 0
    };
  }

  function customAmountStockQuantity(product, amount, manualKg = 0) {
    if (!product) return 0;
    const price = Number(product.price || 0);
    const unit = String(product.unit || "").toLocaleLowerCase("tr-TR");
    if (product.saleType === "weighted" || unit === "kg") {
      return price > 0 ? roundStock(amount / price) : roundStock(manualKg);
    }
    return 1;
  }

  function customAmountStockLabel(product, quantity) {
    if (!product) return "-";
    if (product.saleType === "weighted" || String(product.unit || "").toLocaleLowerCase("tr-TR") === "kg") {
      return formatStock(quantity, "Kg");
    }
    return formatStock(quantity, product.unit || "Adet");
  }

  function quickPosPage() {
    const products = quickPosSaleProducts();
    const categories = quickPosCategories(products);
    if (!categories.includes(state.posCategory)) state.posCategory = "Tumu";
    const visibleProducts = quickPosFilteredProducts(products);
    const groups = quickPosProductGroups(visibleProducts);

    return `
      <section class="quick-pos-page">
        <div class="section-head quick-pos-head">
          <div>
            <p class="eyebrow">Dokunmatik kasa</p>
            <h2>Hızlı Satış (POS)</h2>
          </div>
          <div class="quick-pos-head-actions">
            <button class="button primary" type="button" id="openQuickPosCustomAmount">Tutarla Satış</button>
            <button class="button" type="button" id="clearQuickPosCart">Sepeti Temizle</button>
          </div>
        </div>
        <div class="quick-pos-layout">
          <div class="quick-pos-main">
            <div class="quick-pos-search">
              <input id="quickPosSearch" value="${escapeAttribute(state.posSearch)}" placeholder="Ürün ara" />
            </div>
            <div class="quick-pos-categories">
              ${categories.map((category) => {
                const count = category === "Tumu" ? products.length : products.filter((product) => product.category === category).length;
                return `
                  <button class="quick-pos-category-card ${state.posCategory === category ? "active" : ""}" type="button" data-pos-category="${escapeAttribute(category)}">
                    <strong>${category === "Tumu" ? "Tüm Ürünler" : escapeHtml(category)}</strong>
                    <span>${count} ürün</span>
                  </button>
                `;
              }).join("")}
            </div>
            <div class="quick-pos-products">
              ${visibleProducts.length ? [...groups.entries()].map(([category, groupProducts]) => `
                <section class="quick-pos-group">
                  <div class="quick-pos-group-head">
                    <h3>${state.posCategory === "Tumu" && category === "Tumu" ? "Tüm Ürünler" : escapeHtml(category)}</h3>
                    <span>${groupProducts.length} ürün</span>
                  </div>
                  <div class="quick-pos-product-grid">
                    ${groupProducts.map(quickPosProductCard).join("")}
                  </div>
                </section>
              `).join("") : empty("Aramanıza uygun satış ürünü bulunamadı.")}
            </div>
          </div>
          ${quickPosCartPanel()}
        </div>
      </section>
    `;
  }

  function quickPosProductCard(product) {
    const icon = product.saleType === "weighted" ? "⚖️" : "🌯";
    const price = product.saleType === "weighted" ? `${formatTRY(product.price || 0)}/kg` : formatTRY(product.price || 0);
    const available = calculateAvailableRecipeQuantity(product);
    const disabled = available <= 0 ? "disabled" : "";
    return `
      <button class="quick-pos-card" type="button" data-pos-product="${escapeAttribute(product.id)}" data-product-id="${escapeAttribute(product.id)}" ${disabled}>
        <span class="quick-pos-icon">${icon}</span>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${price}</small>
        <small class="${available <= 0 ? "danger" : "muted"}">${available <= 0 ? "Stok yok" : `Stok: ${formatStock(available, product.saleType === "weighted" ? "Kg" : product.unit)}`}</small>
      </button>
    `;
  }

  function quickPosSubtotal() {
    return state.posCart.reduce((total, item) => total + Number(item.lineTotal || 0), 0);
  }

  function quickPosTotal() {
    return Math.max(0, quickPosSubtotal() - (Number(state.posDiscount) || 0));
  }

  function quickPosCartPanel() {
    const customers = getVeresiyeCustomers();
    const subtotal = quickPosSubtotal();
    const total = quickPosTotal();
    const cashInfo = quickPosCashInfo(total);

    return `
      <aside class="quick-pos-cart">
        <div class="quick-pos-cart-head">
          <h3>Canlı Sepet</h3>
          <span>${state.posCart.length} satır</span>
        </div>
        <div class="quick-pos-cart-list">
          ${state.posCart.length ? state.posCart.map(quickPosCartRow).join("") : empty("Ürün seçerek başlayın.")}
        </div>
        <div class="quick-pos-discount">
          <span>İndirim</span>
          <div class="quick-pos-discount-buttons">
            ${[10, 20, 50].map((amount) => `<button type="button" class="button compact" data-pos-discount="${amount}">${amount} TL</button>`).join("")}
          </div>
          <input id="quickPosManualDiscount" type="number" min="0" step="0.01" value="${state.posDiscount || ""}" placeholder="Manuel indirim" />
        </div>
        <div class="quick-pos-totals">
          <div><span>Ara Toplam</span><strong>${formatTRY(subtotal)}</strong></div>
          <div><span>İndirim</span><strong>${formatTRY(state.posDiscount || 0)}</strong></div>
          <div class="quick-pos-grand-total"><span>Toplam</span><strong>${formatTRY(total)}</strong></div>
        </div>
        <div class="quick-pos-payments">
          ${[
            ["Nakit", "💵"],
            ["POS", "💳"],
            ["Online", "🌐"],
            ["IBAN", "🏦"],
            ["Veresiye", "📒"]
          ].map(([method, icon]) => `
            <button type="button" class="quick-pos-payment ${state.posPaymentMethod === method ? "active" : ""}" data-pos-payment="${method}">
              <span>${icon}</span>${method}
            </button>
          `).join("")}
        </div>
        ${state.posPaymentMethod === "Veresiye" ? `
          <div class="quick-pos-credit">
            <label for="quickPosCustomerSearch">Müşteri Ara</label>
            <input id="quickPosCustomerSearch" list="quickPosCustomerList" placeholder="Ad veya telefon" />
            <datalist id="quickPosCustomerList">
              ${customers.map((customer) => `<option value="${escapeAttribute(customer.name)}" data-id="${escapeAttribute(customer.id)}">${escapeHtml(customer.phone || "")}</option>`).join("")}
            </datalist>
            <select id="quickPosVeresiyeCustomer">
              <option value="">Yeni müşteri oluştur</option>
              ${customers.map((customer) => `<option value="${escapeAttribute(customer.id)}" ${state.posVeresiyeCustomerId === customer.id ? "selected" : ""}>${escapeHtml(customer.name)} ${customer.phone ? `- ${escapeHtml(customer.phone)}` : ""}</option>`).join("")}
            </select>
            <div class="form-grid two">
              <input id="quickPosNewCustomerName" placeholder="Yeni müşteri adı" />
              <input id="quickPosNewCustomerPhone" placeholder="Telefon" />
            </div>
          </div>
        ` : ""}
        ${state.posPaymentMethod === "Nakit" ? `
          <div class="quick-pos-cash-panel">
            <div class="quick-pos-totals">
              <div><span>Hesap toplamı</span><strong>${formatTRY(total)}</strong></div>
              <div><span>Verilen para</span><strong>${formatTRY(cashInfo.received)}</strong></div>
              <div><span>${cashInfo.shortfall > 0 ? "Kalan tutar" : "Para üstü"}</span><strong class="${cashInfo.shortfall > 0 ? "danger" : "success"}">${formatTRY(cashInfo.shortfall || cashInfo.changeDue)}</strong></div>
            </div>
            <input id="quickPosCashReceived" type="number" min="0" step="0.01" value="${escapeAttribute(state.posCashReceived)}" placeholder="Müşterinin verdiği para" />
            ${cashInfo.changeDue > 0 ? `
              <div class="quick-pos-methods">
                <label><input type="radio" name="quickPosCashHandling" value="returned" ${state.posCashHandling !== "tip" ? "checked" : ""} /> Para üstü verildi</label>
                <label><input type="radio" name="quickPosCashHandling" value="tip" ${state.posCashHandling === "tip" ? "checked" : ""} /> Müşteri bıraktı</label>
              </div>
            ` : ""}
          </div>
        ` : ""}
        <button type="button" class="quick-pos-complete" id="completeQuickPosSale" ${state.posCart.length ? "" : "disabled"}>Satışı Tamamla</button>
      </aside>
    `;
  }

  function quickPosCartRow(item) {
    const optionText = hasCartDoritos(item) ? "Doritos" : item.saleType === "weighted" ? formatWeightedAmount(item) : "";
    const detailText = item.customAmountSale ? [item.note, `Stok düşümü: ${customAmountStockLabel(findProductById(item.originalProductId || item.productId), item.stockDeductQuantity || item.quantityKg || item.quantity || 0)}`].filter(Boolean).join(" - ") : optionText;
    return `
      <div class="quick-pos-cart-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          ${detailText ? `<span>${escapeHtml(detailText)}</span>` : ""}
        </div>
        <strong>${formatTRY(item.lineTotal)}</strong>
        <div class="quick-pos-row-actions">
          ${item.saleType === "weighted" || item.customAmountSale || item.saleType === "custom-amount" ? "" : `<button type="button" data-pos-cart-dec="${escapeAttribute(item.key)}">-</button><span>x${item.quantity}</span><button type="button" data-pos-cart-inc="${escapeAttribute(item.key)}">+</button>`}
          <button type="button" data-pos-cart-remove="${escapeAttribute(item.key)}">Sil</button>
        </div>
      </div>
    `;
  }

  function quickPosCartKey(productId, options = [], saleType = "standard") {
    return `${saleType}:${productId}:${options.map((option) => option.id).sort().join("+")}`;
  }

  function addQuickPosStandardProduct(product, options = []) {
    const key = quickPosCartKey(product.id, options);
    const existing = state.posCart.find((item) => item.key === key);
    const nextQuantity = (existing ? existing.quantity : 0) + 1;

    if (nextQuantity > calculateAvailableRecipeQuantity(product)) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    if (existing) {
      existing.quantity = nextQuantity;
      existing.lineTotal = saleLineTotal(product, existing.quantity, existing);
    } else {
      state.posCart.push({
        key,
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.price,
        options,
        lineTotal: saleLineTotal(product, 1, { options })
      });
    }
    console.log("[QuickPOS] cart", state.posCart);
    render();
  }

  function openQuickPosDurumModal(product) {
    console.log("[QuickPOS] modal opening");
    const modal = openModal(product.name, `
      <form id="quickPosDurumForm">
        <label class="quick-pos-check">
          <input id="quickPosDoritos" type="checkbox" />
          <span>Doritos (+25 TL)</span>
        </label>
        <div class="quick-pos-modal-total">
          <span>Toplam</span>
          <strong id="quickPosDurumTotal">${formatTRY(product.price)}</strong>
        </div>
        <div class="modal-actions">
          <button type="button" class="button" data-close-modal>İptal</button>
          <button type="submit" class="button primary">Sepete Ekle</button>
        </div>
      </form>
    `);
    const checkbox = modal.querySelector("#quickPosDoritos");
    const totalElement = modal.querySelector("#quickPosDurumTotal");
    checkbox?.addEventListener("change", () => {
      if (totalElement) totalElement.textContent = formatTRY(product.price + (checkbox.checked ? 25 : 0));
    });
    modal.querySelector("#quickPosDurumForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      addQuickPosStandardProduct(product, checkbox?.checked ? [{ id: "doritos", name: "Doritos", price: 25 }] : []);
      closeActiveModal();
    });
  }

  function openQuickPosFirikModal(product) {
    console.log("[QuickPOS] modal opening");
    const raw = findProductById(product.rawMaterialId);
    const pricePerKg = Number(product.price || 0);
    if (pricePerKg <= 0) {
      showToast("Firik kilogram satış fiyatını önce Ürünler ekranından belirleyin.");
      return;
    }

    const modal = openModal("Firik", `
      <form id="quickPosFirikForm">
        <div class="quick-pos-methods">
          <label><input type="radio" name="quickPosFirikMethod" value="kg" checked /> Gram/Kg Gir</label>
          <label><input type="radio" name="quickPosFirikMethod" value="amount" /> TL Gir</label>
        </div>
        <div class="quick-pos-fast-grid" id="quickPosKgPresets">
          ${[0.25, 0.5, 0.75, 1].map((kg) => `<button type="button" data-pos-firik-kg="${kg}">${kg.toFixed(3)}</button>`).join("")}
        </div>
        <div class="quick-pos-fast-grid" id="quickPosAmountPresets">
          ${[150, 200, 250].map((amount) => `<button type="button" data-pos-firik-amount="${amount}">${amount} TL</button>`).join("")}
        </div>
        <div class="form-grid two">
          <input id="quickPosFirikKg" type="number" min="0.001" step="0.001" value="0.250" placeholder="Miktar kg" />
          <input id="quickPosFirikAmount" type="number" min="0.01" step="0.01" value="" placeholder="TL tutarı" />
        </div>
        <div class="quick-pos-modal-total">
          <span id="quickPosFirikSummary">Kg fiyatı: ${formatTRY(pricePerKg)} | Stok: ${formatStock(raw?.stock || 0, "Kg")}</span>
          <strong id="quickPosFirikTotal">${formatTRY(pricePerKg * 0.25)}</strong>
        </div>
        <div class="modal-actions">
          <button type="button" class="button" data-close-modal>İptal</button>
          <button type="submit" class="button primary">Sepete Ekle</button>
        </div>
      </form>
    `);

    const update = () => {
      const method = modal.querySelector("input[name='quickPosFirikMethod']:checked")?.value || "kg";
      const kgInput = modal.querySelector("#quickPosFirikKg");
      const amountInput = modal.querySelector("#quickPosFirikAmount");
      const kg = method === "amount" ? parseMoneyValue(amountInput?.value || 0) / pricePerKg : parseMoneyValue(kgInput?.value || 0);
      const total = kg * pricePerKg;
      const summary = modal.querySelector("#quickPosFirikSummary");
      const totalElement = modal.querySelector("#quickPosFirikTotal");
      if (summary) summary.textContent = `Kg fiyatı: ${formatTRY(pricePerKg)} | ${formatStock(kg, "Kg")} | ${Math.round(kg * 1000)} gram`;
      if (totalElement) totalElement.textContent = formatTRY(total);
    };
    modal.querySelectorAll("input[name='quickPosFirikMethod'], #quickPosFirikKg, #quickPosFirikAmount").forEach((element) => {
      element.addEventListener("input", update);
      element.addEventListener("change", update);
    });
    modal.querySelectorAll("[data-pos-firik-kg]").forEach((button) => {
      button.addEventListener("click", () => {
        modal.querySelector("input[value='kg']").checked = true;
        modal.querySelector("#quickPosFirikKg").value = button.dataset.posFirikKg;
        update();
      });
    });
    modal.querySelectorAll("[data-pos-firik-amount]").forEach((button) => {
      button.addEventListener("click", () => {
        modal.querySelector("input[value='amount']").checked = true;
        modal.querySelector("#quickPosFirikAmount").value = button.dataset.posFirikAmount;
        update();
      });
    });
    update();
    modal.querySelector("#quickPosFirikForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const method = modal.querySelector("input[name='quickPosFirikMethod']:checked")?.value || "kg";
      const kg = roundStock(method === "amount"
        ? parseMoneyValue(modal.querySelector("#quickPosFirikAmount")?.value || 0) / pricePerKg
        : parseMoneyValue(modal.querySelector("#quickPosFirikKg")?.value || 0));
      const lineTotal = Math.round(kg * pricePerKg * 100) / 100;
      if (kg <= 0 || lineTotal <= 0) {
        showToast("Firik satışı için geçerli miktar veya tutar girin.");
        return;
      }
      if (kg > Number(raw?.stock || 0)) {
        showToast("Firik stoku yetersiz.");
        return;
      }
      state.posCart.push({
        key: quickPosCartKey(product.id, [], "weighted") + `:${Date.now()}`,
        productId: product.id,
        name: "Firik",
        saleType: "weighted",
        rawMaterialId: product.rawMaterialId,
        quantity: kg,
        quantityKg: kg,
        quantityGram: Math.round(kg * 1000),
        pricePerKg,
        unitPrice: pricePerKg,
        lineTotal,
        options: []
      });
      closeActiveModal();
      render();
    });
  }

  function openQuickPosCustomAmountModal() {
    const products = quickPosSaleProducts();
    if (!products.length) {
      showToast("Tutarla satış için satış ürünü bulunamadı.");
      return;
    }
    const firstProduct = products[0];
    const modal = openModal("Tutarla Satış", `
      <form id="quickPosCustomAmountForm">
        <div class="form-grid two">
          <div class="field">
            <label for="quickPosCustomProduct">Ürün seçimi</label>
            <select id="quickPosCustomProduct">
              ${products.map((product) => `<option value="${escapeAttribute(product.id)}">${escapeHtml(product.name)} - ${escapeHtml(product.category || "Genel")}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="quickPosCustomAmount">Satış tutarı</label>
            <input id="quickPosCustomAmount" type="number" min="0.01" step="0.01" value="100" />
          </div>
        </div>
        <div class="quick-pos-fast-grid">
          ${[50, 100, 150, 200, 250].map((amount) => `<button type="button" data-custom-amount="${amount}">${amount} TL</button>`).join("")}
          <button type="button" data-custom-amount="">Manuel tutar</button>
        </div>
        <label class="quick-pos-check" id="quickPosCustomDeductWrap">
          <input id="quickPosCustomDeductStock" type="checkbox" checked />
          <span>Stoktan düş</span>
        </label>
        <div class="form-grid two" id="quickPosCustomKgWrap">
          <div class="field">
            <label for="quickPosCustomKg">Düşülecek kg</label>
            <input id="quickPosCustomKg" type="number" min="0.001" step="0.001" value="" />
          </div>
          <div class="field">
            <label>Stok önizleme</label>
            <input id="quickPosCustomStockPreview" readonly />
          </div>
        </div>
        <div class="field">
          <label for="quickPosCustomNote">Açıklama/not</label>
          <input id="quickPosCustomNote" placeholder="Örn. müşteriye özel tutar" />
        </div>
        <p class="muted" id="quickPosCustomSummary"></p>
        <div class="modal-actions">
          <button type="button" class="button" data-close-modal>İptal</button>
          <button type="submit" class="button primary">Sepete Ekle</button>
        </div>
      </form>
    `);

    const productSelect = modal.querySelector("#quickPosCustomProduct");
    const amountInput = modal.querySelector("#quickPosCustomAmount");
    const kgInput = modal.querySelector("#quickPosCustomKg");
    const kgWrap = modal.querySelector("#quickPosCustomKgWrap");
    const deductInput = modal.querySelector("#quickPosCustomDeductStock");
    const summary = modal.querySelector("#quickPosCustomSummary");
    const stockPreview = modal.querySelector("#quickPosCustomStockPreview");

    const currentProduct = () => findProductById(productSelect?.value) || firstProduct;
    const refresh = () => {
      const product = currentProduct();
      const amount = parseMoneyValue(amountInput?.value || 0);
      const unit = String(product?.unit || "").toLocaleLowerCase("tr-TR");
      const isKg = product?.saleType === "weighted" || unit === "kg";
      const price = Number(product?.price || 0);
      if (kgWrap) kgWrap.style.display = isKg ? "" : "none";
      const manualKg = parseMoneyValue(kgInput?.value || 0);
      const stockQuantity = deductInput?.checked ? customAmountStockQuantity(product, amount, manualKg) : 0;
      const available = calculateAvailableRecipeQuantity(product);
      if (isKg && price > 0 && kgInput) kgInput.value = stockQuantity ? String(stockQuantity) : "";
      if (stockPreview) stockPreview.value = deductInput?.checked ? `${customAmountStockLabel(product, stockQuantity)} / mevcut ${customAmountStockLabel(product, available)}` : "Stok düşülmeyecek";
      if (summary) {
        summary.textContent = `${product.name} - tutar ${formatTRY(amount)} - ${deductInput?.checked ? `stok düşümü ${customAmountStockLabel(product, stockQuantity)}` : "stok düşülmeyecek"}`;
        summary.className = deductInput?.checked && stockQuantity > available ? "danger" : "muted";
      }
    };

    productSelect?.addEventListener("change", refresh);
    amountInput?.addEventListener("input", refresh);
    kgInput?.addEventListener("input", refresh);
    deductInput?.addEventListener("change", refresh);
    modal.querySelectorAll("[data-custom-amount]").forEach((button) => {
      button.addEventListener("click", () => {
        if (amountInput) {
          amountInput.value = button.dataset.customAmount || "";
          amountInput.focus();
        }
        refresh();
      });
    });
    refresh();

    modal.querySelector("#quickPosCustomAmountForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const product = currentProduct();
      const amount = parseMoneyValue(amountInput?.value || 0);
      if (amount <= 0) {
        showToast("Tutarla satış için pozitif tutar girin.");
        return;
      }
      const deductStock = deductInput?.checked !== false;
      const manualKg = parseMoneyValue(kgInput?.value || 0);
      const stockQuantity = deductStock ? customAmountStockQuantity(product, amount, manualKg) : 0;
      const available = calculateAvailableRecipeQuantity(product);
      if (deductStock && stockQuantity <= 0) {
        showToast("Stoktan düşülecek miktar girin.");
        return;
      }
      if (deductStock && stockQuantity > available) {
        showToast("Bu ürün için yeterli stok yok.");
        return;
      }
      state.posCart.push({
        key: quickPosCartKey(product.id, [], "custom-amount") + `:${Date.now()}`,
        productId: product.id,
        originalProductId: product.id,
        name: `${product.name} - Tutarla Satış`,
        saleType: "custom-amount",
        customAmountSale: true,
        rawMaterialId: product.rawMaterialId || null,
        quantity: stockQuantity,
        stockDeductQuantity: stockQuantity,
        quantityKg: product.saleType === "weighted" || String(product.unit || "").toLocaleLowerCase("tr-TR") === "kg" ? stockQuantity : null,
        unitPrice: amount,
        lineTotal: amount,
        options: [],
        note: valueOf("quickPosCustomNote")
      });
      closeActiveModal();
      render();
    });
  }

  function bindQuickPosEvents() {
    bindClick("clearQuickPosCart", () => {
      state.posCart = [];
      state.posDiscount = 0;
      state.posCashReceived = "";
      state.posCashHandling = "returned";
      render();
    });
    bindClick("openQuickPosCustomAmount", openQuickPosCustomAmountModal);
    const searchInput = document.getElementById("quickPosSearch");
    searchInput?.addEventListener("input", () => {
      state.posSearch = searchInput.value;
      render();
    });
    document.querySelectorAll("[data-pos-category]").forEach((button) => {
      button.addEventListener("click", () => {
        state.posCategory = button.dataset.posCategory || "Tumu";
        render();
      });
    });
    document.querySelectorAll("[data-pos-product]").forEach((button) => {
      button.addEventListener("click", () => {
        const productId = button.dataset.posProduct || button.dataset.productId;
        const product = findProductById(productId);
        if (!product) return;
        if (calculateAvailableRecipeQuantity(product) <= 0) {
          showToast("Stok yok.");
          return;
        }
        if (product.saleType === "weighted") openQuickPosFirikModal(product);
        else if (product.supportsDoritos) openQuickPosDurumModal(product);
        else addQuickPosStandardProduct(product, []);
      });
    });
    document.querySelectorAll("[data-pos-cart-inc]").forEach((button) => {
      button.addEventListener("click", () => changeQuickPosCartQuantity(button.dataset.posCartInc, 1));
    });
    document.querySelectorAll("[data-pos-cart-dec]").forEach((button) => {
      button.addEventListener("click", () => changeQuickPosCartQuantity(button.dataset.posCartDec, -1));
    });
    document.querySelectorAll("[data-pos-cart-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        state.posCart = state.posCart.filter((item) => item.key !== button.dataset.posCartRemove);
        render();
      });
    });
    document.querySelectorAll("[data-pos-discount]").forEach((button) => {
      button.addEventListener("click", () => {
        state.posDiscount = Number(button.dataset.posDiscount || 0);
        render();
      });
    });
    const manualDiscount = document.getElementById("quickPosManualDiscount");
    manualDiscount?.addEventListener("input", () => {
      state.posDiscount = Math.max(0, parseMoneyValue(manualDiscount.value));
      render();
    });
    document.querySelectorAll("[data-pos-payment]").forEach((button) => {
      button.addEventListener("click", () => {
        state.posPaymentMethod = button.dataset.posPayment;
        if (state.posPaymentMethod !== "Nakit") {
          state.posCashReceived = "";
          state.posCashHandling = "returned";
        }
        render();
      });
    });
    const cashReceived = document.getElementById("quickPosCashReceived");
    cashReceived?.addEventListener("input", () => {
      state.posCashReceived = cashReceived.value;
      render();
    });
    document.querySelectorAll("input[name='quickPosCashHandling']").forEach((input) => {
      input.addEventListener("change", () => {
        state.posCashHandling = input.value;
        render();
      });
    });
    const customerSelect = document.getElementById("quickPosVeresiyeCustomer");
    customerSelect?.addEventListener("change", () => {
      state.posVeresiyeCustomerId = customerSelect.value;
    });
    bindClick("completeQuickPosSale", completeQuickPosSale);
  }

  function changeQuickPosCartQuantity(key, delta) {
    const item = state.posCart.find((entry) => entry.key === key);
    if (!item || item.saleType === "weighted" || item.customAmountSale || item.saleType === "custom-amount") return;
    const product = findProductById(item.productId);
    const nextQuantity = Number(item.quantity || 0) + delta;
    if (nextQuantity <= 0) {
      state.posCart = state.posCart.filter((entry) => entry.key !== key);
      render();
      return;
    }
    if (nextQuantity > calculateAvailableRecipeQuantity(product)) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }
    item.quantity = nextQuantity;
    item.lineTotal = saleLineTotal(product, item.quantity, item);
    render();
  }

  function completeQuickPosSale() {
    console.log("[QuickPOS] completing sale");
    if (!state.posCart.length) {
      showToast("Satış için sepete ürün ekleyin.");
      return;
    }
    const total = quickPosTotal();
    const method = state.posPaymentMethod || "Nakit";
    const items = state.posCart.map((cartItem) => ({ cartItem, product: findProductById(cartItem.productId) }));
    const invalidItem = items.find((item) => {
      if (!item.product) return true;
      if (item.cartItem.customAmountSale || item.cartItem.saleType === "custom-amount") {
        if (item.cartItem.rawMaterialId || (Array.isArray(item.product.recipe) && item.product.recipe.length)) return false;
        return Number(item.product.stock || 0) < Number(item.cartItem.stockDeductQuantity || 0);
      }
      return item.cartItem.saleType !== "weighted" && (!Array.isArray(item.product.recipe) || !item.product.recipe.length) && item.product.stock < item.cartItem.quantity;
    });
    if (invalidItem) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }
    const recipeUsage = calculateRecipeUsage(items);
    const missingMaterials = validateRecipeStock(recipeUsage);
    const doritosMissing = validateDoritosStock(items);
    if (missingMaterials.length || doritosMissing.length) {
      showToast([...missingMaterials, ...doritosMissing].join(" | "));
      return;
    }

    let creditCustomer = null;
    if (method === "Veresiye") {
      const customerId = document.getElementById("quickPosVeresiyeCustomer")?.value || state.posVeresiyeCustomerId;
      creditCustomer = getVeresiyeCustomers().find((customer) => customer.id === customerId) || null;
      if (!creditCustomer) {
        const name = valueOf("quickPosNewCustomerName");
        if (!name) {
          showToast("Veresiye için müşteri seçin veya yeni müşteri adı girin.");
          return;
        }
      }
    }
    const cashInfo = quickPosCashInfo(total);
    if (method === "Nakit") {
      if (cashInfo.received < total) {
        showToast(`Nakit ödeme eksik. Kalan tutar: ${formatTRY(cashInfo.shortfall)}`);
        return;
      }
    }

    items.forEach(({ cartItem, product }) => {
      if (cartItem.customAmountSale || cartItem.saleType === "custom-amount") {
        if (!cartItem.rawMaterialId && (!Array.isArray(product.recipe) || !product.recipe.length)) {
          product.stock = roundStock(product.stock - Number(cartItem.stockDeductQuantity || 0));
        }
      } else if (cartItem.saleType !== "weighted" && (!Array.isArray(product.recipe) || !product.recipe.length)) {
        product.stock = roundStock(product.stock - cartItem.quantity);
      }
      product.sold = roundStock(product.sold + Number(cartItem.stockDeductQuantity || cartItem.quantity || cartItem.quantityKg || 0));
    });
    recipeUsage.forEach((amountKg, materialId) => {
      const material = findProductById(materialId);
      if (material) material.stock = roundStock(material.stock - amountKg);
    });
    const doritos = findDoritosStockProduct();
    if (doritos) {
      const doritosNeeded = items.reduce((sum, item) => sum + (hasCartDoritos(item.cartItem) ? Number(item.cartItem.quantity || 0) : 0), 0);
      doritos.stock = roundStock(Number(doritos.stock || 0) - doritosNeeded);
    }

    const now = new Date();
    const saleItems = items.map(({ cartItem, product }) => {
      const lineTotal = saleLineTotal(product, cartItem.quantity || cartItem.quantityKg, cartItem);
      const recipeCost = calculateCartRecipeCost(product, cartItem);
      const baseItem = {
        productId: product.id,
        productName: product.name,
        name: product.name,
        saleType: cartItem.saleType || "standard",
        quantity: cartItem.quantity || cartItem.quantityKg,
        quantityKg: cartItem.quantityKg || null,
        quantityGram: cartItem.quantityGram || null,
        unit: product.unit,
        unitPrice: cartItem.pricePerKg || product.price,
        pricePerKg: cartItem.pricePerKg || null,
        options: Array.isArray(cartItem.options) ? cartItem.options : [],
        optionsTotal: optionTotal(cartItem.options),
        recipeCost,
        grossProfit: lineTotal - recipeCost,
        lineTotal,
        total: lineTotal
      };
      if (cartItem.customAmountSale || cartItem.saleType === "custom-amount") {
        return {
          ...baseItem,
          productName: cartItem.name,
          name: cartItem.name,
          saleType: "custom-amount",
          customAmountSale: true,
          originalProductId: cartItem.originalProductId || product.id,
          note: cartItem.note || "",
          stockDeductQuantity: cartItem.stockDeductQuantity || 0,
          quantityKg: cartItem.quantityKg || null,
          unitPrice: lineTotal
        };
      }
      return baseItem;
    });
    const subtotal = saleItems.reduce((sum, item) => sum + item.total, 0);
    const discount = Math.min(Number(state.posDiscount || 0), subtotal);
    const recipeCost = saleItems.reduce((sum, item) => sum + item.recipeCost, 0);
    const sale = {
      id: createId(),
      productId: saleItems[0].productId,
      productName: saleItems.length === 1 ? saleItems[0].productName : `${saleItems.length} ürün`,
      quantity: saleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      unit: saleItems.length === 1 ? saleItems[0].unit : "kalem",
      unitPrice: subtotal,
      subtotal,
      discount,
      total: subtotal - discount,
      recipeCost,
      grossProfit: subtotal - discount - recipeCost,
      paymentMethod: method,
      cashReceived: method === "Nakit" ? cashInfo.received : 0,
      changeDue: method === "Nakit" ? cashInfo.changeDue : 0,
      changeReturned: method === "Nakit" ? cashInfo.changeReturned : 0,
      tipAmount: method === "Nakit" ? cashInfo.tipAmount : 0,
      cashNetIn: method === "Nakit" ? subtotal - discount + cashInfo.tipAmount : 0,
      customAmountSale: saleItems.some((item) => item.customAmountSale),
      originalProductId: saleItems.length === 1 ? saleItems[0].originalProductId || null : null,
      source: "quick-pos",
      date: now.toISOString().slice(0, 10),
      time: now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      items: saleItems
    };
    state.data.sales.push(sale);

    if (method === "Veresiye") {
      const description = `POS satışı: ${sale.productName}`;
      const customerId = document.getElementById("quickPosVeresiyeCustomer")?.value || state.posVeresiyeCustomerId;
      if (customerId) {
        addDebtToCustomer(customerId, { amount: sale.total, description });
      } else {
        createVeresiyeCustomer({
          name: valueOf("quickPosNewCustomerName"),
          phone: valueOf("quickPosNewCustomerPhone"),
          startingDebt: sale.total,
          description
        });
      }
    }

    state.posCart = [];
    state.posDiscount = 0;
    state.posVeresiyeCustomerId = "";
    state.posCashReceived = "";
    state.posCashHandling = "returned";
    saveData();
    showToast("Sipariş tamamlandı");
    render();
  }

  function businessDurumDefinitions() {
    const cigkofte = findRawMaterialByName("Çiğköfte");
    if (!cigkofte) return [];

    return [
      { name: "Normal Dürüm", price: 100, gram: 100 },
      { name: "Mega Dürüm", price: 130, gram: 125 },
      { name: "Ultra Dürüm", price: 140, gram: 150 },
      { name: "Double Dürüm", price: 160, gram: 175 }
    ].map((item) => ({
      ...item,
      recipe: [{ materialId: cigkofte.id, amount: item.gram, unit: "gram" }]
    }));
  }

  function normalizeBusinessName(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findRawMaterialByName(name) {
    const target = normalizeBusinessName(name);
    return state.data.products.find((product) => product.type === "raw" && normalizeBusinessName(product.name) === target);
  }

  function findSaleProductByName(name) {
    const target = normalizeBusinessName(name);
    return state.data.products.find((product) => product.type === "sale" && normalizeBusinessName(product.name) === target);
  }

  function isWrongFirikDurum(product) {
    return product?.type === "sale" && /firik/.test(normalizeBusinessName(product.name)) && /durum/.test(normalizeBusinessName(product.name));
  }

  function applyBusinessProductCatalog() {
    if (!state.data || !Array.isArray(state.data.products)) return;

    state.data.products = state.data.products.map(normalizeProduct).filter((product) => !isWrongFirikDurum(product));

    let firikRaw = findRawMaterialByName("Firik");
    if (!firikRaw) {
      firikRaw = normalizeProduct({
        id: createId(),
        name: "Firik",
        category: "Hammadde",
        type: "raw",
        unit: "Kg",
        stock: 0,
        criticalLevel: 1,
        purchasePrice: 280,
        price: 0,
        sold: 0,
        recipe: []
      });
      state.data.products.push(firikRaw);
    }
    firikRaw.type = "raw";
    firikRaw.unit = "Kg";
    firikRaw.purchasePrice = Number(firikRaw.purchasePrice || 280) || 280;

    let cigkofteRaw = findRawMaterialByName("Çiğköfte");
    if (!cigkofteRaw) {
      cigkofteRaw = normalizeProduct({
        id: createId(),
        name: "Çiğköfte",
        category: "Hammadde",
        type: "raw",
        unit: "Kg",
        stock: 0,
        criticalLevel: 1,
        purchasePrice: 0,
        price: 0,
        sold: 0,
        recipe: []
      });
      state.data.products.push(cigkofteRaw);
    }
    cigkofteRaw.type = "raw";
    cigkofteRaw.unit = "Kg";

    businessDurumDefinitions().forEach((definition) => {
      let product = findSaleProductByName(definition.name);
      if (!product) {
        product = normalizeProduct({
          id: createId(),
          name: definition.name,
          category: "Dürüm",
          type: "sale",
          unit: "Adet",
          stock: 999,
          criticalLevel: 0,
          price: definition.price,
          sold: 0,
          recipe: definition.recipe
        });
        state.data.products.push(product);
      }

      product.name = definition.name;
      product.category = "Dürüm";
      product.type = "sale";
      product.unit = "Adet";
      product.price = definition.price;
      product.recipe = definition.recipe;
      product.supportsDoritos = true;
      product.stock = Number(product.stock || 999);
    });

    let firikSale = findSaleProductByName("Firik");
    if (!firikSale) {
      firikSale = normalizeProduct({
        id: createId(),
        name: "Firik",
        category: "Tartılı Satış",
        type: "sale",
        unit: "Kg",
        stock: 999,
        criticalLevel: 0,
        price: 0,
        sold: 0,
        recipe: []
      });
      state.data.products.push(firikSale);
    }
    firikSale.name = "Firik";
    firikSale.category = "Tartılı Satış";
    firikSale.type = "sale";
    firikSale.unit = "Kg";
    firikSale.saleType = "weighted";
    firikSale.rawMaterialId = firikRaw.id;
  }

  function findDoritosStockProduct() {
    return state.data.products.find((product) => normalizeBusinessName(product.name).includes("doritos"));
  }

  function parseCartAddValue(value) {
    const [productId, optionId] = String(value || "").split("::");
    return {
      productId,
      options: optionId === "doritos" ? [{ id: "doritos", name: "Doritos", price: 25 }] : []
    };
  }

  function cartItemKey(productId, options = []) {
    return `${productId}::${options.map((option) => option.id).sort().join("+")}`;
  }

  function hasCartDoritos(item) {
    return Array.isArray(item.options) && item.options.some((option) => option.id === "doritos");
  }

  function optionTotal(options = []) {
    return options.reduce((total, option) => total + (Number(option.price) || 0), 0);
  }

  function cartQuantity(productId) {
    return state.cart
      .filter((entry) => entry.productId === productId)
      .reduce((total, entry) => total + Number(entry.quantity || entry.quantityKg || 0), 0);
  }

  function saleLineTotal(product, quantity, item = {}) {
    if (item.customAmountSale || item.saleType === "custom-amount") return Number(item.lineTotal || 0);
    if (item.saleType === "weighted") return Number(item.lineTotal || 0);
    return ((Number(product?.price) || 0) + optionTotal(item.options)) * Number(quantity || 0);
  }

  function calculateCartRecipeCost(product, item) {
    if (item.customAmountSale || item.saleType === "custom-amount") {
      if (item.rawMaterialId && Number(item.quantityKg || item.stockDeductQuantity || 0) > 0) {
        const raw = findProductById(item.rawMaterialId);
        return Math.round(Number(item.quantityKg || item.stockDeductQuantity || 0) * (Number(raw?.purchasePrice) || 0) * 100) / 100;
      }
      if (Array.isArray(product?.recipe) && product.recipe.length && Number(item.stockDeductQuantity || item.quantity || 0) > 0) {
        return calculateRecipeCost(product, item.stockDeductQuantity || item.quantity);
      }
      return 0;
    }
    if (item.saleType === "weighted") {
      const raw = findProductById(item.rawMaterialId);
      const cost = Number(item.quantityKg || 0) * (Number(raw?.purchasePrice) || 0);
      return Math.round(cost * 100) / 100;
    }

    let cost = calculateRecipeCost(product, item.quantity);
    if (hasCartDoritos(item)) {
      const doritos = findDoritosStockProduct();
      cost += Number(item.quantity || 0) * (Number(doritos?.purchasePrice) || 0);
    }
    return Math.round(cost * 100) / 100;
  }

  function formatWeightedAmount(item) {
    const kg = roundStock(item.quantityKg || 0);
    if (kg >= 1) return formatStock(kg, "Kg");
    return `${Math.round(kg * 1000)} gram`;
  }

  function calculateAvailableRecipeQuantity(product) {
    if (product?.saleType === "weighted") {
      const raw = findProductById(product.rawMaterialId);
      return roundStock(raw?.stock || 0);
    }

    const recipe = Array.isArray(product?.recipe) ? product.recipe : [];
    if (!recipe.length) return Number(product?.stock || 0);

    const limits = recipe.map((item) => {
      const material = findProductById(item.materialId);
      const perUnitKg = recipeAmountToKg(item.amount, item.unit);
      if (!material || perUnitKg <= 0) return 0;
      return Math.floor((roundStock(material.stock) / perUnitKg) * 1000) / 1000;
    });

    return limits.length ? Math.max(0, Math.min(...limits)) : 0;
  }

  function saleProductCard(product) {
    const available = calculateAvailableRecipeQuantity(product);
    const recipeCost = calculateRecipeCost(product);
    const grossProfit = Number(product.price || 0) - recipeCost;

    if (product.saleType === "weighted") {
      return `
        <button class="product-card sale-product-card" data-cart-add="${product.id}" type="button" ${available <= 0 ? "disabled" : ""}>
          <h4>${escapeHtml(product.name)}</h4>
          <p>Tartılı satış - ${formatStock(available, "Kg")} mevcut</p>
          <div class="product-card-meta">
            <span class="price">${formatTRY(product.price || 0)}/kg</span>
            <span class="${available <= 0 ? "danger" : "muted"}">Firik</span>
          </div>
        </button>
      `;
    }

    const doritosButtons = product.supportsDoritos ? `
      <div class="product-card-actions">
        <button class="button compact" type="button" data-cart-add="${product.id}">Standart</button>
        <button class="button compact" type="button" data-cart-add="${product.id}::doritos">Doritoslu +${formatTRY(25)}</button>
      </div>
    ` : "";

    return `
      <article class="product-card sale-product-card">
        <h4>${escapeHtml(product.name)}</h4>
        <p>${escapeHtml(product.category)} - ${escapeHtml(product.unit)}</p>
        <div class="product-card-meta">
          <span class="price">${money.format(product.price)}</span>
          <span class="${available <= product.criticalLevel ? "danger" : "muted"}">Stok: ${formatStock(available, product.unit)}</span>
        </div>
        ${Array.isArray(product.recipe) && product.recipe.length ? `<p class="muted">Maliyet: ${formatTRY(recipeCost)} | Brüt kâr: ${formatTRY(grossProfit)}</p>` : ""}
        ${doritosButtons || `<button class="button compact" type="button" data-cart-add="${product.id}" ${available <= 0 ? "disabled" : ""}>Sepete Ekle</button>`}
      </article>
    `;
  }

  function openWeightedFirikModal(product) {
    const raw = findProductById(product.rawMaterialId);
    const pricePerKg = Number(product.price || 0);

    if (pricePerKg <= 0) {
      showToast("Firik kilogram satış fiyatını önce Ürünler ekranından belirleyin.");
      return;
    }

    const modal = openModal("Firik Tartılı Satış", `
      <form id="weightedFirikForm">
        <div class="form-grid two">
          <div class="field">
            <label for="weightedMethod">Satış yöntemi</label>
            <select id="weightedMethod">
              <option value="kg">Kilogram/gram gir</option>
              <option value="amount">TL tutarı gir</option>
            </select>
          </div>
          <div class="field">
            <label>Kilogram fiyatı</label>
            <input id="weightedPricePerKg" value="${pricePerKg}" readonly />
          </div>
          <div class="field">
            <label for="weightedQuantity">Miktar</label>
            <input id="weightedQuantity" type="number" min="0.001" step="0.001" value="0.250" />
          </div>
          <div class="field">
            <label for="weightedUnit">Birim</label>
            <select id="weightedUnit">
              <option value="kg">kg</option>
              <option value="gram">gram</option>
            </select>
          </div>
          <div class="field">
            <label for="weightedAmount">Satış tutarı</label>
            <input id="weightedAmount" type="number" min="0.01" step="0.01" value="" />
          </div>
          <div class="field">
            <label>Hesaplanan miktar</label>
            <input id="weightedCalculated" readonly />
          </div>
        </div>
        <p class="muted" id="weightedSummary">Mevcut stok: ${formatStock(raw?.stock || 0, "Kg")}</p>
        <div class="modal-actions">
          <button type="button" class="button" data-close-modal>İptal</button>
          <button type="submit" class="button primary">Sepete Ekle</button>
        </div>
      </form>
    `);

    const form = modal.querySelector("#weightedFirikForm");
    const updatePreview = () => {
      const method = modal.querySelector("#weightedMethod")?.value || "kg";
      const amount = parseMoneyValue(modal.querySelector("#weightedAmount")?.value || 0);
      const quantity = parseMoneyValue(modal.querySelector("#weightedQuantity")?.value || 0);
      const unit = modal.querySelector("#weightedUnit")?.value || "kg";
      const kg = method === "amount" ? amount / pricePerKg : unit === "gram" ? quantity / 1000 : quantity;
      const lineTotal = kg * pricePerKg;
      const calculated = modal.querySelector("#weightedCalculated");
      if (calculated) calculated.value = `${formatStock(kg, "Kg")} / ${Math.round(kg * 1000)} gram / ${formatTRY(lineTotal)}`;
    };

    modal.querySelectorAll("#weightedMethod, #weightedAmount, #weightedQuantity, #weightedUnit").forEach((element) => {
      element.addEventListener("input", updatePreview);
      element.addEventListener("change", updatePreview);
    });
    updatePreview();

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const method = modal.querySelector("#weightedMethod")?.value || "kg";
      const amount = parseMoneyValue(modal.querySelector("#weightedAmount")?.value || 0);
      const quantity = parseMoneyValue(modal.querySelector("#weightedQuantity")?.value || 0);
      const unit = modal.querySelector("#weightedUnit")?.value || "kg";
      const quantityKg = roundStock(method === "amount" ? amount / pricePerKg : unit === "gram" ? quantity / 1000 : quantity);
      const lineTotal = Math.round(quantityKg * pricePerKg * 100) / 100;

      if (quantityKg <= 0 || lineTotal <= 0) {
        showToast("Firik satışı için geçerli miktar veya tutar girin.");
        return;
      }
      if (quantityKg > Number(raw?.stock || 0)) {
        showToast("Firik stoku yetersiz.");
        return;
      }

      state.cart.push({
        productId: product.id,
        name: product.name,
        saleType: "weighted",
        rawMaterialId: product.rawMaterialId,
        quantity: quantityKg,
        quantityKg,
        quantityGram: Math.round(quantityKg * 1000),
        pricePerKg,
        unitPrice: pricePerKg,
        lineTotal,
        options: []
      });
      closeActiveModal();
      render();
    });
  }

  function addToCart(productValue) {
    const parsed = parseCartAddValue(productValue);
    const product = state.data.products.find((item) => item.id === parsed.productId);
    if (!product) return;

    if (product.saleType === "weighted") {
      openWeightedFirikModal(product);
      return;
    }

    const key = cartItemKey(product.id, parsed.options);
    const item = state.cart.find((entry) => entry.key === key);
    const currentQuantity = item ? item.quantity : 0;
    const nextQuantity = roundStock(currentQuantity + 1);

    if (nextQuantity > calculateAvailableRecipeQuantity(product)) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    if (item) {
      item.quantity = nextQuantity;
      item.lineTotal = saleLineTotal(product, item.quantity, item);
    } else {
      state.cart.push({
        key,
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.price,
        options: parsed.options,
        lineTotal: saleLineTotal(product, 1, { options: parsed.options })
      });
    }
    render();
  }

  function changeCartQuantity(productId, delta) {
    const weightedItem = state.cart.find((entry) => entry.productId === productId && entry.saleType === "weighted");
    if (weightedItem) {
      state.cart = state.cart.filter((entry) => entry !== weightedItem);
      render();
      return;
    }

    const item = state.cart.find((entry) => entry.productId === productId && entry.saleType !== "weighted");
    const product = item ? state.data.products.find((entry) => entry.id === item.productId) : null;
    if (!product || !item) return;

    const nextQuantity = roundStock(item.quantity + delta);
    if (nextQuantity <= 0) {
      state.cart = state.cart.filter((entry) => entry !== item);
      render();
      return;
    }

    if (nextQuantity > calculateAvailableRecipeQuantity(product)) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    item.quantity = nextQuantity;
    item.lineTotal = saleLineTotal(product, item.quantity, item);
    render();
  }

  function setCartQuantity(productId, value) {
    const item = state.cart.find((entry) => entry.productId === productId && entry.saleType !== "weighted");
    const product = item ? state.data.products.find((entry) => entry.id === item.productId) : null;
    if (!product || !item) return;

    const nextQuantity = roundStock(parseMoneyValue(value));
    if (nextQuantity <= 0) {
      state.cart = state.cart.filter((entry) => entry !== item);
      render();
      return;
    }

    if (nextQuantity > calculateAvailableRecipeQuantity(product)) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    item.quantity = nextQuantity;
    item.lineTotal = saleLineTotal(product, item.quantity, item);
  }

  function cartTotal() {
    return state.cart.reduce((total, item) => {
      const product = state.data.products.find((entry) => entry.id === item.productId);
      return total + (product ? saleLineTotal(product, item.quantity || item.quantityKg, item) : 0);
    }, 0);
  }

  function cartRow(item) {
    const product = state.data.products.find((entry) => entry.id === item.productId);
    if (!product) return "";

    if (item.saleType === "weighted") {
      return `
        <div class="cart-row">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <div class="muted">${formatWeightedAmount(item)} - ${formatTRY(item.lineTotal)}</div>
            <div class="muted">Kg fiyatı: ${formatTRY(item.pricePerKg)}</div>
          </div>
          <button class="button icon-button" type="button" data-cart-decrease="${product.id}">-</button>
        </div>
      `;
    }

    const optionText = hasCartDoritos(item) ? "Doritoslu" : "Standart";
    return `
      <div class="cart-row">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <div class="muted">${optionText} - ${item.quantity} ${escapeHtml(product.unit)} - ${formatTRY(item.lineTotal || saleLineTotal(product, item.quantity, item))}</div>
        </div>
        <div class="cart-stepper">
          <button class="button icon-button" type="button" data-cart-decrease="${product.id}">-</button>
          <strong>${item.quantity}</strong>
          <button class="button icon-button" type="button" data-cart-increase="${product.id}">+</button>
        </div>
      </div>
    `;
  }

  function calculateRecipeUsage(items) {
    const usageMap = new Map();

    items.forEach(({ cartItem, product }) => {
      if (cartItem.customAmountSale || cartItem.saleType === "custom-amount") {
        if (cartItem.rawMaterialId && Number(cartItem.quantityKg || cartItem.stockDeductQuantity || 0) > 0) {
          const current = usageMap.get(cartItem.rawMaterialId) || 0;
          usageMap.set(cartItem.rawMaterialId, roundStock(current + Number(cartItem.quantityKg || cartItem.stockDeductQuantity || 0)));
          return;
        }
        if (!product || !Array.isArray(product.recipe) || !product.recipe.length) return;
        product.recipe.forEach((recipeItem) => {
          const amountKg = roundStock(recipeAmountToKg(recipeItem.amount, recipeItem.unit) * Number(cartItem.stockDeductQuantity || cartItem.quantity || 0));
          const current = usageMap.get(recipeItem.materialId) || 0;
          usageMap.set(recipeItem.materialId, roundStock(current + amountKg));
        });
        return;
      }

      if (cartItem.saleType === "weighted") {
        const current = usageMap.get(cartItem.rawMaterialId) || 0;
        usageMap.set(cartItem.rawMaterialId, roundStock(current + Number(cartItem.quantityKg || 0)));
        return;
      }

      if (!product || !Array.isArray(product.recipe) || !product.recipe.length) return;

      product.recipe.forEach((recipeItem) => {
        const amountKg = roundStock(recipeAmountToKg(recipeItem.amount, recipeItem.unit) * Number(cartItem.quantity || 0));
        const current = usageMap.get(recipeItem.materialId) || 0;
        usageMap.set(recipeItem.materialId, roundStock(current + amountKg));
      });
    });

    return usageMap;
  }

  function validateDoritosStock(items) {
    const doritos = findDoritosStockProduct();
    if (!doritos) return [];

    const needed = items.reduce((total, item) => total + (hasCartDoritos(item.cartItem) ? Number(item.cartItem.quantity || 0) : 0), 0);
    if (needed > 0 && Number(doritos.stock || 0) < needed) {
      return [`Doritos eksik: gerekli ${needed}, mevcut ${doritos.stock || 0}`];
    }
    return [];
  }

  function recordSale() {
    const method = state.paymentMethod || state.data.paymentMethods[0];

    if (!state.cart.length) {
      showToast("Satis icin sepete urun ekleyin.");
      return;
    }

    const items = state.cart.map((cartItem) => {
      const product = state.data.products.find((entry) => entry.id === cartItem.productId);
      return { cartItem, product };
    });

    const invalidItem = items.find((item) => !item.product || (item.cartItem.saleType !== "weighted" && (!Array.isArray(item.product.recipe) || !item.product.recipe.length) && item.product.stock < item.cartItem.quantity));
    if (invalidItem) {
      showToast("Bu ürün için yeterli stok yok.");
      return;
    }

    const recipeUsage = calculateRecipeUsage(items);
    const missingMaterials = validateRecipeStock(recipeUsage);
    const doritosMissing = validateDoritosStock(items);
    if (missingMaterials.length || doritosMissing.length) {
      showToast([...missingMaterials, ...doritosMissing].join(" | "));
      return;
    }

    items.forEach(({ cartItem, product }) => {
      if (cartItem.saleType !== "weighted" && (!Array.isArray(product.recipe) || !product.recipe.length)) {
        product.stock = roundStock(product.stock - cartItem.quantity);
      }
      product.sold = roundStock(product.sold + Number(cartItem.quantity || cartItem.quantityKg || 0));
    });

    recipeUsage.forEach((amountKg, materialId) => {
      const material = findProductById(materialId);
      if (material) material.stock = roundStock(material.stock - amountKg);
    });

    const doritos = findDoritosStockProduct();
    if (doritos) {
      const doritosNeeded = items.reduce((total, item) => total + (hasCartDoritos(item.cartItem) ? Number(item.cartItem.quantity || 0) : 0), 0);
      doritos.stock = roundStock(Number(doritos.stock || 0) - doritosNeeded);
    }

    const now = new Date();
    const saleItems = items.map(({ cartItem, product }) => {
      const lineTotal = saleLineTotal(product, cartItem.quantity || cartItem.quantityKg, cartItem);
      const recipeCost = calculateCartRecipeCost(product, cartItem);

      return {
        productId: product.id,
        productName: product.name,
        name: product.name,
        saleType: cartItem.saleType || "standard",
        quantity: cartItem.quantity || cartItem.quantityKg,
        quantityKg: cartItem.quantityKg || null,
        quantityGram: cartItem.quantityGram || null,
        unit: product.unit,
        unitPrice: cartItem.pricePerKg || product.price,
        pricePerKg: cartItem.pricePerKg || null,
        options: Array.isArray(cartItem.options) ? cartItem.options : [],
        optionsTotal: optionTotal(cartItem.options),
        recipeCost,
        grossProfit: lineTotal - recipeCost,
        lineTotal,
        total: lineTotal
      };
    });
    const total = saleItems.reduce((sum, item) => sum + item.total, 0);
    const recipeCost = saleItems.reduce((sum, item) => sum + item.recipeCost, 0);
    const quantity = saleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    state.data.sales.push({
      id: createId(),
      productId: saleItems[0].productId,
      productName: saleItems.length === 1 ? saleItems[0].productName : `${saleItems.length} urun`,
      quantity,
      unit: saleItems.length === 1 ? saleItems[0].unit : "kalem",
      unitPrice: total,
      total,
      recipeCost,
      grossProfit: total - recipeCost,
      paymentMethod: method,
      date: now.toISOString().slice(0, 10),
      time: now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      items: saleItems
    });

    state.quantity = 1;
    state.cart = [];
    state.page = "Dashboard";
    saveData();
    showToast("Satış kaydedildi. Stok ve kasa güncellendi.");
    render();
  }

  applyBusinessProductCatalog();
  if (isSetupCompleted()) saveData();

  if (window.location.hash === "#sale") state.page = "Satis Yap";
  if (state.data.paymentMethods.length) state.paymentMethod = state.data.paymentMethods[0];
  if (state.data.products.length) state.selectedProductId = state.data.products[0].id;

  render();
  bootstrapSupabase().catch((error) => {
    console.error("[Supabase] init failed", error);
    state.authLoading = false;
    state.supabaseEnabled = false;
    state.supabaseError = error.message;
    render();
  });
})();

