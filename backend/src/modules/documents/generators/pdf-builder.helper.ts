import * as crypto from "crypto";

export function createMinimalPdf(title: string, lines: string[]): Buffer {
  const content = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];

  let stream = `BT /F1 16 Tf 50 780 Td (${escapePdfString(title)}) Tj ET\n`;
  stream += "BT /F1 10 Tf 50 750 Td\n";

  let yOffset = 0;
  for (const line of lines) {
    stream += `0 ${yOffset === 0 ? 0 : -18} Td (${escapePdfString(line)}) Tj\n`;
    yOffset++;
  }
  stream += "ET\n";

  const streamLen = Buffer.byteLength(stream, "utf8");
  content.push(
    `4 0 obj << /Length ${streamLen} >> stream\n${stream}endstream\nendobj`,
  );

  // Cross-reference table
  content.push("xref");
  content.push("0 6");
  content.push("0000000000 65535 f ");
  content.push("0000000009 00000 n ");
  content.push("0000000058 00000 n ");
  content.push("0000000115 00000 n ");
  content.push("0000000300 00000 n ");
  content.push("0000000230 00000 n ");
  content.push("trailer << /Size 6 /Root 1 0 R >>");
  content.push("startxref");
  content.push("450");
  content.push("%%EOF");

  return Buffer.from(content.join("\n"), "utf8");
}

function escapePdfString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
