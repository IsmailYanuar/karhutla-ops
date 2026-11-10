import { readFileSync, writeFileSync } from 'node:fs'

const DATA_DIR = 'frontend/public/data'
const read = (name) => JSON.parse(readFileSync(`${DATA_DIR}/${name}.json`, 'utf8'))

try { process.loadEnvFile('.env') } catch { }

const history = read('history')
const wilayah = read('wilayah')
const area = Object.fromEntries(wilayah.provinsi.map((p) => [p.name, p.areaKm2]))

const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (s, n) => iso(new Date(new Date(`${s}T00:00:00Z`).getTime() + n * 86400000))
const days = history.days
const hotspots = read('hotspots')
function sumRange(from, to) {
  const out = { total: 0, high: 0, covered: 0, byProvince: {} }
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const day = days[d]
    if (!day) continue
    out.covered++
    out.total += day.count
    out.high += day.high || 0
    for (const [p, n] of Object.entries(day.byProvince)) out.byProvince[p] = (out.byProvince[p] || 0) + n
  }
  return out
}

const dates = hotspots.summary.byDate.map((d) => d.date).sort()
const first = dates[0]
const last = dates.at(-1)
const now = {
  total: hotspots.summary.total,
  high: hotspots.summary.high,
  byProvince: Object.fromEntries(hotspots.summary.byProvince.map((p) => [p.province, p.count])),
}

const span = dates.length
const before = sumRange(addDays(first, -span), addDays(first, -1))
const lastYear = sumRange(addDays(first, -364), addDays(last, -364))
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null)

const provinces = wilayah.provinsi.map(({ name }) => {
  const n = now.byProvince[name] || 0
  const b = before.byProvince[name] || 0
  return { name, n, diff: n - b, density: Math.round((n / area[name]) * 1000 * 10) / 10 }
})

const facts = {
  jumlahHari: span,
  periode: `${first} s.d. ${last}`,
  totalTitik: now.total,
  kepercayaanTinggi: now.high,
  perubahanPeriodeSebelumnyaPersen: before.covered === span ? pct(now.total, before.total) : null,
  perubahanTahunLaluPersen: lastYear.covered >= dates.length - 1 ? pct(now.total, lastYear.total) : null,
  terbanyak: [...provinces].sort((a, b) => b.n - a.n).slice(0, 3).map(({ name, n }) => ({ provinsi: name, titik: n })),
  terpadat: [...provinces].sort((a, b) => b.density - a.density).slice(0, 3).map(({ name, density }) => ({ provinsi: name, per1000km2: density })),
  kenaikanTerbesar: [...provinces].filter((p) => p.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 3).map(({ name, diff }) => ({ provinsi: name, tambahanTitik: diff })),
}

const fmt = (n) => n.toLocaleString('id-ID')
function templateText(f) {
  const change = f.perubahanPeriodeSebelumnyaPersen
  const trend = change == null ? '' : change === 0 ? ', sama dengan periode sebelumnya' : `, ${change > 0 ? 'naik' : 'turun'} ${Math.abs(change)}% dibanding ${span} hari sebelumnya`
  const top = f.terbanyak.map((t) => `${t.provinsi} (${fmt(t.titik)})`).join(', ')
  const rise = f.kenaikanTerbesar[0]
  return `Dalam ${span} hari terakhir terdeteksi ${fmt(f.totalTitik)} titik panas di Indonesia${trend}, ${fmt(f.kepercayaanTinggi)} di antaranya berkepercayaan tinggi. Terbanyak di ${top}.` +
    (rise ? ` Kenaikan terbesar terjadi di ${rise.provinsi} (+${fmt(rise.tambahanTitik)} titik).` : '')
}

