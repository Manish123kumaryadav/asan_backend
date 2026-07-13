const sharp = require("sharp");
const User = require("../model/User");

const MAX_IMAGE_BYTES = 50 * 1024;

function readRequestBuffer(req) {
  return new Promise((resolve, reject) => { const chunks = []; req.on("data", (chunk) => chunks.push(chunk)); req.on("end", () => resolve(Buffer.concat(chunks))); req.on("error", reject); });
}

function parseMultipart(buffer, contentType) {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) throw new Error("Missing multipart boundary");
  for (const part of buffer.toString("binary").split(`--${boundary}`)) {
    if (!part.includes('name="file"')) continue;
    const headerEnd = part.indexOf("\r\n\r\n"); if (headerEnd === -1) continue;
    const header = part.slice(0, headerEnd); let body = part.slice(headerEnd + 4).replace(/\r\n$/, "");
    return { contentType: header.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream", buffer: Buffer.from(body, "binary") };
  }
  throw new Error("File field is required");
}

function storageConfig(kind) {
  const bucket = kind === "avatar" ? (process.env.SUPABASE_PROFILE_BUCKET || "Profile_PIc") : (process.env.SUPABASE_ADD_BUCKET || "Add_pic");
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase Storage is not configured");
  return { bucket, baseUrl: process.env.SUPABASE_URL.replace(/\/$/, ""), key: process.env.SUPABASE_SERVICE_ROLE_KEY };
}

exports.upload = (kind) => async (req, res) => {
  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) return res.status(400).json({ success: false, message: "multipart/form-data file upload is required" });
    const file = parseMultipart(await readRequestBuffer(req), contentType);
    if (!file.contentType.startsWith("image/")) return res.status(400).json({ success: false, message: "Only image files are allowed" });
    const user = await User.findByPk(req.user.id);
    if (!user?.guid) return res.status(404).json({ success: false, message: "User identity not found" });
    const compressed = await compressImageBelow50kb(file.buffer);
    const { bucket, baseUrl, key } = storageConfig(kind);
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
    const objectPath = `${user.guid}/${user.guid}-${timestamp}.jpg`;
    const uploadUrl = `${baseUrl}/storage/v1/object/${bucket}/${objectPath}`;
    const response = await fetch(uploadUrl, { method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "image/jpeg", "x-upsert": "false" }, body: compressed });
    if (!response.ok) throw new Error((await response.text()) || "Supabase upload failed");
    const relativePath = `/api/media/object/${bucket}/${objectPath}`;
    return res.status(201).json({ success: true, data: { relativePath, url: relativePath, bucket, objectPath } });
  } catch (error) { return res.status(400).json({ success: false, message: error.message || "Upload failed" }); }
};

exports.object = async (req, res) => {
  try {
    const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, ""); const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!baseUrl || !key) return res.status(503).json({ success: false, message: "Supabase Storage is not configured" });
    const objectPath = `${req.params.userGuid}/${req.params.fileName}`;
    const response = await fetch(`${baseUrl}/storage/v1/object/authenticated/${req.params.bucket}/${objectPath}`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
    if (!response.ok) return res.status(response.status).json({ success: false, message: "Image not found" });
    res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

async function compressImageBelow50kb(buffer) {
  let width = 1280; let quality = 82; let best = buffer;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const output = await sharp(buffer).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (output.length < best.length) best = output; if (output.length <= MAX_IMAGE_BYTES) return output;
    if (quality > 50) quality -= 10; else { width = Math.max(420, Math.round(width * 0.72)); quality = 72; }
  }
  return best;
}
