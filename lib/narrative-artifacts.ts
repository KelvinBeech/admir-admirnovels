import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const OUTPUT_DIR = path.join(process.cwd(), "public", "generated", "marketing-reports");

export async function ensureArtifactDir() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  return OUTPUT_DIR;
}

export async function generateNarrativeArtifacts(input: { itemId: string; runId: string; title: string; summary: string; manuscript: string }) {
  await ensureArtifactDir();

  const html = renderNarrativeHtml({
    title: input.title,
    summary: input.summary,
    body: input.manuscript,
  });

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
    await page.setContent(html, { waitUntil: "load" });

    const safeItem = slugify(input.itemId);
    const safeRun = slugify(input.runId);
    const pdfPath = path.join(OUTPUT_DIR, `${safeItem}-${safeRun}-narrative.pdf`);
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", right: "14mm", bottom: "16mm", left: "14mm" },
    });

    return {
      pdfPath,
      pdfUrl: `/generated/marketing-reports/${safeItem}-${safeRun}-narrative.pdf`,
    };
  } finally {
    await browser.close();
  }
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderNarrativeHtml(input: { title: string; summary: string; body: string }) {
  const bodyHtml = escapeHtml(input.body)
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/\n\n/g, "</p><p>");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      body { font-family: Georgia, serif; color: #18181b; margin: 0; padding: 40px 52px; background: white; }
      .eyebrow { font: 600 12px/1.4 Inter, system-ui, sans-serif; letter-spacing: 0.22em; text-transform: uppercase; color: #7c3aed; }
      h1 { font-size: 34px; margin: 18px 0 10px; }
      h2 { font-size: 20px; margin: 32px 0 12px; page-break-after: avoid; }
      .summary { font: 15px/1.7 Inter, system-ui, sans-serif; color: #3f3f46; margin-bottom: 28px; }
      .body { font-size: 15px; line-height: 1.8; }
      p { margin: 0 0 1em; }
    </style>
  </head>
  <body>
    <div class="eyebrow">AdmirNovels manuscript</div>
    <h1>${escapeHtml(input.title)}</h1>
    <div class="summary">${escapeHtml(input.summary)}</div>
    <div class="body"><p>${bodyHtml}</p></div>
  </body>
</html>`;
}
