export type DateBounds = {
  min: string;
  max: string;
};

const minimumTargetDateOffsetDays = 14;
const maximumTargetDateOffsetDays = 730;
const dayMilliseconds = 24 * 60 * 60 * 1000;

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = createUtcDate(year!, month!, day!);
  return formatIsoDate(date) === value;
}

export function parseIsoDate(value: string) {
  if (!isValidIsoDate(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

export function formatIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTargetDateBounds(referenceDate: Date): DateBounds {
  const referenceDay = createUtcDate(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth() + 1,
    referenceDate.getUTCDate(),
  );
  const minimum = addUtcDays(referenceDay, minimumTargetDateOffsetDays);
  const maximum = addUtcDays(referenceDay, maximumTargetDateOffsetDays);

  return {
    min: formatIsoDate(minimum),
    max: formatIsoDate(maximum),
  };
}

export function createUtcDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * dayMilliseconds);
}
