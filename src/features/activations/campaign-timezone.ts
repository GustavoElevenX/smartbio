function parts(date: Date, timeZone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
}

export function toCampaignLocalTime(iso: string, timeZone: string) {
  const value = parts(new Date(iso), timeZone);
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

/** Converte datetime-local no fuso da campanha, independentemente do fuso do navegador. */
export function campaignLocalTimeToIso(local: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) throw new Error("Informe uma data e hora válidas.");
  const [, year, month, day, hour, minute] = match;
  const wall = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (!Number.isFinite(wall)) throw new Error("Informe uma data e hora válidas.");
  const offset = (instant: number) => {
    const value = parts(new Date(instant), timeZone);
    const localAsUtc = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), Number(value.hour), Number(value.minute), Number(value.second));
    return localAsUtc - instant;
  };
  const candidates = [wall - 86_400_000, wall, wall + 86_400_000]
    .map(offset).map((value) => wall - value)
    .filter((value, index, values) => values.indexOf(value) === index)
    .filter((value) => toCampaignLocalTime(new Date(value).toISOString(), timeZone) === local)
    .toSorted((a, b) => a - b);
  if (!candidates.length) throw new Error("Este horário não existe no fuso da campanha.");
  return new Date(candidates[0]).toISOString();
}
