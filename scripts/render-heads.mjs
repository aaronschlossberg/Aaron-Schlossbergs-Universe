import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const IGNORE = new Set([".git", "_site", "node_modules", "__MACOSX", "_partials"]);
const EXEMPT = new Set(["google80eb4e64b20355ca.html"]);
const COMMON_SCHEMA_TYPES = new Set([
    "Person", "WebSite", "WebPage", "AboutPage", "ContactPage",
    "CollectionPage", "ProfilePage", "BreadcrumbList", "ImageObject"
]);

const [config, pages, template] = await Promise.all([
    readFile(path.join(ROOT, "data/config.json"), "utf8").then(JSON.parse),
    readFile(path.join(ROOT, "data/pages.json"), "utf8").then(JSON.parse),
    readFile(path.join(ROOT, "_partials/head.html"), "utf8")
]);

function esc(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pageUrl(pathname) {
    return new URL(pathname, `${config.baseUrl}/`).href;
}

function pathnameFor(file) {
    const relative = path.relative(ROOT, file).split(path.sep).join("/");
    if (relative === "index.html") return "/";
    if (relative.endsWith("/index.html")) return `/${relative.slice(0, -10)}`;
    return `/${relative}`;
}

async function walk(directory = ROOT) {
    const files = [];

    for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && IGNORE.has(entry.name)) continue;

        const full = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...await walk(full));
        } else if (entry.name.endsWith(".html")) {
            const relative = path.relative(ROOT, full).split(path.sep).join("/");

            if (!EXEMPT.has(relative)) {
                files.push(full);
            }
        }
    }

    return files.sort();
}

function personNode(detailed) {
    const node = {
        "@type": "Person",
        "@id": `${config.baseUrl}/#person`,
        name: config.personName,
        alternateName: config.alternatePersonName,
        url: `${config.baseUrl}/about-me/`
    };

    if (!detailed) return node;

    const socialKeys = [
        "instagram", "instagramPhotography", "instagramWebsite",
        "facebookProfile", "facebookPage", "x", "linkedin", "quora",
        "medium", "substack", "spotify", "tiktok", "pinterest", "reddit",
        "youtube", "github", "threads", "myspace"
    ];

    const sameAs = socialKeys
        .map(key => config.links?.[key])
        .filter(Boolean)
        .map(value => {
            const url = new URL(value);
            url.search = "";
            url.hash = "";
            return url.href;
        });

    return {
        ...node,
        givenName: "Aaron",
        familyName: "Schlossberg",
        description: config.defaultDescription,
        image: {
            "@type": "ImageObject",
            url: `${config.baseUrl}/assets/img/me_nachi_falls_circular.png`,
            caption: "Aaron Schlossberg at Nachi Falls in Japan"
        },
        alumniOf: {
            "@type": "CollegeOrUniversity",
            name: "Muhlenberg College",
            url: "https://www.muhlenberg.edu/"
        },
        knowsAbout: [
            "Computer science",
            "Web development",
            "Entrepreneurship",
            "Creative writing",
            "Technical writing",
            "Knowledge systems",
            "Worldbuilding",
            "Liminal spaces",
            "Immersive experiences",
            "Community building"
        ],
        sameAs
    };
}

function breadcrumbNode(pathname, absoluteUrl) {
    if (
        pathname === "/" ||
        pages[pathname].breadcrumbs === false
    ) {
        return null;
    }

    const trail = [
        {
            pathname: "/",
            name: pages["/"].breadcrumbLabel
        }
    ];

    let current = "/";

    for (
        const segment of
        pathname.split("/").filter(Boolean)
    ) {
        current += `${segment}/`;

        const parent = pages[current];

        if (!parent) {
            throw new Error(
                `${pathname} needs a ${current} parent entry.`
            );
        }

        trail.push({
            pathname: current,
            name:
                parent.breadcrumbLabel ||
                parent.socialTitle ||
                parent.title
        });
    }

    return {
        "@type": "BreadcrumbList",
        "@id": `${absoluteUrl}#breadcrumbs`,
        itemListElement: trail.map(
            (item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: item.name,
                item: pageUrl(item.pathname)
            })
        )
    };
}

