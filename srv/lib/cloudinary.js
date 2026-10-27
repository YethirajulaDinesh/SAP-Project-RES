require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Photos and damage report PDFs (INT-09 / INT-10). Optional: when no credentials are
// configured the photo is kept only in SAP HANA (DamagePhotos.photoContent).
const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;                                            // 10 MB

function credentials() {
  if (process.env.VCAP_SERVICES) {
    const up = (JSON.parse(process.env.VCAP_SERVICES)['user-provided'] || [])
      .find(s => s.name === 'cloudinary-credentials');
    if (up) return up.credentials;
  }
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  };
}
const creds = credentials();
const isConfigured = () => !!(creds && creds.cloud_name && creds.api_key && creds.api_secret);
if (isConfigured()) cloudinary.config({ ...creds, secure: true });

async function upload({ content, mediaType, folder, isPrivate = true }) {
  if (!ALLOWED.includes(mediaType)) throw new Error('Only JPEG, PNG, WEBP and PDF files are allowed');
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'base64');
  if (buf.length > MAX_BYTES) throw new Error('File exceeds the 10 MB limit');
  const res = await new Promise((resolve, reject) =>
    cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto', type: isPrivate ? 'authenticated' : 'upload', unique_filename: true },
      (err, r) => (err ? reject(err) : resolve(r))
    ).end(buf));
  return {
    url: res.secure_url, publicId: res.public_id, resourceType: res.resource_type,
    format: res.format, size: res.bytes
  };
}

async function remove(publicId, resourceType = 'image', isPrivate = true) {
  return cloudinary.uploader.destroy(publicId,
    { resource_type: resourceType, type: isPrivate ? 'authenticated' : 'upload', invalidate: true });
}

function signedUrl(publicId, resourceType, format) {
  return cloudinary.url(publicId, {
    resource_type: resourceType, type: 'authenticated',
    sign_url: true, secure: true, format
  });
}
module.exports = { ALLOWED, MAX_BYTES, isConfigured, upload, remove, signedUrl };
