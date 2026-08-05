import type { BusinessLocation, OpeningHoursRule } from "@/types";

export interface OpeningHoursException {
  startsAt: string;
  endsAt: string;
  isOpen: boolean;
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function timeToMinutes(value: string) { const [hour = 0, minute = 0] = value.split(":").map(Number); return hour * 60 + minute; }

export function isOpenAt(rules: OpeningHoursRule[], requestedAt: string | Date, timezone: string, exceptions: OpeningHoursException[] = []) {
  const date = requestedAt instanceof Date ? requestedAt : new Date(requestedAt);
  if (Number.isNaN(date.getTime())) return false;
  const exception = exceptions.find((item) => date >= new Date(item.startsAt) && date < new Date(item.endsAt));
  if (exception) return exception.isOpen;
  const { day, minutes } = localParts(date, timezone);
  const previousDay = (day + 6) % 7;
  return rules.some((rule) => {
    if (rule.isClosed) return false;
    const opens = timeToMinutes(rule.opensAt);
    const closes = timeToMinutes(rule.closesAt);
    if (opens === closes && rule.weekday === day) return true;
    if (closes > opens) return rule.weekday === day && minutes >= opens && minutes < closes;
    return (rule.weekday === day && minutes >= opens) || (rule.weekday === previousDay && minutes < closes);
  });
}

export function isLocationOpen(location: BusinessLocation, requestedAt: string | Date) {
  return isOpenAt(location.openingHours, requestedAt, location.timezone);
}
