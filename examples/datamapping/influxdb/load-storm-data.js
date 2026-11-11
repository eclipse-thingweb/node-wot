/* eslint no-console: "off" */

// Loads storm_data.csv into InfluxDB 1.8 as the "storm_event" measurement.
// Runs inside the "storm-data-loader" container defined in docker-compose.yml.

const fs = require("node:fs");

const influxUrl = process.env.INFLUXDB_URL ?? "http://localhost:8086";
const csvFile = process.env.CSV_FILE ?? "../storm-data-file/storm_data.csv";
const database = process.env.INFLUXDB_DB ?? "storms";

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (c === '"') {
                quoted = false;
            } else {
                field += c;
            }
        } else if (c === '"') {
            quoted = true;
        } else if (c === ",") {
            row.push(field);
            field = "";
        } else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += c;
        }
    }
    if (field !== "" || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

const escapeTag = (value) => value.replace(/[\\,= ]/g, (c) => `\\${c}`);
const escapeString = (value) => value.replace(/[\\"]/g, (c) => `\\${c}`);

// BEGIN_DATE is MM/DD/YYYY, BEGIN_TIME is HHMM, CZ_TIMEZONE is e.g. "CST-6".
function toEpochSeconds(date, time, timezone) {
    const [month, day, year] = date.split("/").map(Number);
    const hhmm = Number(time);
    const offsetHours = Number(timezone.replace(/^[A-Z]+/, ""));
    const local = Date.UTC(year, month - 1, day, Math.floor(hhmm / 100), hhmm % 100);
    return (local - offsetHours * 3600 * 1000) / 1000;
}

function toLineProtocol(event) {
    const tags = [
        `event_id=${escapeTag(event.EVENT_ID)}`,
        `state=${escapeTag(event.STATE)}`,
        `event_type=${escapeTag(event.EVENT_TYPE)}`,
    ];
    const fields = [
        `county="${escapeString(event.CZ_NAME_STR)}"`,
        `deaths_direct=${Number(event.DEATHS_DIRECT)}i`,
        `injuries_direct=${Number(event.INJURIES_DIRECT)}i`,
        `damage_property=${Number(event.DAMAGE_PROPERTY_NUM)}i`,
        `damage_crops=${Number(event.DAMAGE_CROPS_NUM)}i`,
    ];
    if (event.MAGNITUDE !== "") {
        fields.push(`magnitude=${Number(event.MAGNITUDE)}`);
    }
    const time = toEpochSeconds(event.BEGIN_DATE, event.BEGIN_TIME, event.CZ_TIMEZONE);
    return `storm_event,${tags.join(",")} ${fields.join(",")} ${time}`;
}

async function waitForInflux() {
    for (let attempt = 1; attempt <= 30; attempt++) {
        try {
            const response = await fetch(`${influxUrl}/ping`);
            if (response.ok) return;
        } catch {
            // InfluxDB is not accepting connections yet.
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(`InfluxDB at ${influxUrl} did not become ready`);
}

async function request(path, body) {
    const response = await fetch(`${influxUrl}${path}`, { method: "POST", body });
    if (!response.ok) {
        throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
    }
}

async function main() {
    const [header, ...records] = parseCsv(fs.readFileSync(csvFile, "utf8").replace(/^\uFEFF/, ""));
    const events = records.map((values) => Object.fromEntries(header.map((name, i) => [name, values[i] ?? ""])));

    await waitForInflux();
    await request(`/query?q=${encodeURIComponent(`CREATE DATABASE ${database}`)}`);
    await request(`/write?db=${database}&precision=s`, events.map(toLineProtocol).join("\n"));
    console.log(`Loaded ${events.length} storm events into InfluxDB database '${database}'`);
}

main().catch((err) => {
    console.error("Storm data loader error:", err);
    process.exitCode = 1;
});
