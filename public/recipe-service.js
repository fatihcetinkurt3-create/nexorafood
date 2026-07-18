(function () {
  function normalizeRecipeUnit(unit) {
    const value = String(unit || "gram").toLocaleLowerCase("tr-TR");
    if (["kg", "kilogram"].includes(value)) return "kilogram";
    if (["adet", "piece", "pcs"].includes(value)) return "adet";
    return "gram";
  }

  function roundQuantity(value) {
    const number = Number(value) || 0;
    return Math.round(number * 1000) / 1000;
  }

  function recipeAmountToIngredientUnit(amount, recipeUnit, ingredientUnit) {
    const value = Number(amount) || 0;
    const unit = normalizeRecipeUnit(recipeUnit);
    const target = window.NexoraIngredientService?.normalizeUnit?.(ingredientUnit) || "Kg";
    if (unit === "adet") return roundQuantity(value);
    const grams = unit === "kilogram" ? value * 1000 : value;
    return target === "Gram" ? roundQuantity(grams) : roundQuantity(grams / 1000);
  }

  function calculateCapacity(product, ingredientsById) {
    const recipe = Array.isArray(product?.recipe) ? product.recipe : [];
    if (!recipe.length) return Number.POSITIVE_INFINITY;
    const limits = recipe.map((item) => {
      const ingredient = ingredientsById.get(item.materialId || item.ingredientId);
      const needed = recipeAmountToIngredientUnit(item.amount || item.quantity, item.unit, ingredient?.unit);
      if (!ingredient || needed <= 0) return 0;
      return Math.floor((Number(ingredient.stock || 0) / needed) * 1000) / 1000;
    });
    return Math.max(0, Math.min(...limits));
  }

  window.NexoraRecipeService = {
    normalizeRecipeUnit,
    recipeAmountToIngredientUnit,
    calculateCapacity
  };
})();
