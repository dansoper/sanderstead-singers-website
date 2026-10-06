const fs = require("node:fs/promises");
const markdownIt = require("markdown-it");

// Where the site lives. Set to "/" to publish it at the root instead of the
// holding page in landing/index.html.
const PATH_PREFIX = "/";

const MUSIC_COLUMNS = [
    ["introit", "Introit"],
    ["responses", "Responses"],
    ["psalm", "Psalm"],
    ["canticles", "Setting"],
    ["anthem", "Anthem"],
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];

// Visits have either an exact `start` date, or a `year` with an optional `month` ("August", "July/August")
function sortKey(visit) {
    const d = visit.data;
    if (d.start) return new Date(d.start).getTime();
    if (d.year) return Date.UTC(d.year, Math.max(MONTHS.indexOf(String(d.month).split("/")[0]), 0), 1);
    return -Infinity;
}

// Still to happen, as of the build: its last day is today or later
const TODAY = new Date(new Date().toISOString().slice(0, 10));
function isUpcoming(data) {
    const last = data.end || data.start;
    return Boolean(last) && new Date(last) >= TODAY;
}

function formatDate(value, options) {
    return new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC", ...options });
}

module.exports = async function (eleventyConfig) {
    // Rewrites root-relative URLs (/visits/, /css/style.css) to include PATH_PREFIX
    const { HtmlBasePlugin } = await import("@11ty/eleventy");
    eleventyConfig.addPlugin(HtmlBasePlugin);

    // The site builds into _site/dev/; put the holding page at _site/index.html
    if (PATH_PREFIX !== "/") {
        eleventyConfig.on("eleventy.after", async () => {
            const landing = await fs.readFile("landing/index.html", "utf8");
            await fs.writeFile("_site/index.html", landing.replaceAll("{{ pathPrefix }}", PATH_PREFIX));
        });
    }

    eleventyConfig.addPassthroughCopy("src/files");
    eleventyConfig.addPassthroughCopy("src/images");
    eleventyConfig.addPassthroughCopy("src/css");
    eleventyConfig.addPassthroughCopy("src/documents");

    const pastVisits = (api) => api.getFilteredByGlob("src/visits/*.md").filter((v) => !isUpcoming(v.data));

    // Newest first
    eleventyConfig.addCollection("visits", (api) => pastVisits(api).sort((a, b) => sortKey(b) - sortKey(a)));

    // Every visit, past and future, oldest first (for previous/next links)
    eleventyConfig.addCollection("chronological", (api) =>
        api.getFilteredByGlob("src/visits/*.md").sort((a, b) => sortKey(a) - sortKey(b))
    );

    // Soonest first
    eleventyConfig.addCollection("upcoming", (api) =>
        api.getFilteredByGlob("src/visits/*.md").filter((v) => isUpcoming(v.data)).sort((a, b) => sortKey(a) - sortKey(b))
    );

    // [{ name, visits: [...] }] alphabetically, each cathedral's visits oldest first
    eleventyConfig.addCollection("cathedrals", (api) => {
        const byName = new Map();
        // Parish churches and colleges appear in Visits but not here
        for (const visit of api.getFilteredByGlob("src/visits/*.md").filter((v) => !v.data.notCathedral)) {
            const name = visit.data.cathedral;
            if (!byName.has(name)) byName.set(name, []);
            byName.get(name).push(visit);
        }
        return [...byName.entries()]
            .map(([name, visits]) => {
                visits.sort((a, b) => sortKey(a) - sortKey(b));
                const cover = [...visits].reverse().find((v) => v.data.image);
                return { name, visits, image: cover && cover.data.image };
            })
            .sort((a, b) => a.name.replace(/^St\.? /, "").localeCompare(b.name.replace(/^St\.? /, "")));
    });

    // The year the site was built, e.g. for the copyright line
    eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

    eleventyConfig.addFilter("isUpcoming", isUpcoming);

    // A reversed copy (Nunjucks' own `reverse` reorders the original array in place)
    eleventyConfig.addFilter("newestFirst", (items) => [...items].reverse());

    eleventyConfig.addFilter("longDate", (value) =>
        formatDate(value, { day: "numeric", month: "long", year: "numeric" })
    );
    eleventyConfig.addFilter("serviceDate", (value) =>
        formatDate(value, { weekday: "short", day: "numeric", month: "long" })
    );

    // "19–25 August 2019", "10 April 2012", or just "1995"
    eleventyConfig.addFilter("visitDates", (data) => {
        if (data.dateLabel) return data.dateLabel;
        if (!data.start) {
            if (!data.year) return "Date not known";
            return data.month ? `${data.month.replace("/", " / ")} ${data.year}` : String(data.year);
        }
        const start = new Date(data.start);
        const end = data.end ? new Date(data.end) : null;
        if (end && end.getTime() === start.getTime()) return formatDate(start, { day: "numeric", month: "long", year: "numeric" });
        if (!end) return formatDate(start, { day: "numeric", month: "long", year: "numeric" });
        const sameMonth = start.getUTCMonth() === end.getUTCMonth();
        const first = formatDate(start, sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" });
        return `${first}–${formatDate(end, { day: "numeric", month: "long", year: "numeric" })}`;
    });

    eleventyConfig.addFilter("visitYear", (data) => {
        if (data.start) return new Date(data.start).getUTCFullYear();
        return data.year || "";
    });

    // Only show music columns that have something in them for this visit
    eleventyConfig.addFilter("musicColumns", (services = []) =>
        MUSIC_COLUMNS.filter(([key]) => services.some((s) => s[key]))
    );

    eleventyConfig.addFilter("confirmed", (visits) => visits.filter((v) => !v.data.status));
    eleventyConfig.addFilter("limit", (items, n) => items.slice(0, n));

    eleventyConfig.addFilter("visitsTo", (cathedrals, name) =>
        (cathedrals.find((c) => c.name === name) || { visits: [] }).visits
    );

    // Cathedrals with at least one visit that has happened (not cancelled, unconfirmed or still to come)
    eleventyConfig.addFilter("sungCount", (cathedrals) =>
        cathedrals.filter((c) => c.visits.some((v) => !v.data.status && !isUpcoming(v.data))).length
    );

    eleventyConfig.addFilter("hasDates", (services = []) => services.some((s) => s.date));

    eleventyConfig.addFilter("hasMusic", (services = []) =>
        services.some((s) => MUSIC_COLUMNS.some(([key]) => s[key]))
    );

    const options = {
        html: true,
        typographer: true,
    };
    const md = markdownIt(options);
    eleventyConfig.setLibrary("md", md);

    // Curly quotes and dashes for titles and names that never goes through Markdown.
    // Returns plain text, so Nunjucks still escapes it.
    eleventyConfig.addFilter("smart", (text) => {
        if (!text) return text;
        const [inline] = md.parseInline(String(text), {});
        return inline.children.map((token) => token.content).join("");
    });

    return {
        dir: { input: "src", output: "_site" + PATH_PREFIX },
        pathPrefix: PATH_PREFIX,
        markdownTemplateEngine: "njk",
        htmlTemplateEngine: "njk",
    };
};
