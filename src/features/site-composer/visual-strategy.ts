import type { BusinessShape } from "./site-composer.types";

export function recommendVisualDirection(shape: BusinessShape) {
  const directions = ["hierarquia clara", "contraste acessível", "componentes responsivos"];
  if (shape.hasCatalog) directions.push("fotografia de produto consistente");
  if (shape.model === "b2b") directions.push("prova e credibilidade antes da conversão");
  if (shape.locationCount > 0) directions.push("informações locais fáceis de localizar");
  return directions;
}