function preservedSchemaNodes(html) {
    const $ = load(html);
    const kept = [];
    const seen = new Set();

    $("script[type='application/ld+json']").each(
        (_, script) => {
            try {
                const data = JSON.parse(
                    $(script).text()
                );

                const nodes = Array.isArray(
                    data?.["@graph"]
                )
                    ? data["@graph"]
                    : [data];

                for (const node of nodes) {
                    const types = Array.isArray(
                        node?.["@type"]
                    )
                        ? node["@type"]
                        : [node?.["@type"]];

                    const isSpecial = types.some(
                        type =>
                            type &&
                            !COMMON_SCHEMA_TYPES.has(type)
                    );

                    if (!isSpecial) continue;

                    const identity =
                        node["@id"] ||
                        JSON.stringify(node);

                    if (!seen.has(identity)) {
                        seen.add(identity);
                        kept.push(node);
                    }
                }
            } catch {
                // Invalid old JSON-LD is not carried into the new head.
            }
        }
    );

    return kept;
}

function jsonLd(
    pathname,
    page,
    image,
    extraSchema
) {
    const absoluteUrl = pageUrl(pathname);
    const breadcrumb = breadcrumbNode(
        pathname,
        absoluteUrl
    );
    const imageId =
        `${absoluteUrl}#primaryimage`;

    const normalizedExtra =
        structuredClone(extraSchema);

    const primaryExtra =
        normalizedExtra.find(node =>
            [
                "Article",
                "ShortStory",
                "VideoObject"
            ].includes(node?.["@type"])
        );

    if (
        primaryExtra &&
        !primaryExtra["@id"]
    ) {
        const fragment = {
            Article: "article",
            ShortStory: "story",
            VideoObject: "video"
        }[primaryExtra["@type"]];

        primaryExtra["@id"] =
            `${absoluteUrl}#${fragment}`;
    }

    const webpage = {
        "@type":
            page.schemaType ||
            "WebPage",
        "@id":
            `${absoluteUrl}#webpage`,
        url: absoluteUrl,
        name:
            page.socialTitle ||
            page.title,
        description:
            page.description,
        inLanguage:
            config.language,
        isPartOf: {
            "@id":
                `${config.baseUrl}/#website`
        },
        creator: {
            "@id":
                `${config.baseUrl}/#person`
        },
        primaryImageOfPage: {
            "@id": imageId
        }
    };

    if (breadcrumb) {
        webpage.breadcrumb = {
            "@id": breadcrumb["@id"]
        };
    }

    const mainEntityId =
        page.mainEntityId ||
        primaryExtra?.["@id"];

    if (mainEntityId) {
        webpage.mainEntity = {
            "@id": mainEntityId
        };
    }

    if (page.aboutPerson) {
        webpage.about = {
            "@id":
                `${config.baseUrl}/#person`
        };
    }

    if (page.article) {
        webpage.headline =
            page.socialTitle ||
            page.title;

        webpage.author = {
            "@id":
                `${config.baseUrl}/#person`
        };

        if (page.article.published) {
            webpage.datePublished =
                page.article.published;
        }

        if (page.article.modified) {
            webpage.dateModified =
                page.article.modified;
        }
    }

    const graph = [
        personNode(
            page.personDetails === true
        ),
        {
            "@type": "WebSite",
            "@id":
                `${config.baseUrl}/#website`,
            url:
                `${config.baseUrl}/`,
            name:
                config.siteName,
            alternateName:
                config.alternatePersonName,
            description:
                config.defaultDescription,
            inLanguage:
                config.language,
            publisher: {
                "@id":
                    `${config.baseUrl}/#person`
            }
        },
        {
            "@type": "ImageObject",
            "@id": imageId,
            url: image.url,
            contentUrl: image.url,
            width: image.width,
            height: image.height,
            caption: image.alt
        },
        webpage
    ];

    if (breadcrumb) {
        graph.push(breadcrumb);
    }

    graph.push(...normalizedExtra);

    return JSON.stringify(
        {
            "@context":
                "https://schema.org",
            "@graph": graph
        },
        null,
        2
    ).replace(/</g, "\\u003c");
}

