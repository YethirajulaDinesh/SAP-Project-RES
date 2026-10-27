// Damage photo evidence: type / size checks, SHA-256 hash and optional Cloudinary copy (FR-018, FR-019)
const cds = require('@sap/cds');
const crypto = require('crypto');
const cloudinary = require('./cloudinary');
const { getSetting } = require('./common');
const LOG = cds.log('photos');

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];

async function toBuffer(content) {
  if (content == null) return null;
  if (Buffer.isBuffer(content)) return content;
  if (typeof content === 'string') return Buffer.from(content, 'base64');
  if (content[Symbol.asyncIterator]) {
    const chunks = [];
    for await (const c of content) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  }
  return Buffer.from(content);
}

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Runs before a photo row or its content is written.
 * expectedHash: hash announced by the client (on create, or earlier on the same row);
 * a photo whose content does not match it is rejected.
 */
async function check(req, expectedHash) {
  const d = req.data;
  if (d.mediaType && !ALLOWED.includes(String(d.mediaType).toLowerCase()))
    return req.reject(415, 'Only JPEG, PNG, WEBP or HEIC photos are allowed', 'mediaType');
  if (d.photoContent == null) return;
  const buf = await toBuffer(d.photoContent);
  const maxMb = await getSetting('MAX_PHOTO_MB', 10);
  if (buf.length > maxMb * 1024 * 1024) return req.reject(413, `Photo exceeds the ${maxMb} MB limit`);
  const hash = sha256(buf);
  const expected = (d.sha256Hash || expectedHash || req.headers?.['x-content-sha256'] || '').toLowerCase();
  if (expected && expected !== hash)
    return req.reject(422, 'Photo rejected: the SHA-256 hash does not match the uploaded content');
  d.photoContent = buf;
  d.sha256Hash = hash;
  if (cloudinary.isConfigured() && !d.storageUrl) {
    try {
      const res = await cloudinary.upload({ content: buf, mediaType: d.mediaType || 'image/jpeg', folder: 'rental-damage-photos' });
      d.storageUrl = res.url;
    } catch (e) {
      LOG.warn('Cloudinary copy failed, photo kept in SAP HANA only:', e.message);
    }
  }
}

// Saved photos keep their hash: new content must match it, so evidence cannot be swapped.
// Draft photos can still be replaced until the draft is saved.
function register(srv, DamagePhotos) {
  srv.before(['CREATE', 'UPDATE'], DamagePhotos, async req => {
    let expected;
    if (req.event === 'UPDATE' && req.data.photoContent != null) {
      const row = await SELECT.one.from(DamagePhotos).columns('sha256Hash').where({ ID: req.data.ID });
      expected = row?.sha256Hash;
    }
    return check(req, expected);
  });
  srv.before(['CREATE', 'UPDATE'], DamagePhotos.drafts, req => check(req));
}

module.exports = { ALLOWED, toBuffer, sha256, check, register };
