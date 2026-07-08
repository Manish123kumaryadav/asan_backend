const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const MAX_IMAGE_BYTES = 50 * 1024;

function safeName(fileName) {
  const clean = String(fileName || "upload.jpg").replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${Date.now()}-${clean}`;
}

function readRequestBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(buffer, contentType) {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] ||
    contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];

  if (!boundary) {
    throw new Error("Missing multipart boundary");
  }

  const raw = buffer.toString("binary");
  const parts = raw.split(`--${boundary}`);
  for (const part of parts) {
    if (!part.includes('name="file"')) continue;

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const header = part.slice(0, headerEnd);
    const fileName = header.match(/filename="([^"]+)"/i)?.[1] || "upload.jpg";
    const contentTypeMatch = header.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream";
    let body = part.slice(headerEnd + 4);
    body = body.replace(/\r\n$/, "");

    return {
      fileName,
      contentType: contentTypeMatch,
      buffer: Buffer.from(body, "binary"),
    };
  }

  throw new Error("File field is required");
}

exports.upload = (kind) => async (req, res) => {
  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({ success: false, message: "multipart/form-data file upload is required" });
    }

    const file = parseMultipart(await readRequestBuffer(req), contentType);
    if (!file.contentType.startsWith("image/")) {
      return res.status(400).json({ success: false, message: "Only image files are allowed" });
    }

    const folder = kind === "avatar" ? "avatar" : "product";
    const uploadDir = path.join(UPLOAD_ROOT, folder);
    fs.mkdirSync(uploadDir, { recursive: true });

    const compressed = await compressImageBelow50kb(file.buffer);
    const finalName = safeName(file.fileName.replace(/\.[^.]+$/, ".jpg"));
    const diskPath = path.join(uploadDir, finalName);
    fs.writeFileSync(diskPath, compressed);

    const relativePath = `/uploads/${folder}/${finalName}`;
    return res.status(201).json({
      success: true,
      data: {
        relativePath,
        url: relativePath,
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Upload failed" });
  }
};

async function compressImageBelow50kb(buffer) {
  let width = 1280;
  let quality = 82;
  let best = buffer;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const output = await sharp(buffer)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (output.length < best.length) best = output;
    if (output.length <= MAX_IMAGE_BYTES) return output;

    if (quality > 50) {
      quality -= 10;
    } else {
      width = Math.max(420, Math.round(width * 0.72));
      quality = 72;
    }
  }

  return best;
}
