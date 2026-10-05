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
- `npm run validate`: Runs the website validator and reports structural, content, asset, and linking problems.
- `npm run build`: Runs head generation first, prepares fonts and images, validates and generates `_site`, and bundles/minifies its CSS.

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

The generator covers all 30 current site pages, including noindex pages.
Shared HTML partials, build output, dependencies, and the Google verification
HTML file are excluded. New content pages must have a matching `pages.json`
entry. Existing noindex/canonical rules remain enforced, and every page must
render successfully before the generator starts writing files.

This manages the document's `<head>`, which contains browser metadata and
resources. The visible navigation/header remains in `_partials/header.html`.

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
