/* global crypto, Image, navigator, addEventListener */
// Yard App: scan, inspect with photos, transfer. Works offline: inspections are queued
// on the device and sent later; the clientRef makes a repeated send harmless.
(function () {
    'use strict';
    const API = '/rest/mobile/';
    const QUEUE_KEY = 'ret_yard_queue';
    const TONE = { 'Available': 'good', 'Rented Out': 'neutral', 'Under Inspection': 'warning', 'Damaged': 'serious', 'In Maintenance': 'warning', 'Quarantined': 'critical' };
    const COLORS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b', neutral: '#2a78d6' };
    const $ = id => document.getElementById(id);
    const state = { asset: null, type: null, grade: null, codes: {}, equipment: [], locations: [] };
    let csrfToken = null;

    // ---------- helpers ----------
    function toast(text, isError) {
        const t = $('toast'); t.textContent = text; t.className = isError ? 'err' : ''; t.style.display = 'block';
        clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.style.display = 'none'; }, 3500);
    }
    function show(view) {
        document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== view; });
        window.scrollTo(0, 0);
    }
    function statusEl(text) {
        const s = document.createElement('span'); s.className = 'status'; s.textContent = text;
        s.style.setProperty('--tone', COLORS[TONE[text] || 'neutral']);
        return s;
    }
    async function csrf() {
        if (csrfToken) return csrfToken;
        const r = await fetch(API + 'Locations?$top=1', { headers: { 'X-CSRF-Token': 'Fetch' }, credentials: 'same-origin' });
        csrfToken = r.headers.get('x-csrf-token') || 'none';
        return csrfToken;
    }
    async function call(path, body) {
        const opts = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
        if (body) {
            opts.method = 'POST';
            opts.headers['Content-Type'] = 'application/json';
            opts.headers['X-CSRF-Token'] = await csrf();
            opts.body = JSON.stringify(body);
        }
        const r = await fetch(API + path, opts);
        const data = r.status === 204 ? null : await r.json().catch(() => null);
        if (!r.ok) {
            const err = new Error(data?.error?.message || `Request failed (${r.status})`);
            err.status = r.status;
            throw err;
        }
        return data;
    }
    async function sha256(bytes) {
        const h = await crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Shrinks a camera photo to max 1280 px JPEG, so it fits the offline queue
    function compress(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                c.toBlob(b => b ? resolve(b) : reject(new Error('Photo could not be read')), 'image/jpeg', 0.8);
                URL.revokeObjectURL(img.src);
            };
            img.onerror = () => reject(new Error('Photo could not be read'));
            img.src = URL.createObjectURL(file);
        });
    }
    const toBase64 = buf => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };

    // ---------- offline queue ----------
    const readQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } };
    const writeQueue = q => {
        try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { toast('The device storage is full. Send the saved inspections first.', true); }
        renderNet();
    };
    function renderNet() {
        const q = readQueue(), dot = $('netDot'), text = $('syncText');
        dot.className = 'dot' + (!navigator.onLine ? ' off' : q.length ? ' wait' : '');
        text.textContent = !navigator.onLine ? `Offline · ${q.length} saved` : q.length ? `Send ${q.length} saved` : 'Online';
    }
    let syncing = false;
    async function sync() {
        if (syncing || !navigator.onLine) { renderNet(); return 0; }
        syncing = true;
        let sent = 0;
        for (const entry of readQueue()) {
            try {
                const res = await call('submitInspection', entry.inspection);
                for (const p of entry.photos.filter(x => !x.done)) {
                    await call('uploadPhoto', { damageID: res.damageIDs[p.damageIndex], fileName: p.fileName, mediaType: p.mediaType, content: p.content, sha256: p.sha256 });
                    p.done = true;
                }
                writeQueue(readQueue().filter(e => e.clientRef !== entry.clientRef));
                sent++;
            } catch (e) {
                entry.error = e.message;                                   // keep it (and the photos already sent)
                writeQueue(readQueue().map(x => (x.clientRef === entry.clientRef ? entry : x)));
                if (!e.status || e.status >= 500 || e.status === 401) break;   // offline or server down: try later
                toast(`${entry.equipmentName}: ${e.message}`, true);
            }
        }
        syncing = false;
        renderNet();
        if (sent) toast(`${sent} inspection(s) sent`);
        return sent;
    }

    // ---------- 1. find equipment ----------
    function renderList() {
        const f = $('filter').value.toLowerCase(), ul = $('eqList');
        ul.textContent = '';
        state.equipment.filter(e => !f || [e.equipmentName, e.equipmentType, e.locationName, e.serialNumber].join(' ').toLowerCase().includes(f))
            .forEach(e => {
                const li = document.createElement('li'), left = document.createElement('div'), b = document.createElement('b'), s = document.createElement('small');
                b.textContent = e.equipmentName; s.textContent = `${e.serialNumber} · ${e.locationName || ''}`;
                left.append(b, s); li.append(left, statusEl(e.currentStatus));
                li.addEventListener('click', () => scan(e.serialNumber));
                ul.appendChild(li);
            });
    }

    async function scan(code) {
        try {
            state.asset = await call(`scanEquipment(code='${encodeURIComponent(String(code).trim().replace(/'/g, "''"))}')`);
            renderAsset(); show('viewAsset');
        } catch (e) { toast(e.message, true); }
    }

    async function startCamera() {
        if (!('BarcodeDetector' in window) || !navigator.mediaDevices) {
            toast('Camera scanning is not supported in this browser. Type the serial number instead.', true); return;
        }
        const video = $('video');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream; video.hidden = false; await video.play();
            const detector = new window.BarcodeDetector();
            const stop = () => { stream.getTracks().forEach(t => t.stop()); video.hidden = true; };
            const tick = async () => {
                if (video.hidden) return;
                const codes = await detector.detect(video).catch(() => []);
                if (codes.length) { stop(); $('code').value = codes[0].rawValue; scan(codes[0].rawValue); return; }
                setTimeout(tick, 300);
            };
            tick();
            setTimeout(stop, 30000);
        } catch (e) { toast('Camera not available: ' + e.message, true); }
    }

    // ---------- 2. equipment card ----------
    function renderAsset() {
        const a = state.asset, card = $('assetCard');
        card.textContent = '';
        const h = document.createElement('h2'); h.textContent = a.equipmentName;
        const sub = document.createElement('div'); sub.textContent = `${a.serialNumber} · ${a.model || ''} `; sub.appendChild(statusEl(a.currentStatus));
        const facts = document.createElement('div'); facts.className = 'facts';
        [['Location', a.locationName], ['Type', a.equipmentType],
        ['Rental', a.customer ? `${a.customer} (${a.rentalStatus})` : 'None'], ['Expected back', a.expectedReturnDate || '—'],
        ['Last grade', a.lastGrade || '—'], ['Last meter', a.lastMeterReading ?? '—'],
        ['Open damages', a.openDamages], ['Last inspection', a.lastInspectionDate ? new Date(a.lastInspectionDate).toLocaleString() : '—']]
            .forEach(([k, v]) => { const d = document.createElement('div'), s = document.createElement('small'); s.textContent = k; d.append(s, document.createTextNode(String(v))); facts.appendChild(d); });
        card.append(h, sub, facts);
        $('transferForm').hidden = true;
        $('startTransfer').disabled = a.currentStatus === 'Rented Out';
    }

    // ---------- 3. inspection ----------
    function segButtons(host, values, current, onPick) {
        host.textContent = '';
        values.forEach(v => {
            const b = document.createElement('button'); b.type = 'button'; b.textContent = v; b.setAttribute('aria-pressed', String(v === current));
            b.addEventListener('click', () => { onPick(v); host.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
            host.appendChild(b);
        });
    }
    function startInspection() {
        const a = state.asset;
        state.type = a.rentalStatus === 'Booked' ? 'Check-Out' : ['Checked Out', 'Returned'].includes(a.rentalStatus) ? 'Check-In'
            : ['Damaged', 'In Maintenance', 'Quarantined'].includes(a.currentStatus) ? 'Post-Repair' : 'Periodic';
        state.grade = null;
        $('inspTitle').textContent = a.equipmentName;
        const types = state.codes.InspectionType || ['Check-Out', 'Check-In', 'Periodic', 'Post-Repair'];
        const allowed = types.filter(t => !['Check-Out', 'Check-In'].includes(t) || a.rentalID);
        const hint = () => { $('rentalHint').textContent = ['Check-Out', 'Check-In'].includes(state.type) ? `For the rental of ${a.customer}` : 'Not linked to a rental'; };
        segButtons($('typeSeg'), allowed, state.type, v => { state.type = v; hint(); });
        hint();
        segButtons($('gradeSeg'), state.codes.ConditionGrade || ['A', 'B', 'C', 'D'], null, v => { state.grade = v; });
        $('meter').value = ''; $('meter').min = a.lastMeterReading || 0; $('notes').value = ''; $('damageList').textContent = '';
        show('viewInspect');
    }
    function fill(select, values, placeholder) {
        select.textContent = '';
        const o = document.createElement('option'); o.value = ''; o.textContent = placeholder; select.appendChild(o);
        values.forEach(v => { const x = document.createElement('option'); x.value = v; x.textContent = v; select.appendChild(x); });
    }
    function addDamage() {
        const node = $('damageTpl').content.firstElementChild.cloneNode(true);
        fill(node.querySelector('.dType'), state.codes.DamageType || [], 'Damage type');
        fill(node.querySelector('.dSev'), state.codes.Severity || ['Minor', 'Moderate', 'Major', 'Critical'], 'Severity');
        node.photos = [];
        node.querySelector('.dPhotos').addEventListener('change', async ev => {
            for (const file of ev.target.files) {
                try {
                    const blob = await compress(file), buf = await blob.arrayBuffer();
                    const photo = { fileName: file.name.replace(/\.\w+$/, '') + '.jpg', mediaType: 'image/jpeg', content: toBase64(buf), sha256: await sha256(buf) };
                    node.photos.push(photo);
                    const img = document.createElement('img'); img.src = URL.createObjectURL(blob); img.alt = 'Damage photo';
                    node.querySelector('.thumbs').appendChild(img);
                } catch (e) { toast(e.message, true); }
            }
            ev.target.value = '';
        });
        node.querySelector('.remove').addEventListener('click', () => node.remove());
        $('damageList').appendChild(node);
    }

    async function saveInspection(ev) {
        ev.preventDefault();
        const a = state.asset;
        if (!state.grade) { toast('Choose the condition grade', true); return; }
        const damages = [...document.querySelectorAll('#damageList .damage')];
        const photos = [], list = [];
        for (const [i, d] of damages.entries()) {
            const damageType = d.querySelector('.dType').value, severity = d.querySelector('.dSev').value;
            if (!damageType || !severity) { toast('Every damage needs a type and a severity', true); return; }
            if (!d.photos.length) { toast('Add at least one photo for every damage', true); return; }
            list.push({ damageType, severity, damageDescription: d.querySelector('.dDesc').value });
            d.photos.forEach(p => photos.push({ ...p, damageIndex: i }));
        }
        const clientRef = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()).toString();
        const withRental = ['Check-Out', 'Check-In'].includes(state.type);
        const entry = {
            clientRef, equipmentName: a.equipmentName, savedAt: new Date().toISOString(), photos,
            inspection: {
                clientRef, equipmentID: a.equipmentID, rentalID: withRental ? a.rentalID : null, inspectionType: state.type,
                conditionGrade: state.grade, meterReading: $('meter').value ? Number($('meter').value) : null,
                notes: $('notes').value, damages: list
            }
        };
        writeQueue([...readQueue(), entry]);
        const sent = navigator.onLine ? await sync() : 0;
        const stillQueued = readQueue().find(e => e.clientRef === clientRef);
        $('doneTitle').textContent = stillQueued ? 'Inspection saved on this device' : 'Inspection sent';
        $('doneText').textContent = stillQueued
            ? (stillQueued.error ? `Not sent yet: ${stillQueued.error}` : 'It will be sent automatically when the connection is back.')
            : `${a.equipmentName}: grade ${state.grade}, ${list.length} damage(s), ${photos.length} photo(s).`;
        if (sent || !stillQueued) loadEquipment();
        show('viewDone');
    }

    // ---------- transfer ----------
    async function transfer(ev) {
        ev.preventDefault();
        try {
            state.asset = await call('transferEquipment', { equipmentID: state.asset.equipmentID, toLocationID: $('toLocation').value, reason: $('transferReason').value });
            renderAsset(); toast('Equipment transferred'); loadEquipment();
        } catch (e) { toast(e.message, true); }
    }

    // ---------- start ----------
    async function loadEquipment() {
        try { state.equipment = await call('Equipment?$orderby=equipmentName'); renderList(); } catch { /* offline: keep the old list */ }
    }
    async function init() {
        document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
        $('scanForm').addEventListener('submit', ev => { ev.preventDefault(); scan($('code').value); });
        $('cameraBtn').addEventListener('click', startCamera);
        $('filter').addEventListener('input', renderList);
        $('startInspection').addEventListener('click', startInspection);
        $('startTransfer').addEventListener('click', () => { $('transferForm').hidden = !$('transferForm').hidden; });
        $('transferForm').addEventListener('submit', transfer);
        $('addDamage').addEventListener('click', addDamage);
        $('inspForm').addEventListener('submit', saveInspection);
        $('syncBtn').addEventListener('click', sync);
        addEventListener('online', sync); addEventListener('offline', renderNet);
        renderNet();
        try {
            const [codes, locations] = await Promise.all([call('CodeLists?$orderby=list,sortOrder'), call('Locations?$orderby=locationName')]);
            codes.forEach(c => { (state.codes[c.list] ||= []).push(c.code); });
            state.locations = locations;
            fill($('toLocation'), [], 'Choose a location');
            locations.forEach(l => { const o = document.createElement('option'); o.value = l.ID; o.textContent = `${l.locationName} (${l.city})`; $('toLocation').appendChild(o); });
        } catch (e) {
            if (e.status === 401 || e.status === 403) { toast('Please sign in with a yard role', true); return; }
        }
        await loadEquipment();
        sync();
    }
    init();
})();
