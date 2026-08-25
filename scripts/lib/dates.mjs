// All date math in UTC on ISO strings — no local timezone surprises.

export function daysAgo(isoDate, n) {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}

export function monthsAgo(isoDate, n) {
    const d = new Date(`${isoDate.slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - n);
    return d.toISOString().slice(0, 7);
}

export function* dateRange(startIso, endIso) {
    const d = new Date(`${startIso}T00:00:00Z`);
    const stop = new Date(`${endIso}T00:00:00Z`);
    while (d <= stop) {
        yield d.toISOString().slice(0, 10);
        d.setUTCDate(d.getUTCDate() + 1);
    }
}

export function* monthRange(startMonth, endMonth) {
    const d = new Date(`${startMonth}-01T00:00:00Z`);
    const stop = new Date(`${endMonth}-01T00:00:00Z`);
    while (d <= stop) {
        yield d.toISOString().slice(0, 7);
        d.setUTCMonth(d.getUTCMonth() + 1);
    }
}
