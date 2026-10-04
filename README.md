# Sanderstead Singers website

Built with [Eleventy](https://www.11ty.dev/). Much of the content was recovered from the [archived old site](https://web.archive.org/web/20240506224550/https://www.sandersteadsingers.org.uk/).

```sh
npm install
npm start       # local preview at http://localhost:8080
npm run build   # outputs to _site/
```

### Publishing at /dev

While the new site is being finished, it builds into `_site/dev/`, with all links prefixed `/dev/`. The holding page in `landing/index.html` goes at `_site/index.html`. To launch, set `PATH_PREFIX` to `"/"` in `.eleventy.js`: the site then builds straight into `_site/` and the holding page is no longer used. Keep links in templates and Markdown root-relative (`/visits/`), and the prefix is added automatically.

## Adding or editing a visit

Create `src/visits/<cathedral>-<year>.md`. The file name becomes the URL (`/visits/ely-2019/`).

```yaml
---
cathedral: Ely Cathedral          # must match exactly across visits to group them
start: 2019-08-19                 # or `year: 2019` plus optional `month: August` if exact dates aren't known
end: 2019-08-25                   # optional
kind: Choir camp                  # e.g. Choir camp, Evensong, Virtual Choral Evensong
status: Cancelled                 # optional: Cancelled / To be confirmed
image: /images/visits/ely-2019.jpg  # optional main photo
imageAlt: Ely Cathedral
imageCaption: "Photo: A. N. Other"  # quote anything containing a colon
photos:                           # optional gallery, e.g. from Facebook
  - src: /images/visits/ely-2019-choir.jpg
    alt: The choir outside the west door
    caption: Optional caption
services:
  - date: 2019-08-19
    service: Choral Evensong
    introit: "..."
    responses: "Sumsion"
    psalm: "Psalms 98–102"
    canticles: "Harwood in A flat"   # shown as "Setting"
    anthem: "My soul, there is a country – Parry"
  - date: 2019-08-22
    service: Dumb Day
---
Optional paragraphs about the visit, in Markdown.
```

Add `notCathedral: true` for venues such as parish churches: they appear in Visits but not on the Cathedrals page or in its count. Each music field is optional, and a table column only appears if at least one service uses it. A visit that isn't cancelled or unconfirmed and has no `services` shows a "music list not online yet" note. The home page counts and the "N cathedrals" figures update automatically, and skip visits that have a `status`.

### Cathedral photos

The Cathedrals page, and any visit without its own photo, use each cathedral's lead image from Wikipedia. The script only accepts freely licensed images from Wikimedia Commons (public domain, CC0, CC BY, CC BY-SA) and saves them to `src/images/cathedrals/`. It records the photographer and licence in `src/_data/cathedralImages.json`, and the site shows that credit next to each image, as the licences require. After adding a visit to a new cathedral, run:

```sh
npm run cathedral-images
```

If a cathedral's Wikipedia article has a different title, add it to `WIKIPEDIA_TITLES` in `scripts/fetch-cathedral-images.mjs`. To use a different image, edit the JSON entry by hand, keeping the credit accurate.

### Importing the music spreadsheet

The `services` fields map directly to spreadsheet columns (date, service, introit, responses, psalm, setting, anthem), so a small script can turn a CSV export into these front-matter blocks.