async function listModels(key) {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL]
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Gagal membaca daftar model (HTTP ${res.status})`)
  const { models = [] } = await res.json()
  const ok = models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => /^gemini-\d+(\.\d+)?-flash(-lite)?(-preview)?$/.test(n))
  const version = (n) => Number(n.match(/^gemini-(\d+(?:\.\d+)?)/)[1])
  ok.sort((a, b) => version(b) - version(a) || a.includes('preview') - b.includes('preview') || a.includes('lite') - b.includes('lite'))
  if (!ok.length) throw new Error('Tidak ada model Gemini Flash yang tersedia')
  return ok.slice(0, 4)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function forAi(f) {
  const tgl = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const [a, b] = f.periode.split(' s.d. ')
  const n = (v) => (v == null ? null : v.toLocaleString('id-ID'))
  return {
    periode: `${tgl(a)} sampai ${tgl(b)} (${f.jumlahHari} hari)`,
    totalTitik: n(f.totalTitik),
    kepercayaanTinggi: n(f.kepercayaanTinggi),
    perubahanDibandingPeriodeSebelumnya: f.perubahanPeriodeSebelumnyaPersen == null ? null : `${f.perubahanPeriodeSebelumnyaPersen > 0 ? 'naik' : 'turun'} ${Math.abs(f.perubahanPeriodeSebelumnyaPersen)}%`,
    perubahanDibandingTahunLalu: f.perubahanTahunLaluPersen == null ? null : `${f.perubahanTahunLaluPersen > 0 ? 'naik' : 'turun'} ${Math.abs(f.perubahanTahunLaluPersen)}%`,
    terbanyak: f.terbanyak.map((t) => `${t.provinsi} (${n(t.titik)} titik)`),
    terpadat: f.terpadat.map((t) => `${t.provinsi} (${n(t.per1000km2)} titik per 1.000 km²)`),
    kenaikanTerbesar: f.kenaikanTerbesar.map((t) => `${t.provinsi} (bertambah ${n(t.tambahanTitik)} titik)`),
  }
}

const REQUEST_TIMEOUT_MS = 60_000
const CALL_BUDGET_MS = 2 * 60_000

async function callGemini(prompt, asJson = false) {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new Error('GEMINI_API_KEY belum diatur')
  const generationConfig = { temperature: 0.3, ...(asJson ? { responseMimeType: 'application/json' } : {}) }
  let lastError = 'tidak diketahui'
  const deadline = Date.now() + CALL_BUDGET_MS
  for (const model of await listModels(key)) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (Date.now() > deadline) throw new Error(`waktu habis (${lastError})`)
      let res
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch (e) {
        lastError = `${model}: ${e.name === 'TimeoutError' ? 'tidak menjawab dalam 60 detik' : e.message}`
        console.warn(`Percobaan ${attempt} gagal: ${lastError}`)
        continue
      }
      if (res.ok) {
        const json = await res.json()
        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim()
        if (text) return { text, model }
        lastError = `${model} tidak mengembalikan teks`
        break
      }
      lastError = `${model} HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`
      console.warn(`Percobaan ${attempt} gagal: ${lastError.slice(0, 80)}`)
      if (![429, 500, 503].includes(res.status)) break
      await sleep(attempt * 5000)
    }
  }
  throw new Error(`Gemini gagal: ${lastError}`)
}

async function aiText(f) {
  const prompt = `Kamu menulis ringkasan harian untuk website publik KarhutlaTracker tentang titik panas kebakaran hutan dan lahan di Indonesia.
Tulis 2 sampai 3 kalimat dalam bahasa Indonesia yang jelas untuk masyarakat umum.
Aturan:
- Pakai HANYA angka dari data JSON di bawah. Jangan menambah angka, penyebab, atau prediksi.
- Sebut "titik panas", bukan "kebakaran", karena tidak semua titik panas adalah api.
- Nada netral dan informatif, tanpa menyalahkan pihak mana pun.
- Jika nilai perubahan null, jangan bahas perubahan itu.
- Perubahan dibandingkan dengan periode sebelumnya yang panjangnya sama (jumlahHari).
- Tulis angka dan tanggal persis seperti di data (sudah diformat).
- Cukup bahas 3 sampai 4 fakta terpenting, jangan semua.
- Tanpa judul, tanpa poin, tanpa emoji, tanpa tanda pisah panjang.
Data:
${JSON.stringify(forAi(f), null, 2)}`

  const { text, model } = await callGemini(prompt)
  return { text: text.replace(/\s*—\s*/g, ', '), model }
}

const histDates = Object.keys(days).sort()
const anchor = histDates.at(-2) ?? histDates.at(-1)
const week = sumRange(addDays(anchor, -6), anchor)
const prevWeek = sumRange(addDays(anchor, -13), addDays(anchor, -7))
const tglPendek = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const provRows = wilayah.provinsi.map(({ name, areaKm2 }) => {
  const n = week.byProvince[name] || 0
  return { name, n, before: prevWeek.byProvince[name] || 0, density: (n / areaKm2) * 1000 }
})
const rankOf = (key, row) => 1 + provRows.filter((r) => r[key] > row[key]).length
const fmtDec = (v) => v.toLocaleString('id-ID', { maximumFractionDigits: 1 })
const provFacts = Object.fromEntries(provRows.map((r) => {
  const change = r.before ? Math.round(((r.n - r.before) / r.before) * 100) : null
  return [r.name, {
    titik7Hari: fmt(r.n),
    titik7HariSebelumnya: fmt(r.before),
    perubahan: r.before === 0 ? (r.n ? 'sebelumnya tidak ada titik panas' : 'sama-sama nol') : `${change > 0 ? 'naik' : change < 0 ? 'turun' : 'tetap'} ${Math.abs(change)}%`,
    peringkatJumlah: `${rankOf('n', r)} dari ${provRows.length}`,
    kepadatanPer1000km2: fmtDec(r.density),
    peringkatKepadatan: `${rankOf('density', r)} dari ${provRows.length}`,
  }]
}))

function provTemplate(name) {
  const f = provFacts[name]
  if (f.titik7Hari === '0') return `Tidak ada titik panas terdeteksi di ${name} dalam 7 hari sampai ${tglPendek(anchor)}.`
  let text = `Dalam 7 hari sampai ${tglPendek(anchor)} terdeteksi ${f.titik7Hari} titik panas di ${name}, peringkat ${f.peringkatJumlah} provinsi.`
  if (f.perubahan.startsWith('naik') || f.perubahan.startsWith('turun')) text += ` Jumlahnya ${f.perubahan} dibanding 7 hari sebelumnya.`
  else if (f.perubahan === 'sebelumnya tidak ada titik panas') text += ' Pada 7 hari sebelumnya belum ada titik panas.'
  return text + ` Kepadatannya ${f.kepadatanPer1000km2} titik per 1.000 km².`
}

async function aiProvinces() {
  const prompt = `Kamu menulis ringkasan singkat per provinsi untuk website publik KarhutlaTracker tentang titik panas kebakaran hutan dan lahan di Indonesia.
