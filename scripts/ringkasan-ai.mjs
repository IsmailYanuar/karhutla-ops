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

// Daftar model Flash yang tersedia, terbaru dulu, karena nama model Gemini sering berganti.
async function listModels(key) {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL]
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } })
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

async function aiText(f) {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new Error('GEMINI_API_KEY belum diatur')
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


  let lastError = 'tidak diketahui'
  for (const model of await listModels(key)) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3 } }),
      })
      if (res.ok) {
        const json = await res.json()
        const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim()
        if (text) return { text: text.replace(/\s*—\s*/g, ', '), model }
        lastError = `${model} tidak mengembalikan teks`
        break
      }
      lastError = `${model} HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`
      console.warn(`Percobaan ${attempt} gagal: ${lastError.slice(0, 80)}`)
      if (![429, 500, 503].includes(res.status)) break
      await sleep(attempt * 10000)
    }
  }
  throw new Error(`Gemini gagal: ${lastError}`)
}

let result
try {
  result = { ...(await aiText(facts)), ai: true }
  console.log(`Ringkasan AI dibuat dengan ${result.model}.`)
} catch (e) {
  console.warn(`Ringkasan AI tidak dipakai: ${e.message}. Memakai ringkasan templat.`)
  result = { text: templateText(facts), model: null, ai: false }
}

writeFileSync(`${DATA_DIR}/ringkasan.json`, JSON.stringify({ ...result, facts, generatedAt: new Date().toISOString() }, null, 2))
console.log(result.text)