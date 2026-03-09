[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# Taskboard

A minimal Kanban task board powered by Google Sheets — no backend needed.

**[Live Demo](https://lugassawan.github.io/taskboard/)**

<!-- Screenshot: replace the URL below with an actual screenshot of the app -->
<!-- ![Taskboard screenshot](screenshot.png) -->

## Features

- **Kanban columns** — Backlog, On Going, and Done
- **Google Sheets backend** — your own spreadsheet is the database
- **Inline actions** — move tasks between columns, edit, and delete without leaving the board
- **Due date tracking** — overdue tasks are highlighted automatically
- **Dark theme** — easy on the eyes with a grid-pattern background
- **Responsive** — works on desktop and mobile
- **Privacy-first** — no server, no analytics; data stays in your Google Sheet

## Getting Started

1. Create a **Google Sheet** and rename the first sheet tab to `Tasks`.
2. Open **Extensions > Apps Script**, paste the script shown in the app's setup screen, then **Deploy > New deployment > Web App** with access set to **Anyone**.
3. Copy the **Web App URL**, open the app, and paste it in the setup screen.

That's it — your tasks will sync with the spreadsheet.

## Tech Stack

- **Vanilla JavaScript** — zero dependencies
- **IBM Plex Mono** & **Instrument Serif** — from Google Fonts
- **Google Sheets + Apps Script** — serverless data layer
- **GitHub Pages** — static hosting

## Project Structure

```
taskboard/
├── index.html      # HTML shell
├── style.css       # All styles
├── app.js          # Application logic
├── robots.txt      # Crawler directives
├── sitemap.xml     # Sitemap for search engines
├── LICENSE          # MIT License
└── .gitignore
```

## License

[MIT](LICENSE)