function ogExtensions(page) {
    const lines = [];

    if (page.profile) {
        lines.push(
            `<meta property="profile:first_name" content="${esc(page.profile.firstName)}">`,
            `<meta property="profile:last_name" content="${esc(page.profile.lastName)}">`
        );
    }

    if (page.article) {
        lines.push(
            `<meta property="article:author" content="${config.baseUrl}/about-me/">`
        );

        if (page.article.published) {
            lines.push(
                `<meta property="article:published_time" content="${esc(page.article.published)}">`
            );
        }

        if (page.article.modified) {
            lines.push(
                `<meta property="article:modified_time" content="${esc(page.article.modified)}">`
            );
        }
    }

    if (page.video) {
        lines.push(
            `<meta property="og:video" content="${esc(page.video.url)}">`,
            `<meta property="og:video:secure_url" content="${esc(page.video.url)}">`,
            `<meta property="og:video:type" content="${esc(page.video.type)}">`,
            `<meta property="og:video:width" content="${page.video.width}">`,
            `<meta property="og:video:height" content="${page.video.height}">`
        );
    }

    return lines.join("\n");
}

function render(
    pathname,
    page,
    extraSchema
) {
    const absoluteUrl =
        pageUrl(pathname);

    const image = {
        url:
            page.image?.url ||
            config.defaultOgImage,
        type:
            page.image?.type ||
            config.defaultOgImageType,
        width:
            page.image?.width ||
            config.defaultOgImageWidth,
        height:
            page.image?.height ||
            config.defaultOgImageHeight,
        alt:
            page.image?.alt ||
            config.defaultOgImageAlt
    };

    const values = {
        TITLE:
            esc(page.title),
        DESCRIPTION:
            esc(page.description),
        AUTHOR:
            esc(config.personName),
        APPLICATION_NAME:
            esc(config.applicationName),
        THEME_COLOR:
            esc(config.themeColor),
        ROBOTS:
            esc(
                page.robots ||
                "index, follow"
            ),
        PINTEREST_DOMAIN_VERIFY:
            esc(
                config.pinterestDomainVerify
            ),
        WEBSITE_LAUNCHES_VERIFICATION:
            esc(
                config.websiteLaunchesVerification
            ),
        CANONICAL:
            page.canonical === false
                ? ""
                : `<link rel="canonical" href="${absoluteUrl}">`,
        SITE_NAME:
            esc(config.siteName),
        OG_LOCALE:
            esc(config.ogLocale),
        SOCIAL_TITLE:
            esc(
                page.socialTitle ||
                page.title
            ),
        SOCIAL_DESCRIPTION:
            esc(
                page.socialDescription ||
                page.description
            ),
        OG_TYPE:
            esc(
                page.ogType ||
                "website"
            ),
        PAGE_URL:
            absoluteUrl,
        IMAGE_URL:
            esc(image.url),
        IMAGE_TYPE:
            esc(image.type),
        IMAGE_WIDTH:
            image.width,
        IMAGE_HEIGHT:
            image.height,
        IMAGE_ALT:
            esc(image.alt),
        OPEN_GRAPH_EXTENSIONS:
            ogExtensions(page),
        TWITTER_CARD:
            esc(
                page.twitterCard ||
                "summary_large_image"
            ),
        X_HANDLE:
            esc(config.xHandle),
        EXTRA_STYLES:
            (page.extraStyles || [])
                .map(href =>
                    `<link rel="stylesheet" href="${esc(href)}">`
                )
                .join("\n"),
        JSON_LD:
            jsonLd(
                pathname,
                page,
                image,
                extraSchema
            ),
        EXTRA_SCRIPTS:
            (page.extraScripts || [])
                .map(src =>
                    `<script defer src="${esc(src)}"></script>`
                )
                .join("\n")
    };

    let output = template;

    for (
        const [key, value] of
        Object.entries(values)
    ) {
        output = output.replaceAll(
            `{{${key}}}`,
            String(value)
        );
    }

    const unused =
        output.match(/{{[A-Z_]+}}/g);

    if (unused) {
        throw new Error(
            `Unresolved head tokens: ${unused.join(", ")}`
        );
    }

    return output
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

async function requireAsset(
    value,
    label
) {
    const url = new URL(
        value,
        `${config.baseUrl}/`
    );

    if (
        url.origin !==
        new URL(config.baseUrl).origin
    ) {
        return;
    }

    const local = path.join(
        ROOT,
        decodeURIComponent(
            url.pathname
        ).replace(/^\/+/, "")
    );

    try {
        await access(local);
    } catch {
        throw new Error(
            `${label} does not exist: ${url.pathname}`
        );
    }
}

const files = await walk();
const pathnames = new Set(
    files.map(pathnameFor)
);
const descriptions = new Map();

for (const pathname of pathnames) {
    const page = pages[pathname];

    if (!page) {
        throw new Error(
            `Add ${pathname} to data/pages.json.`
        );
    }

    for (
        const field of
        [
            "title",
            "description",
            "breadcrumbLabel"
        ]
    ) {
        if (!page[field]?.trim()) {
            throw new Error(
                `${pathname} needs ${field}.`
            );
        }
    }

    const noindex =
        /(^|,)\s*noindex\b/i.test(
            page.robots || ""
        );

    if (
        noindex !==
        (page.canonical === false)
    ) {
        throw new Error(
            `${pathname}: use canonical:false exactly when using noindex.`
        );
    }

    const normalized =
        page.description
            .trim()
            .toLowerCase();

    if (
        descriptions.has(normalized)
    ) {
        throw new Error(
            `${pathname} duplicates ${descriptions.get(normalized)}'s description.`
        );
    }

    descriptions.set(
        normalized,
        pathname
    );

    const image =
        page.image || {
            url:
                config.defaultOgImage
        };

    await requireAsset(
        image.url,
        `${pathname} share image`
    );

    if (page.video?.url) {
        await requireAsset(
            page.video.url,
            `${pathname} video`
        );
    }

    for (
        const asset of
        [
            ...(page.extraStyles || []),
            ...(page.extraScripts || [])
        ]
    ) {
        await requireAsset(
            asset,
            `${pathname} head asset`
        );
    }
}

for (
    const pathname of
    Object.keys(pages)
) {
    if (!pathnames.has(pathname)) {
        throw new Error(
            `${pathname} has metadata but no HTML page.`
        );
    }
}

const changed = [];

for (const file of files) {
    const pathname =
        pathnameFor(file);

    const html =
        await readFile(
            file,
            "utf8"
        );

    if (
        !/<head\b[^>]*>[\s\S]*?<\/head>/i
            .test(html)
    ) {
        throw new Error(
            `${pathname} needs a <head> element.`
        );
    }

    const extraSchema =
        Array.isArray(
            pages[pathname].schemaNodes
        )
            ? pages[pathname].schemaNodes
            : preservedSchemaNodes(html);

    const next = html.replace(
        /<head\b[^>]*>[\s\S]*?<\/head>/i,
        `<head>\n${render(
            pathname,
            pages[pathname],
            extraSchema
        )}\n</head>`
    );

    if (next !== html) {
        changed.push(
            path.relative(ROOT, file)
        );

        if (!CHECK) {
            await writeFile(
                file,
                next,
                "utf8"
            );
        }
    }
}

if (
    CHECK &&
    changed.length
) {
    console.error(
        "These page heads are out of date:"
    );

    changed.forEach(file =>
        console.error(`  - ${file}`)
    );

    console.error(
        "Run `npm run heads`, then try again."
    );

    process.exitCode = 1;
} else {
    console.log(
        CHECK
            ? `Checked ${files.length} managed page heads.`
            : `Rendered ${files.length} managed page heads (${changed.length} updated).`
    );
}