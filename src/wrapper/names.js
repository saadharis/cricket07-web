// Real player names. Cricket 07 shows made-up names for unlicensed players (S.Tendehar for Tendulkar).
// Its data also holds a real-name copy of the player list; real-names.json maps each fake-named record
// to its real name (matched by comparing the two copies' stats). This code runs in the page, before the
// game starts, and edits the app's own copy of Data/data.gob.
//
// The new player list is appended to the archive and its index entry pointed at it, so the original list
// stays in the file and switching back to the original names only restores the index entry.
const fs = require('fs');
const path = require('path');

const NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, 'real-names.json'), 'utf8'));

const PAGE_JS = `async (NAMES, mode) => {
  const ENTRY = '113964e05e69ab31d264fb8f15c58e5c.cdf', REC = 360, MARK = '.names-original.json';
  const root = await navigator.storage.getDirectory();
  let dir, fh;
  try { dir = await root.getDirectoryHandle('c07game'); fh = await (await dir.getDirectoryHandle('Data')).getFileHandle('data.gob'); }
  catch { return 'no-game'; }
  const file = await fh.getFile();
  const bytes = async (a, b) => new Uint8Array(await file.slice(a, b).arrayBuffer());
  const head = new DataView((await bytes(0, 16)).buffer);
  if (head.getUint32(0) !== 0x42494746) return 'unknown';   // "BIGF"
  const count = head.getUint32(8), idx = await bytes(16, 16 + head.getUint32(12));
  const iv = new DataView(idx.buffer);
  let pos = -1, off = 0, size = 0;
  for (let p = 0, k = 0; k < count; k++) {
    const o = iv.getUint32(p), s = iv.getUint32(p + 4); let e = p + 8;
    while (idx[e]) e++;
    if (new TextDecoder('latin1').decode(idx.subarray(p + 8, e)) === ENTRY) { pos = 16 + p; off = o; size = s; break; }
    p = e + 1;
  }
  if (pos < 0) return 'unknown';

  // RefPack (EA's compression)
  const unpack = (s) => {
    const f = s[0]; let p = 2, n;
    if (f & 0x80) { n = (s[p] << 24 | s[p + 1] << 16 | s[p + 2] << 8 | s[p + 3]) >>> 0; p += 4; } else { n = s[p] << 16 | s[p + 1] << 8 | s[p + 2]; p += 3; }
    if (f & 1) p += f & 0x80 ? 4 : 3;
    const o = new Uint8Array(n); let q = 0;
    const lit = (k) => { o.set(s.subarray(p, p + k), q); p += k; q += k; };
    while (p < s.length) {
      const c = s[p]; let len, dist;
      if (c < 0x80) { const c1 = s[p + 1]; p += 2; lit(c & 3); len = ((c & 0x1c) >> 2) + 3; dist = ((c & 0x60) << 3) + c1 + 1; }
      else if (c < 0xc0) { const c1 = s[p + 1], c2 = s[p + 2]; p += 3; lit(c1 >> 6); len = (c & 0x3f) + 4; dist = ((c1 & 0x3f) << 8) + c2 + 1; }
      else if (c < 0xe0) { const c1 = s[p + 1], c2 = s[p + 2], c3 = s[p + 3]; p += 4; lit(c & 3); len = ((c & 0x0c) << 6) + c3 + 5; dist = ((c & 0x10) << 12) + (c1 << 8) + c2 + 1; }
      else if (c < 0xfc) { p += 1; lit(((c & 0x1f) << 2) + 4); continue; }
      else { p += 1; lit(c & 3); break; }
      for (let i = 0; i < len; i++, q++) o[q] = o[q - dist];
    }
    return o;
  };
  // a valid RefPack stream made of literal blocks only (bigger, but simple)
  const pack = (d) => {
    const n = d.length, o = new Uint8Array(5 + n + Math.ceil(n / 112) + 1); let q = 0, p = 0;
    o.set([0x10, 0xfb, n >> 16 & 255, n >> 8 & 255, n & 255]); q = 5;
    while (n - p >= 4) { const k = Math.min(112, ((n - p) >> 2) << 2); o[q++] = 0xe0 + ((k - 4) >> 2); o.set(d.subarray(p, p + k), q); q += k; p += k; }
    o[q++] = 0xfc + (n - p); o.set(d.subarray(p), q); q += n - p;
    return o.subarray(0, q);
  };

  const raw = await bytes(off, off + size);
  const cdf = raw[1] === 0xfb ? unpack(raw) : raw;
  const dec = new TextDecoder('latin1');
  const nameAt = (i) => { const b = cdf.subarray(i * REC + 8, i * REC + 24); const z = b.indexOf(0); return dec.decode(z < 0 ? b : b.subarray(0, z)); };
  const isReal = NAMES.every(([i, , r]) => nameAt(i) === r);
  const isFake = NAMES.every(([i, f]) => nameAt(i) === f);
  const state = isReal ? 'real' : isFake ? 'original' : 'unknown';
  if (mode === 'status' || state === mode || state === 'unknown') return state;

  const setEntry = async (w, o, s) => {
    const b = new DataView(new ArrayBuffer(8)); b.setUint32(0, o); b.setUint32(4, s);
    await w.write({ type: 'write', position: pos, data: b.buffer });
  };
  if (mode === 'original') {
    let m; try { m = JSON.parse(await (await (await dir.getFileHandle(MARK)).getFile()).text()); } catch { return 'no-original'; }
    const w = await fh.createWritable({ keepExistingData: true });
    await setEntry(w, m.off, m.size);
    // also drop the appended list and restore the archive's length, so the file is byte for byte the
    // original again (the port's launcher checks file sizes when its game-file list changes)
    if (m.fileSize && m.fileSize < file.size && m.off + m.size <= m.fileSize) {
      const t = new DataView(new ArrayBuffer(4)); t.setUint32(0, m.fileSize, true);
      await w.write({ type: 'write', position: 4, data: t.buffer });
      await w.truncate(m.fileSize);
    }
    await w.close();
    return 'original';
  }
  // mode === 'real'
  const out = new Uint8Array(cdf);
  for (const [i, , r] of NAMES) {
    const b = new Uint8Array(16);
    for (let k = 0; k < r.length; k++) b[k] = r.charCodeAt(k);
    out.set(b, i * REC + 8);
  }
  const packed = pack(out);
  // The marker remembers the original list and the archive's original length. The new list always goes right
  // after that length, replacing any list written before, so switching names on and off doesn't grow the file.
  let m = null;
  try { m = JSON.parse(await (await (await dir.getFileHandle(MARK)).getFile()).text()); } catch {}
  if (!m || !m.fileSize) {
    // first time (or a marker from an older version of the app): the names are original now, so the current
    // entry is the original list, and new lists go after everything already in the file
    m = { off, size, fileSize: file.size };
    const mw = await (await dir.getFileHandle(MARK, { create: true })).createWritable();
    await mw.write(JSON.stringify(m)); await mw.close();
  }
  const end = m.fileSize, at = end + ((16 - end % 16) % 16), total = at + packed.length;
  const w = await fh.createWritable({ keepExistingData: true });
  await w.truncate(at);
  await w.write({ type: 'write', position: at, data: packed });
  await setEntry(w, at, packed.length);
  const t = new DataView(new ArrayBuffer(4)); t.setUint32(0, total, true);
  await w.write({ type: 'write', position: 4, data: t.buffer });
  await w.close();
  return 'real';
}`;

// mode: 'status' | 'real' | 'original'. Returns the state afterwards ('real', 'original', 'unknown', 'no-game').
function names(win, mode) {
  return win.webContents.executeJavaScript(`(${PAGE_JS})(${JSON.stringify(NAMES)}, ${JSON.stringify(mode)})`);
}

module.exports = { names, COUNT: NAMES.length };
