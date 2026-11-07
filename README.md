# Aaron Schlossberg’s Universe
My evolving personal website and portfolio—bringing together my work in computer science, entrepreneurship, writing, art, education, worldbuilding, and more.

**Live website:** [www.aaronschlossberg.com](https://www.aaronschlossberg.com/) 

[![Preview of Aaron Schlossberg’s Universe](assets/img/og-aaron-schlossbergs-universe.png)](https://www.aaronschlossberg.com/)

## Overview
This is "**[Aaron Schlossberg's Universe](https://www.aaronschlossberg.com/)**"; my personal portfolio website, built to showcase my background, skills, projects, life experiences, work, services, and more. It also includes a contact section for professional outreach.

## Website Contents
- **[Home](https://www.aaronschlossberg.com/)** | `/`
- **[About Me](https://www.aaronschlossberg.com/about-me/)** | `/about-me/`
- **[Education](https://www.aaronschlossberg.com/education/)** | `/education/`
  - **[Hebrew Academy](https://www.aaronschlossberg.com/education/hebrew-academy/)** | `/education/hebrew-academy/` _(under construction)_
  - **[Pathways Academy of Technology and Design](https://www.aaronschlossberg.com/education/pathways-academy/)** | `/education/pathways-academy/` _(under construction)_
  - **[Muhlenberg College](https://www.aaronschlossberg.com/education/muhlenberg/)** | `/education/muhlenberg/`
    - **[Clubs & Leadership](https://www.aaronschlossberg.com/education/muhlenberg/clubs/)** | `/education/muhlenberg/clubs/` _(under construction)_
      - **[Fencing Practice Video](https://www.aaronschlossberg.com/education/muhlenberg/clubs/fencing-video/)** | `/education/muhlenberg/clubs/fencing-video/`
    - **[Courses](https://www.aaronschlossberg.com/education/muhlenberg/courses/)** | `/education/muhlenberg/courses/` _(under construction)_
    - **[Experiences](https://www.aaronschlossberg.com/education/muhlenberg/experiences/)** | `/education/muhlenberg/experiences/` _(under construction)_
    - **[Highlights](https://www.aaronschlossberg.com/education/muhlenberg/highlights/)** | `/education/muhlenberg/highlights/` _(under construction)_
  - **[Lifelong Learning](https://www.aaronschlossberg.com/education/lifelong-learning/)** | `/education/lifelong-learning/` _(under construction)_
- **[Projects](https://www.aaronschlossberg.com/projects/)** | `/projects/`
  - **[Info Sprawlings](https://www.aaronschlossberg.com/projects/info-sprawlings/)** | `/projects/info-sprawlings/`
    - **[How the Info Sprawlings Evolved](https://www.aaronschlossberg.com/projects/info-sprawlings/history/)** | `/projects/info-sprawlings/history/`
    - **[Blender](https://www.aaronschlossberg.com/projects/info-sprawlings/blender/)** | `/projects/info-sprawlings/blender/`
  - **[Fiction2Reality](https://www.aaronschlossberg.com/projects/fiction2reality/)** | `/projects/fiction2reality/`
- **[Writings](https://www.aaronschlossberg.com/writings/)** | `/writings/`
  - **[1080 Paths of Least Resistance](https://www.aaronschlossberg.com/writings/1080-paths-of-least-resistance/)** | `/writings/1080-paths-of-least-resistance/`
  - **[Just This Once](https://www.aaronschlossberg.com/writings/just-this-once/)** | `/writings/just-this-once/`
- **[Resume](https://www.aaronschlossberg.com/resume/)** | `/resume/`
- **[Contact](https://www.aaronschlossberg.com/contact/)** | `/contact/`
- **[Compendium](https://www.aaronschlossberg.com/compendium/)** | `/compendium/`
- **[Images](https://www.aaronschlossberg.com/images/)** | `/images/`
  - **[Pictures of Me](https://www.aaronschlossberg.com/images/pictures-of-me/)** | `/images/pictures-of-me/`
- **[Sitemap](https://www.aaronschlossberg.com/site-map/)** | `/site-map/`

## Built With
- Semantic HTML
- CSS
- Vanilla JavaScript
- Node.js build and validation scripts
- Cheerio
- JSON and JSON-LD
- XML sitemaps
- Netlify
- Love

## Key Features
- Responsive, multi-section personal website
- Reusable header, footer, and page partials
- Custom Node.js build system
- Automated website validation
- Generated search indexes
- Searchable _Writings_ and _Info Sprawlings_ collections
- Structured data and breadcrumb markup
- XML page and image sitemaps
- Custom domain and Netlify deployment
- Expandable architecture for future projects, writings, images, and knowledge pages

## Local Development
### Prerequisites
- [Node.js](https://nodejs.org/) 20.18.1 or newer
- npm

### Setup
1. Clone or download the repository.
2. Open the project directory in a terminal.
3. Install the dependencies:

   ```bash
   npm ci
   ```
4. Build the website: `npm run build`
5. Serve the generated `_site` directory using a local web server: `npx serve _site`
6. Open the local address shown in the terminal. The source files should be processed through the build system rather than opened directly with a `file://` URL.

### Available Commands:
- `npm run heads`: Rebuilds the entire `<head>` of every managed source page from the central configuration and template.
- `npm run check:heads`: Checks that every source head matches the generated version without changing files. Exits with an error if any head is out of date.
- `npm run test:heads`: Runs the head-generator regression tests in temporary fixtures.
- `npm run compendium` generates the Compendium, its entry pages, metadata, and sitemap links, then refreshes page heads.
- `npm run test:compendium` checks Compendium generation and protects manually maintained pages.
- `npm run validate`: Runs the website validator and reports structural, content, asset, and linking problems.
- `npm run build` generates the Compendium and page heads, prepares fonts and images, validates and generates `_site`, and bundles/minifies its CSS.

### Managing the entire HTML head

Every page head is generated. Edit the following central files instead of editing
metadata directly in an HTML page; manual head edits are overwritten on the next
`npm run heads` or `npm run build`.

| File | What it controls |
| --- | --- |
| `data/pages.json` | Each page's title, description, breadcrumbs, indexing settings, schema type, share image, article/profile/video details, extra styles/scripts, and specialized structured data. |
| `data/config.json` | Site name and URL, author, language/locale, default share image, theme color, verification values, social handle, and Google Analytics measurement ID. |
| `_partials/head.html` | The complete shared head structure: charset, viewport, favicon, meta tags, canonical link, Open Graph, Twitter cards, font preloads, CSS, JSON-LD, and JavaScript. Add any future shared head tags here. |

`title` is the only source for `<title>`, `og:title`, and `twitter:title`.
`description` is the only source for the regular, Open Graph, and Twitter
descriptions. Separate `socialTitle` and `socialDescription` fields have been
removed; the generator rejects them to prevent accidental divergence.
The generated WebPage structured-data name and description use the same fields.

For example, change these two fields within the `/contact/` entry:

```json
"title": "Contact Aaron L. Schlossberg | Aaron Schlossberg’s Universe",
"description": "Contact Aaron L. Schlossberg about web development, writing, creative projects, collaborations, opportunities, and other work."
```

Then run `npm run heads` to update the source HTML, or `npm run build` to update
the source HTML and produce the deployable `_site` output. There is no need to
run both commands for a normal build. Neither command publishes the website;
the updated source must still reach the repository used by Netlify.

Page-specific images use the `image` object, falling back to the default image
in `config.json`. Their URL, MIME type, dimensions, and alt text are regenerated,
along with the page's Open Graph type/URL/locale/site name and any configured
article, profile, or video tags. Twitter uses the same image and alt text.
Use `extraStyles` and `extraScripts` for additional per-page CSS and deferred JS.

Specialized JSON-LD for stories, articles, software, and the fencing video is
stored in the page's `schemaNodes` array. The generator no longer recovers it
from a previous HTML head, so even an empty head can be rebuilt completely.
These nodes retain their work-specific titles and details, such as word counts,
publication dates, and video upload information. Edit those details in
`schemaNodes` when the underlying work changes.

Google Analytics uses `googleAnalyticsId` in `config.json`. Remove that field or
set it to an empty string to omit both Analytics scripts from all generated heads.

The generator covers every registered site page, including noindex pages.
Shared HTML partials, build output, dependencies, and the Google verification
HTML file are excluded. New content pages must have a matching `pages.json`
entry. Existing noindex/canonical rules remain enforced, and every page must
render successfully before the generator starts writing files.

This manages the document's `<head>`, which contains browser metadata and
resources. The visible navigation/header remains in `_partials/header.html`.

## Editing the Compendium

Edit `data/compendium.json` to change definitions, tags, context, examples, and
references. Each record generates a short list entry and a page at
`/compendium/<slug>/`. Keep a published slug stable so its links keep working.
The `related` array contains the slugs of other Compendium entries.

Use an entry’s `links` array for phrases that should link within its definition,
context, examples, or image caption. Each item has `text` and `href` fields.
`cite: true` italicizes a work title, `quote: true` adds curly quotation marks,
and `caseSensitive: true` distinguishes titles such as `Up` from ordinary words.
The generator escapes the remaining text and links the longest matching phrase.

An optional `image` object supplies a local asset path, alternative text, pixel
dimensions, caption, credit, and license link when applicable. Images large
enough for a sharing preview also supply the page’s Open Graph image.

Run `npm run compendium` to refresh the source pages for a local preview.
`npm run build` also runs this step. Generated entry HTML and metadata are
rebuilt from the data file. New tags appear in the filters automatically.

## Site Desk

1. Open a terminal in the project folder. Run `node --version` to check for Node
   20.18.1 or newer. Node 22 matches the Netlify build configuration.
2. Run `npm ci`, then `npm run editor`. Open
   [http://127.0.0.1:4175](http://127.0.0.1:4175). Leave that terminal running.
3. Pick **Writing**, **Info Sprawling**, or **General page**. Fill in the title
   and short description. **Page details** holds the URL slug and the fields
   for the selected page type. For a **General page**, search **Parent page** by
   title or path, then choose a match or **Top level (/)**. Selecting **Images**
   and entering the slug `travel` creates `/images/travel/`. Reload the editor
   to see newly registered parent pages.
4. Compose in **Body**. The toolbar handles formatting and inserts. You can
   use **⌘B**, **⌘I**, and **⌘U** on a Mac, with **Ctrl** on Windows or Linux.
   Use **Image** or drop a JPG, PNG, WebP, or GIF into the editor, then add alt
   text and an optional caption. **Footnote** accepts note text and an optional
   source link. **Equation** takes LaTeX and previews it as you type.
5. Click **Save draft** or press **⌘S** or **Ctrl+S**. Reopen it from **Your
   pages**. **Preview** saves the current draft and opens a preview with
   desktop and mobile widths. Drafts and their images are stored on this
   computer under `.authoring/`.
6. Click **Prepare for publish** when the page is ready. In another terminal
   in the same folder, run `npm run build`. Review the generated page and the
   Git diff, then commit the page’s changes and push to your Netlify branch.
   After preparation, reopen the page in the desk to revise it. Its page type
   and address are locked at that point.

For a first practice run, make a short draft with a heading, an image with a
caption, a footnote, and an equation like `x^2 + y^2 = r^2`. Save it, refresh
the browser, reopen it, then check the footnote links in the mobile preview.

**Prepare for publish** writes the editable JSON under `content/`, the
public HTML and any images it uses, the metadata in `data/pages.json`, and
the relevant listing and sitemap entries. Commit the editable JSON along with
the generated files so you can reopen the page from another checkout.
Writings also get a card on `/writings/`, and Info Sprawlings get a record in
`data/info-sprawlings/` for their respective search indexes. For existing
handwritten pages, continue editing their source files. The desk handles
pages created through it.

Run `npm run test:editor` to check the renderer and publishing workflow. Stop
the editor with **Ctrl+C** in its terminal. Start it again with
`npm run editor` whenever you want to write.

## Roadmap
Development priorities, planned improvements, and possible future directions are tracked in [ROADMAP.md](ROADMAP.md).

<!-- ## Goals & Future Improvements
- Add interactive elements using more JavaScript. 
- Continue to improve the formatting.
- Add more pages (and perhaps some subdomains, as well). 
  - /compendium/
  - quotes page
  - "for recruiters" page, with an embedded résumé, project summaries, skills, contact, links to GitHub, TikTok, LinkedIn, etc...
  - /interests/ 
  - /fandoms/ 
  - /videos/ 
  - "a view of the real world"/"formative experiences" (or whatever it will be called) 
  - /referrals/ 
- Embed a Google Maps map.
- Link to other websites I've built.

## Roadmap
- Continue expanding the Info Sprawlings knowledge system
- Publish additional fiction, essays, articles, and reflections
- Add dedicated pages for major projects
- Expand the Images section with photography, travel, and artwork
- Improve site-wide search and content discovery
- Continue improving accessibility, performance, SEO, and responsive design
- Automate additional maintenance and validation tasks -->

## Project Status
[Aaron Schlossberg’s Universe](https://www.aaronschlossberg.com/) is actively developed and continually expanding. Its content, design, organization, and technical systems will evolve as new projects, writings, images, experiences, and areas of interest are added.

Feedback and suggestions are always welcome through the [Contact page](https://www.aaronschlossberg.com/contact/).