Periode: 7 hari sampai ${tglPendek(anchor)}, dibanding 7 hari sebelumnya.
Untuk SETIAP provinsi di data, tulis 2 kalimat bahasa Indonesia yang jelas untuk masyarakat umum.
Aturan:
- Pakai HANYA angka dari data provinsi itu, tulis persis seperti di data. Jangan menambah angka, penyebab, atau prediksi.
- Kalimat pertama WAJIB memuat jumlah titik7Hari persis seperti tertulis.
- Sebut "titik panas", bukan "kebakaran".
- Nada netral dan informatif, tanpa menyalahkan pihak mana pun.
- Jika titik7Hari 0, cukup satu kalimat bahwa tidak ada titik panas terdeteksi.
- Variasikan susunan kalimat antarprovinsi, tapi tetap ringkas.
- Tanpa judul, tanpa emoji, tanpa tanda pisah panjang.
Balas HANYA dengan objek JSON: kunci = nama provinsi persis seperti di data, nilai = teks ringkasan.
Data:
${JSON.stringify(provFacts, null, 1)}`
  const { text, model } = await callGemini(prompt, true)
  const parsed = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim())
  return { parsed, model }
}

const hasNumber = (text, num) => new RegExp(`(^|[^\\d.,])${num.replace(/\./g, '\\.')}(?![\\d]|[.,]\\d)`).test(text)
const provinsi = {}
let provModel = null
try {
  const { parsed, model } = await aiProvinces()
  provModel = model
  for (const name of Object.keys(provFacts)) {
    const t = typeof parsed[name] === 'string' ? parsed[name].replace(/\s*—\s*/g, ', ').trim() : ''
    provinsi[name] = t && hasNumber(t, provFacts[name].titik7Hari) ? { text: t, ai: true } : { text: provTemplate(name), ai: false }
  }
  console.log(`Ringkasan provinsi AI: ${Object.values(provinsi).filter((p) => p.ai).length} dari ${provRows.length} provinsi (${model}).`)
} catch (e) {
  console.warn(`Ringkasan provinsi AI tidak dipakai: ${e.message}. Memakai templat.`)
  for (const name of Object.keys(provFacts)) provinsi[name] = { text: provTemplate(name), ai: false }
}

let result
try {
  result = { ...(await aiText(facts)), ai: true }
  console.log(`Ringkasan AI dibuat dengan ${result.model}.`)
} catch (e) {
  console.warn(`Ringkasan AI tidak dipakai: ${e.message}. Memakai ringkasan templat.`)
  result = { text: templateText(facts), model: null, ai: false }
}

writeFileSync(`${DATA_DIR}/ringkasan.json`, JSON.stringify({ ...result, facts, provinsi, provinsiModel: provModel, provinsiSampai: anchor, generatedAt: new Date().toISOString() }, null, 2))
console.log(result.text)