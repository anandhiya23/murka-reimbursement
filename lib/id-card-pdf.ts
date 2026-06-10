import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";

const MM = 2.834645669; // mm -> PDF points

// CR80 card, portrait orientation, with 3mm bleed all around.
const TRIM_W = 54 * MM;
const TRIM_H = 85.6 * MM;
const BLEED = 3 * MM;
const PAGE_W = TRIM_W + BLEED * 2;
const PAGE_H = TRIM_H + BLEED * 2;
const SAFE = 5 * MM; // inset from page edge for content

export interface CardInput {
  fullName: string;
  memberNo?: string | null;
  division: string;
  event: string;
  image: { bytes: Uint8Array; format: "jpg" | "png" } | null;
}

// Fit (contain) a value within max width by shrinking the font size.
function fitFontSize(
  text: string,
  font: import("pdf-lib").PDFFont,
  maxWidth: number,
  startSize: number,
  minSize = 6
): number {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

export async function buildIdCardsPdf(cards: CardInput[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const contentW = PAGE_W - SAFE * 2;
  const photoBoxW = 40 * MM;
  const photoBoxH = 48 * MM;

  for (const card of cards) {
    const page = doc.addPage([PAGE_W, PAGE_H]);

    // White background (full bleed).
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(1, 1, 1) });

    // Wordmark top-center.
    const brand = "MURKA";
    const brandSize = 11;
    page.drawText(brand, {
      x: (PAGE_W - fontBold.widthOfTextAtSize(brand, brandSize)) / 2,
      y: PAGE_H - SAFE - brandSize,
      size: brandSize,
      font: fontBold,
      color: rgb(0.07, 0.07, 0.07),
    });

    // Photo box (centered horizontally, below wordmark).
    const photoBoxX = (PAGE_W - photoBoxW) / 2;
    const photoBoxTop = PAGE_H - SAFE - brandSize - 5 * MM;
    const photoBoxY = photoBoxTop - photoBoxH;

    if (card.image) {
      let img: PDFImage | null = null;
      try {
        img =
          card.image.format === "png"
            ? await doc.embedPng(card.image.bytes)
            : await doc.embedJpg(card.image.bytes);
      } catch {
        img = null;
      }
      if (img) {
        const scale = Math.min(photoBoxW / img.width, photoBoxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, {
          x: photoBoxX + (photoBoxW - w) / 2,
          y: photoBoxY + (photoBoxH - h) / 2,
          width: w,
          height: h,
        });
      }
    } else {
      // placeholder frame
      page.drawRectangle({
        x: photoBoxX, y: photoBoxY, width: photoBoxW, height: photoBoxH,
        borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1,
      });
    }

    // Name (bold), division, event — stacked below the photo.
    let cursorY = photoBoxY - 7 * MM;

    const nameSize = fitFontSize(card.fullName, fontBold, contentW, 14);
    page.drawText(card.fullName, {
      x: (PAGE_W - fontBold.widthOfTextAtSize(card.fullName, nameSize)) / 2,
      y: cursorY,
      size: nameSize,
      font: fontBold,
      color: rgb(0.07, 0.07, 0.07),
    });

    cursorY -= 6 * MM;
    const divSize = fitFontSize(card.division, font, contentW, 10);
    page.drawText(card.division, {
      x: (PAGE_W - font.widthOfTextAtSize(card.division, divSize)) / 2,
      y: cursorY,
      size: divSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    if (card.memberNo) {
      cursorY -= 5.5 * MM;
      const noText = `No. ${card.memberNo}`;
      page.drawText(noText, {
        x: (PAGE_W - fontBold.widthOfTextAtSize(noText, 9)) / 2,
        y: cursorY,
        size: 9,
        font: fontBold,
        color: rgb(0.07, 0.07, 0.07),
      });
    }

    // Event name pinned near the bottom safe line.
    const evSize = fitFontSize(card.event, font, contentW, 9);
    page.drawText(card.event, {
      x: (PAGE_W - font.widthOfTextAtSize(card.event, evSize)) / 2,
      y: SAFE,
      size: evSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  return doc.save();
}
