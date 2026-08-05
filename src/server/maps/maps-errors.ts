import "server-only";

export class MapsConfigurationError extends Error {
  readonly code = "maps_configuration_error";

  constructor(message = "O provedor de mapas não está configurado.") {
    super(message);
    this.name = "MapsConfigurationError";
  }
}

export class AddressNotFoundError extends Error {
  readonly code = "address_not_found";

  constructor(message = "Não encontramos esse endereço. Revise os dados ou informe as coordenadas manualmente.") {
    super(message);
    this.name = "AddressNotFoundError";
  }
}

export class MapsProviderError extends Error {
  readonly code = "maps_provider_error";

  constructor(message = "O serviço de geocodificação não respondeu. Tente novamente.") {
    super(message);
    this.name = "MapsProviderError";
  }
}
