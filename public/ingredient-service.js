(function () {
  function normalizeUnit(unit) {
    const value = String(unit || "Kg").toLocaleLowerCase("tr-TR");
    if (["gram", "gr", "g"].includes(value)) return "Gram";
    if (["adet", "piece", "pcs"].includes(value)) return "Adet";
    return "Kg";
  }

  function roundQuantity(value) {
    const number = Number(value) || 0;
    return Math.round(number * 1000) / 1000;
  }

  function isIngredient(product) {
    return product?.type === "raw" || product?.stockTrackingType === "ingredient";
  }

  function formatQuantity(value, unit) {
    const normalizedUnit = normalizeUnit(unit);
    const quantity = roundQuantity(value);
    if (normalizedUnit === "Kg" && quantity > 0 && quantity < 1) return `${Math.round(quantity * 1000)} gr`;
    if (normalizedUnit === "Kg") return `${quantity.toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`;
    if (normalizedUnit === "Gram") return `${quantity.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} gr`;
    return `${quantity.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} adet`;
  }

  window.NexoraIngredientService = {
    normalizeUnit,
    roundQuantity,
    isIngredient,
    formatQuantity
  };
})();
