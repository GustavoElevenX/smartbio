// These fields are supplied by the catalog/cart, not by a second generic form.
export function isCatalogSelectionLabel(label: string) {
  const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/_/g, " ").trim();
  return /^(item|itens|produtos?|quantidades?|sabor|sabores|modelos?|cor|cores|tamanhos?|variantes?)(\s+(do pedido|desejados?|selecionados?))?$/.test(normalized);
}
