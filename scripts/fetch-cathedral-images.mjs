// Downloads the Wikipedia lead image for each cathedral named in src/visits/*.md,
// keeping only freely licensed images from Wikimedia Commons, and records the
// credit for each in src/_data/cathedralImages.json.
//
//   node scripts/fetch-cathedral-images.mjs           # fetch any missing
//   node scripts/fetch-cathedral-images.mjs --force   # re-fetch everything

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const VISITS_DIR = "src/visits";
const IMAGE_DIR = "src/images/cathedrals";
const DATA_FILE = "src/_data/cathedralImages.json";
const WIDTH = 800;
const HEADERS = { "User-Agent": "SandersteadSingersWebsite/1.0 (https://www.sandersteadsingers.org.uk)" };

// Where the Wikipedia article title differs from the name we use
const WIKIPEDIA_TITLES = {};

const FREE_LICENCE = /^(public domain|pd|cc0|cc by(-sa)? [0-9.]+)/i;

const force = process.argv.includes("--force");

function slugify(name) {
    return name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function stripHtml(html = "") {
    return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function api(host, params) {
    const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: "json", formatversion: 2, ...params });
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`${res.status} from ${url}`);
    return res.json();
}

async function cathedralNames() {
    const names = new Set();
    for (const file of await readdir(VISITS_DIR)) {
        if (!file.endsWith(".md")) continue;
        const text = await readFile(`${VISITS_DIR}/${file}`, "utf8");
        const match = text.match(/^cathedral:\s*(.+)$/m);
        if (match && !/^notCathedral:\s*true/m.test(text)) names.add(match[1].trim().replace(/^["']|["']$/g, ""));
    }
    return [...names].sort();
}

async function fetchImage(name) {
    const title = WIKIPEDIA_TITLES[name] || name;
    const page = (await api("en.wikipedia.org", {
        action: "query", titles: title, redirects: 1, prop: "pageimages", piprop: "name",
    })).query.pages[0];
    if (!page.pageimage) throw new Error(`no lead image on "${title}"`);

    // Images that live on Commons (rather than locally on Wikipedia) carry machine-readable licences
    const file = (await api("commons.wikimedia.org", {
        action: "query", titles: `File:${page.pageimage}`, prop: "imageinfo",
        iiprop: "url|extmetadata", iiurlwidth: WIDTH,
    })).query.pages[0];
    const info = file.imageinfo && file.imageinfo[0];
    if (!info) throw new Error(`${page.pageimage} is not on Wikimedia Commons`);

    const meta = info.extmetadata;
    const licence = stripHtml(meta.LicenseShortName?.value);
    if (!FREE_LICENCE.test(licence)) throw new Error(`${page.pageimage} has licence "${licence}"`);

    const res = await fetch(info.thumburl, { headers: HEADERS });
    if (!res.ok) throw new Error(`${res.status} downloading ${info.thumburl}`);
    const ext = info.thumburl.match(/\.(jpe?g|png|webp)$/i)?.[1].toLowerCase().replace("jpeg", "jpg") || "jpg";
    const src = `/images/cathedrals/${slugify(name)}.${ext}`;
    await writeFile(`src${src}`, Buffer.from(await res.arrayBuffer()));

    return {
        src,
        artist: stripHtml(meta.Artist?.value) || "Unknown",
        licence,
        licenceUrl: meta.LicenseUrl?.value || null,
        source: info.descriptionurl,
    };
}

await mkdir(IMAGE_DIR, { recursive: true });
const data = existsSync(DATA_FILE) ? JSON.parse(await readFile(DATA_FILE, "utf8")) : {};

for (const name of await cathedralNames()) {
    if (data[name] && !force) continue;
    try {
        data[name] = await fetchImage(name);
        console.log(`✓ ${name}: ${data[name].licence}, ${data[name].artist}`);
    } catch (err) {
        console.warn(`✗ ${name}: ${err.message}`);
    }
}

await writeFile(DATA_FILE, JSON.stringify(data, null, 4) + "\n");
