"use client";

// Detail pasien edokter: tab SOAPIE & Resep — lihat riwayat + input baru.
// no_rawat/jenis/nama dari query string (hindari %2F 404 dari slash no_rawat).

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import MicButton from "@/components/MicButton";
import PtoForm from "@/components/PtoForm";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  edokterSoapie, edokterResep, edokterSimpanSoapie, edokterHapusSoapie, edokterCariObat, edokterSimpanResep, edokterCopyResep,
  edokterPengkajianMedisList, edokterPengkajianMedisDetail, edokterPengkajianMedisSave, edokterPengkajianMedisHapus, EdokterPengkajianMedis,
  edokterResumeMedisGet, edokterResumeMedisSave,
  edokterIcuGet, edokterIcuSave, edokterIcuHistori, EdokterIcuHistori,
  edokterAsesmenPraAnestesiGet, edokterAsesmenPraAnestesiSave, edokterAsesmenPraAnestesiHapus,
  edokterAsesmenPraInduksiGet, edokterAsesmenPraInduksiSave, edokterAsesmenPraInduksiHapus,
  edokterAsesmenPraBedahGet, edokterAsesmenPraBedahSave, edokterAsesmenPraBedahHapus,
  edokterLabJenis, edokterLabPermintaan, edokterBuatLab, edokterLabHasil,
  edokterRadJenis, edokterRadPermintaan, edokterBuatRad, edokterRadHasil,
  edokterRadGambar, edokterRadGambarUrl,
  EdokterSoapie, EdokterResep, EdokterObat, EdokterResepItem,
  EdokterJenisPrw, EdokterPermintaan, EdokterHasilLab, EdokterHasilRad, EdokterGambar,
  getEfarmasiResepTelaah, getEfarmasiTelaah, saveEfarmasiTelaah, getEfarmasiAlergi, saveEfarmasiAlergi,
  getEfarmasiPemberianObat, getEfarmasiPto, saveEfarmasiPto, getEfarmasiRekonsiliasi, saveEfarmasiRekonsiliasi,
  getEfarmasiKonseling, saveEfarmasiKonseling,
  ResepTelaah, Telaah, AlergiResp, PemberianObat, Pto, Rekonsiliasi, Konseling,
  enakesCatatanList, enakesCatatanSave, EnakesCatatan,
  enakesBundleHeader, enakesBundleDetail, enakesBundleHeaderSave, enakesBundleDetailSave,
  enakesBundleHeaderHapus, enakesBundleDetailHapus, BundleRow,
  enakesResumeKepGet, enakesResumeKepSave, EnakesResumeKep, enakesResumeKepHapus,
  enakesKriteriaGet, enakesKriteriaSave, enakesKriteriaHapus,
  enakesTtv, EnakesTtv,
  enakesJatuhRiwayat, enakesJatuhSave, EnakesRiwayatJatuh, enakesJatuhHapus,
  enakesNyeriList, enakesNyeriSave, EnakesNyeri,
  enakesEwsRiwayat, enakesEwsSave, EnakesRiwayatEws, enakesEwsHapus,
  enakesEdukasiList, enakesEdukasiSave, EnakesEdukasi, enakesCekAkses,
  enakesCatatanHapus, enakesNyeriHapus, enakesEdukasiHapus,
  uploadSuratMedia,
  getPenerimaanBukti,
  getPengantarPulangTtd,
  getResumeSerahTerima, saveResumeSerahTerima,
  enakesPengkajianInstrumen, enakesPengkajianSkema, enakesPengkajianGet, enakesPengkajianSave,
  enakesPengkajianMaster, PengkajianInstrumen, PengkajianSkema, PengkajianMaster,
  enakesPenolakanList, enakesPenolakanSave, enakesPenolakanBukti, enakesPenolakanDetail, enakesPenolakanHapus, EnakesPenolakan,
  enakesPhq9List, enakesPhq9Save, EnakesPhq9, enakesPhq9Hapus,
  enakesAsqList, enakesAsqSave, EnakesAsq, enakesAsqHapus,
  enakesKekerasanList, enakesKekerasanSave, enakesMelarikanList, enakesMelarikanSave,
  enakesKekerasanHapus, enakesMelarikanHapus, enakesKekerasanDetail, enakesMelarikanDetail, RisikoDetail,
  EnakesRisiko, RisikoBody,
  enakesPengkajianIcuGet, enakesPengkajianIcuSave, enakesPengkajianIcuRiwayat, EnakesPengkajianIcuRow, enakesPengkajianIcuHapus, enakesPengkajianIcuDetail,
  enakesKmIcu2022List, enakesKmIcu2022Detail, enakesKmIcu2022Save, enakesKmIcu2022Hapus, EnakesKmIcu2022Row,
  enakesIntubasiList, enakesIntubasiSave, enakesIntubasiHapus, EnakesIntubasi,
  enakesTransferList, enakesTransferSave, enakesTransferHapus, enakesTransferDetail, EnakesTransfer,
  enakesStatusAnestesiList, enakesStatusAnestesiSave, enakesStatusAnestesiHapus, enakesStatusAnestesiDetail, EnakesSaRingkas,
  monAnesGet, monAnesHeaderSave, monAnesDetailAdd, monAnesDetailHapus, MonAnesDetail,
  periopSkorConfig, periopSkorList, periopSkorDetail, periopSkorSave, periopSkorHapus, PeriopSkorSection, PeriopSkorRingkas,
  periopFormConfig, periopFormList, periopFormDetail, periopFormSave, periopFormHapus, PeriopFormSection, PeriopFormRingkas,
  ckList, ckCreate, ckUpdate, ckHapus, CatatanKeperawatan,
  enakesApsGet, enakesApsSave, enakesApsBukti,
  enakesEmarGet, enakesEmarTambahObat, enakesEmarBeri, EnakesEmarObat, EnakesEmarDetail, EmarBeriItem,
  enakesSignInGet, enakesSignInSave, enakesSignInHapus, enakesTimeOutGet, enakesTimeOutSave, enakesTimeOutHapus, enakesSignOutGet, enakesSignOutSave, enakesSignOutHapus,
  enakesAskepPraopGet, enakesAskepPraopSave, enakesAskepPraopHapus, enakesAskepIntraopGet, enakesAskepIntraopSave, enakesAskepIntraopHapus, enakesAskepPostopGet, enakesAskepPostopSave, enakesAskepPostopHapus, AsuhanKb,
  enakesSedasiPraGet, enakesSedasiPraSave, enakesSedasiSelamaGet, enakesSedasiSelamaSave, enakesSedasiPascaGet, enakesSedasiPascaSave,
  enakesSedasiMonList, enakesSedasiMonSave, enakesSedasiMonHapus, enakesSedasiMonpList, enakesSedasiMonpSave, enakesSedasiMonpHapus, SedasiRec, SedasiMonRow,
  enakesPenandaanGet, enakesPenandaanTtdSave, enakesPenandaanHapus, EnakesPenandaan,
  enakesMonitoringSingleUseGet, enakesMonitoringSingleUseSave, enakesMonitoringSingleUseHapus, EnakesMonitoringSingleUse,
  enakesMe, igdListDokter, edokterMe,
  suratKontrolInfo, suratKontrolPoli, suratKontrolDokter, suratKontrolCreate, suratKontrolHapus,
  SuratKontrolInfo, SkPoli, SkDokter,
} from "@/lib/api";

type Tab = "soapie" | "resep" | "lab" | "radiologi" | "telaah" | "alergi" | "asuhan" | "catatan" | "ttv" | "jatuh" | "nyeri" | "ews" | "edukasi" | "pengkajian" | "penolakan" | "phq9" | "asq" | "kekerasan" | "melarikan" | "icu" | "pengkajian_icu" | "aps" | "emar" | "signin" | "timeout" | "signout" | "askep_praop" | "askep_intraop" | "askep_postop" | "penandaan" | "monitoring_single_use" | "asesmen_pra_anestesi" | "asesmen_pra_induksi" | "asesmen_pra_bedah" | "catatan_sedasi" | "surat_kontrol" | "resume_kep" | "bundle_ppi"
 | "kriteria_masuk_icu" | "kriteria_keluar_icu" | "kriteria_masuk_nicu" | "kriteria_keluar_nicu" | "kriteria_masuk_picu" | "kriteria_keluar_picu" | "kriteria_masuk_icu_2022" | "transfer" | "intubasi" | "status_anestesi" | "pengkajian_medis" | "awal_medis_igd" | "resume_medis" | "orientasi_ranap" | "ttd_pengantar_pulang" | "resume_serah_terima" | "discharge_screening" | "second_opinion" | "rekonsiliasi_obat" | "pto" | "meso" | "hitung_kassa"
 | "skor_aldrette" | "skor_steward" | "skor_bromage"
 | "edukasi_anestesi" | "konversi_anestesi" | "sia_general" | "sia_regional"
 | "penilaian_pre_operasi" | "checklist_post_operasi" | "monitoring_anestesi" | "laporan_operasi" | "form_robson" | "monitoring_fisiologis"
 | "reaksi_transfusi" | "restrain" | "mpp_skrining" | "mpp_evaluasi" | "catatan_keperawatan";
const TABS: [Tab, string][] = [["soapie", "SOAPIE"], ["pengkajian_medis", "Awal Medis Ranap"], ["awal_medis_igd", "Awal Medis IGD"], ["penolakan", "Persetujuan Tindakan"], ["icu", "Asesmen ICU"], ["kriteria_masuk_icu_2022", "Kriteria Masuk ICU"], ["asesmen_pra_anestesi", "Asesmen Pra Anestesi"], ["resume_medis", "Resume Medis"], ["resep", "Resep"], ["lab", "Lab"], ["radiologi", "Radiologi"]];
const TABS_FARMASI: [Tab, string][] = [["soapie", "SOAPIE"], ["resep", "Resep"], ["telaah", "Telaah"], ["rekonsiliasi_obat", "Rekonsiliasi"], ["pto", "PTO"], ["meso", "MESO"], ["asuhan", "Asuhan"], ["edukasi", "Edukasi"], ["alergi", "Alergi"], ["lab", "Lab"]];
const TABS_ENAKES: [Tab, string][] = [["soapie", "SOAPIE"], ["pengkajian", "Pengkajian"], ["ttv", "TTV"], ["ews", "EWS"], ["nyeri", "Nyeri"], ["jatuh", "Jatuh"], ["phq9", "PHQ-9"], ["asq", "ASQ (Bunuh Diri)"], ["kekerasan", "Kekerasan Fisik"], ["melarikan", "Melarikan Diri"], ["pengkajian_icu", "Pengkajian ICU"], ["intubasi", "Intubasi & Ventilator"], ["catatan_keperawatan", "Catatan Keperawatan"], ["transfer", "Transfer Antar Ruang"], ["reaksi_transfusi", "Reaksi Transfusi"], ["restrain", "Restrain"], ["mpp_skrining", "MPP — Skrining"], ["mpp_evaluasi", "MPP — Evaluasi"], ["discharge_screening", "Skrining Perencanaan Pulang"], ["second_opinion", "Second Opinion (Pendapat Kedua)"], ["hitung_kassa", "Hitung Kassa & Instrumen"], ["orientasi_ranap", "Penerimaan & Orientasi Pasien Baru"], ["ttd_pengantar_pulang", "TTD Pengantar Pulang"], ["resume_serah_terima", "Serah Terima Resume"], ["aps", "Pulang APS"], ["surat_kontrol", "Surat Kontrol BPJS"], ["emar", "Jadwal Obat"], ["signin", "Sign In OK"], ["timeout", "Time Out OK"], ["signout", "Sign Out OK"], ["penandaan", "Penandaan Operasi"], ["monitoring_single_use", "Monitoring Alat Single Use"], ["catatan_sedasi", "Anestesi Sedasi"], ["asesmen_pra_induksi", "Asesmen Pra Induksi"], ["asesmen_pra_bedah", "Asesmen Pra Bedah"], ["status_anestesi", "Status Anestesi"], ["askep_praop", "Askep KB — Pra-Op"], ["askep_intraop", "Askep KB — Intra-Op"], ["askep_postop", "Askep KB — Post-Op"], ["skor_aldrette", "Skor Aldrette"], ["skor_steward", "Skor Steward"], ["skor_bromage", "Skor Bromage"], ["penilaian_pre_operasi", "Penilaian Pre Operasi"], ["checklist_post_operasi", "Checklist Post Operasi"], ["monitoring_anestesi", "Monitoring Anestesi"], ["laporan_operasi", "Laporan Operasi"], ["form_robson", "Form Robson"], ["edukasi_anestesi", "Edukasi Anestesi"], ["sia_general", "SIA General"], ["sia_regional", "SIA Regional"], ["konversi_anestesi", "Konversi Anestesi"], ["monitoring_fisiologis", "Monitoring Fisiologis Anes/Sedasi"], ["catatan", "Catatan"], ["resume_kep", "Resume Keperawatan"], ["kriteria_keluar_icu", "Kriteria Keluar ICU"], ["kriteria_masuk_nicu", "Kriteria Masuk NICU"], ["kriteria_keluar_nicu", "Kriteria Keluar NICU"], ["kriteria_masuk_picu", "Kriteria Masuk PICU"], ["kriteria_keluar_picu", "Kriteria Keluar PICU"], ["edukasi", "Edukasi"], ["penolakan", "Persetujuan Penolakan Tindakan"], ["bundle_ppi", "Monitoring Bundle PPI"], ["alergi", "Alergi"], ["resep", "Resep"], ["lab", "Lab"], ["radiologi", "Rad"]];
// Konteks Operasi (segmen "Operasi" daftar e-Nakes): hanya SOAPIE + tab terkait
// operasi/perioperatif (checklist keselamatan, penandaan, anestesi/sedasi, askep KB).
const OPERASI_KEYS: Tab[] = ["soapie", "signin", "timeout", "signout", "penandaan", "hitung_kassa", "monitoring_single_use", "catatan_sedasi", "asesmen_pra_induksi", "status_anestesi", "askep_praop", "askep_intraop", "askep_postop", "skor_aldrette", "skor_steward", "skor_bromage", "edukasi_anestesi", "sia_general", "sia_regional", "konversi_anestesi", "penilaian_pre_operasi", "checklist_post_operasi", "monitoring_anestesi", "laporan_operasi", "form_robson"];
const TABS_ENAKES_OPERASI: [Tab, string][] = TABS_ENAKES.filter(([t]) => OPERASI_KEYS.includes(t));
// Konteks Operasi E-Dokter (segmen "Operasi" daftar e-Dokter): fokus anestesi/bedah.
const TABS_EDOKTER_OPERASI: [Tab, string][] = [["soapie", "SOAPIE"], ["asesmen_pra_anestesi", "Asesmen Pra Anestesi"], ["penilaian_pre_operasi", "Penilaian Pre Operasi"], ["checklist_post_operasi", "Checklist Post Operasi"], ["monitoring_anestesi", "Monitoring Anestesi"], ["laporan_operasi", "Laporan Operasi"], ["form_robson", "Form Robson"], ["edukasi_anestesi", "Edukasi Anestesi"], ["sia_general", "SIA General"], ["sia_regional", "SIA Regional"], ["konversi_anestesi", "Konversi Anestesi"], ["status_anestesi", "Status Anestesi"], ["skor_aldrette", "Skor Aldrette"], ["skor_steward", "Skor Steward"], ["skor_bromage", "Skor Bromage"], ["penolakan", "Persetujuan Tindakan"], ["resep", "Resep"]];
// Pengelompokan tab untuk navigasi dropdown (urutan grup = urutan tampil).
// Dipakai saat jumlah tab banyak (mis. e-Nakes ~70) agar mudah dicari.
const TAB_GROUPS: [string, Tab[]][] = [
  ["Umum & Catatan", ["soapie", "catatan", "catatan_keperawatan", "resume_kep", "resume_medis", "resume_serah_terima", "edukasi", "penolakan", "alergi", "resep", "telaah", "asuhan", "rekonsiliasi_obat", "pto", "meso", "lab", "radiologi", "emar"]],
  ["Penilaian & Skrining", ["pengkajian", "pengkajian_medis", "awal_medis_igd", "ttv", "ews", "nyeri", "jatuh", "phq9", "asq", "kekerasan", "melarikan"]],
  ["Perioperatif / Bedah", ["signin", "timeout", "signout", "penandaan", "hitung_kassa", "monitoring_single_use", "penilaian_pre_operasi", "checklist_post_operasi", "laporan_operasi", "form_robson", "askep_praop", "askep_intraop", "askep_postop"]],
  ["Anestesi", ["asesmen_pra_anestesi", "asesmen_pra_induksi", "asesmen_pra_bedah", "catatan_sedasi", "status_anestesi", "monitoring_anestesi", "monitoring_fisiologis", "edukasi_anestesi", "sia_general", "sia_regional", "konversi_anestesi", "skor_aldrette", "skor_steward", "skor_bromage"]],
  ["ICU / Kritis", ["icu", "pengkajian_icu", "intubasi", "kriteria_masuk_icu", "kriteria_masuk_icu_2022", "kriteria_keluar_icu", "kriteria_masuk_nicu", "kriteria_keluar_nicu", "kriteria_masuk_picu", "kriteria_keluar_picu"]],
  ["MPP & Kepulangan", ["mpp_skrining", "mpp_evaluasi", "discharge_screening", "second_opinion", "transfer", "orientasi_ranap", "reaksi_transfusi", "restrain", "ttd_pengantar_pulang", "aps"]],
  ["PPI / Bundle", ["bundle_ppi"]],
];

// Navigasi tab: set kecil → tab horizontal biasa; set besar (>16) → dropdown
// dengan pencarian + pengelompokan agar tidak perlu scroll samping.
function TabNav({ tabs, value, onChange, enakes, forceDropdown }: { tabs: [Tab, string][]; value: Tab; onChange: (t: Tab) => void; enakes: boolean; forceDropdown?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const activeCls = enakes ? "text-rose-700 border-rose-600" : "text-emerald-700 border-emerald-600";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (tabs.length <= 16 && !forceDropdown) {
    return (
      <nav className="bg-slate-50 border-b border-slate-200 flex overflow-x-auto">
        {tabs.map(([t, l]) => (
          <button key={t} onClick={() => onChange(t)}
            className={`py-3 px-3.5 shrink-0 text-xs font-semibold transition-colors whitespace-nowrap ${
              value === t ? `${activeCls} border-b-2 bg-white` : "text-slate-500 hover:text-slate-700"
            }`}>{l}</button>
        ))}
      </nav>
    );
  }

  const curLabel = tabs.find(([t]) => t === value)?.[1] ?? "Pilih Form";
  const ql = q.trim().toLowerCase();
  const inSet = new Map<Tab, string>(tabs);
  const grouped: [string, [Tab, string][]][] = [];
  const used = new Set<Tab>();
  for (const [g, keys] of TAB_GROUPS) {
    const items: [Tab, string][] = [];
    for (const k of keys) {
      const l = inSet.get(k);
      if (l === undefined) continue;
      used.add(k);
      if (!ql || l.toLowerCase().includes(ql)) items.push([k, l]);
    }
    if (items.length) grouped.push([g, items]);
  }
  const lainnya = tabs.filter(([t, l]) => !used.has(t) && (!ql || l.toLowerCase().includes(ql)));
  if (lainnya.length) grouped.push(["Lainnya", lainnya]);

  return (
    <div ref={ref} className="relative bg-slate-50 border-b border-slate-200 px-3 py-2">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
        <span className="truncate flex items-center gap-2">
          <span className={enakes ? "text-rose-600" : "text-emerald-600"}>●</span>
          <span className="truncate">{curLabel}</span>
        </span>
        <svg className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute left-3 right-3 z-30 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Cari form…"
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-300" />
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {grouped.length === 0 && <div className="px-3 py-4 text-center text-xs text-slate-400">Tidak ada form cocok</div>}
            {grouped.map(([g, items]) => (
              <div key={g}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{g}</div>
                {items.map(([t, l]) => (
                  <button key={t} onClick={() => { onChange(t); setOpen(false); setQ(""); }}
                    className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-slate-50 ${
                      value === t ? (enakes ? "text-rose-700 font-semibold bg-rose-50" : "text-emerald-700 font-semibold bg-emerald-50") : "text-slate-600"
                    }`}>
                    <span className="w-3 shrink-0 text-center text-xs">{value === t ? "✓" : ""}</span>
                    <span className="truncate">{l}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const KESADARAN = ["Compos Mentis", "Somnolence", "Sopor", "Coma", "Alert", "Confusion", "Voice", "Pain", "Unresponsive"];

// Hook cek hak akses E-Nakes (kolom tabel user). col kosong = tidak digate (true).
function useAkses(col: string): boolean {
  const [boleh, setBoleh] = useState(true);
  useEffect(() => {
    if (!col) { setBoleh(true); return; }
    let alive = true;
    enakesCekAkses(col).then(r => { if (alive) setBoleh(r.data.granted); }).catch(() => { if (alive) setBoleh(false); });
    return () => { alive = false; };
  }, [col]);
  return boleh;
}

// Pemetaan tab E-Nakes -> kolom hak akses (tabel user). "" = tidak digate di sini.
function tabPerm(tab: Tab, jenis: string): string {
  switch (tab) {
    case "catatan": return jenis === "ranap" ? "catatan_keperawatan_ranap" : "catatan_keperawatan_ralan";
    case "emar": return "catatan_keperawatan_ranap";
    case "resume_kep":
    case "kriteria_masuk_icu": case "kriteria_keluar_icu":
    case "kriteria_masuk_nicu": case "kriteria_keluar_nicu":
    case "kriteria_masuk_picu": case "kriteria_keluar_picu": return "tindakan_ranap";
    case "nyeri": return "penilaian_ulang_nyeri";
    case "edukasi": return "pelaksanaan_informasi_edukasi";
    case "penolakan": return "persetujuan_penolakan_tindakan";
    case "phq9": return "skrining_instrumen_srq";
    case "asq": return "penilaian_tambahan_bunuh_diri";
    case "kekerasan": return "penilaian_tambahan_perilaku_kekerasan";
    case "melarikan": return "penilaian_tambahan_beresiko_melarikan_diri";
    case "pengkajian_icu": case "kriteria_masuk_icu_2022": return "checklist_kriteria_masuk_icu";
    case "intubasi": case "transfer": case "orientasi_ranap": case "ttd_pengantar_pulang": case "resume_serah_terima": case "discharge_screening": return "tindakan_ranap";
    case "status_anestesi": case "asesmen_pra_induksi": return "laporan_anestesi";
    case "aps": return "surat_pulang_atas_permintaan_sendiri";
    case "signin": return "signin_sebelum_anestesi";
    case "timeout": return "timeout_sebelum_insisi";
    case "signout": return "signout_sebelum_menutup_luka";
    case "penandaan": case "monitoring_single_use": return "checklist_pre_operasi";
    case "askep_praop": case "askep_intraop": case "askep_postop": return "pengkajian_askep";
    default: return "";
  }
}

// Pemetaan tab E-Dokter -> kolom hak akses (tabel user). "" = tidak digate.
// Hanya kolom yang benar-benar ada di tabel user Khanza.
function edokterTabPerm(tab: Tab): string {
  switch (tab) {
    case "soapie": return "soap_perawatan";
    case "penolakan": return "persetujuan_penolakan_tindakan";
    case "resume_medis": return "data_resume_pasien";
    case "resep": return "resep_dokter";
    case "lab": return "permintaan_lab";
    case "radiologi": return "permintaan_radiologi";
    default: return ""; // pengkajian_medis, icu, asesmen_pra_* — tak ada kolom khusus
  }
}

// Notif kegagalan simpan: tampilkan alert (blocking) agar petugas benar-benar sadar,
// sekaligus kembalikan pesan untuk ditaruh di banner error form.
function notifGagal(ex: { response?: { data?: { error?: string } } }, fallback: string): string {
  const msg = ex?.response?.data?.error ?? fallback;
  if (typeof window !== "undefined") window.alert("⚠️ " + msg);
  return msg;
}

export default function PasienDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Memuat…</div>}>
      <PasienDetail />
    </Suspense>
  );
}

function PasienDetail() {
  const router = useRouter();
  const sp = useSearchParams();
  const noRawat = sp.get("no_rawat") ?? "";
  const jenis = sp.get("jenis") ?? "ralan";
  const nama = sp.get("nm") ?? "";
  // Mode farmasi (dipakai lewat /efarmasi): tanpa Radiologi, Resep read-only,
  // Lab lihat-hasil saja. SOAPIE tetap (farmasi melakukan SOAP kefarmasian).
  const path = usePathname();
  const isFarmasi = path.startsWith("/efarmasi");
  // Mode e-Nakes (perawat/tenaga kesehatan lewat /enakes): SOAPIE + Alergi input,
  // Resep & penunjang lihat saja.
  const isEnakes = path.startsWith("/enakes");
  const isEdokter = !isFarmasi && !isEnakes;
  const resepReadOnly = isFarmasi || isEnakes;
  // Konteks "Operasi" (dibuka dari segmen Operasi daftar e-Nakes): batasi tab
  // hanya SOAPIE + tab terkait operasi/perioperatif.
  const isOperasi = (isEnakes || isEdokter) && sp.get("ctx") === "operasi";

  const [tab, setTab] = useState<Tab>("soapie");
  // Hak akses per-tab (E-Nakes & E-Dokter): bila tak berakses, konten tab dibuat read-only.
  const bolehTab = useAkses(isEnakes ? tabPerm(tab, jenis) : isEdokter ? edokterTabPerm(tab) : (isFarmasi && tab === "edukasi") ? "pelaksanaan_informasi_edukasi" : "");
  const [soapie, setSoapie] = useState<EdokterSoapie[] | null>(null);
  const [resep, setResep] = useState<EdokterResep[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (tab !== "soapie" && tab !== "resep") return; // lab/radiologi punya loader sendiri
    setLoading(true);
    const load = tab === "soapie"
      ? edokterSoapie(noRawat, jenis).then(r => setSoapie(r.data))
      : edokterResep(noRawat).then(r => setResep(r.data));
    load.catch(() => { if (tab === "soapie") setSoapie([]); else setResep([]); })
        .finally(() => setLoading(false));
  }, [tab, noRawat, jenis, reload]);

  const [editSoap, setEditSoap] = useState<EdokterSoapie | null>(null);
  useEffect(() => { setFormOpen(false); setEditSoap(null); }, [tab]);
  const onSaved = () => { setFormOpen(false); setEditSoap(null); setReload(x => x + 1); };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header + tab (satu blok sticky) */}
      <div className="sticky top-0 z-20 shadow-md">
      <header className={`bg-gradient-to-br text-white px-3 pt-3 pb-3 ${isEnakes ? "from-rose-600 to-pink-700" : isFarmasi ? "from-sky-700 to-blue-800" : "from-teal-700 to-emerald-800"}`}>
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()}
            className="shrink-0 p-2 -ml-1 rounded-lg hover:bg-white/15 transition-colors" aria-label="Kembali">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="font-bold leading-tight truncate">{nama || "Pasien"}</div>
            <div className="text-xs text-white/80 truncate">{noRawat} · {labelJenis(jenis)}</div>
          </div>
        </div>
      </header>

      {/* Navigasi tab: set kecil → tab horizontal; set besar (e-Nakes ~70) →
          dropdown dengan pencarian + pengelompokan (lihat komponen TabNav). */}
      <TabNav
        tabs={isEnakes ? (isOperasi ? TABS_ENAKES_OPERASI : TABS_ENAKES) : isFarmasi ? TABS_FARMASI : (isOperasi ? TABS_EDOKTER_OPERASI : TABS)}
        value={tab}
        onChange={setTab}
        enakes={isEnakes}
        forceDropdown={!isEnakes && !isFarmasi}
      />
      </div>

      <main className="flex-1 p-3 space-y-3">
        {!bolehTab && <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">Anda tidak memiliki hak akses untuk mengubah data pada form ini — hanya bisa melihat.</div>}
        <fieldset disabled={!bolehTab} className="border-0 m-0 p-0 min-w-0 space-y-3">
        {tab === "soapie" || tab === "resep" ? (
          <>
            {formOpen ? (
              tab === "soapie"
                ? <SoapieForm noRawat={noRawat} jenis={jenis} edit={editSoap} onSaved={onSaved} onCancel={() => { setFormOpen(false); setEditSoap(null); }} />
                : <ResepForm noRawat={noRawat} jenis={jenis} onSaved={onSaved} onCancel={() => setFormOpen(false)} />
            ) : (tab === "resep" && resepReadOnly) ? null : (
              <button onClick={() => { setEditSoap(null); setFormOpen(true); }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
                + {tab === "soapie" ? "Catatan SOAPIE Baru" : "Resep Baru"}
              </button>
            )}
            {loading ? (
              <div className="text-center text-slate-400 text-sm py-10">Memuat…</div>
            ) : tab === "soapie" ? (
              <SoapieList data={soapie ?? []}
                onEdit={(s) => { setEditSoap(s); setFormOpen(true); }}
                onDelete={async (s) => {
                  if (!window.confirm(`Hapus catatan SOAPIE ${s.tgl_perawatan ?? ""} ${(s.jam_rawat ?? "").slice(0, 5)}?`)) return;
                  try {
                    await edokterHapusSoapie({ no_rawat: noRawat, jenis, tgl_perawatan: s.tgl_perawatan ?? "", jam_rawat: s.jam_rawat ?? "" });
                    setReload(x => x + 1);
                  } catch (e) {
                    const err = e as { response?: { data?: { error?: string } } };
                    alert(err.response?.data?.error ?? "Gagal menghapus");
                  }
                }} />
            ) : (
              <ResepList data={resep ?? []} noRawat={noRawat} jenis={jenis} readOnly={resepReadOnly} onCopied={() => setReload(x => x + 1)} />
            )}
          </>
        ) : tab === "ttv" ? (
          <TtvTab noRawat={noRawat} jenis={jenis} />
        ) : tab === "jatuh" ? (
          <JatuhTab noRawat={noRawat} jenis={jenis} />
        ) : tab === "nyeri" ? (
          <NyeriTab noRawat={noRawat} />
        ) : tab === "phq9" ? (
          <Phq9Tab noRawat={noRawat} />
        ) : tab === "asq" ? (
          <AsqTab noRawat={noRawat} />
        ) : tab === "icu" ? (
          <IcuAsesmenTab noRawat={noRawat} kdDokter={sp.get("kd_dokter") ?? undefined} />
        ) : tab === "asesmen_pra_anestesi" ? (
          <AsesmenPraAnestesiTab noRawat={noRawat} kdDokter={sp.get("kd_dokter") ?? undefined} />
        ) : tab === "asesmen_pra_induksi" ? (
          <PraInduksiTab noRawat={noRawat} kdDokter={sp.get("kd_dokter") ?? undefined} />
        ) : tab === "asesmen_pra_bedah" ? (
          <AsesmenPraBedahTab noRawat={noRawat} kdDokter={sp.get("kd_dokter") ?? undefined} />
        ) : tab === "catatan_sedasi" ? (
          <CatatanSedasiTab noRawat={noRawat} />
        ) : tab === "surat_kontrol" ? (
          <SuratKontrolTab noRawat={noRawat} />
        ) : tab === "kekerasan" ? (
          <RisikoTab noRawat={noRawat} judul="Asesmen Risiko Kekerasan Fisik"
            statik={KEKERASAN_STATIK_LBL} dinamis={KEKERASAN_DINAMIS_LBL}
            listFn={enakesKekerasanList} saveFn={enakesKekerasanSave} hapusFn={enakesKekerasanHapus} detailFn={enakesKekerasanDetail} />
        ) : tab === "melarikan" ? (
          <RisikoTab noRawat={noRawat} judul="Asesmen Risiko Melarikan Diri"
            statik={MELARIKAN_STATIK_LBL} dinamis={MELARIKAN_DINAMIS_LBL}
            listFn={enakesMelarikanList} saveFn={enakesMelarikanSave} hapusFn={enakesMelarikanHapus} detailFn={enakesMelarikanDetail} />
        ) : tab === "pengkajian_icu" ? (
          <PengkajianIcuTab noRawat={noRawat} />
        ) : tab === "kriteria_masuk_icu_2022" ? (
          <KriteriaMasukIcu2022Tab noRawat={noRawat} />
        ) : tab === "intubasi" ? (
          <IntubasiTab noRawat={noRawat} />
        ) : tab === "transfer" ? (
          <TransferTab noRawat={noRawat} />
        ) : tab === "status_anestesi" ? (
          <StatusAnestesiTab noRawat={noRawat} />
        ) : tab === "monitoring_fisiologis" ? (
          <MonitoringFisiologisTab noRawat={noRawat} />
        ) : tab === "aps" ? (
          <ApsTab noRawat={noRawat} />
        ) : tab === "emar" ? (
          <EmarTab noRawat={noRawat} />
        ) : tab === "signin" ? (
          <ChecklistPhaseTab noRawat={noRawat} phase="signin" judul="Sign In (Sebelum Induksi Anestesi)" items={SIGNIN_ITEMS} hasImplan />
        ) : tab === "timeout" ? (
          <ChecklistPhaseTab noRawat={noRawat} phase="timeout" judul="Time Out (Sebelum Insisi)" items={TIMEOUT_ITEMS} extraText={["lama_tindakan", "Lama tindakan (perkiraan)"]} />
        ) : tab === "signout" ? (
          <ChecklistPhaseTab noRawat={noRawat} phase="signout" judul="Sign Out (Sebelum Menutup Luka)" items={SIGNOUT_ITEMS} extraText={["perhatian_utama_fase_pemulihan", "Perhatian utama fase pemulihan"]} />
        ) : tab === "penandaan" ? (
          <PenandaanTab noRawat={noRawat} />
        ) : tab === "monitoring_single_use" ? (
          <MonitoringSingleUseTab noRawat={noRawat} />
        ) : tab === "skor_aldrette" || tab === "skor_steward" || tab === "skor_bromage" ? (
          <SkorPeriopTab noRawat={noRawat} section={tab.replace("skor_", "")} kdDokter={sp.get("kd_dokter") ?? undefined} />
        ) : tab === "orientasi_ranap" ? (
          <PenerimaanRanapTab noRawat={noRawat} kdDokter={sp.get("kd_dokter") ?? undefined} />
        ) : tab === "ttd_pengantar_pulang" ? (
          <PengantarPulangTtdTab noRawat={noRawat} />
        ) : tab === "resume_serah_terima" ? (
          <ResumeSerahTerimaTab noRawat={noRawat} />
        ) : tab === "edukasi_anestesi" || tab === "konversi_anestesi" || tab === "sia_general" || tab === "sia_regional" || tab === "penilaian_pre_operasi" || tab === "checklist_post_operasi" || tab === "monitoring_anestesi" || tab === "laporan_operasi" || tab === "form_robson" || tab === "reaksi_transfusi" || tab === "restrain" || tab === "mpp_skrining" || tab === "mpp_evaluasi" || tab === "discharge_screening" || tab === "second_opinion" || tab === "rekonsiliasi_obat" || tab === "meso" || tab === "hitung_kassa" ? (
          <PeriopFormTab noRawat={noRawat} section={tab} kdDokter={sp.get("kd_dokter") ?? undefined} />
        ) : tab === "pto" ? (
          <PtoForm noRawat={noRawat} />
        ) : tab === "askep_praop" ? (
          <AskepEventTab noRawat={noRawat} sectionKeys={["data_awal", "preop", "masalah"]} getFn={enakesAskepPraopGet} saveFn={enakesAskepPraopSave} hapusFn={enakesAskepPraopHapus} />
        ) : tab === "askep_intraop" ? (
          <AskepEventTab noRawat={noRawat} sectionKeys={["intraop"]} getFn={enakesAskepIntraopGet} saveFn={enakesAskepIntraopSave} hapusFn={enakesAskepIntraopHapus} />
        ) : tab === "askep_postop" ? (
          <AskepEventTab noRawat={noRawat} sectionKeys={["postop", "diagnosa"]} getFn={enakesAskepPostopGet} saveFn={enakesAskepPostopSave} hapusFn={enakesAskepPostopHapus} />
        ) : tab === "ews" ? (
          <EwsTab noRawat={noRawat} jenis={jenis} />
        ) : tab === "pengkajian" ? (
          <PengkajianTab noRawat={noRawat} jenis={jenis} />
        ) : tab === "penolakan" ? (
          <PenolakanTab noRawat={noRawat} />
        ) : tab === "pengkajian_medis" ? (
          <PengkajianMedisTab noRawat={noRawat} />
        ) : tab === "awal_medis_igd" ? (
          <PengkajianMedisTab noRawat={noRawat} sumber="igd" />
        ) : tab === "resume_medis" ? (
          <ResumeMedisTab noRawat={noRawat} />
        ) : tab === "catatan_keperawatan" ? (
          <CatatanKeperawatanTab noRawat={noRawat} jenis={jenis} />
        ) : tab === "edukasi" ? (
          <EdukasiTab noRawat={noRawat} />
        ) : tab === "catatan" ? (
          <CatatanTab noRawat={noRawat} jenis={jenis} />
        ) : tab === "resume_kep" ? (
          <ResumeKeperawatanTab noRawat={noRawat} />
        ) : tab === "bundle_ppi" ? (
          <BundlePpiTab noRawat={noRawat} />
        ) : tab.startsWith("kriteria_") ? (
          <ChecklistKriteriaTab noRawat={noRawat} form={tab.replace("kriteria_", "")} />
        ) : tab === "telaah" ? (
          <TelaahTab noRawat={noRawat} />
        ) : tab === "asuhan" ? (
          <AsuhanTab noRawat={noRawat} />
        ) : tab === "alergi" ? (
          <AlergiTab noRawat={noRawat} />
        ) : (
          <PenunjangTab kind={tab === "lab" ? "lab" : "rad"} noRawat={noRawat} jenis={jenis} viewOnly={resepReadOnly} />
        )}
        </fieldset>
      </main>
    </div>
  );
}

function labelJenis(j: string) {
  return j === "igd" ? "IGD" : j === "ranap" ? "Rawat Inap" : "Rawat Jalan";
}

// ── Catatan Keperawatan (adopsi DlgCatatanKeperawatan Khanza) ────────────────
// Ranap menyertakan tanda vital (TD/Nadi/RR/Suhu); ralan & IGD hanya uraian.
function CatatanTab({ noRawat, jenis }: { noRawat: string; jenis: string }) {
  const [list, setList] = useState<EnakesCatatan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [uraian, setUraian] = useState("");
  const [td, setTd] = useState(""); const [nadi, setNadi] = useState("");
  const [rr, setRr] = useState(""); const [suhu, setSuhu] = useState("");
  const [spo2, setSpo2] = useState("");
  const [waktu, setWaktu] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [editKey, setEditKey] = useState<{ t: string; j: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    enakesCatatanList(noRawat, jenis)
      .then(r => setList(r.data)).catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [noRawat, jenis, reload]);

  function resetForm() { setUraian(""); setTd(""); setNadi(""); setRr(""); setSuhu(""); setSpo2(""); setWaktu(nowLocal()); setEditKey(null); }
  function startEdit(c: EnakesCatatan) {
    setUraian(c.uraian ?? ""); setTd(c.td ?? ""); setNadi(c.nadi ?? ""); setRr(c.rr ?? ""); setSuhu(c.suhu ?? ""); setSpo2(c.spo2 ?? "");
    setWaktu(`${(c.tanggal ?? "").slice(0, 10)}T${(c.jam ?? "").slice(0, 5)}`);
    setEditKey({ t: c.tanggal ?? "", j: c.jam ?? "" }); setErr(""); setOpen(true);
  }
  async function simpan() {
    if (!uraian.trim()) { setErr("Uraian wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      await enakesCatatanSave({ no_rawat: noRawat, jenis, uraian, td, nadi, rr, suhu, spo2, waktu,
        edit: !!editKey, orig_tanggal: editKey?.t, orig_jam: editKey?.j });
      resetForm(); setOpen(false); setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan catatan"));
    } finally { setSaving(false); }
  }

  async function hapusCatatan(c: EnakesCatatan) {
    if (!window.confirm("Hapus catatan keperawatan ini?")) return;
    try {
      await enakesCatatanHapus({ no_rawat: noRawat, jenis, tanggal: c.tanggal ?? "", jam: c.jam ?? "" });
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }

  return (
    <div className="space-y-3">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="text-sm font-bold text-slate-800">{editKey ? "Ubah Catatan Keperawatan" : "Catatan Keperawatan Baru"}</div>
          <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tekanan Darah" value={td} onChange={setTd} placeholder="mmHg, cth 120/80" />
            <Field label="Nadi" value={nadi} onChange={setNadi} placeholder="x/menit" />
            <Field label="Respirasi (RR)" value={rr} onChange={setRr} placeholder="x/menit" />
            <Field label="Suhu" value={suhu} onChange={setSuhu} placeholder="°C" />
            <Field label="SpO₂" value={spo2} onChange={setSpo2} placeholder="%" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Uraian</label>
            <div className="relative">
              <textarea value={uraian} onChange={e => setUraian(e.target.value)} rows={4}
                placeholder="Tuliskan catatan/observasi keperawatan…"
                className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-rose-400" />
              <MicButton value={uraian} onChange={setUraian} className="absolute right-1 bottom-1" />
            </div>
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
            <button onClick={() => { setOpen(false); setErr(""); resetForm(); }}
              className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setOpen(true); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + Catatan Keperawatan Baru
        </button>
      )}

      {loading ? (
        <div className="text-center text-slate-400 text-sm py-10">Memuat…</div>
      ) : (list ?? []).length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-10">Belum ada catatan keperawatan.</div>
      ) : (
        (list ?? []).map((c, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{(c.tanggal ?? "").slice(0, 10)} {c.jam ? c.jam.slice(0, 5) : ""}</span>
              <span className="flex items-center gap-2">
                {c.petugas && <span className="text-rose-600 font-semibold truncate max-w-[40%] text-right">{c.petugas}</span>}
                {c.milik === 1 && <button onClick={() => startEdit(c)} className="text-emerald-600 hover:text-emerald-800 font-semibold">Edit</button>}
                {c.milik === 1 && <button onClick={() => hapusCatatan(c)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            {(c.td || c.nadi || c.rr || c.suhu || c.spo2) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.td && <VitalChip label="TD" value={c.td} />}
                {c.nadi && <VitalChip label="Nadi" value={c.nadi} />}
                {c.rr && <VitalChip label="RR" value={c.rr} />}
                {c.suhu && <VitalChip label="Suhu" value={c.suhu} />}
                {c.spo2 && <VitalChip label="SpO₂" value={c.spo2} />}
              </div>
            )}
            <div className="mt-1.5 text-sm text-slate-700 whitespace-pre-wrap">{c.uraian}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Resume Keperawatan (adopsi RMDataResumeKeperawatan Khanza) ───────────────
// Satu resume per kunjungan (no_rawat) — upsert. Dokter PJ terisi otomatis.
function ResumeKeperawatanTab({ noRawat }: { noRawat: string }) {
  const [data, setData] = useState<EnakesResumeKep | null>(null);
  const [loading, setLoading] = useState(true);
  const [diagnosaAwal, setDiagnosaAwal] = useState("");
  const [alasan, setAlasan] = useState("");
  const [masalah, setMasalah] = useState("");
  const [tindakan, setTindakan] = useState("");
  const [alihRawat, setAlihRawat] = useState("");
  const [evaluasi, setEvaluasi] = useState("");
  const [nasihat, setNasihat] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    enakesResumeKepGet(noRawat)
      .then(r => {
        const d = r.data;
        setData(d);
        if (d) {
          setDiagnosaAwal(d.diagnosa_awal); setAlasan(d.alasan); setMasalah(d.masalah_perawatan);
          setTindakan(d.tindakan); setAlihRawat(d.alih_rawat); setEvaluasi(d.evaluasi); setNasihat(d.nasihat);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [noRawat]);

  async function simpan() {
    if (!diagnosaAwal.trim()) { setErr("Diagnosa awal wajib diisi"); return; }
    setSaving(true); setErr(""); setOkMsg("");
    try {
      await enakesResumeKepSave({
        no_rawat: noRawat, diagnosa_awal: diagnosaAwal, alasan, masalah_perawatan: masalah,
        tindakan, alih_rawat: alihRawat, evaluasi, nasihat,
      });
      setOkMsg("Resume keperawatan tersimpan.");
      const r = await enakesResumeKepGet(noRawat);
      setData(r.data);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan resume"));
    } finally { setSaving(false); }
  }

  async function hapus() {
    if (!window.confirm("Hapus resume keperawatan ini?")) return;
    setErr(""); setOkMsg("");
    try {
      await enakesResumeKepHapus({ no_rawat: noRawat });
      setData(null);
      setDiagnosaAwal(""); setAlasan(""); setMasalah(""); setTindakan(""); setAlihRawat(""); setEvaluasi(""); setNasihat("");
      setOkMsg("Resume dihapus.");
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }

  if (loading) return <div className="text-center text-slate-400 text-sm py-10">Memuat…</div>;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-800">Resume Keperawatan</div>
          {data?.nm_dokter && <div className="text-[11px] text-slate-500">DPJP: <span className="font-semibold text-slate-700">{data.nm_dokter}</span></div>}
        </div>
        <Field label="Diagnosa Awal" value={diagnosaAwal} onChange={setDiagnosaAwal} placeholder="Diagnosa masuk" />
        <Field label="Alasan Masuk / Dirawat" value={alasan} onChange={setAlasan} placeholder="Alasan pasien dirawat" />
        <ResumeArea label="Masalah Keperawatan" value={masalah} onChange={setMasalah} />
        <ResumeArea label="Tindakan Keperawatan" value={tindakan} onChange={setTindakan} />
        <ResumeArea label="Alih Rawat / Rencana Tindak Lanjut" value={alihRawat} onChange={setAlihRawat} />
        <ResumeArea label="Evaluasi" value={evaluasi} onChange={setEvaluasi} />
        <ResumeArea label="Nasihat / Anjuran" value={nasihat} onChange={setNasihat} />
        {err && <div className="text-xs text-red-600">{err}</div>}
        {okMsg && <div className="text-xs text-emerald-600">{okMsg}</div>}
        {data?.petugas && <div className="text-[11px] text-slate-400">Tersimpan oleh: {data.petugas}</div>}
        <div className="flex gap-2">
          <button onClick={simpan} disabled={saving}
            className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
            {saving ? "Menyimpan…" : data ? "Perbarui Resume" : "Simpan Resume"}
          </button>
          {data && <button onClick={hapus} disabled={saving}
            className="px-4 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg py-2">
            Hapus
          </button>}
        </div>
      </div>
    </div>
  );
}

function ResumeArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
          className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-rose-400" />
        <MicButton value={value} onChange={onChange} className="absolute right-1 bottom-1" />
      </div>
    </div>
  );
}

// ── Checklist Kriteria Masuk/Keluar ICU/NICU/PICU (adopsi RMChecklistKriteria*) ─
type KriteriaItem = { col: string; label: string };
type KriteriaSchema = {
  sections: { title: string; items: KriteriaItem[] }[];
  keputusan?: { col: string; label: string; options: string[] };
  keterangan?: { col: string; label: string };
};
const KRITERIA_SCHEMAS: Record<string, KriteriaSchema> = {
  masuk_icu: {
    sections: [
      { title: "I. Prioritas 1", items: [
        { col: "prioritas1_1", label: "Pasca Operasi Dengan Gangguan Nafas Atau Hipotensi" },
        { col: "prioritas1_2", label: "Gagal Nafas" },
        { col: "prioritas1_3", label: "Gagal Jantung Dengan Tanda Bendungan Paru" },
        { col: "prioritas1_4", label: "Gangguan Asam Basa / Elektrolit" },
        { col: "prioritas1_5", label: "Gagal Ginjal Dengan Tanda Bendungan Paru" },
        { col: "prioritas1_6", label: "Syok Karena Perdarahan Anafilaksis" } ] },
      { title: "II. Prioritas 2", items: [
        { col: "prioritas2_1", label: "Pasca Operasi Besar" },
        { col: "prioritas2_2", label: "Kejang Berulang" },
        { col: "prioritas2_3", label: "Gangguan Kesadaran" },
        { col: "prioritas2_4", label: "Dehidrasi Berat" },
        { col: "prioritas2_5", label: "Gangguan Jalan Nafas" },
        { col: "prioritas2_6", label: "Aritmia Jantung" },
        { col: "prioritas2_7", label: "Asma Akut Berat" },
        { col: "prioritas2_8", label: "Diabetes Yang Memerlukan Terapi Insulin Kontinyu" } ] },
      { title: "III. Prioritas 3", items: [
        { col: "prioritas3_1", label: "Penyakit Keganasan Dengan Metastasis" },
        { col: "prioritas3_2", label: "Pasien Geriatrik Dengan Fungsi Hidup Sebelumnya Minimal" },
        { col: "prioritas3_3", label: "Pasien Dengan GCS 3" },
        { col: "prioritas3_4", label: "Pasien Jantung, Penyakit Paru Terminal Disertai Komplikasi Penyakit Akut Berat" } ] },
      { title: "IV. Kriteria Fisiologis — Tanda Vital", items: [
        { col: "kriteria_fisiologis_tanda_vital_1", label: "Nadi < 40 atau > 150 (x/menit)" },
        { col: "kriteria_fisiologis_tanda_vital_2", label: "SBP < 80 mmHg Atau 20 mmHg Di Bawah SBP Pasien" },
        { col: "kriteria_fisiologis_tanda_vital_3", label: "MAP < 60 mmHg" },
        { col: "kriteria_fisiologis_tanda_vital_4", label: "DBP > 120 mmHg" },
        { col: "kriteria_fisiologis_tanda_vital_5", label: "R > 35 x/menit" } ] },
      { title: "V. Kriteria Fisiologis — Laboratorium", items: [
        { col: "kriteria_fisiologis_laborat_1", label: "Na < 110 meq/L Atau > 170 meq/L" },
        { col: "kriteria_fisiologis_laborat_2", label: "Ca > 15 mg/dl" },
        { col: "kriteria_fisiologis_laborat_3", label: "GDS > 800 mg/dl" },
        { col: "kriteria_fisiologis_laborat_4", label: "K < 2 meq/L Atau 7 meq/L" },
        { col: "kriteria_fisiologis_laborat_5", label: "PaO2 < 50 mmHg" },
        { col: "kriteria_fisiologis_laborat_6", label: "PH < 7,1 Atau 7,7" } ] },
      { title: "VI. Kriteria Fisiologis — Radiologi", items: [
        { col: "kriteria_fisiologis_radiologi_1", label: "Perdarahan Cerebrovaskuler, SAH, Atau Contusion Dengan Gangguan Kesadaran Atau Neurologi" },
        { col: "kriteria_fisiologis_radiologi_2", label: "Ruptur Organ Dalam, Kandung Kemih, Hati, Varices Esophagus Atau Uterus Dengan Gangguan Hemodinamik" } ] },
      { title: "VII. Kriteria Fisiologis — Klinis", items: [
        { col: "kriteria_fisiologis_klinis_1", label: "Pupil Anisokor" },
        { col: "kriteria_fisiologis_klinis_2", label: "Obstruksi Jalan Nafas" },
        { col: "kriteria_fisiologis_klinis_3", label: "Anuria" },
        { col: "kriteria_fisiologis_klinis_4", label: "Kejang Berulang" },
        { col: "kriteria_fisiologis_klinis_5", label: "Tamponade Jantung" },
        { col: "kriteria_fisiologis_klinis_6", label: "Coma" },
        { col: "kriteria_fisiologis_klinis_7", label: "Sianosis" },
        { col: "kriteria_fisiologis_klinis_8", label: "Luka Bakar > 10 % BSA" } ] },
    ],
  },
  keluar_icu: {
    sections: [
      { title: "Tanda Vital Dan Kondisi Fisiologi", items: [
        { col: "kriteria1", label: "Denyut Jantung" },
        { col: "kriteria2", label: "Systolic Arterial Pressure" },
        { col: "kriteria3", label: "Laju Pernafasan (tidak ada obstruksi jalan nafas)" },
        { col: "kriteria4", label: "Produksi Urin > 0.5 ml/kgBB" },
        { col: "kriteria5", label: "GCS > 10 atau pasien GCS > 8 dengan nafas spontan" },
        { col: "kriteria6", label: "Topangan Inotropik atau vasopressor intravena dan vasodilator tidak diperlukan lagi" },
        { col: "kriteria7", label: "Disritmia jantung teratasi" },
        { col: "kriteria8", label: "Kondisi Neurologis Stabil" } ] },
      { title: "Laboratorium", items: [
        { col: "kriteria9", label: "PaO2 > 60 mmHg atau SaO2 > 90%" },
        { col: "kriteria10", label: "FiO2 < 0.50 tanpa peningkatan kebutuhan FiO2" },
        { col: "kriteria11", label: "PaCo2 < 65 mmHg dan pH 7,1-7,7 dengan Hemodinamik stabil" } ] },
    ],
  },
  masuk_nicu: {
    sections: [
      { title: "I. Respirasi", items: [
        { col: "respirasi1", label: "Distres Napas Berat (Grunting, Retraksi, Takipnea > 70x/menit)" },
        { col: "respirasi2", label: "Apnea Berulang / Apnea Dengan Bradikardia" },
        { col: "respirasi3", label: "Kebutuhan CPAP Atau Ventilasi Mekanik" },
        { col: "respirasi4", label: "Saturasi O₂ < 90% Dengan Oksigen Suplementasi" } ] },
      { title: "II. Prematuritas & Berat Badan", items: [
        { col: "prematur1", label: "Berat Lahir < 2000 g (Khususnya < 1500 g : VLBW)" },
        { col: "prematur2", label: "Usia Kehamilan < 35 minggu (Khususnya < 32 minggu)" },
        { col: "prematur3", label: "Hipotermia (< 36°C) Yang Tidak Membaik Dengan Penghangatan Biasa" } ] },
      { title: "III. Kondisi Kardiovaskular", items: [
        { col: "kardio1", label: "Syok Refrakter Resusitasi Awal" },
        { col: "kardio2", label: "Bradikardia Berat (< 80x/menit)" },
        { col: "kardio3", label: "Sianosis Sentral Menetap" } ] },
      { title: "IV. Neurologi", items: [
        { col: "neuro1", label: "Kejang" },
        { col: "neuro2", label: "GCS / Kesadaran Bayi Sangat Rendah" },
        { col: "neuro3", label: "Ensefalopati Hipoksik Iskemik Sedang–Berat" } ] },
      { title: "V. Metabolik & Infeksi", items: [
        { col: "metabolik1", label: "Hipoglikemia (< 40 mg/dL) Atau Hiperglikemia Berat" },
        { col: "metabolik2", label: "Dugaan Atau Terkonfirmasi Sepsis Neonatal" },
        { col: "metabolik3", label: "Asidosis Metabolik Berat (pH < 7,2)" } ] },
      { title: "VI. Kondisi Lain", items: [
        { col: "kondisilain1", label: "Kelainan Kongenital Berat Memerlukan Stabilisasi Intensif" },
        { col: "kondisilain2", label: "Dari Ibu Dengan Riwayat Komplikasi Perinatal Berat" },
        { col: "kondisilain3", label: "Pasca Operasi Besar Neonatus" },
        { col: "kondisilain4", label: "Ikterus Berat Memerlukan Fototerapi Intensif Atau Transfusi Tukar" } ] },
    ],
    keputusan: { col: "keputusan", label: "Keputusan", options: ["Diterima Di NICU", "Tidak Diterima - Dirawat Di Ruang Perawatan Bayi Lain"] },
    keterangan: { col: "keterangan", label: "Keterangan / Catatan" },
  },
  keluar_nicu: {
    sections: [
      { title: "I. Respirasi", items: [
        { col: "respirasi1", label: "Tidak Memerlukan Ventilasi Mekanik Atau CPAP" },
        { col: "respirasi2", label: "Saturasi O₂ ≥ 90% Tanpa Oksigen Tambahan" },
        { col: "respirasi3", label: "Tidak Ada Apnea Atau Bradikardia Dalam 5–7 Hari Terakhir" } ] },
      { title: "II. Kardiovaskular", items: [
        { col: "kardio1", label: "Tekanan Darah Stabil Sesuai Usia" },
        { col: "kardio2", label: "Tidak Ada Episode Syok Dalam 5 Hari Terakhir" } ] },
      { title: "III. Nutrisi", items: [
        { col: "nutrisi1", label: "Asupan Oral Penuh (ASI/PMK) Tanpa Distress" },
        { col: "nutrisi2", label: "Tidak Memerlukan Nutrisi Parenteral" },
        { col: "nutrisi3", label: "Berat Badan Stabil / Meningkat ≥ 15 g/Kg/Hari" } ] },
      { title: "IV. Suhu Tubuh", items: [
        { col: "suhutubuh1", label: "Suhu Stabil (36,5–37,5°C) Di Ruang / Inkubator Terbuka" },
        { col: "suhutubuh2", label: "Tidak Ada Episode Hipotermia / Hipertermia 3 Hari Terakhir" } ] },
      { title: "V. Infeksi & Monitoring", items: [
        { col: "infeksi1", label: "Tidak Memerlukan Monitoring Invasif" },
        { col: "infeksi2", label: "Semua Terapi / Tindakan Invasif Telah Selesai" },
        { col: "infeksi3", label: "Tidak Ada Tanda Infeksi Aktif" } ] },
    ],
    keputusan: { col: "keputusan", label: "Keputusan", options: ["Layak Dipindahkan Ke Ruang Rawat Bayi/Rawat Gabung", "Layak Pulang", "Tetap Di NICU"] },
    keterangan: { col: "keterangan", label: "Keterangan / Catatan" },
  },
  masuk_picu: {
    sections: [
      { title: "Kriteria Umum", items: [
        { col: "kriteriaumum1", label: "Membutuhkan Monitoring & Terapi Intensif Secara Berkelanjutan" },
        { col: "kriteriaumum2", label: "Membutuhkan Dukungan ≥ 1 Organ Vital" },
        { col: "kriteriaumum3", label: "Pasien Dengan Kondisi Mengancam Jiwa Yang Masih Berpotensi Reversibel" } ] },
      { title: "Respirasi", items: [
        { col: "respirasi1", label: "Gagal Napas Akut (Misal: ARDS, Status Asmatikus)" },
        { col: "respirasi2", label: "Hipoksemia Berat (PaO₂ < 60 mmHg Dengan FiO₂ > 0,6)" },
        { col: "respirasi3", label: "Butuh Ventilasi Mekanik Invasif / Non-invasif" },
        { col: "respirasi4", label: "Hiperkarbia Berat (PaCO₂ > 60 mmHg Dengan pH < 7,25)" } ] },
      { title: "Kardiovaskular", items: [
        { col: "kardio1", label: "Syok Refrakter (Septik, Kardiogenik, Hipovolemik, Anafilaksis)" },
        { col: "kardio2", label: "Gagal Jantung Berat" },
        { col: "kardio3", label: "Gangguan Irama Jantung Yang Mengancam Nyawa" },
        { col: "kardio4", label: "Pasca Resusitasi Jantung Paru" } ] },
      { title: "Neurologi", items: [
        { col: "neuro1", label: "Trauma Kepala Berat Dengan Gangguan Hemodinamik / Napas" },
        { col: "neuro2", label: "Kejang Berulang / Status Epileptikus" },
        { col: "neuro3", label: "Penurunan Kesadaran (GCS ≤ 8 Atau Koma)" },
        { col: "neuro4", label: "Edema Serebri, Perdarahan Intrakranial" } ] },
      { title: "Bedah / Pasca Operasi", items: [
        { col: "bedah1", label: "Pasca Operasi Mayor Dengan Risiko Komplikasi Tinggi" },
        { col: "bedah2", label: "Pasca Transplantasi Organ" },
        { col: "bedah3", label: "Pasca Operasi Jantung / Thoraks Kompleks" } ] },
      { title: "Lain-lain", items: [
        { col: "kondisilain1", label: "Gangguan Metabolik / Elektrolit Yang Mengancam Jiwa" },
        { col: "kondisilain2", label: "Intoksikasi Berat" },
        { col: "kondisilain3", label: "Sepsis Berat Dengan Disfungsi Organ Multipel" } ] },
    ],
    keputusan: { col: "keputusan", label: "Keputusan", options: ["Diterima Di PICU", "Tidak Diterima - Dirawat Di Ruang Lain"] },
    keterangan: { col: "keterangan", label: "Keterangan / Catatan" },
  },
  keluar_picu: {
    sections: [
      { title: "Kondisi Klinis", items: [
        { col: "kondisiklinis1", label: "Tidak Ada Tanda Gagal Napas Akut" },
        { col: "kondisiklinis2", label: "Saturasi O₂ Stabil Tanpa Ventilator Mekanik Atau O₂ Nasal < 2 L/menit" },
        { col: "kondisiklinis3", label: "Status Kesadaran Stabil (Sesuai Baseline, GCS ≥ 13 / Tidak Ada Penurunan Akut)" },
        { col: "kondisiklinis4", label: "Tidak Ada Perdarahan Aktif / Syok" },
        { col: "kondisiklinis5", label: "Tidak Membutuhkan Vasopressor / Inotropik" },
        { col: "kondisiklinis6", label: "Tanda Vital Stabil (HR, RR, Nadi, TD, Suhu)" } ] },
      { title: "Kebutuhan Perawatan", items: [
        { col: "kebutuhanperawatan1", label: "Tidak Lagi Membutuhkan Monitoring Invasif" },
        { col: "kebutuhanperawatan2", label: "Tidak Membutuhkan Terapi Intensif Berkelanjutan" },
        { col: "kebutuhanperawatan3", label: "Nyeri Terkontrol" },
        { col: "kebutuhanperawatan4", label: "Kebutuhan Cairan & Nutrisi Dapat Dipenuhi Secara Oral / Enteral / IV Standar" } ] },
      { title: "Rencana Tindak Lanjut", items: [
        { col: "tindaklanjut1", label: "Rencana Kontrol / Tindakan Lanjutan Tercatat" },
        { col: "tindaklanjut2", label: "Orang Tua / Wali Mendapat Edukasi Kondisi & Rencana Perawatan" },
        { col: "tindaklanjut3", label: "Konsultasi Dengan Tim Terkait Sudah Dilakukan" },
        { col: "tindaklanjut4", label: "Rencana Terapi Jelas Untuk Rawat Ruang Biasa" } ] },
    ],
    keputusan: { col: "keputusan", label: "Keputusan", options: ["Layak Keluar Dari PICU/Pindah Ke Ruang Rawat Biasa", "Tidak Layak Keluar/Tetap Dirawat Di PICU"] },
    keterangan: { col: "keterangan", label: "Keterangan / Catatan" },
  },
};

function YaTidak({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex shrink-0 rounded-lg overflow-hidden border border-slate-300">
      {["Ya", "Tidak"].map(o => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-3 py-1 text-xs font-semibold transition-colors ${value === o ? (o === "Ya" ? "bg-rose-600 text-white" : "bg-slate-500 text-white") : "bg-white text-slate-500"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function ChecklistKriteriaTab({ noRawat, form }: { noRawat: string; form: string }) {
  const schema = KRITERIA_SCHEMAS[form];
  const [values, setValues] = useState<Record<string, string>>({});
  const [petugas, setPetugas] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    if (!schema) { setLoading(false); return; }
    setLoading(true);
    enakesKriteriaGet(form, noRawat)
      .then(r => {
        if (r.data && r.data.values && Object.keys(r.data.values).length) {
          setValues(r.data.values); setPetugas(r.data.petugas || "");
        } else {
          const init: Record<string, string> = {};
          schema.sections.forEach(s => s.items.forEach(it => { init[it.col] = "Tidak"; }));
          if (schema.keputusan) init[schema.keputusan.col] = schema.keputusan.options[0];
          if (schema.keterangan) init[schema.keterangan.col] = "";
          setValues(init); setPetugas("");
        }
      })
      .catch(() => setValues({}))
      .finally(() => setLoading(false));
  }, [form, noRawat, schema]);

  function set(col: string, v: string) { setValues(prev => ({ ...prev, [col]: v })); }

  async function simpan() {
    setSaving(true); setErr(""); setOkMsg("");
    try {
      await enakesKriteriaSave({ form, no_rawat: noRawat, values });
      setOkMsg("Checklist tersimpan.");
      const r = await enakesKriteriaGet(form, noRawat);
      if (r.data) setPetugas(r.data.petugas || "");
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan checklist"));
    } finally { setSaving(false); }
  }

  async function hapus() {
    if (!window.confirm("Hapus checklist kriteria ini?")) return;
    setErr(""); setOkMsg("");
    try {
      await enakesKriteriaHapus({ form, no_rawat: noRawat });
      const init: Record<string, string> = {};
      schema?.sections.forEach(s => s.items.forEach(it => { init[it.col] = "Tidak"; }));
      if (schema?.keputusan) init[schema.keputusan.col] = schema.keputusan.options[0];
      if (schema?.keterangan) init[schema.keterangan.col] = "";
      setValues(init); setPetugas(""); setOkMsg("Checklist dihapus.");
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }

  if (!schema) return <div className="text-center text-slate-400 text-sm py-10">Form tidak dikenal.</div>;
  if (loading) return <div className="text-center text-slate-400 text-sm py-10">Memuat…</div>;
  const kp = schema.keputusan; const kt = schema.keterangan;

  return (
    <div className="space-y-3">
      {schema.sections.map(sec => (
        <div key={sec.title} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide mb-2">{sec.title}</div>
          <div className="space-y-2.5">
            {sec.items.map(it => (
              <div key={it.col} className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-700 flex-1">{it.label}</span>
                <YaTidak value={values[it.col] ?? "Tidak"} onChange={v => set(it.col, v)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {kp && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{kp.label}</label>
          <select value={values[kp.col] ?? kp.options[0]} onChange={e => set(kp.col, e.target.value)}
            className="w-full mt-1 rounded-lg border border-slate-300 text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400">
            {kp.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )}
      {kt && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{kt.label}</label>
          <input value={values[kt.col] ?? ""} onChange={e => set(kt.col, e.target.value)} maxLength={50}
            className="w-full mt-1 rounded-lg border border-slate-300 text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400" />
        </div>
      )}
      {err && <div className="text-xs text-red-600">{err}</div>}
      {okMsg && <div className="text-xs text-emerald-600">{okMsg}</div>}
      {petugas && <div className="text-[11px] text-slate-400">Tersimpan oleh: {petugas}</div>}
      <div className="flex gap-2">
        <button onClick={simpan} disabled={saving}
          className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5 shadow-sm">
          {saving ? "Menyimpan…" : "Simpan Checklist"}
        </button>
        {petugas && <button onClick={hapus} disabled={saving}
          className="px-4 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg py-2.5">
          Hapus
        </button>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
    </div>
  );
}

function VitalChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[11px]">
      <span className="text-rose-500 font-semibold">{label}</span>
      <span className="text-slate-700">{value}</span>
    </span>
  );
}

// ── Grafik TTV — tren tanda vital dari input SOAPIE (pemeriksaan_ralan/ranap) ──
type TtvPt = { t: string; v: number };
function toNum(s: string): number | null {
  const v = parseFloat((s || "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return isFinite(v) ? v : null;
}
function TtvTab({ noRawat, jenis }: { noRawat: string; jenis: string }) {
  const [data, setData] = useState<EnakesTtv[] | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    enakesTtv(noRawat, jenis).then(r => setData(r.data)).catch(() => setData([])).finally(() => setLoading(false));
  }, [noRawat, jenis]);

  if (loading) return <div className="text-center text-slate-400 text-sm py-10">Memuat…</div>;
  const rows = data ?? [];
  if (rows.length === 0)
    return <div className="text-center text-slate-400 text-sm py-10">Belum ada data tanda vital dari SOAPIE.</div>;

  const pick = (sel: (r: EnakesTtv) => number | null): TtvPt[] =>
    rows.map(r => ({ t: r.waktu, v: sel(r) })).filter(p => p.v !== null) as TtvPt[];
  const sistol = pick(r => (r.tensi.includes("/") ? toNum(r.tensi.split("/")[0]) : toNum(r.tensi)));
  const diastol = pick(r => (r.tensi.includes("/") ? toNum(r.tensi.split("/")[1]) : null));
  const nadi = pick(r => toNum(r.nadi));
  const resp = pick(r => toNum(r.respirasi));
  const suhu = pick(r => toNum(r.suhu));
  const spo2 = pick(r => toNum(r.spo2));

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-400">Sumber: input SOAPIE · {rows.length} pencatatan · {labelJenis(jenis)}</div>
      {(sistol.length > 0 || diastol.length > 0) && (
        <TtvChart title="Tekanan Darah" unit="mmHg"
          series={[{ name: "Sistol", color: "#e11d48", points: sistol }, { name: "Diastol", color: "#f59e0b", points: diastol }]} />
      )}
      {nadi.length > 0 && <TtvChart title="Nadi" unit="x/mnt" series={[{ name: "Nadi", color: "#dc2626", points: nadi }]} />}
      {resp.length > 0 && <TtvChart title="Respirasi" unit="x/mnt" series={[{ name: "RR", color: "#0891b2", points: resp }]} />}
      {suhu.length > 0 && <TtvChart title="Suhu" unit="°C" series={[{ name: "Suhu", color: "#ea580c", points: suhu }]} />}
      {spo2.length > 0 && <TtvChart title="SpO₂" unit="%" series={[{ name: "SpO2", color: "#7c3aed", points: spo2 }]} />}
    </div>
  );
}

function TtvChart({ title, unit, series }: {
  title: string; unit: string; series: { name: string; color: string; points: TtvPt[] }[];
}) {
  const W = 320, H = 132, padL = 26, padR = 8, padT = 16, padB = 20;
  const all = series.flatMap(s => s.points.map(p => p.v));
  if (all.length === 0) return null;
  let min = Math.min(...all), max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const gap = (max - min) * 0.15; min -= gap; max += gap;
  const yy = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const xx = (i: number, n: number) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR));
  const longest = series.reduce((a, b) => (b.points.length > a.points.length ? b : a), series[0]);
  const firstT = longest.points[0]?.t ?? "", lastT = longest.points[longest.points.length - 1]?.t ?? "";
  const grid = [max, (min + max) / 2, min];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="text-sm font-bold text-slate-800">{title} <span className="text-xs font-normal text-slate-400">({unit})</span></div>
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 justify-end">
          {series.filter(s => s.points.length > 0).map(s => (
            <span key={s.name} className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <span style={{ background: s.color }} className="w-2.5 h-2.5 rounded-full inline-block" />
              {s.name} <b className="text-slate-700 tabular-nums">{s.points[s.points.length - 1].v}</b>
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 132 }} preserveAspectRatio="none">
        {grid.map((gv, i) => (
          <g key={i}>
            <line x1={padL} y1={yy(gv)} x2={W - padR} y2={yy(gv)} stroke="#eef2f6" strokeWidth={1} />
            <text x={padL - 3} y={yy(gv) + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{Math.round(gv)}</text>
          </g>
        ))}
        {series.map(s => {
          if (s.points.length === 0) return null;
          const n = s.points.length;
          const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${xx(i, n).toFixed(1)},${yy(p.v).toFixed(1)}`).join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, i) => (
                <circle key={i} cx={xx(i, n)} cy={yy(p.v)} r={i === n - 1 ? 2.6 : 1.5} fill={s.color} />
              ))}
            </g>
          );
        })}
        <text x={padL} y={H - 5} fontSize={8} fill="#94a3b8" textAnchor="start">{firstT.slice(5)}</text>
        {lastT !== firstT && <text x={W - padR} y={H - 5} fontSize={8} fill="#94a3b8" textAnchor="end">{lastT.slice(5)}</text>}
      </svg>
    </div>
  );
}

// ── Risiko Jatuh (adopsi form RM Khanza; skor code-exact) ────────────────────
type JOpt = { t: string; n: number; v?: string };   // v = string enum DB bila beda dari label
type JKomp = { label: string; opsi: JOpt[] };
type ScoredDef = {
  key: string; nama: string; komponen: JKomp[];
  total?: (n: number[]) => number;
  ambang: (t: number) => { hasil: string; saran: string };
};
const SARAN_STD = "Intervensi pencegahan risiko jatuh standar";
const SARAN_TINGGI = "Intervensi standar + intervensi risiko jatuh tinggi";

const MORSE_DEF: ScoredDef = {
  key: "morse", nama: "Morse — Dewasa",
  komponen: [
    { label: "1. Riwayat jatuh (1 tahun terakhir)", opsi: [{ t: "Tidak", n: 0 }, { t: "Ya", n: 25 }] },
    { label: "2. Diagnosis sekunder (≥ 2 diagnosis medis)", opsi: [{ t: "Tidak", n: 0 }, { t: "Ya", n: 15 }] },
    { label: "3. Alat bantu", opsi: [
      { t: "Tidak ada / kursi roda / perawat / tirah baring", v: "Tidak Ada/Kursi Roda/Perawat/Tirah Baring", n: 0 },
      { t: "Tongkat / alat penopang", v: "Tongkat/Alat Penopang", n: 15 },
      { t: "Berpegangan pada perabot", v: "Berpegangan Pada Perabot", n: 30 }] },
    { label: "4. Terpasang infus", opsi: [{ t: "Tidak", n: 0 }, { t: "Ya", n: 20 }] },
    { label: "5. Gaya berjalan", opsi: [
      { t: "Normal / tirah baring / imobilisasi", v: "Normal/Tirah Baring/Imobilisasi", n: 0 },
      { t: "Lemah", n: 10 }, { t: "Terganggu", n: 20 }] },
    { label: "6. Status mental", opsi: [
      { t: "Sadar akan kemampuan diri sendiri", v: "Sadar Akan Kemampuan Diri Sendiri", n: 0 },
      { t: "Sering lupa akan keterbatasan yang dimiliki", v: "Sering Lupa Akan Keterbatasan Yang Dimiliki", n: 15 }] },
  ],
  ambang: t => t < 25 ? { hasil: "Risiko Rendah (0-24)", saran: SARAN_STD }
    : t < 45 ? { hasil: "Risiko Sedang (25-44)", saran: SARAN_STD }
    : { hasil: "Risiko Tinggi (≥45)", saran: SARAN_TINGGI },
};
const HUMPTY_DEF: ScoredDef = {
  key: "humpty", nama: "Humpty Dumpty — Anak",
  komponen: [
    { label: "1. Umur", opsi: [
      { t: "0 - 3 tahun", v: "0 - 3 Tahun", n: 4 }, { t: "3 - 7 tahun", v: "3 - 7 Tahun", n: 3 },
      { t: "7 - 13 tahun", v: "7 - 13 Tahun", n: 2 }, { t: "> 13 tahun", v: "> 13 Tahun", n: 1 }] },
    { label: "2. Jenis kelamin", opsi: [{ t: "Laki-laki", n: 2 }, { t: "Perempuan", n: 1 }] },
    { label: "3. Diagnosa", opsi: [
      { t: "Kelainan neurologi", v: "Kelainan Neurologi", n: 4 },
      { t: "Perubahan oksigenasi (nafas, dehidrasi, anemia, dll)", v: "Perubahan Dalam Oksigen(Masalah Saluran Nafas, Dehidrasi, Anemia, Anoreksia / Sakit Kepala, Dll)", n: 3 },
      { t: "Kelainan psikis / perilaku", v: "Kelainan Psikis / Perilaku", n: 2 },
      { t: "Diagnosa lain", v: "Diagnosa Lain", n: 1 }] },
    { label: "4. Gangguan kognitif", opsi: [
      { t: "Tidak sadar terhadap keterbatasan", v: "Tidak Sadar Terhadap Keterbatasan", n: 3 },
      { t: "Lupa keterbatasan", v: "Lupa Keterbatasan", n: 2 },
      { t: "Mengetahui kemampuan diri", v: "Mengetahui Kemampuan Diri", n: 1 }] },
    { label: "5. Faktor lingkungan", opsi: [
      { t: "Riwayat jatuh dari tempat tidur saat bayi/anak", v: "Riwayat Jatuh Dari Tempat Tidur Saat Bayi/Anak", n: 4 },
      { t: "Menggunakan alat bantu / box / mebel", v: "Pasien Menggunakan Alat Bantu/Box/Mebel", n: 3 },
      { t: "Berada di tempat tidur", v: "Pasien Berada Di Tempat Tidur", n: 2 },
      { t: "Di luar ruang rawat", v: "Di Luar Ruang Rawat", n: 1 }] },
    { label: "6. Respons operasi / sedasi / anestesi", opsi: [
      { t: "Dalam 24 jam", v: "Dalam 24 Jam", n: 3 }, { t: "Dalam 48 jam", v: "Dalam 48 Jam", n: 2 },
      { t: "> 48 jam", v: "> 48 Jam", n: 1 }] },
    { label: "7. Penggunaan obat", opsi: [
      { t: "Multipel (sedatif, hipnotik, barbiturat, antidepresan, diuretik, narkotik)", v: "Bermacam-macam Obat Yang Digunakan : Obat Sedative (Kecuali Pasien ICU Yang Menggunakan sedasi dan paralisis), Hipnotik, Barbiturat, Fenoti-Azin, Antidepresan, Laksans/Diuretika,Narkotik", n: 3 },
      { t: "Salah satu obat di atas", v: "Salah Satu Dari Pengobatan Di Atas", n: 2 },
      { t: "Pengobatan lain", v: "Pengobatan Lain", n: 1 }] },
  ],
  ambang: t => t >= 12 ? { hasil: "Risiko Tinggi (≥12)", saran: "Intervensi risiko jatuh tinggi (pasang gelang kuning)" }
    : { hasil: "Risiko Rendah (7-11)", saran: SARAN_STD },
};
const LANSIA_DEF: ScoredDef = {
  key: "lansia", nama: "Skala Lansia (Sydney)",
  komponen: [
    { label: "1. Riwayat jatuh", opsi: [
      { t: "Tidak", n: 0 }, { t: "Datang karena jatuh", v: "Pasien Datang Karena Jatuh", n: 6 },
      { t: "Jatuh dalam 2 bulan terakhir", v: "Pasien Jatuh Dalam 2 Bulan Terakhir", n: 6 }] },
    { label: "2. Status mental", opsi: [
      { t: "Tidak", n: 0 }, { t: "Delirium", v: "Pasien Delirium", n: 14 },
      { t: "Disorientasi", v: "Pasien Disorientasi", n: 14 }, { t: "Agitasi", v: "Pasien Agitasi", n: 14 }] },
    { label: "3. Penglihatan", opsi: [
      { t: "Tidak", n: 0 }, { t: "Memakai kaca mata", v: "Memakai Kaca Mata", n: 1 },
      { t: "Penglihatan kabur", v: "Penglihatan Kabur", n: 1 },
      { t: "Glukoma / katarak / degenerasi makula", v: "Memiliki Glukoma/Katarak/Degenerasi Makula", n: 1 }] },
    { label: "4. Kebiasaan berkemih", opsi: [
      { t: "Tidak", n: 0 },
      { t: "Perubahan berkemih (frekuensi/urgensi/inkontinensia/nokturia)", v: "Prilaku Berkemih/Frekuensi/Urgensi/Incontinensia/Nokturia", n: 2 }] },
    { label: "5. Transfer", opsi: [
      { t: "Mandiri", n: 0 }, { t: "Bantuan 1 orang / pengawasan", v: "Memerlukan Bantuan 1 Orang/Pengawasan", n: 1 },
      { t: "Bantuan 2 orang", v: "Memerlukan Bantuan 2 Orang", n: 2 }, { t: "Bantuan total", v: "Memerlukan Bantuan Total", n: 3 }] },
    { label: "6. Mobilitas", opsi: [
      { t: "Mandiri", n: 0 }, { t: "Berjalan dengan bantuan 1 orang", v: "Berjalan Dengan Bantuan 1 Orang", n: 1 },
      { t: "Menggunakan kursi roda", v: "Menggunakan Kursi Roda", n: 2 }, { t: "Imobilisasi", n: 3 }] },
  ],
  total: n => n[0] + n[1] + n[2] + n[3] + ((n[4] + n[5]) <= 3 ? 0 : 7),
  ambang: t => t < 6 ? { hasil: "Risiko Rendah (0-5)", saran: SARAN_STD }
    : t < 17 ? { hasil: "Risiko Sedang (6-16)", saran: SARAN_STD }
    : { hasil: "Risiko Tinggi (≥17)", saran: SARAN_TINGGI },
};
const GERIATRI_DEF: ScoredDef = {
  key: "geriatri", nama: "Geriatri (Ontario)",
  komponen: [
    ["1. Gangguan gaya berjalan (diseret, menghentak, berayun)", 4],
    ["2. Pusing / pingsan pada posisi tegak", 3],
    ["3. Kebingungan setiap saat", 3],
    ["4. Nokturia / inkontinen", 3],
    ["5. Kebingungan intermiten", 2],
    ["6. Kelemahan umum", 2],
    ["7. Obat berisiko tinggi (diuretik, narkotik, sedatif, antipsikotik, dll)", 2],
    ["8. Riwayat jatuh dalam 12 bulan", 2],
    ["9. Osteoporosis", 1],
    ["10. Gangguan pendengaran / penglihatan", 1],
    ["11. Usia ≥ 70 tahun", 1],
  ].map(([label, ya]) => ({ label: label as string, opsi: [{ t: "Tidak", n: 0 }, { t: "Ya", n: ya as number }] })),
  ambang: t => t <= 3 ? { hasil: "Risiko Rendah (0-3)", saran: SARAN_STD }
    : { hasil: "Risiko Tinggi (≥4)", saran: SARAN_TINGGI },
};
const SCORED_DEFS: Record<string, ScoredDef> = { morse: MORSE_DEF, humpty: HUMPTY_DEF, lansia: LANSIA_DEF, geriatri: GERIATRI_DEF };
const NEO_INTERVENSI = [
  "Pasang gelang risiko jatuh", "Edukasi orang tua/keluarga", "Dekatkan box bayi dengan ibu",
  "Orientasi ruangan pada orang tua/keluarga", "Pastikan lantai & alas kaki tidak licin",
  "Pastikan selalu ada pendamping", "Bila dalam inkubator, pastikan semua jendela terkunci",
  "Kontrol rutin oleh perawat/bidan", "Pasang tanda risiko jatuh pada box/inkubator",
];
const NEO_EDUKASI = [
  "Tempatkan bayi pada tempat yang aman", "Segera istirahat bila lelah & tempatkan bayi pada boxnya",
  "Cara membedong bayi", "Libatkan keluarga mendampingi / segera panggil perawat bila perlu", "Teknik menggendong bayi",
];
const NEO_SASARAN = ["Bapak", "Ibu", "Keluarga", "Wali lainnya"];
const NEO_EVALUASI = ["Memahami & mampu menjelaskan kembali", "Perlu edukasi ulang", "Mampu mendemonstrasikan"];

function riskCls(h: string) {
  const s = h.toLowerCase();
  if (s.includes("tinggi")) return "bg-red-50 text-red-700 border-red-200";
  if (s.includes("sedang")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (s.includes("rendah") || s.includes("tidak berisiko")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

function JatuhTab({ noRawat, jenis }: { noRawat: string; jenis: string }) {
  const [instrumen, setInstrumen] = useState<string>(jenis === "ranap" ? "morse" : "getupgo");
  const [riwayat, setRiwayat] = useState<EnakesRiwayatJatuh[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    enakesJatuhRiwayat(noRawat).then(r => setRiwayat(r.data)).catch(() => setRiwayat([]));
  }, [noRawat, reload]);
  const onSaved = () => { setOpen(false); setReload(x => x + 1); };
  async function hapusJatuh(r: EnakesRiwayatJatuh) {
    if (!window.confirm(`Hapus asesmen risiko jatuh (${r.instrumen}) ini?`)) return;
    try {
      await enakesJatuhHapus({ no_rawat: noRawat, tanggal: r.tanggal ?? "", instrumen: r.instrumen });
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }
  const OPSI = [
    ["getupgo", "Get Up & Go (skrining RJ/IGD)"], ["morse", "Morse — Dewasa"],
    ["humpty", "Humpty Dumpty — Anak"], ["lansia", "Skala Lansia (Sydney)"],
    ["geriatri", "Geriatri (Ontario)"], ["neonatus", "Neonatus (checklist)"],
  ];
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Instrumen asesmen</label>
        <select value={instrumen} onChange={e => { setInstrumen(e.target.value); setOpen(false); }}
          className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400">
          {OPSI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {!open && (
          <button onClick={() => setOpen(true)}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg py-2 mt-1">
            + Isi Asesmen
          </button>
        )}
      </div>

      {open && (
        instrumen === "getupgo" ? <GetUpGoForm noRawat={noRawat} onSaved={onSaved} onCancel={() => setOpen(false)} />
        : instrumen === "neonatus" ? <NeonatusForm noRawat={noRawat} onSaved={onSaved} onCancel={() => setOpen(false)} />
        : <ScoredForm def={SCORED_DEFS[instrumen]} noRawat={noRawat} onSaved={onSaved} onCancel={() => setOpen(false)} />
      )}

      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-1">Riwayat Asesmen</div>
      {riwayat === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : riwayat.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada asesmen risiko jatuh.</div>
      ) : (
        riwayat.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-800">{r.instrumen}</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {(r.tanggal ?? "").slice(0, 16)}
                {r.milik === 1 && <button onClick={() => hapusJatuh(r)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {r.ringkas && <span className="text-xs text-slate-500">{r.ringkas}</span>}
              {r.hasil && <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${riskCls(r.hasil)}`}>{r.hasil}</span>}
            </div>
            {r.petugas && <div className="mt-1 text-[11px] text-rose-600">{r.petugas}</div>}
          </div>
        ))
      )}
    </div>
  );
}

function ScoredForm({ def, noRawat, onSaved, onCancel }: { def: ScoredDef; noRawat: string; onSaved: () => void; onCancel: () => void }) {
  const [sel, setSel] = useState<number[]>(def.komponen.map(() => 0));
  const [saran, setSaran] = useState("");
  const [waktu, setWaktu] = useState(() => nowLocal());
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const nilai = def.komponen.map((k, i) => k.opsi[sel[i]].n);
  const total = def.total ? def.total(nilai) : nilai.reduce((a, b) => a + b, 0);
  const { hasil, saran: saranDefault } = def.ambang(total);
  useEffect(() => { if (!touched) setSaran(saranDefault); }, [saranDefault, touched]);

  async function simpan() {
    setSaving(true); setErr("");
    try {
      await enakesJatuhSave({
        no_rawat: noRawat, instrumen: def.key,
        skala: def.komponen.map((k, i) => k.opsi[sel[i]].v ?? k.opsi[sel[i]].t),
        nilai, total, hasil, saran, waktu,
      });
      onSaved();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan asesmen"));
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
      <div className="text-sm font-bold text-slate-800">{def.nama}</div>
      <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
      {def.komponen.map((k, i) => (
        <div key={i}>
          <label className="text-xs font-semibold text-slate-600">{k.label}</label>
          <select value={sel[i]} onChange={e => setSel(s => s.map((x, j) => (j === i ? +e.target.value : x)))}
            className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400">
            {k.opsi.map((o, oi) => <option key={oi} value={oi}>{o.t} ({o.n})</option>)}
          </select>
        </div>
      ))}
      <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${riskCls(hasil)}`}>
        <span className="text-sm font-semibold">Total: <span className="tabular-nums">{total}</span></span>
        <span className="text-sm font-bold">{hasil}</span>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Saran / rencana intervensi</label>
        <textarea value={saran} onChange={e => { setTouched(true); setSaran(e.target.value); }} rows={2}
          className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400" />
      </div>
      {err && <div className="text-xs text-red-600">{err}</div>}
      <div className="flex gap-2">
        <button onClick={simpan} disabled={saving}
          className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
          {saving ? "Menyimpan…" : "Simpan Asesmen"}
        </button>
        <button onClick={onCancel} className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
      </div>
    </div>
  );
}

function GetUpGoForm({ noRawat, onSaved, onCancel }: { noRawat: string; onSaved: () => void; onCancel: () => void }) {
  const [cara, setCara] = useState(false);
  const [menopang, setMenopang] = useState(false);
  const [ruangan, setRuangan] = useState("");
  const [namaKel, setNamaKel] = useState("");
  const [tindakan, setTindakan] = useState(true);
  const [waktu, setWaktu] = useState(() => nowLocal());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const hasil = cara && menopang ? "Risiko tinggi" : cara || menopang ? "Risiko rendah" : "Tidak berisiko";

  async function simpan() {
    setSaving(true); setErr("");
    try {
      await enakesJatuhSave({
        no_rawat: noRawat, instrumen: "getupgo",
        ruangan, cara_berjalan: cara ? "Ya" : "Tidak", menopang: menopang ? "Ya" : "Tidak",
        hasil_penilaian: hasil, tindakan_ya: tindakan ? "Ya" : "Tidak", nama_keluarga: namaKel, waktu,
      });
      onSaved();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan asesmen"));
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
      <div className="text-sm font-bold text-slate-800">Get Up &amp; Go (skrining)</div>
      <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
      <Field label="Ruangan" value={ruangan} onChange={setRuangan} placeholder="cth Poli Umum / IGD" />
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={cara} onChange={e => setCara(e.target.checked)} className="mt-1 accent-rose-600" />
        <span>Cara berjalan tidak seimbang/sempoyongan/limbung, atau memakai alat bantu (kruk, tripot, kursi roda, orang lain)</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={menopang} onChange={e => setMenopang(e.target.checked)} className="mt-1 accent-rose-600" />
        <span>Menopang / memegang pinggiran kursi/meja/benda lain saat akan duduk</span>
      </label>
      <div className={`rounded-lg border px-3 py-2 text-sm font-bold ${riskCls(hasil)}`}>Hasil: {hasil}</div>
      <Field label="Nama keluarga (diberi edukasi)" value={namaKel} onChange={setNamaKel} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={tindakan} onChange={e => setTindakan(e.target.checked)} className="accent-rose-600" />
        <span>Tindakan sesuai hasil penilaian dilaksanakan</span>
      </label>
      {err && <div className="text-xs text-red-600">{err}</div>}
      <div className="flex gap-2">
        <button onClick={simpan} disabled={saving}
          className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
          {saving ? "Menyimpan…" : "Simpan Asesmen"}
        </button>
        <button onClick={onCancel} className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
      </div>
    </div>
  );
}

function NeonatusForm({ noRawat, onSaved, onCancel }: { noRawat: string; onSaved: () => void; onCancel: () => void }) {
  const [intv, setIntv] = useState<boolean[]>(NEO_INTERVENSI.map(() => false));
  const [edu, setEdu] = useState<boolean[]>(NEO_EDUKASI.map(() => false));
  const [sas, setSas] = useState<boolean[]>(NEO_SASARAN.map(() => false));
  const [evl, setEvl] = useState<boolean[]>(NEO_EVALUASI.map(() => false));
  const [waktu, setWaktu] = useState(() => nowLocal());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const yn = (a: boolean[]) => a.map(b => (b ? "Ya" : "Tidak"));

  async function simpan() {
    setSaving(true); setErr("");
    try {
      await enakesJatuhSave({
        no_rawat: noRawat, instrumen: "neonatus",
        intervensi: yn(intv), edukasi: yn(edu), sasaran: yn(sas), evaluasi: yn(evl), waktu,
      });
      onSaved();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan asesmen"));
    } finally { setSaving(false); }
  }

  const grup = (judul: string, labels: string[], state: boolean[], setState: (v: boolean[]) => void) => (
    <div>
      <div className="text-xs font-bold text-slate-600 mb-1">{judul}</div>
      <div className="space-y-1">
        {labels.map((l, i) => (
          <label key={i} className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={state[i]} onChange={e => setState(state.map((x, j) => (j === i ? e.target.checked : x)))}
              className="mt-1 accent-rose-600" />
            <span>{l}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
      <div className="text-sm font-bold text-slate-800">Risiko Jatuh Neonatus (checklist)</div>
      <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
      {grup("Intervensi", NEO_INTERVENSI, intv, setIntv)}
      {grup("Edukasi yang diberikan", NEO_EDUKASI, edu, setEdu)}
      {grup("Sasaran edukasi", NEO_SASARAN, sas, setSas)}
      {grup("Evaluasi", NEO_EVALUASI, evl, setEvl)}
      {err && <div className="text-xs text-red-600">{err}</div>}
      <div className="flex gap-2">
        <button onClick={simpan} disabled={saving}
          className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
          {saving ? "Menyimpan…" : "Simpan Asesmen"}
        </button>
        <button onClick={onCancel} className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
      </div>
    </div>
  );
}

// ── Penilaian Ulang Nyeri (adopsi RMPenilaianUlangNyeri, PQRST) ──────────────
const NYERI_JENIS = ["Tidak Ada Nyeri", "Nyeri Akut", "Nyeri Kronis"];
const NYERI_PROVOKES = ["Proses Penyakit", "Benturan", "Lain-lain", "-"];
const NYERI_QUALITY = ["Seperti Tertusuk", "Berdenyut", "Teriris", "Tertindih", "Tertiban", "Lain-lain", "-"];
const NYERI_HILANG: [string, string][] = [["Istirahat", "Istirahat"], ["Medengar Musik", "Mendengar Musik"], ["Minum Obat", "Minum Obat"], ["-", "-"]];
function skalaCls(s: string) {
  const n = parseInt(s, 10);
  if (isNaN(n)) return "bg-slate-100 text-slate-500 border-slate-200";
  if (n <= 3) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (n <= 6) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}
function NyeriSel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (string | [string, string])[] }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400">
        {options.map(o => {
          const [val, lab] = Array.isArray(o) ? o : [o, o];
          return <option key={val} value={val}>{lab}</option>;
        })}
      </select>
    </div>
  );
}
function NyeriTab({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<EnakesNyeri[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => { enakesNyeriList(noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat, reload]);

  const [nyeri, setNyeri] = useState("Tidak Ada Nyeri");
  const [skala, setSkala] = useState("0");
  const [provokes, setProvokes] = useState("-"); const [ketProvokes, setKetProvokes] = useState("");
  const [quality, setQuality] = useState("-"); const [ketQuality, setKetQuality] = useState("");
  const [lokasi, setLokasi] = useState(""); const [menyebar, setMenyebar] = useState("Tidak");
  const [durasi, setDurasi] = useState(""); const [nyeriHilang, setNyeriHilang] = useState("-"); const [ketNyeri, setKetNyeri] = useState("");
  const [waktu, setWaktu] = useState("");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);

  function resetForm() {
    setNyeri("Tidak Ada Nyeri"); setSkala("0"); setProvokes("-"); setKetProvokes(""); setQuality("-");
    setKetQuality(""); setLokasi(""); setMenyebar("Tidak"); setDurasi(""); setNyeriHilang("-"); setKetNyeri(""); setWaktu(nowLocal()); setEditKey(null);
  }
  function startEdit(n: EnakesNyeri) {
    setNyeri(n.nyeri || "Tidak Ada Nyeri"); setSkala(n.skala_nyeri || "0"); setProvokes(n.provokes || "-"); setKetProvokes(n.ket_provokes || "");
    setQuality(n.quality || "-"); setKetQuality(n.ket_quality || ""); setLokasi(n.lokasi || ""); setMenyebar(n.menyebar || "Tidak");
    setDurasi(n.durasi || ""); setNyeriHilang(n.nyeri_hilang || "-"); setKetNyeri(n.ket_nyeri || "");
    setWaktu((n.tanggal ?? "").slice(0, 16).replace(" ", "T"));
    setEditKey(n.tanggal ?? ""); setErr(""); setOpen(true);
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      await enakesNyeriSave({
        no_rawat: noRawat, nyeri, skala_nyeri: skala, provokes, ket_provokes: ketProvokes,
        quality, ket_quality: ketQuality, lokasi, menyebar, durasi, nyeri_hilang: nyeriHilang, ket_nyeri: ketNyeri, waktu,
        edit: !!editKey, orig_tanggal: editKey ?? undefined,
      });
      setOpen(false); setReload(x => x + 1); resetForm();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan penilaian nyeri"));
    } finally { setSaving(false); }
  }

  async function hapusNyeri(n: EnakesNyeri) {
    if (!window.confirm("Hapus penilaian nyeri ini?")) return;
    try {
      await enakesNyeriHapus({ no_rawat: noRawat, tanggal: n.tanggal ?? "" });
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }

  return (
    <div className="space-y-3">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="text-sm font-bold text-slate-800">{editKey ? "Ubah Penilaian Ulang Nyeri" : "Penilaian Ulang Nyeri"}</div>
          <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
          <NyeriSel label="Jenis nyeri" value={nyeri} onChange={setNyeri} options={NYERI_JENIS} />
          <div>
            <label className="text-xs font-semibold text-slate-600">Skala nyeri (0–10)</label>
            <div className="flex items-center gap-2 mt-0.5">
              <input type="range" min={0} max={10} value={parseInt(skala, 10) || 0}
                onChange={e => setSkala(e.target.value)} className="flex-1 accent-rose-600" />
              <span className={`w-9 text-center text-sm font-bold rounded-md border py-0.5 ${skalaCls(skala)}`}>{skala}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NyeriSel label="P — Provokes (pencetus)" value={provokes} onChange={setProvokes} options={NYERI_PROVOKES} />
            <Field label="Ket. pencetus" value={ketProvokes} onChange={setKetProvokes} />
            <NyeriSel label="Q — Quality" value={quality} onChange={setQuality} options={NYERI_QUALITY} />
            <Field label="Ket. quality" value={ketQuality} onChange={setKetQuality} />
            <Field label="R — Lokasi (region)" value={lokasi} onChange={setLokasi} />
            <NyeriSel label="Menyebar" value={menyebar} onChange={setMenyebar} options={["Tidak", "Ya"]} />
            <Field label="T — Durasi (time)" value={durasi} onChange={setDurasi} placeholder="cth 5 menit / hilang timbul" />
            <NyeriSel label="Nyeri berkurang dengan" value={nyeriHilang} onChange={setNyeriHilang} options={NYERI_HILANG} />
          </div>
          <Field label="Keterangan tambahan" value={ketNyeri} onChange={setKetNyeri} />
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : "Simpan Penilaian"}
            </button>
            <button onClick={() => { setOpen(false); setErr(""); resetForm(); }}
              className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setOpen(true); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + Penilaian Ulang Nyeri
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada penilaian nyeri.</div>
      ) : (
        list.map((n, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold rounded-md border px-2 py-0.5 ${skalaCls(n.skala_nyeri)}`}>Skala {n.skala_nyeri}</span>
                <span className="text-sm font-semibold text-slate-700">{n.nyeri}</span>
              </div>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {(n.tanggal ?? "").slice(0, 16)}
                {n.milik === 1 && <button onClick={() => startEdit(n)} className="text-emerald-600 hover:text-emerald-800 font-semibold">Edit</button>}
                {n.milik === 1 && <button onClick={() => hapusNyeri(n)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500 space-y-0.5">
              {(n.lokasi || n.menyebar === "Ya") && <div>Lokasi: {n.lokasi || "-"}{n.menyebar === "Ya" ? " (menyebar)" : ""}</div>}
              {n.provokes && n.provokes !== "-" && <div>Pencetus: {n.provokes}{n.ket_provokes ? ` — ${n.ket_provokes}` : ""}</div>}
              {n.quality && n.quality !== "-" && <div>Kualitas: {n.quality}{n.ket_quality ? ` — ${n.ket_quality}` : ""}</div>}
              {n.durasi && <div>Durasi: {n.durasi}</div>}
              {n.nyeri_hilang && n.nyeri_hilang !== "-" && <div>Berkurang dengan: {n.nyeri_hilang === "Medengar Musik" ? "Mendengar Musik" : n.nyeri_hilang}</div>}
              {n.ket_nyeri && <div>Ket.: {n.ket_nyeri}</div>}
            </div>
            {n.petugas && <div className="mt-1 text-[11px] text-rose-600">{n.petugas}</div>}
          </div>
        ))
      )}
    </div>
  );
}

// ── EWS — Early Warning Score (adopsi form pemantauan Khanza; skor code-exact) ─
type EwsOpt = { t: string; n: number };
type EwsKomp = { label: string; opsi: EwsOpt[] };
type EwsDef = {
  key: string; nama: string; komponen: EwsKomp[];
  total: (skor: number[], param: string[]) => number;
  interpret: (total: number, skor: number[], param: string[]) => string;
  codeBlue?: boolean;
};
const EWSD_CODEBLUE = "Lakukan RJP oleh petugas/tim primer, aktivasi code blue henti jantung (...), respon Tim Medis Emergency (TME) segera, maksimal 5 menit, informasikan dan konsultasikan ke DPJP";
const EWSD_RESUS = "Resusitasi dan monitoring secara kontinyu ole dokter jaga dan perawat senior, aktivasi code blue kegawatan medis (....) respon Tim Medis Emergency (TME) segera, maksimal 10 menit, informasikr dan konsultasikan ke DPJP";
const EWSD_DOKTER = "Asesment segera oleh dokter jaga (respon segera, maks 5 menit) konsultasi DPJP dan spesialis terkait, eskalasi perawatan dan monitoring tap jam, pertimbangkan perawatan dengan monitoring yang sesua (HCU)";
const EWSD_PERAWAT = "Assement segera oleh perawat senior, respon segera, maks 5 menit, eskalasi perawat dan frekuensi monitoring per 4-6 jam, jika diperlukan assesment oleh dokter jaga bangsal";
const EWS_RENDAH = "Beresiko rendah, ulangi setiap 7 jam";
const EWS_DEWASA: EwsDef = {
  key: "dewasa", nama: "EWS Dewasa",
  komponen: [
    { label: "Laju respirasi (x/menit)", opsi: [{ t: "<= 5", n: 7 }, { t: "6 - 8", n: 3 }, { t: "9 - 11", n: 1 }, { t: "12 - 20", n: 0 }, { t: "21 - 24", n: 2 }, { t: "25 - 34", n: 3 }, { t: ">= 35", n: 7 }] },
    { label: "Saturasi oksigen (%)", opsi: [{ t: ">= 95", n: 0 }, { t: "94 - 95", n: 1 }, { t: "92 - 93", n: 2 }, { t: "<= 92", n: 3 }] },
    { label: "Suplemen oksigen", opsi: [{ t: "Tidak", n: 0 }, { t: "Ya", n: 2 }] },
    { label: "Tekanan darah sistolik (mmHg)", opsi: [{ t: ">= 220", n: 3 }, { t: "181 - 220", n: 2 }, { t: "111 - 180", n: 0 }, { t: "101 - 110", n: 1 }, { t: "91 - 100", n: 2 }, { t: "71 - 90", n: 3 }, { t: "<= 70", n: 7 }] },
    { label: "Laju jantung (x/menit)", opsi: [{ t: ">= 140", n: 7 }, { t: "131 - 140", n: 3 }, { t: "111 - 130", n: 2 }, { t: "91 - 110", n: 1 }, { t: "51 - 90", n: 0 }, { t: "41 - 50", n: 2 }, { t: "<= 40", n: 7 }] },
    { label: "Tingkat kesadaran", opsi: [{ t: "Sadar", n: 0 }, { t: "Nyeri/Verbal", n: 3 }, { t: "Unrespon", n: 7 }] },
    { label: "Temperatur (°C)", opsi: [{ t: "<= 35", n: 3 }, { t: "35.1 - 36", n: 1 }, { t: "36.1 - 38", n: 0 }, { t: "38.1 - 39", n: 1 }, { t: ">= 39", n: 2 }] },
  ],
  total: skor => skor.reduce((a, b) => a + b, 0),
  interpret: (total, _s, p) => {
    let i = 0;
    if (p[0] === "<= 5" || p[0] === ">= 35") i++;
    if (p[3] === "<= 70") i++;
    if (p[4] === ">= 140" || p[4] === "<= 40") i++;
    if (p[5] === "Unrespon") i++;
    if (total > 8) return EWSD_CODEBLUE;
    if (total >= 7 || i > 0) return EWSD_RESUS;
    if (total >= 5) return EWSD_DOKTER;
    if (total > 0) return EWSD_PERAWAT;
    return EWS_RENDAH;
  },
};
const EWS_ANAK: EwsDef = {
  key: "anak", nama: "PEWS Anak",
  komponen: [
    { label: "Perilaku", opsi: [{ t: "Sadar / Bermain", n: 0 }, { t: "Tidur / Perubahan Perilaku", n: 1 }, { t: "Gelisah", n: 2 }, { t: "Tidak Merespon Terhadap Nyeri Penurunan Kesadaran", n: 3 }] },
    { label: "CRT / warna kulit", opsi: [{ t: "1 - 2 dtk / Pink", n: 0 }, { t: "3 dtk / Pucat", n: 1 }, { t: "4 dtk / Sianosis", n: 2 }, { t: ">=5 dtk / Mottle", n: 3 }] },
    { label: "Respirasi", opsi: [{ t: "Tidak Ada Retraksi", n: 0 }, { t: "Cuping Hidung / O2 1-3 Lpm", n: 1 }, { t: "Retraksi Dada / O2 4-6 Lpm", n: 2 }, { t: "Stridor / O2 7-8 Lpm", n: 3 }] },
  ],
  total: skor => skor.reduce((a, b) => a + b, 0),
  interpret: total => total > 4 ? "Laporkan perubahan klinis ke perawat ketua tim, dokter jaga dan DPJP. Kolaborasikan langkah selanjutnya dengan seluruh tim perawatan"
    : total > 3 ? "Monitor per 1 jam. Laporkan ke dokter jaga dan kemudian tindak lanjut lapor ke DPJP untuk advis selanjutnya. Kolaborasi langkah selanjutnya dengan seluruh tim perawatan. Jika masih di perlukan lapor ulang keperawat ketua tim dan DPJP"
    : total > 2 ? "Monitoring 1 sampai 2 jam. Pengkajian ulang dilakukan oleh PJ sift dan laporkan ke dokter jaga"
    : "Monitoring setiap 4 jam oleh perawat pelaksana dan di lanjutkan observasi atau monitoring secara rutin",
};
const EWS_NEONATUS: EwsDef = {
  key: "neonatus", nama: "EWS Neonatus", codeBlue: true,
  komponen: [
    { label: "1. Pernapasan (x/menit)", opsi: [{ t: "<= 29", n: 2 }, { t: "30 - 39", n: 1 }, { t: "40 - 60", n: 0 }, { t: ">= 61", n: 2 }] },
    { label: "2. Saturasi oksigen (%)", opsi: [{ t: ">= 94", n: 0 }, { t: "90 - 93", n: 1 }, { t: "<= 90", n: 2 }] },
    { label: "3. Penggunaan O2", opsi: [{ t: "Tidak", n: 0 }, { t: "Ya", n: 2 }] },
    { label: "4. Denyut jantung (x/menit)", opsi: [{ t: "<= 80", n: 2 }, { t: "81 - 119", n: 1 }, { t: "120 - 160", n: 0 }, { t: "161 - 180", n: 1 }, { t: ">= 181", n: 2 }] },
    { label: "5. Retraksi dada", opsi: [{ t: "Tidak", n: 0 }, { t: "Ringan", n: 1 }, { t: "Berat", n: 2 }] },
    { label: "6. CRT", opsi: [{ t: "<= 3 Detik", n: 0 }, { t: ">= 3 Detik", n: 1 }] },
    { label: "7. Suhu (°C)", opsi: [{ t: "36,5 - 37,5", n: 0 }, { t: "<= 36,5", n: 1 }, { t: ">= 37,5", n: 1 }] },
    { label: "8. Warna kulit (tak masuk skor total)", opsi: [{ t: "Pink", n: 0 }, { t: "Pucat", n: 2 }] },
  ],
  total: skor => skor.slice(0, 7).reduce((a, b) => a + b, 0),   // skor8 (warna kulit) TIDAK dijumlah — sesuai kode Khanza
  interpret: total => total > 6 ? "Petugas : Panggilan Darurat, Monitoring : Berkelanjutan, Tindakan : Menghubungi tim emergency jaga/aktifkan Code Blue"
    : total === 6 ? "Petugas : Perawat Jaga & Dokter Jaga, Monitoring : Berkelanjutan, Tindakan : Melapor ke DPJP"
    : total >= 4 ? "Petugas : Perawat Jaga & Dokter Jaga, Monitoring : Per 30 menit, Tindakan : Perawat jaga melakukan monitoring ulang dan melapor ke dokter jaga"
    : total === 3 ? "Petugas : Perawat Jaga & Dokter Jaga, Monitoring : Per 1 jam, Tindakan : Perawat jaga melakukan monitoring ulang dan melapor ke dokter jaga"
    : total === 2 ? "Petugas : Perawat Jaga, Monitoring : Per 2 jam, Tindakan : Semua perubahan kondisi pasien harus meningkatkan frekuensi monitor untuk tindakan klinis yang tepat"
    : total === 1 ? "Petugas : Perawat Jaga, Monitoring : Per 4 jam, Tindakan : Semua perubahan kondisi pasien harus meningkatkan frekuensi monitor untuk tindakan klinis yang tepat"
    : EWS_RENDAH,
};
const EWS_DEFS: Record<string, EwsDef> = { dewasa: EWS_DEWASA, anak: EWS_ANAK, neonatus: EWS_NEONATUS };
function ewsCls(txt: string) {
  const s = txt.toLowerCase();
  if (s.includes("code blue") || s.includes("rjp") || s.includes("panggilan darurat") || s.includes("resusitasi") || s.includes("emergency")) return "bg-red-50 text-red-700 border-red-200";
  if (s.includes("dokter jaga") || s.includes("30 menit") || s.includes("per 1 jam") || s.includes("dpjp")) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}
function defaultSel(k: EwsKomp) { const i = k.opsi.findIndex(o => o.n === 0); return i < 0 ? 0 : i; }

// ── PHQ-9 (Patient Health Questionnaire-9) ───────────────────────────────────
const PHQ9_PERTANYAAN: string[] = [
  "Kurang tertarik atau kurang suka dalam melakukan apapun",
  "Merasa murung, pilu (sangat sedih) atau putus asa",
  "Sulit untuk tidur atau bertahan tidur, atau terlalu banyak tidur",
  "Merasa lelah atau kurang bertenaga",
  "Kurang nafsu makan atau terlalu banyak makan",
  "Merasa buruk akan diri sendiri, merasa gagal, atau telah mengecewakan diri sendiri / keluarga",
  "Sulit konsentrasi pada sesuatu, misalnya membaca berita atau menonton televisi",
  "Bergerak atau berbicara sangat lambat sehingga orang lain memperhatikan — atau sebaliknya resah/gelisah sehingga bergerak lebih banyak dari biasanya",
  "Memikirkan bahwa lebih baik mengakhiri hidup atau melukai diri sendiri dengan cara tertentu",
];
const PHQ9_OPSI: [number, string][] = [
  [0, "Tidak sama sekali"], [1, "Beberapa hari"], [2, "Lebih dari seminggu"], [3, "Hampir setiap hari"],
];
function phq9Kesimpulan(total: number) {
  return total <= 14 ? "Asuhan RBD (rencana bunuh diri)" : "Rujuk ke psikiater/perawat spesialis jiwa/psikolog klinis";
}
function phq9Cls(total: number) {
  return total >= 15 ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200";
}

function Phq9Tab({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<EnakesPhq9[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [nilai, setNilai] = useState<number[]>(Array(9).fill(0));
  const [waktu, setWaktu] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);
  useEffect(() => { enakesPhq9List(noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat, reload]);

  const total = nilai.reduce((a, b) => a + b, 0);

  function resetForm() { setNilai(Array(9).fill(0)); setWaktu(nowLocal()); setEditKey(null); }
  function startEdit(s: EnakesPhq9) {
    setNilai([s.phq1, s.phq2, s.phq3, s.phq4, s.phq5, s.phq6, s.phq7, s.phq8, s.phq9]);
    setWaktu((s.tanggal ?? "").slice(0, 16).replace(" ", "T"));
    setEditKey(s.tanggal ?? ""); setErr(""); setOpen(true);
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      await enakesPhq9Save({ no_rawat: noRawat, nilai, waktu, edit: !!editKey, orig_tanggal: editKey ?? undefined });
      setOpen(false); setReload(x => x + 1); resetForm();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan PHQ-9"));
    } finally { setSaving(false); }
  }

  async function hapus(s: EnakesPhq9) {
    if (!window.confirm("Hapus skrining PHQ-9 ini?")) return;
    try {
      await enakesPhq9Hapus({ no_rawat: noRawat, tanggal: s.tanggal ?? "" });
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }

  return (
    <div className="space-y-3">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
          <div>
            <div className="text-sm font-bold text-slate-800">{editKey ? "Ubah Skrining PHQ-9" : "Skrining PHQ-9"}</div>
            <div className="text-[11px] text-slate-500">Selama 2 minggu terakhir, seberapa sering pasien terganggu oleh masalah berikut?</div>
          </div>
          <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
          {PHQ9_PERTANYAAN.map((q, i) => (
            <div key={i} className="border-b border-slate-100 pb-2.5">
              <div className="text-xs font-semibold text-slate-700 mb-1.5"><span className="text-rose-600">{i + 1}.</span> {q}</div>
              <div className="grid grid-cols-4 gap-1">
                {PHQ9_OPSI.map(([n, t]) => (
                  <button key={n} type="button"
                    onClick={() => setNilai(v => v.map((x, j) => j === i ? n : x))}
                    className={`text-[10px] leading-tight rounded-lg border px-1 py-1.5 font-semibold transition-colors ${
                      nilai[i] === n ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-500 border-slate-200 hover:border-rose-300"
                    }`}>
                    <div className="text-sm">{n}</div>{t}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-sm font-semibold text-slate-600">Total skor</span>
            <span className={`text-sm font-bold rounded-md border px-2 py-0.5 ${phq9Cls(total)}`}>{total} / 27</span>
          </div>
          <div className={`text-xs font-semibold rounded-lg border px-3 py-2 ${phq9Cls(total)}`}>{phq9Kesimpulan(total)}</div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : "Simpan PHQ-9"}
            </button>
            <button onClick={() => { setOpen(false); setErr(""); resetForm(); }}
              className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setOpen(true); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + Skrining PHQ-9
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada skrining PHQ-9.</div>
      ) : (
        list.map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-bold rounded-md border px-2 py-0.5 ${phq9Cls(s.total_skor)}`}>Skor {s.total_skor} / 27</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {(s.tanggal ?? "").slice(0, 16)}
                {s.milik === 1 && <button onClick={() => startEdit(s)} className="text-emerald-600 hover:text-emerald-800 font-semibold">Edit</button>}
                {s.milik === 1 && <button onClick={() => hapus(s)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            <div className="mt-1.5 text-xs font-semibold text-slate-600">{s.kesimpulan}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {[s.phq1, s.phq2, s.phq3, s.phq4, s.phq5, s.phq6, s.phq7, s.phq8, s.phq9].map((v, j) => (
                <span key={j} className="text-[10px] text-slate-400 bg-slate-50 rounded px-1.5 py-0.5">{j + 1}:{v}</span>
              ))}
            </div>
            {s.petugas && <div className="mt-1 text-[11px] text-slate-400">Petugas: {s.petugas}</div>}
          </div>
        ))
      )}
    </div>
  );
}

// ── ASQ — Ask Suicide-Screening Questions (RM.103) ───────────────────────────
const ASQ_PERTANYAAN: string[] = [
  "Dalam beberapa minggu terakhir, apakah Anda berharap untuk mengakhiri hidup?",
  "Dalam beberapa minggu terakhir, apakah Anda merasa keluarga Anda lebih baik bila Anda mengakhiri hidup?",
  "Dalam beberapa minggu terakhir, apakah Anda ada keinginan bunuh diri?",
  "Apakah Anda pernah mencoba bunuh diri? (bila iya: bagaimana & kapan)",
  "Apakah Anda merasa ingin bunuh diri saat ini? (bila iya, deskripsikan)",
];
function asqKesimpulan(a: string[]) {
  const positif = a.slice(0, 4).some(x => x === "Ya");
  if (!positif) return "Skrining Negatif (tidak ada risiko bunuh diri saat ini)";
  if (a[4] === "Ya") return "Positif AKUT — evaluasi keselamatan segera, jangan tinggalkan pasien sendiri";
  return "Positif Non-Akut — perlu evaluasi kesehatan jiwa lebih lanjut";
}
function asqCls(k: string) {
  return k.startsWith("Positif AKUT") ? "bg-red-50 text-red-700 border-red-200"
    : k.startsWith("Positif") ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function AsqTab({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<EnakesAsq[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [jwb, setJwb] = useState<string[]>(Array(5).fill("Tidak"));
  const [ket4, setKet4] = useState(""); const [ket5, setKet5] = useState("");
  const [waktu, setWaktu] = useState("");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);
  useEffect(() => { enakesAsqList(noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat, reload]);

  const kesimpulan = asqKesimpulan(jwb);
  const perluQ5 = jwb.slice(0, 4).some(x => x === "Ya");

  function resetForm() { setJwb(Array(5).fill("Tidak")); setKet4(""); setKet5(""); setWaktu(nowLocal()); setEditKey(null); }
  function startEdit(s: EnakesAsq) {
    setJwb([s.asq1 || "Tidak", s.asq2 || "Tidak", s.asq3 || "Tidak", s.asq4 || "Tidak", s.asq5 || "Tidak"]);
    setKet4(s.ket4 || ""); setKet5(s.ket5 || ""); setWaktu((s.tanggal ?? "").slice(0, 16).replace(" ", "T")); setEditKey(s.tanggal ?? ""); setErr(""); setOpen(true);
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      await enakesAsqSave({ no_rawat: noRawat, asq1: jwb[0], asq2: jwb[1], asq3: jwb[2], asq4: jwb[3], asq5: jwb[4], ket4, ket5, waktu,
        edit: !!editKey, orig_tanggal: editKey ?? undefined });
      setOpen(false); setReload(x => x + 1); resetForm();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan skrining ASQ"));
    } finally { setSaving(false); }
  }

  async function hapus(s: EnakesAsq) {
    if (!window.confirm("Hapus skrining ASQ ini?")) return;
    try {
      await enakesAsqHapus({ no_rawat: noRawat, tanggal: s.tanggal ?? "" });
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }

  return (
    <div className="space-y-3">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
          <div>
            <div className="text-sm font-bold text-slate-800">{editKey ? "Ubah Skrining Risiko Bunuh Diri (ASQ)" : "Skrining Risiko Bunuh Diri (ASQ)"}</div>
            <div className="text-[11px] text-slate-500">Bila Q1–Q4 ada satu jawaban “Ya”, lanjutkan ke Q5.</div>
          </div>
          <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
          {ASQ_PERTANYAAN.map((q, i) => (
            <div key={i} className={`border-b border-slate-100 pb-2.5 ${i === 4 && !perluQ5 ? "opacity-50" : ""}`}>
              <div className="text-xs font-semibold text-slate-700 mb-1.5"><span className="text-rose-600">{i + 1}.</span> {q}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {["Tidak", "Ya"].map(v => (
                  <button key={v} type="button"
                    onClick={() => setJwb(prev => prev.map((x, j) => j === i ? v : x))}
                    className={`text-xs rounded-lg border px-2 py-1.5 font-semibold transition-colors ${
                      jwb[i] === v
                        ? (v === "Ya" ? "bg-red-600 text-white border-red-600" : "bg-slate-600 text-white border-slate-600")
                        : "bg-white text-slate-500 border-slate-200 hover:border-rose-300"
                    }`}>
                    {v}
                  </button>
                ))}
              </div>
              {i === 3 && (
                <input value={ket4} onChange={e => setKet4(e.target.value)} placeholder="Ket. Q4 — bagaimana & kapan…"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
              )}
              {i === 4 && (
                <input value={ket5} onChange={e => setKet5(e.target.value)} placeholder="Ket. Q5 — deskripsi…"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
              )}
            </div>
          ))}
          <div className={`text-xs font-semibold rounded-lg border px-3 py-2 ${asqCls(kesimpulan)}`}>{kesimpulan}</div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : "Simpan ASQ"}
            </button>
            <button onClick={() => { setOpen(false); setErr(""); resetForm(); }}
              className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setOpen(true); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + Skrining ASQ (Risiko Bunuh Diri)
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada skrining ASQ.</div>
      ) : (
        list.map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-bold rounded-md border px-2 py-0.5 ${asqCls(s.kesimpulan)}`}>{s.kesimpulan}</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                {(s.tanggal ?? "").slice(0, 16)}
                {s.milik === 1 && <button onClick={() => startEdit(s)} className="text-emerald-600 hover:text-emerald-800 font-semibold">Edit</button>}
                {s.milik === 1 && <button onClick={() => hapus(s)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[s.asq1, s.asq2, s.asq3, s.asq4, s.asq5].map((v, j) => (
                <span key={j} className={`text-[10px] rounded px-1.5 py-0.5 ${v === "Ya" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-400"}`}>Q{j + 1}:{v}</span>
              ))}
            </div>
            {(s.ket4 || s.ket5) && (
              <div className="mt-1 text-[11px] text-slate-500 space-y-0.5">
                {s.ket4 && <div>Q4: {s.ket4}</div>}
                {s.ket5 && <div>Q5: {s.ket5}</div>}
              </div>
            )}
            {s.petugas && <div className="mt-1 text-[11px] text-slate-400">Petugas: {s.petugas}</div>}
          </div>
        ))
      )}
    </div>
  );
}

// ── Asesmen Awal Medis Kritis ICU (e-dokter) ─────────────────────────────────
type IcuField = { k: string; l: string; t: "text" | "area" | "sel"; o?: string[] };
type IcuSec = { sec: string; fields: IcuField[] };
const ICU_ASESMEN: IcuSec[] = [
  { sec: "I. Anamnesis", fields: [
    { k: "jenis_anamnesis", l: "Jenis Anamnesis", t: "sel", o: ["", "Autoanamnesa", "Alloanamnesa"] },
    { k: "sumber_alloanamnesa", l: "Alloanamnesa dari (hubungan)", t: "text" },
    { k: "ruangan", l: "Ruangan Intensif", t: "text" },
    { k: "keluhan_utama", l: "Keluhan Utama", t: "area" },
    { k: "perjalanan_penyakit", l: "Perjalanan Penyakit", t: "area" },
    { k: "penyakit_lain_alergi", l: "Penyakit lain / alergi obat", t: "area" },
    { k: "riwayat_penyakit_dahulu", l: "Riwayat penyakit dahulu", t: "area" },
  ] },
  { sec: "II. Pemeriksaan Fisik — Keadaan Umum", fields: [
    { k: "keadaan_umum", l: "Keadaan umum", t: "text" },
    { k: "kesadaran", l: "Kesadaran", t: "sel", o: ["", "Compos mentis", "Apatis", "Somnolen", "Sopor", "Soporocoma", "Coma"] },
    { k: "gcs", l: "GCS (E / M / V)", t: "text" },
    { k: "skala_nyeri", l: "Skala Nyeri", t: "text" },
    { k: "td", l: "Tekanan Darah (mmHg)", t: "text" },
    { k: "nadi", l: "Nadi (x/menit)", t: "text" },
    { k: "suhu", l: "Suhu (°C)", t: "text" },
    { k: "rr", l: "Pernafasan / RR (x/menit)", t: "text" },
    { k: "bb", l: "Berat Badan (Kg)", t: "text" },
    { k: "tb", l: "Tinggi Badan (Cm)", t: "text" },
  ] },
  { sec: "II. Pemeriksaan Fisik — Status Lokalis", fields: [
    { k: "fisik_kepala", l: "Kepala", t: "text" }, { k: "fisik_mata", l: "Mata", t: "text" },
    { k: "fisik_tht", l: "THT", t: "text" }, { k: "fisik_gigi", l: "Gigi", t: "text" },
    { k: "fisik_leher", l: "Leher", t: "text" }, { k: "fisik_paru", l: "Paru-paru", t: "text" },
    { k: "fisik_jantung", l: "Jantung", t: "text" }, { k: "fisik_abdomen", l: "Abdomen", t: "text" },
    { k: "fisik_extremitas", l: "Extremitas", t: "text" },
    { k: "fisik_lain", l: "Pemeriksaan fisik lain / catatan", t: "area" },
  ] },
  { sec: "A. Pemeriksaan Penunjang", fields: [
    { k: "penunjang", l: "Penunjang (laboratorium, radiologi, EKG, dll)", t: "area" },
  ] },
  { sec: "B. Diagnosis", fields: [
    { k: "diagnosis_kerja", l: "Diagnosis Kerja", t: "area" },
    { k: "diagnosis_diferensial", l: "Diagnosis Differensial", t: "area" },
  ] },
  { sec: "C. Terapi", fields: [{ k: "terapi", l: "Terapi", t: "area" }] },
  { sec: "D. Diit", fields: [{ k: "diit", l: "Diit", t: "area" }] },
  { sec: "Tanda Tangan", fields: [
    { k: "ttd_pasien_keluarga", l: "Nama Pasien / Keluarga yang menandatangani", t: "text" },
    { k: "ttd_hubungan", l: "Hubungan dengan pasien", t: "text" },
  ] },
];
function toLocalInput(s?: string | null) { return s ? s.replace(" ", "T").slice(0, 16) : ""; }
function toSql(s: string) { return s ? s.replace("T", " ") + (s.length === 16 ? ":00" : "") : ""; }

function AsesmenPraAnestesiTab({ noRawat, kdDokter }: { noRawat: string; kdDokter?: string }) {
  const [f, setF] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nmDokter, setNmDokter] = useState("");
  const [exists, setExists] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    edokterAsesmenPraAnestesiGet(noRawat, kdDokter)
      .then(r => { setF(r.data.exists ? (r.data.data ?? {}) : {}); setNmDokter(r.data.nm_dokter ?? ""); setExists(!!r.data.exists); })
      .catch(() => setF({}))
      .finally(() => setLoading(false));
  }, [noRawat, kdDokter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);

  const fRef = useRef(f); fRef.current = f;
  const set = useCallback((k: string, v: string) => setF(p => ({ ...p, [k]: v })), []);
  const simpan = async () => {
    setSaving(true);
    try {
      await edokterAsesmenPraAnestesiSave({ no_rawat: noRawat, kd_dokter: kdDokter, data: f });
      setMsg({ t: "ok", m: "Asesmen pra anestesi tersimpan" });
      load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ t: "err", m: err.response?.data?.error ?? "Gagal menyimpan" });
    } finally { setSaving(false); }
  };
  const hapus = async () => {
    if (!window.confirm("Hapus asesmen pra anestesi ini?")) return;
    try {
      await edokterAsesmenPraAnestesiHapus({ no_rawat: noRawat });
      setF({}); setExists(false); setMsg({ t: "ok", m: "Asesmen dihapus" });
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ t: "err", m: err.response?.data?.error ?? "Gagal menghapus" });
    }
  };

  // Helper render — identitas komponen distabilkan (useCallback) & baca state via
  // fRef agar TIDAK remount tiap keystroke (dulu didefinisikan inline -> input
  // kehilangan fokus / "keluar form" tiap ketik 1 huruf).
  const lbl = "block text-[11px] font-semibold text-slate-500 mb-1";
  const inp = "w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  const Txt = useCallback(({ k, l, ph }: { k: string; l: string; ph?: string }) => (
    <label className="block"><span className={lbl}>{l}</span>
      <input value={fRef.current[k] ?? ""} onChange={e => set(k, e.target.value)} placeholder={ph} className={inp} /></label>
  ), [set]);
  const Area = useCallback(({ k, l }: { k: string; l: string }) => (
    <label className="block"><span className={lbl}>{l}</span>
      <textarea value={fRef.current[k] ?? ""} onChange={e => set(k, e.target.value)} rows={2} className={inp} /></label>
  ), [set]);
  const Sel = useCallback(({ k, l, opts }: { k: string; l: string; opts: string[] }) => (
    <label className="block"><span className={lbl}>{l}</span>
      <select value={fRef.current[k] ?? ""} onChange={e => set(k, e.target.value)} className={inp}>
        <option value="">—</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select></label>
  ), [set]);
  const YN = useCallback(({ k, l }: { k: string; l: string }) => (
    <label className="flex items-center gap-2 text-sm text-slate-700 py-1">
      <input type="checkbox" checked={fRef.current[k] === "Ya"} onChange={e => set(k, e.target.checked ? "Ya" : "Tidak")} />
      {l}</label>
  ), [set]);
  const Sec = useCallback(({ t, children }: { t: string; children: React.ReactNode }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="text-xs font-bold text-teal-700 uppercase tracking-wide">{t}</div>{children}</div>
  ), []);

  if (loading) return <div className="py-10 text-center text-slate-400 text-sm">Memuat…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-slate-800">Asesmen Pra Anestesi / Sedasi</div>
        {nmDokter && <div className="text-xs text-slate-500">Dokter: {nmDokter}</div>}
      </div>
      {msg && <div className={`text-xs px-3 py-2 rounded-lg ${msg.t === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.m}</div>}

      <Sec t="Data">
        <Txt k="ruangan" l="Ruangan" />
        <div className="grid grid-cols-2 gap-2"><Txt k="diagnosa" l="Diagnosa" /><Txt k="tindakan_bedah" l="Tindakan Bedah" /></div>
      </Sec>

      <Sec t="1. Subyektif">
        <div className="grid grid-cols-2 gap-2"><Txt k="bb" l="BB (kg)" /><Txt k="tb" l="TB (cm)" /></div>
        <Area k="anamnesi" l="Anamnesa" />
        <div className="text-[11px] font-semibold text-slate-500">Riwayat Penyakit</div>
        <div className="grid grid-cols-2 gap-x-3">
          <YN k="riwayat_asma" l="Asthma" /><YN k="hipertensi" l="Hipertensi" />
          <YN k="diabetes" l="Diabetes Melitus" /><YN k="alergi" l="Alergi" />
        </div>
        <Area k="riwayat_operasi" l="Riwayat Operasi" />
        <div className="grid grid-cols-2 gap-2"><Txt k="jenis_anestesi_riwayat" l="Jenis Anestesi (riwayat)" /><Txt k="komplikasi_riwayat" l="Komplikasi (riwayat)" /></div>
      </Sec>

      <Sec t="2. Obyektif">
        <div className="grid grid-cols-2 gap-2"><Txt k="keadaan_umum" l="Keadaan Umum" /><Txt k="gcs" l="GCS (E/V/M)" /></div>
        <div className="grid grid-cols-4 gap-2"><Txt k="td" l="TD (mmHg)" /><Txt k="nadi" l="Nadi (x/mnt)" /><Txt k="rr" l="RR (x/mnt)" /><Txt k="suhu" l="Suhu (°C)" /></div>
        <div className="grid grid-cols-2 gap-2"><Txt k="gerakan_leher" l="Gerakan Leher" /><Sel k="mallampati" l="Mallampati" opts={["I", "II", "III", "IV"]} /></div>
        <Txt k="methohyoid" l="Jarak Thyromental/Methohyoid" />
        <div className="grid grid-cols-2 gap-2"><Area k="thorax" l="Thorax" /><Area k="abdomen" l="Abdomen" /></div>
        <Area k="ekstremitas" l="Ekstremitas" />
        <Area k="laboratorium" l="Laboratorium" />
        <div className="grid grid-cols-2 gap-2"><Area k="ekg" l="EKG" /><Area k="ro_thorax" l="Ro-Thorax" /></div>
        <Area k="lain_lain" l="Lain-lain" />
      </Sec>

      <Sec t="3. Assessment">
        <div className="grid grid-cols-2 gap-2"><Sel k="asa" l="ASA" opts={["I", "II", "III", "IV", "V", "VI"]} /><Txt k="puasa" l="Puasa (jam)" /></div>
        <Area k="penyulit" l="4. Penyulit" />
      </Sec>

      <Sec t="5. Planning (Perencanaan Anestesi/Sedasi)">
        <div className="text-[11px] font-semibold text-slate-500">Teknik Anestesi / Sedasi</div>
        <div className="grid grid-cols-3 gap-x-3">
          <YN k="teknik_ga_lma" l="GA-LMA" /><YN k="teknik_ga_ett" l="GA-ETT" /><YN k="teknik_ga_tiva" l="GA-TIVA" />
          <YN k="teknik_ga_facemask" l="GA Face Mask" />
          <YN k="teknik_sedasi_ringan" l="Sedasi Ringan" /><YN k="teknik_sedasi_sedang" l="Sedasi Sedang" /><YN k="teknik_sedasi_dalam" l="Sedasi Dalam" />
          <YN k="teknik_spinal" l="Spinal" /><YN k="teknik_epidural" l="Epidural" /><YN k="teknik_kaudal" l="Kaudal" />
          <YN k="teknik_blok_perifer" l="Blok Perifer" />
        </div>
        <Txt k="persediaan_darah" l="Persediaan Darah" />
        <Txt k="premedikasi" l="Premedikasi" />
        <div className="text-[11px] font-semibold text-slate-500">Teknik Khusus</div>
        <div className="grid grid-cols-2 gap-x-3"><YN k="teknik_khusus_hipotensi" l="Hipotensi" /><YN k="teknik_khusus_ventilasi" l="Ventilasi satu paru" /></div>
        <Txt k="teknik_khusus_lain" l="Teknik Khusus Lainnya" />
        <div className="text-[11px] font-semibold text-slate-500">Monitoring</div>
        <div className="grid grid-cols-4 gap-x-3">
          <YN k="monitoring_ekg" l="EKG Lead" /><YN k="monitoring_nadi" l="Nadi" /><YN k="monitoring_spo2" l="SpO2" /><YN k="monitoring_nibp" l="NIBP" />
          <YN k="monitoring_temp" l="Temp" /><YN k="monitoring_cvp" l="CVP" /><YN k="monitoring_arteri" l="Arteri" />
          <YN k="monitoring_etco2" l="EtCO2" />
        </div>
        <Txt k="monitoring_lain" l="Monitoring Lainnya" />
        <Sel k="perawatan_pasca" l="Perawatan Pasca Anestesi" opts={["Rawat Jalan", "Rawat Inap", "ICU / HCU", "RR", "Lainnya"]} />
      </Sec>

      <div className="flex justify-end gap-2 pb-2">
        {exists && <button onClick={hapus} disabled={saving}
          className="bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
          Hapus
        </button>}
        <button onClick={simpan} disabled={saving}
          className="bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50">
          {saving ? "Menyimpan…" : "Simpan Asesmen"}
        </button>
      </div>
    </div>
  );
}

// ── Asesmen Pra Induksi (RM.IBS.11.012.2026) ─────────────────────────────────
// Terpisah dari Pra Anestesi. Satu asesmen aktif per pasien; edit/hapus hanya
// oleh petugas penginput (owner) atau admin. Tanggal & jam bisa diedit.
function PraInduksiTab({ noRawat, kdDokter }: { noRawat: string; kdDokter?: string }) {
  const [f, setF] = useState<Record<string, string>>({});
  const [tgl, setTgl] = useState(nowLocal());
  const [nmDokter, setNmDokter] = useState("");
  const [kdBedah, setKdBedah] = useState(""); const [nmBedah, setNmBedah] = useState("");
  const [dokList, setDokList] = useState<{ kd_dokter: string; nm_dokter: string }[]>([]);
  const [existing, setExisting] = useState<string | null>(null);
  const [dapatEdit, setDapatEdit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);
  const terkunci = !!existing && !dapatEdit;

  const load = useCallback(() => {
    setLoading(true);
    edokterAsesmenPraInduksiGet(noRawat, kdDokter)
      .then(r => {
        const d = r.data;
        setNmDokter(d.nm_dokter ?? "");
        if (d.exists) {
          setF(d.data ?? {});
          setExisting((d.tanggal ?? "").slice(0, 16).replace("T", " "));
          setDapatEdit(d.dapat_edit !== false);
          setTgl(toLocalInput(d.tanggal ?? "") || nowLocal());
          setKdBedah(d.kd_dokter_bedah ?? ""); setNmBedah(d.nm_dokter_bedah ?? "");
        } else {
          setF({}); setExisting(null); setDapatEdit(true); setTgl(nowLocal()); setKdBedah(""); setNmBedah("");
        }
      })
      .catch(() => setF({}))
      .finally(() => setLoading(false));
  }, [noRawat, kdDokter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { igdListDokter().then(r => setDokList(r.data)).catch(() => {}); }, []);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const simpan = async () => {
    if (terkunci) { setMsg({ t: "err", m: "Hanya bisa diedit oleh petugas yang menginput" }); return; }
    setSaving(true);
    try {
      await edokterAsesmenPraInduksiSave({ no_rawat: noRawat, kd_dokter: kdDokter, kd_dokter_bedah: kdBedah, tanggal: tgl, data: f });
      setMsg({ t: "ok", m: existing ? "Perubahan tersimpan" : "Asesmen pra induksi tersimpan" });
      load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ t: "err", m: err.response?.data?.error ?? "Gagal menyimpan" });
    } finally { setSaving(false); }
  };
  const hapus = async () => {
    if (!window.confirm(`Hapus asesmen pra induksi ini (${existing})?`)) return;
    setSaving(true);
    try {
      await edokterAsesmenPraInduksiHapus({ no_rawat: noRawat });
      setMsg({ t: "ok", m: "Data dihapus" });
      load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ t: "err", m: err.response?.data?.error ?? "Gagal menghapus" });
    } finally { setSaving(false); }
  };

  // Helper render (dipanggil sebagai fungsi, bukan komponen → tak remount/kehilangan fokus)
  const lbl = "block text-[11px] font-semibold text-slate-500 mb-1";
  const inp = "w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400";
  const txt = (k: string, l: string, ph?: string) => (
    <label className="block"><span className={lbl}>{l}</span>
      <input value={f[k] ?? ""} onChange={e => set(k, e.target.value)} placeholder={ph} disabled={terkunci} className={inp} /></label>
  );
  const sel = (k: string, l: string, opts: string[]) => (
    <label className="block"><span className={lbl}>{l}</span>
      <select value={f[k] ?? ""} onChange={e => set(k, e.target.value)} disabled={terkunci} className={inp}>
        <option value="">—</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select></label>
  );
  const yn = (k: string, l: string) => (
    <label className="flex items-center gap-2 text-sm text-slate-700 py-1">
      <input type="checkbox" checked={f[k] === "Ya"} disabled={terkunci} onChange={e => set(k, e.target.checked ? "Ya" : "Tidak")} />
      {l}</label>
  );
  // Identitas komponen distabilkan agar tidak remount tiap keystroke (dulu input
  // di dalam <Sec> kehilangan fokus / "keluar" tiap ketik 1 huruf).
  const Sec = useCallback(({ t, children }: { t: string; children: React.ReactNode }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="text-xs font-bold text-teal-700 uppercase tracking-wide">{t}</div>{children}</div>
  ), []);

  if (loading) return <div className="py-10 text-center text-slate-400 text-sm">Memuat…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-slate-800">Asesmen Pra Induksi</div>
        {nmDokter && <div className="text-xs text-slate-500">Dokter/Penata Anestesi: {nmDokter}</div>}
      </div>
      {existing && (
        <div className={`text-[11px] px-3 py-2 rounded-lg border ${terkunci ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-sky-50 border-sky-200 text-sky-700"}`}>
          Pengisian terakhir: {existing}.{" "}
          {terkunci ? "Diinput petugas lain — tidak bisa diubah/dihapus oleh Anda." : "Menyimpan akan memperbarui asesmen ini (jam bisa diganti); atau hapus di bawah."}
        </div>
      )}
      {msg && <div className={`text-xs px-3 py-2 rounded-lg ${msg.t === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.m}</div>}

      <Sec t="Identitas Tindakan">
        <label className="block"><span className={lbl}>Tanggal &amp; jam</span>
          <input type="datetime-local" value={tgl} onChange={e => setTgl(e.target.value)} disabled={terkunci} className={inp} /></label>
        <div className="grid grid-cols-2 gap-2">{txt("diagnosa_prabedah", "Diagnosis Prabedah")}{txt("tindakan_bedah", "Tindakan Bedah")}</div>
        <div className="grid grid-cols-1 gap-2">
          <div className={terkunci ? "pointer-events-none opacity-60" : ""}>
            <DokterPicker label="Dokter Bedah" list={dokList} kd={kdBedah} nm={nmBedah} onPick={(k, n) => { setKdBedah(k); setNmBedah(n); }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">{txt("asisten_bedah", "Asisten Bedah")}{txt("penata_anestesi", "Penata Anestesi")}</div>
      </Sec>

      <Sec t="1. Riwayat Alergi">
        {yn("alergi", "Ada riwayat alergi")}
        {f.alergi === "Ya" && txt("alergi_ket", "Sebutkan")}
      </Sec>

      <Sec t="2. Kemungkinan Kesulitan Jalan Nafas">
        {yn("kesulitan_jalan_nafas", "Ada kemungkinan kesulitan")}
        {f.kesulitan_jalan_nafas === "Ya" && txt("kesulitan_jalan_nafas_ket", "Tindakan antisipasi")}
      </Sec>

      <Sec t="3. Resiko Perdarahan > 500 ml">
        {yn("resiko_perdarahan", "Resiko perdarahan > 500 ml")}
        {yn("sedia_darah", "Sedia darah")}
        {f.sedia_darah === "Ya" && (
          <div className="grid grid-cols-2 gap-2">{txt("sedia_darah_jenis", "Jenis")}{txt("sedia_darah_ml", "Jumlah (ml)")}</div>
        )}
      </Sec>

      <Sec t="4. Penilaian Jalan Nafas">
        <div className="grid grid-cols-3 gap-2">
          {sel("mallampati", "Mallampati", ["1", "2", "3", "4"])}
          {sel("buka_mulut", "Buka Mulut", ["> 3 jari", "< 3 jari"])}
        </div>
        {yn("pergerakan_leher", "Pergerakan leher terbatas")}
      </Sec>

      <Sec t="5. Status Fisik ASA">
        {sel("asa", "ASA", ["1", "2", "3", "4", "5", "E"])}
      </Sec>

      <Sec t="6. Rencana Anestesi">
        {txt("rencana_ga", "General Anestesi")}
        {txt("rencana_ra", "Regional Anestesi")}
      </Sec>

      <Sec t="7. Puasa">
        {sel("puasa", "Status Puasa", ["Belum", "Sudah"])}
        {f.puasa === "Belum" && txt("puasa_terakhir", "Makan/minum terakhir")}
      </Sec>

      <div className="flex justify-end gap-2 pb-2">
        {existing && dapatEdit && (
          <button onClick={hapus} disabled={saving}
            className="bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            Hapus
          </button>
        )}
        <button onClick={simpan} disabled={saving || terkunci}
          className="bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50">
          {saving ? "Menyimpan…" : existing ? "Perbarui Asesmen" : "Simpan Asesmen"}
        </button>
      </div>
    </div>
  );
}

// ── Surat Kontrol BPJS (Rencana Kontrol VClaim) — port dari popup DlgReg ─────
function pesanErr(e: unknown, fallback: string): string {
  const x = e as { response?: { data?: { error?: string } } };
  return x.response?.data?.error ?? fallback;
}
function SuratKontrolTab({ noRawat }: { noRawat: string }) {
  const [info, setInfo] = useState<SuratKontrolInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const besok = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
  const [tgl, setTgl] = useState(besok());
  const [poliList, setPoliList] = useState<SkPoli[]>([]);
  const [dokList, setDokList] = useState<SkDokter[]>([]);
  const [poli, setPoli] = useState<SkPoli | null>(null);
  const [dok, setDok] = useState<SkDokter | null>(null);
  const [busy, setBusy] = useState<"" | "poli" | "dokter" | "simpan" | "hapus">("");

  const muat = useCallback(() => {
    setLoading(true);
    suratKontrolInfo(noRawat)
      .then(r => setInfo(r.data))
      .catch(() => setErr("Gagal memuat data SEP/surat kontrol"))
      .finally(() => setLoading(false));
  }, [noRawat]);
  useEffect(() => { muat(); }, [muat]);

  const cariPoli = async () => {
    if (!info?.no_sep) return;
    setErr(""); setMsg(""); setBusy("poli"); setPoliList([]); setDokList([]); setPoli(null); setDok(null);
    try {
      const r = await suratKontrolPoli(info.no_sep, tgl);
      setPoliList(r.data.poli);
      if (r.data.poli.length === 0) setErr("Tidak ada poli spesialistik untuk tanggal ini");
    } catch (e: unknown) { setErr(pesanErr(e, "Gagal ambil poli dari BPJS")); }
    finally { setBusy(""); }
  };
  const cariDokter = async (p: SkPoli) => {
    setPoli(p); setDok(null); setDokList([]); setErr(""); setBusy("dokter");
    try {
      const r = await suratKontrolDokter(p.kode, tgl);
      setDokList(r.data.dokter);
      if (r.data.dokter.length === 0) setErr("Tidak ada jadwal dokter untuk poli/tanggal ini");
    } catch (e: unknown) { setErr(pesanErr(e, "Gagal ambil dokter dari BPJS")); }
    finally { setBusy(""); }
  };
  const simpan = async () => {
    if (!info?.no_sep || !poli || !dok) return;
    setErr(""); setMsg(""); setBusy("simpan");
    try {
      const r = await suratKontrolCreate({
        no_sep: info.no_sep, tgl_rencana: tgl,
        kd_dokter: dok.kode, nm_dokter: dok.nama, kd_poli: poli.kode, nm_poli: poli.nama,
      });
      setMsg(`Surat kontrol dibuat: ${r.data.no_surat}`);
      setPoliList([]); setDokList([]); setPoli(null); setDok(null);
      muat();
    } catch (e: unknown) { setErr(pesanErr(e, "Gagal membuat surat kontrol")); }
    finally { setBusy(""); }
  };
  const hapus = async (no_surat: string) => {
    if (!confirm(`Batalkan surat kontrol ${no_surat}? Ini juga menghapus di BPJS.`)) return;
    setErr(""); setMsg(""); setBusy("hapus");
    try { await suratKontrolHapus(no_surat); setMsg("Surat kontrol dibatalkan"); muat(); }
    catch (e: unknown) { setErr(pesanErr(e, "Gagal membatalkan surat kontrol")); }
    finally { setBusy(""); }
  };

  if (loading) return <div className="p-4 text-sm text-slate-400">Memuat…</div>;

  return (
    <div className="p-3 space-y-3">
      {err && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg p-2.5">{err}</div>}
      {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-2.5">{msg}</div>}

      {!info?.no_sep ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3">
          Pasien ini belum punya <b>SEP BPJS</b> pada kunjungan ini. Surat kontrol hanya bisa dibuat untuk peserta BPJS yang punya SEP.
        </div>
      ) : (
        <>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-0.5">
            <div>SEP: <b className="text-slate-800">{info.no_sep}</b> · {info.tgl_sep}</div>
            {info.nm_poli_sep && <div>Poli asal: {info.nm_poli_sep}</div>}
            {info.diagnosa && <div className="truncate">Dx: {info.diagnosa}</div>}
          </div>

          {/* Surat kontrol yang sudah ada */}
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1.5">Surat Kontrol Tercatat</div>
            {info.list.length === 0 ? (
              <div className="text-xs text-slate-400 py-2">Belum ada surat kontrol.</div>
            ) : (
              <div className="space-y-2">
                {info.list.map(sk => (
                  <div key={sk.no_surat} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 text-sm">{sk.no_surat}</div>
                        <div className="text-xs text-slate-500 mt-0.5">Kontrol: <b className="text-rose-700">{sk.tgl_rencana}</b></div>
                        <div className="text-xs text-slate-500">{sk.nm_poli} · {sk.nm_dokter}</div>
                      </div>
                      <button onClick={() => hapus(sk.no_surat)} disabled={busy === "hapus"}
                        className="shrink-0 text-[11px] text-rose-600 border border-rose-200 rounded-lg px-2 py-1 hover:bg-rose-50 disabled:opacity-50">
                        Batalkan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form buat surat kontrol baru */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-3">
            <div className="text-sm font-semibold text-slate-700">Buat Surat Kontrol Baru</div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 w-24 shrink-0">Tgl Kontrol</label>
              <input type="date" value={tgl} min={besok()} onChange={e => { setTgl(e.target.value); setPoliList([]); setDokList([]); setPoli(null); setDok(null); }}
                className="flex-1 rounded-lg border border-slate-300 text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400" />
            </div>
            <button onClick={cariPoli} disabled={busy === "poli"}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-50">
              {busy === "poli" ? "Mengambil poli…" : "1. Cari Poli Spesialistik"}
            </button>

            {poliList.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Pilih Poli</div>
                <div className="flex flex-wrap gap-1.5">
                  {poliList.map(p => (
                    <button key={p.kode} onClick={() => cariDokter(p)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border ${poli?.kode === p.kode ? "bg-rose-600 text-white border-rose-600" : "border-slate-300 text-slate-600 hover:border-rose-400"}`}>
                      {p.nama}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {busy === "dokter" && <div className="text-xs text-slate-400">Mengambil jadwal dokter…</div>}
            {dokList.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Pilih Dokter — {poli?.nama}</div>
                <div className="space-y-1.5">
                  {dokList.map(d => (
                    <button key={d.kode} onClick={() => setDok(d)}
                      className={`w-full text-left rounded-lg border px-3 py-2 ${dok?.kode === d.kode ? "border-rose-500 bg-rose-50" : "border-slate-200 hover:border-rose-300"}`}>
                      <div className="text-sm font-semibold text-slate-800">{d.nama}</div>
                      <div className="text-[11px] text-slate-500">{d.hari} {d.jadwal} · kuota {d.terpakai}/{d.kapasitas}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dok && (
              <button onClick={simpan} disabled={busy === "simpan"}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg py-2.5 disabled:opacity-50">
                {busy === "simpan" ? "Membuat…" : `Buat Surat Kontrol — ${poli?.nama} / ${dok.nama}`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Anestesi Sedasi (RM.IBS.11.005.A/B REV.01) — e-Nakes ─────────────────────
// 5 sub-tab urut formulir fisik: Pra Sedasi -> Monitoring -> Selama -> Pasca ->
// Monitoring Pasca. pra/selama/pasca = 1 record aktif (replace); monitoring
// multi-baris. Simpan ke tabel catatan_sedasi_* (sama dgn form Java Khanza).
type SedFld = { k: string; l: string; t?: "text" | "select" | "check"; opts?: string[] };
const SED_AIRWAY = ["Kanul Nasal", "Simple Mask", "NRM", "RM"];
const SED_KANUL = ["Nasal", "SM", "RM", "NRM"];
const SED_REG = ["reg", "ireg"];
function sedErr(e: unknown) { const x = e as { response?: { data?: { error?: string } } }; return x.response?.data?.error ?? "Gagal"; }

function SedForm({ noRawat, getFn, saveFn, groups }: {
  noRawat: string;
  getFn: (n: string) => Promise<{ data: SedasiRec }>;
  saveFn: (b: Record<string, unknown>) => Promise<{ data: { ok: boolean } }>;
  groups: { title: string; fields: SedFld[] }[];
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [terkunci, setTerkunci] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);
  const load = useCallback(() => {
    getFn(noRawat).then(r => {
      if (r.data.exists) {
        setTerkunci(Number(r.data.milik) !== 1);
        const o = { ...r.data } as Record<string, string>; delete o.exists; delete o.tanggal; delete o.nip; delete o.milik; setF(o);
      }
      else { setF({}); setTerkunci(false); }
    }).catch(() => setF({}));
  }, [noRawat, getFn]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3000); return () => clearTimeout(t); } }, [msg]);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    try { await saveFn({ no_rawat: noRawat, ...f }); setMsg({ t: "ok", m: "Tersimpan" }); load(); }
    catch (e) { setMsg({ t: "err", m: sedErr(e) }); } finally { setSaving(false); }
  };
  const lbl = "block text-[11px] font-semibold text-slate-500 mb-1";
  const inp = "w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  const fld = (fd: SedFld) => {
    if (fd.t === "check") return (
      <label key={fd.k} className="flex items-center gap-2 text-sm text-slate-700 py-1">
        <input type="checkbox" checked={f[fd.k] === "Ya"} onChange={e => set(fd.k, e.target.checked ? "Ya" : "Tidak")} />{fd.l}</label>);
    if (fd.t === "select") return (
      <label key={fd.k} className="block"><span className={lbl}>{fd.l}</span>
        <select value={f[fd.k] ?? ""} onChange={e => set(fd.k, e.target.value)} className={inp}>
          <option value="">—</option>{fd.opts!.map(o => <option key={o} value={o}>{o}</option>)}
        </select></label>);
    return (
      <label key={fd.k} className="block"><span className={lbl}>{fd.l}</span>
        <input value={f[fd.k] ?? ""} onChange={e => set(fd.k, e.target.value)} className={inp} /></label>);
  };
  return (
    <div className="space-y-3">
      {msg && <div className={`text-xs px-3 py-2 rounded-lg ${msg.t === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.m}</div>}
      {groups.map(g => (
        <div key={g.title} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-xs font-bold text-rose-700 uppercase tracking-wide">{g.title}</div>
          <div className="grid grid-cols-2 gap-2">{g.fields.map(fld)}</div>
        </div>
      ))}
      <div className="sticky bottom-0 bg-white/95 rounded-xl border border-slate-200 p-2">
        {terkunci && <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mb-1">Data ini dibuat petugas lain — hanya dapat dilihat.</div>}
        <button onClick={save} disabled={saving || terkunci} className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
          {saving ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}

// Asesmen Pra Bedah (tabel asesmen_pra_bedah_rscb) — bisa diedit di E-Dokter & E-Nakes.
const PRB_SECTIONS: { title: string; fields: { k: string; l: string; t?: "area" }[] }[] = [
  { title: "Identitas Tindakan", fields: [
    { k: "ruangan", l: "Ruangan" }, { k: "diagnosa", l: "Diagnosa" }, { k: "tindakan_bedah", l: "Tindakan Bedah" } ] },
  { title: "1. Subjektif", fields: [
    { k: "bb", l: "BB (kg)" }, { k: "tb", l: "TB (cm)" }, { k: "anamnesi", l: "Anamnesis", t: "area" },
    { k: "riwayat_asma", l: "Riwayat Asma" }, { k: "alergi", l: "Alergi" }, { k: "diabetes", l: "Diabetes Melitus" },
    { k: "hipertensi", l: "Hipertensi" }, { k: "riwayat_operasi", l: "Riwayat Operasi" },
    { k: "jenis_anestesi_riwayat", l: "Jenis Anestesi (riwayat)" }, { k: "komplikasi_riwayat", l: "Komplikasi (riwayat)" } ] },
  { title: "2. Objektif", fields: [
    { k: "keadaan_umum", l: "Keadaan Umum" }, { k: "gcs", l: "GCS" }, { k: "td", l: "TD" }, { k: "nadi", l: "Nadi" },
    { k: "rr", l: "RR" }, { k: "suhu", l: "Suhu" }, { k: "gerakan_leher", l: "Gerakan Leher" },
    { k: "methohyoid", l: "Jarak Mentohyoid" }, { k: "mallampati", l: "Mallampati" }, { k: "thorax", l: "Thorax" },
    { k: "abdomen", l: "Abdomen" }, { k: "ekstremitas", l: "Ekstremitas" }, { k: "laboratorium", l: "Laboratorium", t: "area" },
    { k: "ekg", l: "EKG" }, { k: "ro_thorax", l: "Ro Thorax" }, { k: "pemeriksaan_fisik", l: "Pemeriksaan Fisik Lain", t: "area" },
    { k: "lain_lain", l: "Lain-lain", t: "area" } ] },
  { title: "3. Planning (Rencana)", fields: [
    { k: "diagnosa_pra_bedah", l: "Diagnosa Pra Bedah" }, { k: "rencana_tindakan", l: "Rencana Tindakan" },
    { k: "premedikasi", l: "Premedikasi" }, { k: "puasa", l: "Puasa" }, { k: "persediaan_darah", l: "Persediaan Darah" } ] },
];

function AsesmenPraBedahTab({ noRawat, kdDokter }: { noRawat: string; kdDokter?: string }) {
  const [f, setF] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nmDokter, setNmDokter] = useState("");
  const [exists, setExists] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    edokterAsesmenPraBedahGet(noRawat, kdDokter)
      .then(r => { setF(r.data.exists ? (r.data.data ?? {}) : {}); setNmDokter(r.data.nm_dokter ?? ""); setExists(!!r.data.exists); })
      .catch(() => setF({}))
      .finally(() => setLoading(false));
  }, [noRawat, kdDokter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const simpan = async () => {
    setSaving(true);
    try {
      await edokterAsesmenPraBedahSave({ no_rawat: noRawat, kd_dokter: kdDokter, data: f });
      setMsg({ t: "ok", m: "Asesmen pra bedah tersimpan" }); load();
    } catch (e) { setMsg({ t: "err", m: notifGagal(e as { response?: { data?: { error?: string } } }, "Gagal menyimpan") }); }
    finally { setSaving(false); }
  };
  const hapus = async () => {
    if (!window.confirm("Hapus asesmen pra bedah ini?")) return;
    try { await edokterAsesmenPraBedahHapus({ no_rawat: noRawat }); setF({}); setExists(false); setMsg({ t: "ok", m: "Asesmen dihapus" }); }
    catch (e) { setMsg({ t: "err", m: notifGagal(e as { response?: { data?: { error?: string } } }, "Gagal menghapus") }); }
  };

  const lbl = "block text-[11px] font-semibold text-slate-500 mb-1";
  const inp = "w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  // fld sebagai FUNGSI (bukan komponen inline) → tidak remount tiap keystroke.
  const fld = (k: string, l: string, t?: "area") => (
    <label key={k} className="block"><span className={lbl}>{l}</span>
      {t === "area"
        ? <textarea value={f[k] ?? ""} onChange={e => set(k, e.target.value)} rows={2} className={inp} />
        : <input value={f[k] ?? ""} onChange={e => set(k, e.target.value)} className={inp} />}
    </label>
  );

  if (loading) return <div className="py-10 text-center text-slate-400 text-sm">Memuat…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-slate-800">Asesmen Pra Bedah</div>
        {nmDokter && <div className="text-xs text-slate-500">Petugas: {nmDokter}</div>}
      </div>
      {msg && <div className={`text-xs px-3 py-2 rounded-lg ${msg.t === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.m}</div>}
      {PRB_SECTIONS.map(s => (
        <div key={s.title} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-xs font-bold text-teal-700 uppercase tracking-wide">{s.title}</div>
          <div className="grid grid-cols-2 gap-2">{s.fields.map(x => fld(x.k, x.l, x.t))}</div>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={simpan} disabled={saving} className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
          {saving ? "Menyimpan…" : exists ? "Perbarui" : "Simpan"}
        </button>
        {exists && <button onClick={hapus} className="px-4 bg-white border border-red-300 text-red-600 text-sm font-semibold rounded-lg py-2.5">Hapus</button>}
      </div>
    </div>
  );
}

function SedMonForm({ noRawat, full }: { noRawat: string; full: boolean }) {
  const listFn = full ? enakesSedasiMonList : enakesSedasiMonpList;
  const saveFn = full ? enakesSedasiMonSave : enakesSedasiMonpSave;
  const hapusFn = full ? enakesSedasiMonHapus : enakesSedasiMonpHapus;
  const cols: SedFld[] = full
    ? [{ k: "sistol", l: "Sistol" }, { k: "diastol", l: "Diastol" }, { k: "nadi", l: "Nadi" }, { k: "rr", l: "RR" }, { k: "spo2", l: "SPO2" }, { k: "o2", l: "O2" }, { k: "suhu", l: "Suhu" }, { k: "infus", l: "Infus" }, { k: "keterangan", l: "Keterangan" }, { k: "medikasi", l: "Medikasi" }, { k: "perdarahan", l: "Perdarahan" }, { k: "urine", l: "Urine" }]
    : [{ k: "sistol", l: "Sistol" }, { k: "diastol", l: "Diastol" }, { k: "nadi", l: "Nadi" }, { k: "rr", l: "Respirasi" }, { k: "suhu", l: "Suhu" }];
  const [rows, setRows] = useState<SedasiMonRow[]>([]);
  const [inp, setInp] = useState<Record<string, string>>({});
  const [waktu, setWaktu] = useState<string>(() => nowLocal()); // tanggal & jam titik pantau (bisa diedit)
  const [editKey, setEditKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => { listFn(noRawat).then(r => setRows(r.data ?? [])).catch(() => setRows([])); }, [noRawat, listFn]);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string) => setInp(p => ({ ...p, [k]: v }));
  const startEdit = (r: SedasiMonRow) => {
    const o: Record<string, string> = {};
    for (const c of cols) o[c.k] = r[c.k] ?? "";
    setInp(o); setEditKey(r.tanggal ?? "");
    setWaktu(((r.tanggal ?? "").slice(0, 16)).replace(" ", "T") || nowLocal());
  };
  const add = async () => {
    setSaving(true);
    try {
      await saveFn({ no_rawat: noRawat, tanggal: waktu.replace("T", " "), ...inp, ...(editKey ? { edit: true, orig_tanggal: editKey } : {}) });
      setInp({}); setEditKey(null); setWaktu(nowLocal()); load();
    } catch (e) { alert(sedErr(e)); } finally { setSaving(false); }
  };
  const del = async (tgl: string) => { if (!window.confirm("Hapus titik pantau ini?")) return; try { await hapusFn({ no_rawat: noRawat, tanggal: tgl }); load(); } catch (e) { alert(sedErr(e)); } };
  const inpc = "w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs";
  return (
    <div className="space-y-3">
      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
        <div className="text-xs font-bold text-rose-700 uppercase tracking-wide">{editKey ? "Ubah" : "Tambah"} Titik Pantau {full ? "" : "Pasca"}</div>
        <DtField label="Tanggal & Jam" value={waktu} onChange={setWaktu} />
        <div className="grid grid-cols-3 gap-2">
          {cols.map(c => (
            <label key={c.k} className="block"><span className="block text-[11px] font-semibold text-slate-500 mb-1">{c.l}</span>
              <input value={inp[c.k] ?? ""} onChange={e => set(c.k, e.target.value)} className={inpc} /></label>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={add} disabled={saving} className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
            {saving ? "Menyimpan…" : editKey ? "Perbarui" : "+ Tambah"}
          </button>
          {editKey && <button onClick={() => { setInp({}); setEditKey(null); }} className="px-4 bg-white border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2">Batal</button>}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-2 overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead><tr className="text-slate-500 border-b">
            <th className="text-left px-1 py-1">Jam</th>
            {cols.map(c => <th key={c.k} className="text-left px-1 py-1">{c.l}</th>)}
            <th className="px-1"></th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length + 2} className="text-center text-slate-400 py-3">Belum ada data</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-1 py-1 whitespace-nowrap">{(r.tanggal ?? "").slice(11, 16)}</td>
                {cols.map(c => <td key={c.k} className="px-1 py-1">{r[c.k]}</td>)}
                <td className="px-1 whitespace-nowrap">
                  {Number(r.milik) === 1 && <button onClick={() => startEdit(r)} className="text-rose-600 hover:underline mr-2">Edit</button>}
                  {Number(r.milik) === 1 && <button onClick={() => del(r.tanggal)} className="text-red-500 hover:underline">Hapus</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CatatanSedasiTab({ noRawat }: { noRawat: string }) {
  const [sub, setSub] = useState<"pra" | "mon" | "selama" | "pasca" | "monp">("pra");
  const SUBS: [typeof sub, string][] = [["pra", "Pra Sedasi"], ["mon", "Monitoring"], ["selama", "Selama"], ["pasca", "Pasca Sedasi"], ["monp", "Monitoring Pasca"]];
  const praGroups = [
    { title: "Identitas Tindakan", fields: [
      { k: "kd_dokter", l: "Kode Dokter" }, { k: "kd_penata", l: "Kode Penata" }, { k: "asisten", l: "Asisten (nama)" },
      { k: "diagnosis", l: "Diagnosis" }, { k: "tindakan", l: "Tindakan" }, { k: "jam_awal", l: "Jam Awal" },
      { k: "jenis_sedasi", l: "Jenis Sedasi", t: "select" as const, opts: ["Ringan", "Sedang", "Dalam"] }] },
    { title: "A. Checklist Persiapan Sedasi", fields: [
      { k: "cl_informed_consent", l: "Informed Consent", t: "check" as const }, { k: "cl_obat_anestesi", l: "Obat Anestesi", t: "check" as const },
      { k: "cl_tatalaksana_napas", l: "Tatalaksana Jalan Napas", t: "check" as const }, { k: "cl_mesin_anestesi", l: "Mesin Anestesi", t: "check" as const },
      { k: "cl_obat_emergensi", l: "Obat Emergensi", t: "check" as const }, { k: "cl_monitoring", l: "Monitoring", t: "check" as const },
      { k: "cl_suction", l: "Suction Aparatus", t: "check" as const }] },
    { title: "B. Penilaian Pra Sedasi", fields: [
      { k: "kesadaran", l: "Kesadaran" }, { k: "gcs_e", l: "GCS E" }, { k: "gcs_v", l: "GCS V" }, { k: "gcs_m", l: "GCS M" },
      { k: "airway", l: "Airway", t: "select" as const, opts: SED_AIRWAY }, { k: "td", l: "Tekanan Darah" },
      { k: "nadi", l: "Nadi" }, { k: "nadi_reg", l: "Reg/Ireg", t: "select" as const, opts: SED_REG }, { k: "rr", l: "RR" },
      { k: "kanul", l: "Kanul", t: "select" as const, opts: SED_KANUL }, { k: "o2", l: "O2 (L/mnt)" }, { k: "spo2", l: "SPO2 (%)" }] },
  ];
  const selamaGroups = [{ title: "C. Keadaan Selama Sedasi", fields: [
    { k: "letak", l: "Letak Penderita", t: "select" as const, opts: ["Supine", "Litotomi", "Lateral dekubitus (R)", "Lateral dekubitus (L)"] },
    { k: "airway", l: "Airway", t: "select" as const, opts: ["Kanul Nasal", "Face Mask", "Oropharyngeal Airway"] },
    { k: "lama_sedasi", l: "Lama Sedasi (menit)" }, { k: "lama_tindakan", l: "Lama Tindakan (menit)" }, { k: "jam_akhir", l: "Jam Akhir" }, { k: "medikasi", l: "Medikasi" }] }];
  const pascaGroups = [
    { title: "D. Keadaan Pasca Sedasi", fields: [
      { k: "kesadaran", l: "Kesadaran" }, { k: "airway", l: "Airway", t: "select" as const, opts: SED_AIRWAY },
      { k: "td", l: "Tekanan Darah" }, { k: "nadi", l: "Nadi" }, { k: "nadi_reg", l: "Reg/Ireg", t: "select" as const, opts: SED_REG },
      { k: "rr", l: "RR" }, { k: "kanul", l: "Kanul", t: "select" as const, opts: SED_KANUL }, { k: "o2", l: "O2" }, { k: "spo2", l: "SPO2" }, { k: "aldrete", l: "ALDRETE Score" }] },
    { title: "E. Jam Keluar & Instruksi", fields: [
      { k: "keluar_jam", l: "Jam Keluar" }, { k: "pindah_ke", l: "Pindah ke", t: "select" as const, opts: ["Ruang Rawat", "ICU", "HCU", "NICU", "PICU"] },
      { k: "kd_perawat_ruangan", l: "Kode Perawat Ruangan" },
      { k: "ins_pemantauan", l: "Pemantauan tiap" }, { k: "ins_posisi", l: "Posisi pasien" }, { k: "ins_nyeri", l: "Pengelolaan nyeri" },
      { k: "ins_mual_muntah", l: "Penanganan mual muntah" }, { k: "ins_diet", l: "Diet & nutrisi" }, { k: "ins_obat_lain", l: "Obat lain" }, { k: "ins_lain", l: "Lain-lain" }] },
  ];
  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {SUBS.map(([s, l]) => (
          <button key={s} onClick={() => setSub(s)} className={`shrink-0 text-[11px] font-semibold rounded-full px-3 py-1.5 border ${sub === s ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-300"}`}>{l}</button>
        ))}
      </div>
      {sub === "pra" && <SedForm noRawat={noRawat} getFn={enakesSedasiPraGet} saveFn={enakesSedasiPraSave} groups={praGroups} />}
      {sub === "mon" && <SedMonForm noRawat={noRawat} full />}
      {sub === "selama" && <SedForm noRawat={noRawat} getFn={enakesSedasiSelamaGet} saveFn={enakesSedasiSelamaSave} groups={selamaGroups} />}
      {sub === "pasca" && <SedForm noRawat={noRawat} getFn={enakesSedasiPascaGet} saveFn={enakesSedasiPascaSave} groups={pascaGroups} />}
      {sub === "monp" && <SedMonForm noRawat={noRawat} full={false} />}
    </div>
  );
}

function IcuAsesmenTab({ noRawat, kdDokter }: { noRawat: string; kdDokter?: string }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [tglKaji, setTglKaji] = useState("");
  const [tglTiba, setTglTiba] = useState("");
  const [exists, setExists] = useState(false);
  const [meta, setMeta] = useState<{ dokter?: string; oleh?: string } | null>(null);
  const [hist, setHist] = useState<EdokterIcuHistori[] | null>(null);
  const [reload, setReload] = useState(0);
  const [ket, setKet] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(""); const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    edokterIcuGet(noRawat, kdDokter).then(r => {
      const d = r.data;
      setExists(d.exists);
      setForm(d.data ?? {});
      setTglKaji(toLocalInput(d.tanggal) || toLocalInput(new Date().toISOString().slice(0, 19).replace("T", " ")));
      setTglTiba(toLocalInput(d.tiba_ruangan));
      setMeta(d.exists ? { dokter: d.nm_dokter, oleh: d.created_by } : null);
    }).catch(() => { setExists(false); setForm({}); });
    edokterIcuHistori(noRawat, kdDokter).then(r => setHist(r.data)).catch(() => setHist([]));
  }, [noRawat, kdDokter, reload]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function simpan() {
    if (exists && !ket.trim()) { setErr("Sudah ada asesmen aktif — isi alasan revisi untuk mengganti."); return; }
    setSaving(true); setErr(""); setOkMsg("");
    try {
      const r = await edokterIcuSave({
        no_rawat: noRawat, kd_dokter: kdDokter, tanggal: toSql(tglKaji), tiba_ruangan: toSql(tglTiba),
        data: form, keterangan_edit: ket,
      });
      setOkMsg(r.data.revised ? "Tersimpan sebagai revisi baru." : "Asesmen tersimpan.");
      setKet(""); setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan asesmen ICU"));
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-800">Asesmen Awal Medis Kritis ICU</div>
          {exists && <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">Ada versi aktif</span>}
        </div>
        {meta && <div className="text-[11px] text-slate-500">Dokter: {meta.dokter || "-"} · dibuat oleh {meta.oleh || "-"}</div>}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-600">Tiba di Ruangan
            <input type="datetime-local" value={tglTiba} onChange={e => setTglTiba(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5" /></label>
          <label className="text-xs text-slate-600">Waktu Pengkajian
            <input type="datetime-local" value={tglKaji} onChange={e => setTglKaji(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5" /></label>
        </div>
      </div>

      {ICU_ASESMEN.map(s => (
        <div key={s.sec} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">{s.sec}</div>
          {s.fields.map(f => (
            <div key={f.k}>
              <label className="text-xs font-semibold text-slate-600">{f.l}</label>
              {f.t === "area" ? (
                <textarea value={form[f.k] ?? ""} onChange={e => set(f.k, e.target.value)} rows={2}
                  className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              ) : f.t === "sel" ? (
                <select value={form[f.k] ?? ""} onChange={e => set(f.k, e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                  {(f.o ?? []).map(o => <option key={o} value={o}>{o || "— pilih —"}</option>)}
                </select>
              ) : (
                <input value={form[f.k] ?? ""} onChange={e => set(f.k, e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
        {exists && (
          <div>
            <label className="text-xs font-semibold text-amber-700">Alasan revisi (wajib untuk mengganti versi aktif)</label>
            <input value={ket} onChange={e => setKet(e.target.value)} placeholder="mis. koreksi diagnosis / update kondisi"
              className="mt-0.5 w-full rounded-lg border border-amber-300 text-xs px-2 py-1.5" />
          </div>
        )}
        {err && <div className="text-xs text-red-600">{err}</div>}
        {okMsg && <div className="text-xs text-emerald-700">{okMsg}</div>}
        <button onClick={simpan} disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
          {saving ? "Menyimpan…" : exists ? "Simpan Revisi" : "Simpan Asesmen"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
        <div className="text-xs font-bold text-slate-600 mb-1.5">Riwayat / Versi</div>
        {hist === null ? <div className="text-slate-400 text-xs">Memuat…</div>
          : hist.length === 0 ? <div className="text-slate-400 text-xs">Belum ada.</div>
          : hist.map(h => (
            <div key={h.id} className="text-[11px] text-slate-500 border-t border-slate-100 py-1 flex items-center justify-between gap-2">
              <span className="truncate">#{h.id} · {(h.tanggal ?? "").slice(0, 16)} · {h.diagnosa_kerja || "-"}</span>
              <span className={`shrink-0 rounded px-1.5 ${h.status === "aktif" ? "bg-emerald-50 text-emerald-700" : h.status === "dibatalkan" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>{h.status}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Asesmen Risiko Kekerasan Fisik & Melarikan Diri (RM.103) ─────────────────
// Urutan label WAJIB sama dengan array kolom di backend (enakes.rs).
const KEKERASAN_STATIK_LBL = [
  "Insiden kekerasan baru-baru ini", "Riwayat penggunaan senjata", "Laki-laki", "Usia di bawah 35 tahun",
  "Riwayat kriminal", "Riwayat tindakan berbahaya / ide kekerasan", "Riwayat kekerasan masa kanak-kanak",
  "Kurangnya peran dalam hidup (pekerjaan, hubungan)", "Riwayat penggunaan NAPZA",
];
const KEKERASAN_DINAMIS_LBL = [
  "Mengekspresikan ide untuk melukai orang lain", "Akses untuk melakukan tindakan kekerasan",
  "Ide paranoid atau lainnya", "Perintah halusinasi untuk tindakan kekerasan", "Kemarahan, frustasi, atau agitasi",
  "Kesenangan untuk ide / tindakan kekerasan", "Perilaku seksual yang tidak wajar",
  "Berkurangnya / kehilangan kontrol diri", "Penggunaan NAPZA",
];
const MELARIKAN_STATIK_LBL = [
  "Riwayat melarikan diri", "Riwayat penolakan pengobatan / ketidakpatuhan", "Usia ≤ 35 tahun", "Laki-laki",
  "Diagnosis skizofrenia", "Belum menikah", "Riwayat penggunaan NAPZA", "Diagnosis gangguan kepribadian", "Riwayat kriminal",
];
const MELARIKAN_DINAMIS_LBL = [
  "Anti treatment / insight jelek", "Penggunaan NAPZA", "Kebosanan", "Perintah halusinasi untuk melarikan diri",
  "Berkurangnya / kehilangan kontrol diri (dementia)", "Perilaku seksual yang tidak wajar",
  "Kemarahan / frustasi", "Ketakutan perawatan (pasien, nakes, pengobatan)",
];
function risikoLevel(total: number) {
  return total > 14 ? "Tinggi(>14)" : total >= 7 ? "Sedang(7-14)" : "Rendah(<7)";
}
function risikoCls(level: string) {
  return level.startsWith("Tinggi") ? "bg-red-50 text-red-700 border-red-200"
    : level.startsWith("Sedang") ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function RisikoTab({ noRawat, judul, statik, dinamis, listFn, saveFn, hapusFn, detailFn }: {
  noRawat: string; judul: string; statik: string[]; dinamis: string[];
  listFn: (n: string) => Promise<{ data: EnakesRisiko[] }>;
  saveFn: (b: RisikoBody) => Promise<{ data: { ok: boolean; total: number; level: string } }>;
  hapusFn?: (b: { no_rawat: string; tanggal: string }) => Promise<{ data: { ok: boolean } }>;
  detailFn?: (n: string, t: string) => Promise<{ data: RisikoDetail }>;
}) {
  const [list, setList] = useState<EnakesRisiko[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [js, setJs] = useState<string[]>(() => Array(statik.length).fill("Tidak"));
  const [jd, setJd] = useState<string[]>(() => Array(dinamis.length).fill("Tidak"));
  const [pencegahan, setPencegahan] = useState("");
  const [waktu, setWaktu] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { listFn(noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat, reload, listFn]);

  const statikTotal = js.reduce((a, v) => a + (v === "Ya" ? 1 : 0), 0);
  const dinamisTotal = jd.reduce((a, v) => a + (v === "Ya" ? 2 : 0), 0);
  const total = statikTotal + dinamisTotal;
  const level = risikoLevel(total);

  function reset() { setJs(Array(statik.length).fill("Tidak")); setJd(Array(dinamis.length).fill("Tidak")); setPencegahan(""); setWaktu(nowLocal()); setEditKey(null); }

  async function startEdit(s: EnakesRisiko) {
    if (!detailFn) return;
    const t = s.tanggal ?? "";
    setErr("");
    try {
      const d = (await detailFn(noRawat, t)).data;
      setJs(statik.map((_, i) => d?.statik?.[i] ?? "Tidak"));
      setJd(dinamis.map((_, i) => d?.dinamis?.[i] ?? "Tidak"));
      setPencegahan(d?.pencegahan ?? "");
      setWaktu(t.slice(0, 16).replace(" ", "T"));
      setEditKey(t); setOpen(true);
    } catch {
      setErr("Gagal memuat detail asesmen");
    }
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      await saveFn({ no_rawat: noRawat, statik: js, dinamis: jd, pencegahan, waktu, edit: !!editKey, orig_tanggal: editKey ?? undefined });
      setOpen(false); setReload(x => x + 1); reset();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan asesmen"));
    } finally { setSaving(false); }
  }

  async function hapus(s: EnakesRisiko) {
    if (!hapusFn) return;
    if (!window.confirm(`Hapus ${judul} ini?`)) return;
    try {
      await hapusFn({ no_rawat: noRawat, tanggal: s.tanggal ?? "" });
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }

  const OPS = ["Tidak", "Ya", "Tidak Tahu"];
  const Row = (lbl: string, val: string, set: (v: string) => void, bobot: number) => (
    <div className="border-b border-slate-100 pb-2">
      <div className="text-xs text-slate-700 mb-1">{lbl} <span className="text-slate-400">(Ya={bobot})</span></div>
      <div className="grid grid-cols-3 gap-1">
        {OPS.map(o => (
          <button key={o} type="button" onClick={() => set(o)}
            className={`text-[11px] rounded-lg border px-1 py-1 font-semibold transition-colors ${
              val === o ? (o === "Ya" ? "bg-red-600 text-white border-red-600" : "bg-slate-600 text-white border-slate-600")
                : "bg-white text-slate-500 border-slate-200 hover:border-rose-300"}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
          <div className="text-sm font-bold text-slate-800">{editKey ? `Ubah ${judul}` : judul}</div>
          <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">Faktor Statik (Riwayat) · Ya = 1</div>
          {statik.map((lbl, i) => <div key={i}>{Row(lbl, js[i], v => setJs(p => p.map((x, j) => j === i ? v : x)), 1)}</div>)}
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">Faktor Dinamis (Saat Ini) · Ya = 2</div>
          {dinamis.map((lbl, i) => <div key={i}>{Row(lbl, jd[i], v => setJd(p => p.map((x, j) => j === i ? v : x)), 2)}</div>)}
          <div>
            <label className="text-xs font-semibold text-slate-600">Faktor-faktor pencegahan</label>
            <textarea value={pencegahan} onChange={e => setPencegahan(e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
          </div>
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
            <span className="text-slate-500">Statik {statikTotal} + Dinamis {dinamisTotal}</span>
            <span className={`font-bold rounded-md border px-2 py-0.5 ${risikoCls(level)}`}>Total {total} · {level}</span>
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : "Simpan Asesmen"}
            </button>
            <button onClick={() => { setOpen(false); setErr(""); reset(); }}
              className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { reset(); setErr(""); setOpen(true); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + {judul}
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada asesmen.</div>
      ) : (
        list.map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-bold rounded-md border px-2 py-0.5 ${risikoCls(s.level)}`}>Total {s.total} · {s.level || "-"}</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                {(s.tanggal ?? "").slice(0, 16)}
                {detailFn && s.milik === 1 && <button onClick={() => startEdit(s)} className="text-rose-600 hover:text-rose-800 font-semibold">Edit</button>}
                {hapusFn && s.milik === 1 && <button onClick={() => hapus(s)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Statik {s.statik_total} + Dinamis {s.dinamis_total}</div>
            {s.pencegahan && <div className="mt-1 text-[11px] text-slate-500">Pencegahan: {s.pencegahan}</div>}
            {s.petugas && <div className="mt-1 text-[11px] text-slate-400">Petugas: {s.petugas}</div>}
          </div>
        ))
      )}
    </div>
  );
}

// ── Pengkajian Keperawatan Pasien ICU (Comprehensive Admission Assessment) ───
type PF = { k: string; l: string; t: "text" | "area" | "sel" | "multi"; o?: string[] };
type PSec = { t: string; special?: "obat" | "gizi" | "discharge" | "masalah"; f?: PF[] };
const YT = ["Ya", "Tidak"];
const PENGKAJIAN_ICU: PSec[] = [
  { t: "Riwayat Kesehatan Yang Lalu", f: [
    { k: "riw_kondisi", l: "Kondisi kesehatan sebelumnya", t: "text" },
    { k: "riw_dirawat", l: "Pernah dirawat dengan kasus yang sama", t: "text" },
    { k: "riw_alergi", l: "Riwayat Alergi", t: "text" },
    { k: "riw_psikiater", l: "Riwayat masalah emosi/psikiater", t: "text" },
  ] },
  { t: "A. Sistem Pernafasan", f: [
    { k: "nafas_jalan", l: "Jalan nafas", t: "sel", o: ["Bersih", "Sumbatan"] },
    { k: "nafas_sumbatan", l: "Sumbatan berupa", t: "multi", o: ["Sputum", "Darah"] },
    { k: "nafas_rr", l: "RR (x/menit)", t: "text" },
    { k: "nafas_obat_bantu", l: "Penggunaan obat bantu nafas", t: "sel", o: YT },
    { k: "nafas_ett", l: "Terpasang ETT", t: "sel", o: YT },
    { k: "nafas_ventilator", l: "Terpasang Ventilator", t: "sel", o: YT },
    { k: "vent_tv", l: "Ventilator: TV", t: "text" }, { k: "vent_rr", l: "Ventilator: RR", t: "text" },
    { k: "vent_peep", l: "Ventilator: PEEP", t: "text" }, { k: "vent_ie", l: "Ventilator: IE", t: "text" },
    { k: "vent_fio2", l: "Ventilator: FiO2", t: "text" },
    { k: "nafas_irama", l: "Irama", t: "sel", o: ["Teratur", "Tidak teratur"] },
    { k: "nafas_kedalaman", l: "Kedalaman", t: "sel", o: ["Dalam", "Tidak dalam"] },
    { k: "nafas_sputum", l: "Sputum", t: "sel", o: ["Putih", "Kuning", "Hijau"] },
    { k: "nafas_konsistensi", l: "Konsistensi", t: "sel", o: ["Kental", "Tidak kental"] },
    { k: "nafas_suara", l: "Suara nafas", t: "sel", o: ["Ronchi", "Wheezing", "Vesikuler"] },
  ] },
  { t: "B. Sistem Kardiovaskuler", f: [
    { k: "kv_nadi", l: "Nadi (x/menit)", t: "text" }, { k: "kv_td", l: "Tekanan darah", t: "text" },
    { k: "kv_pulsasi", l: "Pulsasi", t: "sel", o: ["Kuat", "Lemah"] },
    { k: "kv_jvp", l: "Distensi vena jugularis", t: "sel", o: ["Ada", "Tidak ada"] },
    { k: "kv_akral", l: "Akral", t: "sel", o: ["Hangat", "Dingin"] },
    { k: "kv_warna", l: "Warna kulit", t: "sel", o: ["Kemerahan", "Pucat", "Cyanosis"] },
    { k: "kv_crt", l: "Waktu pengisian kapiler (CRT)", t: "text" },
    { k: "kv_irama", l: "Irama jantung", t: "sel", o: ["Teratur", "Tidak teratur"] },
    { k: "kv_nyeri_dada", l: "Nyeri dada", t: "sel", o: YT },
    { k: "kv_bunyi", l: "Bunyi jantung", t: "sel", o: ["Murmur", "Gallop"] },
    { k: "kv_perdarahan", l: "Perdarahan", t: "sel", o: YT },
    { k: "kv_area", l: "Area perdarahan", t: "text" }, { k: "kv_jml", l: "Jumlah (cc/jam)", t: "text" },
  ] },
  { t: "C. Sistem Syaraf Pusat", f: [
    { k: "sp_kesadaran", l: "Tingkat kesadaran", t: "text" },
    { k: "sp_pupil", l: "Pupil", t: "sel", o: ["Isokor", "Anisokor", "Miosis", "Midriasis"] },
    { k: "sp_gcs_e", l: "GCS Eye", t: "text" }, { k: "sp_gcs_m", l: "GCS Motorik", t: "text" }, { k: "sp_gcs_v", l: "GCS Verbal", t: "text" },
    { k: "sp_otot", l: "Kekuatan otot", t: "text" }, { k: "sp_koordinasi", l: "Koordinasi motorik", t: "text" },
  ] },
  { t: "D. Sistem Gastrointestinal", f: [
    { k: "gi_distensi", l: "Distensi", t: "sel", o: YT }, { k: "gi_lingkar", l: "Lingkar perut (cm)", t: "text" },
    { k: "gi_nyeri", l: "Nyeri", t: "sel", o: YT }, { k: "gi_peristaltik", l: "Peristaltik", t: "sel", o: YT },
    { k: "gi_defekasi", l: "Defekasi", t: "sel", o: ["Normal", "Tidak normal"] }, { k: "gi_defekasi_ket", l: "Ket. defekasi", t: "text" },
  ] },
  { t: "E. Sistem Perkemihan", f: [
    { k: "km_warna", l: "Warna", t: "sel", o: ["Bening", "Kuning", "Merah", "Kecoklatan"] },
    { k: "km_nyeri", l: "Nyeri", t: "sel", o: YT }, { k: "km_distensi", l: "Distensi", t: "sel", o: YT },
    { k: "km_ctheter", l: "Penggunaan ctheter urine", t: "sel", o: YT }, { k: "km_jml", l: "Jumlah urine (cc/jam)", t: "text" },
  ] },
  { t: "F. Obstetri Ginekologi", f: [
    { k: "obs_hamil", l: "Hamil", t: "sel", o: YT }, { k: "obs_hpht", l: "HPHT", t: "text" }, { k: "obs_keluhan", l: "Keluhan", t: "text" },
  ] },
  { t: "G. Muskuloskeletal & Integumen", f: [
    { k: "ms_tugor", l: "Tugor kulit", t: "sel", o: ["Elastis", "Tidak elastis"] },
    { k: "ms_luka", l: "Terdapat luka", t: "sel", o: YT }, { k: "ms_luka_lok", l: "Lokasi luka", t: "text" },
    { k: "ms_fraktur", l: "Fraktur", t: "sel", o: YT }, { k: "ms_fraktur_dimana", l: "Fraktur dimana", t: "text" },
    { k: "ms_sulit", l: "Kesulitan bergerak", t: "sel", o: YT },
    { k: "ms_alat", l: "Penggunaan alat bantu", t: "sel", o: YT }, { k: "ms_alat_ket", l: "Alat bantu (sebutkan)", t: "text" },
    { k: "ms_lesi", l: "Lokasi luka / lesi lain", t: "text" },
  ] },
  { t: "H. Sistem Hematologi", f: [
    { k: "hema", l: "Perdarahan", t: "multi", o: ["Gusi", "Nasal", "Pethecia", "Echimosis"] },
    { k: "hema_lain", l: "Lain-lain", t: "text" },
  ] },
  { t: "I. Psikososial", f: [
    { k: "ps_komunikasi", l: "Komunikasi yang digunakan", t: "text" },
    { k: "ps_koping", l: "Koping", t: "sel", o: ["Menerima", "Menolak", "Kehilangan", "Mandiri"] },
    { k: "ps_afek", l: "Afek", t: "sel", o: ["Gelisah", "Insomnia", "Tegang", "Depresi", "Apatis"] },
    { k: "ps_hdr", l: "HDR", t: "sel", o: ["Emosional", "Tidak berdaya", "Rasa bersalah"] },
    { k: "ps_persepsi", l: "Persepsi penyakit", t: "sel", o: ["Menerima", "Menolak"] },
    { k: "ps_mengerti", l: "Mengerti tentang penyakit", t: "sel", o: ["Berat", "Sedang", "Ringan"] },
    { k: "ps_hubungan", l: "Hubungan keluarga", t: "sel", o: ["Harmonis", "Tidak harmonis"] },
    { k: "ps_orang_dekat", l: "Orang terdekat", t: "text" },
  ] },
  { t: "J. Spiritual", f: [
    { k: "sp_agama", l: "Agama", t: "text" },
    { k: "sp_kebiasaan", l: "Kebiasaan mengatasi stress dari sisi spiritual", t: "text" },
  ] },
  { t: "K. Alat Invasif Yang Digunakan", f: [
    { k: "ai_wsd", l: "Drain/WSD", t: "sel", o: YT }, { k: "ai_wsd_warna", l: "WSD warna", t: "text" }, { k: "ai_wsd_jml", l: "WSD jumlah (cc/jam)", t: "text" },
    { k: "ai_drainkepala", l: "Drain kepala", t: "sel", o: YT }, { k: "ai_dk_warna", l: "Drain kepala warna", t: "text" }, { k: "ai_dk_jml", l: "Drain kepala jumlah (cc/jam)", t: "text" },
    { k: "ai_ivline", l: "IV Line", t: "sel", o: YT }, { k: "ai_lain", l: "Lain-lain", t: "text" },
  ] },
  { t: "L. Daftar Obat", special: "obat" },
  { t: "M. Skrining Gizi (MST)", special: "gizi" },
  { t: "N. Risiko Cedera / Jatuh", f: [
    { k: "jatuh", l: "Risiko cedera/jatuh", t: "sel", o: ["Tidak", "Ya (isi form pencegahan jatuh)"] },
  ] },
  { t: "O. Status Fungsional", f: [
    { k: "fungsional", l: "Aktifitas dan mobilitas", t: "sel", o: ["Mandiri", "Perlu bantuan"] },
    { k: "fungsional_ket", l: "Perlu bantuan (sebutkan)", t: "text" },
  ] },
  { t: "P. Pengkajian Nyeri", f: [
    { k: "nyeri", l: "Nyeri / tidak nyaman", t: "sel", o: YT },
    { k: "nyeri_lokasi", l: "Nyeri di", t: "text" }, { k: "nyeri_score", l: "Score (0-10)", t: "text" },
    { k: "nyeri_skala", l: "Skala digunakan", t: "sel", o: ["Numeric", "Wong Baker", "CRIES", "FLACC", "COMFORT"] },
    { k: "nyeri_ai", l: "Nilai A/I", t: "text" },
    { k: "nyeri_pengaruh", l: "Nyeri mempengaruhi", t: "multi", o: ["Tidur", "Aktifitas fisik", "Emosi", "Nafsu makan", "Konsentrasi"] },
  ] },
  { t: "Q. Hasil Pemeriksaan Penunjang", f: [
    { k: "pj_elektrolit", l: "Elektrolit", t: "text" },
    { k: "agda_ph", l: "AGDA: PH", t: "text" }, { k: "agda_paco2", l: "AGDA: PaCO2", t: "text" }, { k: "agda_pao2", l: "AGDA: PaO2", t: "text" },
    { k: "agda_hco3", l: "AGDA: HCO3", t: "text" }, { k: "agda_be", l: "AGDA: BE", t: "text" }, { k: "agda_sao2", l: "AGDA: SaO2", t: "text" },
    { k: "pj_hema", l: "Hematologi", t: "text" }, { k: "pj_hati", l: "Fungsi Hati", t: "text" },
    { k: "pj_urine", l: "Urine (Ur/Creatinin)", t: "text" }, { k: "pj_aptt", l: "Faktor pembekuan APTT/PTT", t: "text" },
    { k: "pj_thoraks", l: "Foto Thoraks", t: "text" }, { k: "pj_ekg", l: "EKG", t: "text" }, { k: "pj_dll", l: "Dll.", t: "text" },
  ] },
  { t: "R. Kebutuhan Edukasi", f: [
    { k: "edu_hambatan", l: "Hambatan pembelajaran", t: "multi", o: ["Pendengaran", "Penglihatan", "Kognitif", "Fisik", "Budaya", "Agama", "Emosi", "Bahasa"] },
    { k: "edu_hambatan_lain", l: "Hambatan lainnya", t: "text" },
    { k: "edu_kebutuhan", l: "Kebutuhan pembelajaran pasien", t: "text" },
    { k: "edu_diagnosa", l: "Diagnosa mengenai penyakit", t: "multi", o: ["Obat-obatan", "Diet dan Nutrisi", "Tindakan keperawatan", "Rehabilitasi", "Manajemen Nyeri"] },
  ] },
  { t: "S. Discharge Planning", special: "discharge" },
  { t: "T. Daftar Masalah Keperawatan", special: "masalah" },
];
const DISCHARGE_ROWS = [
  "Perlu pelayanan home care", "Perlu pemasangan implant", "Penggunaan alat bantu", "Telah dilakukan pemesanan alat",
  "Dirujuk komunitas tertentu", "Dirujuk ke tim terapis", "Dirujuk ke ahli gizi", "Perlu edukasi pasien / keluarga", "Perlu adanya inform concent",
];
type ObatRow = { nama: string; dosis: string; cara: string; ket: string };
type MasalahRow = { masalah: string; tujuan: string };
type DischargeRow = { ya: string; ket: string };
function hitungGizi(f: Record<string, unknown>): number {
  const g1 = (f.gizi1 as string) || "";
  let s1 = 0;
  if (g1.startsWith("Tidak yakin")) s1 = 2;
  else if (g1 === "Ya") {
    const t = (f.gizi1_turun as string) || "";
    s1 = t.startsWith("1-5") ? 1 : t.startsWith("6-10") ? 2 : t.startsWith("11-15") ? 3 : t.startsWith(">15") ? 4 : t.startsWith("Tidak yakin") ? 2 : 0;
  }
  const s2 = (f.gizi2 as string) === "Ya" ? 1 : 0;
  return s1 + s2;
}

function PengkajianIcuTab({ noRawat }: { noRawat: string }) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [obat, setObat] = useState<ObatRow[]>([]);
  const [masalah, setMasalah] = useState<MasalahRow[]>([]);
  const [discharge, setDischarge] = useState<DischargeRow[]>(() => DISCHARGE_ROWS.map(() => ({ ya: "", ket: "" })));
  const [riwayat, setRiwayat] = useState<EnakesPengkajianIcuRow[] | null>(null);
  const [reload, setReload] = useState(0);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [waktu, setWaktu] = useState("");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState(""); const [okMsg, setOkMsg] = useState("");

  useEffect(() => { if (!waktu) setWaktu(nowLocal()); }, [waktu]);
  useEffect(() => {
    enakesPengkajianIcuGet(noRawat).then(r => {
      const d = (r.data.data ?? {}) as Record<string, unknown>;
      if (r.data.exists) {
        setForm(d);
        setObat(Array.isArray(d._obat) ? (d._obat as ObatRow[]) : []);
        setMasalah(Array.isArray(d._masalah) ? (d._masalah as MasalahRow[]) : []);
        const dc = Array.isArray(d._discharge) ? (d._discharge as DischargeRow[]) : [];
        setDischarge(DISCHARGE_ROWS.map((_, i) => dc[i] ?? { ya: "", ket: "" }));
      }
    }).catch(() => {});
    enakesPengkajianIcuRiwayat(noRawat).then(r => setRiwayat(r.data)).catch(() => setRiwayat([]));
  }, [noRawat, reload]);

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const toggleMulti = (k: string, o: string) => setForm(p => {
    const arr = Array.isArray(p[k]) ? [...(p[k] as string[])] : [];
    const i = arr.indexOf(o);
    if (i >= 0) arr.splice(i, 1); else arr.push(o);
    return { ...p, [k]: arr };
  });
  const gizi = hitungGizi(form);

  function resetForm() {
    setForm({}); setObat([]); setMasalah([]);
    setDischarge(DISCHARGE_ROWS.map(() => ({ ya: "", ket: "" })));
    setWaktu(nowLocal()); setEditKey(null); setErr(""); setOkMsg("");
  }
  async function startEdit(r: EnakesPengkajianIcuRow) {
    const t = r.tanggal ?? "";
    setErr(""); setOkMsg("");
    try {
      const d = (await enakesPengkajianIcuDetail(noRawat, t)).data;
      const dd = (d?.data ?? {}) as Record<string, unknown>;
      setForm(dd);
      setObat(Array.isArray(dd._obat) ? (dd._obat as ObatRow[]) : []);
      setMasalah(Array.isArray(dd._masalah) ? (dd._masalah as MasalahRow[]) : []);
      const dc = Array.isArray(dd._discharge) ? (dd._discharge as DischargeRow[]) : [];
      setDischarge(DISCHARGE_ROWS.map((_, i) => dc[i] ?? { ya: "", ket: "" }));
      setWaktu(t.slice(0, 16).replace(" ", "T")); setEditKey(t);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErr("Gagal memuat detail pengkajian ICU");
    }
  }
  async function simpan() {
    setSaving(true); setErr(""); setOkMsg("");
    try {
      const data = { ...form, _obat: obat, _masalah: masalah, _discharge: discharge, gizi_skor: gizi };
      await enakesPengkajianIcuSave({ no_rawat: noRawat, data, gizi_skor: gizi, waktu, edit: !!editKey, orig_tanggal: editKey ?? undefined });
      setOkMsg(editKey ? "Pengkajian ICU diperbarui." : "Pengkajian ICU tersimpan."); setEditKey(null); setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan pengkajian ICU"));
    } finally { setSaving(false); }
  }

  async function hapus(r: EnakesPengkajianIcuRow) {
    if (!window.confirm("Hapus pengkajian ICU ini?")) return;
    try {
      await enakesPengkajianIcuHapus({ no_rawat: noRawat, tanggal: r.tanggal ?? "" });
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }

  const chip = (active: boolean) => `text-[11px] rounded-lg border px-2 py-1 font-semibold transition-colors ${active ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-500 border-slate-200 hover:border-rose-300"}`;

  const renderField = (f: PF) => (
    <div key={f.k}>
      <label className="text-xs font-semibold text-slate-600">{f.l}</label>
      {f.t === "area" ? (
        <textarea value={(form[f.k] as string) ?? ""} onChange={e => set(f.k, e.target.value)} rows={2}
          className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
      ) : f.t === "sel" ? (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {(f.o ?? []).map(o => (
            <button key={o} type="button" onClick={() => set(f.k, form[f.k] === o ? "" : o)} className={chip(form[f.k] === o)}>{o}</button>
          ))}
        </div>
      ) : f.t === "multi" ? (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {(f.o ?? []).map(o => (
            <button key={o} type="button" onClick={() => toggleMulti(f.k, o)} className={chip(Array.isArray(form[f.k]) && (form[f.k] as string[]).includes(o))}>{o}</button>
          ))}
        </div>
      ) : (
        <input value={(form[f.k] as string) ?? ""} onChange={e => set(f.k, e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {editKey && (
        <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-[11px] font-semibold text-amber-700">
          <span>Sedang mengubah pengkajian {editKey.slice(0, 16)}</span>
          <button onClick={resetForm} className="text-amber-700 underline">Batal ubah (buat baru)</button>
        </div>
      )}
      {riwayat && riwayat.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 space-y-1">
          <div className="text-[11px] font-semibold text-rose-700">{riwayat.length} pengkajian tersimpan</div>
          {riwayat.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-[11px] text-rose-700">
              <span>{(r.tanggal ?? "").slice(0, 16)} · {r.petugas} (gizi {r.gizi_skor})</span>
              <span className="flex items-center gap-2">
                {r.milik === 1 && <button onClick={() => startEdit(r)} className="text-rose-600 hover:text-rose-800 font-semibold">Edit</button>}
                {r.milik === 1 && <button onClick={() => hapus(r)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
        <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
      </div>
      {PENGKAJIAN_ICU.map(s => (
        <div key={s.t} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
          <div className="text-xs font-bold text-rose-700 uppercase tracking-wide">{s.t}</div>
          {s.f?.map(renderField)}
          {s.special === "obat" && (
            <TableEditor rows={obat} setRows={setObat} kolom={[["nama", "Nama Obat"], ["dosis", "Dosis"], ["cara", "Cara Pemakaian"], ["ket", "Keterangan"]]} kosong={{ nama: "", dosis: "", cara: "", ket: "" }} />
          )}
          {s.special === "masalah" && (
            <TableEditor rows={masalah} setRows={setMasalah} kolom={[["masalah", "Masalah Keperawatan"], ["tujuan", "Tujuan / Target Terukur"]]} kosong={{ masalah: "", tujuan: "" }} />
          )}
          {s.special === "discharge" && (
            <div className="space-y-1.5">
              {DISCHARGE_ROWS.map((lbl, i) => (
                <div key={i} className="border-b border-slate-100 pb-1.5">
                  <div className="text-xs text-slate-700 mb-1">{i + 1}. {lbl}</div>
                  <div className="flex gap-1 items-center">
                    {YT.map(v => (
                      <button key={v} type="button" onClick={() => setDischarge(p => p.map((r, j) => j === i ? { ...r, ya: v } : r))} className={chip(discharge[i]?.ya === v)}>{v}</button>
                    ))}
                    <input value={discharge[i]?.ket ?? ""} onChange={e => setDischarge(p => p.map((r, j) => j === i ? { ...r, ket: e.target.value } : r))}
                      placeholder="keterangan" className="flex-1 rounded-lg border border-slate-300 text-xs px-2 py-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {s.special === "gizi" && (
            <div className="space-y-2">
              {renderField({ k: "gizi1", l: "1. Penurunan BB tidak diinginkan dalam 6 bulan", t: "sel", o: ["Tidak", "Tidak yakin / baju lebih longgar", "Ya"] })}
              {form.gizi1 === "Ya" && renderField({ k: "gizi1_turun", l: "Berapa penurunan BB", t: "sel", o: ["1-5 kg", "6-10 kg", "11-15 kg", ">15 kg", "Tidak yakin penurunannya"] })}
              {renderField({ k: "gizi2", l: "2. Asupan makan berkurang karena tidak nafsu makan / kondisi khusus", t: "sel", o: YT })}
              {renderField({ k: "gizi3", l: "3. Diagnosis khusus (DM/Kemoterapi/HD/Geriatri/imunitas turun)", t: "sel", o: YT })}
              {renderField({ k: "gizi_nutritionis", l: "4. Sudah dibaca & diketahui Nutrisionis", t: "sel", o: YT })}
              <div className={`text-xs font-bold rounded-lg border px-3 py-2 ${gizi > 2 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                Total Skor MST: {gizi} {gizi > 2 ? "— perlu pengkajian lanjut oleh Dietisien/Nutrisionis" : "— risiko rendah"}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2 sticky bottom-0">
        {err && <div className="text-xs text-red-600">{err}</div>}
        {okMsg && <div className="text-xs text-emerald-700">{okMsg}</div>}
        <button onClick={simpan} disabled={saving}
          className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
          {saving ? "Menyimpan…" : editKey ? "Perbarui Pengkajian ICU" : "Simpan Pengkajian ICU"}
        </button>
      </div>
    </div>
  );
}

// ── Kriteria Masuk ICU — REVISI RM.KEP.08.052.2022 (form terpisah utk review) ──
const KMICU_P1: [string, string][] = [
  ["p1_depresi_nafas", "Depresi Pernafasan"], ["p1_butuh_ventilator", "Butuh Ventilator"],
  ["p1_pengobatan_titrasi", "Pengobatan Continue Tertitrasi"], ["p1_sepsis_berat", "Pasien Sepsis Berat"],
  ["p1_gangguan_asam_basa", "Gangguan Keseimbangan Asam Basa dan Elektrolit Mengancam Nyawa"],
];
const KMICU_P2: [string, string][] = [
  ["p2_pemantauan_canggih", "Memerlukan pelayanan pemantauan canggih di ICU"],
  ["p2_jantung_paru", "Menderita penyakit dasar jantung-paru"],
  ["p2_gagal_ginjal", "Gagal ginjal akut dan berat"], ["p2_pembedahan_major", "Pembedahan Major"],
];
const KMICU_P3: [string, string][] = [["p3_kanker_lanjut", "Manifestasi kanker stadium lanjut"]];
const KMICU_P4: [string, string][] = [
  ["p4_dnr", "Kategori DNR"], ["p4_mbo", "Kategori MBO"], ["p4_vegetatif", "Vegetatif Permanen"],
];
// Bagian bawah mengikuti form lama: Kriteria Fisiologis (Tanda Vital/Lab/Radiologi/Klinis).
const KMICU_FIS_VITAL: [string, string][] = [
  ["kriteria_fisiologis_tanda_vital_1", "Nadi < 40 atau > 150 (x/menit)"],
  ["kriteria_fisiologis_tanda_vital_2", "SBP < 80 mmHg Atau 20 mmHg Di Bawah SBP Pasien"],
  ["kriteria_fisiologis_tanda_vital_3", "MAP < 60 mmHg"],
  ["kriteria_fisiologis_tanda_vital_4", "DBP > 120 mmHg"],
  ["kriteria_fisiologis_tanda_vital_5", "R > 35 x/menit"],
];
const KMICU_FIS_LAB: [string, string][] = [
  ["kriteria_fisiologis_laborat_1", "Na < 110 meq/L Atau > 170 meq/L"],
  ["kriteria_fisiologis_laborat_2", "Ca > 15 mg/dl"],
  ["kriteria_fisiologis_laborat_3", "GDS > 800 mg/dl"],
  ["kriteria_fisiologis_laborat_4", "K < 2 meq/L Atau 7 meq/L"],
  ["kriteria_fisiologis_laborat_5", "PaO2 < 50 mmHg"],
  ["kriteria_fisiologis_laborat_6", "PH < 7,1 Atau 7,7"],
];
const KMICU_FIS_RAD: [string, string][] = [
  ["kriteria_fisiologis_radiologi_1", "Perdarahan Cerebrovaskuler, SAH, Atau Contusion Dengan Gangguan Kesadaran Atau Neurologi"],
  ["kriteria_fisiologis_radiologi_2", "Ruptur Organ Dalam, Kandung Kemih, Hati, Varices Esophagus Atau Uterus Dengan Gangguan Hemodinamik"],
];
const KMICU_FIS_KLINIS: [string, string][] = [
  ["kriteria_fisiologis_klinis_1", "Pupil Anisokor"], ["kriteria_fisiologis_klinis_2", "Obstruksi Jalan Nafas"],
  ["kriteria_fisiologis_klinis_3", "Anuria"], ["kriteria_fisiologis_klinis_4", "Kejang Berulang"],
  ["kriteria_fisiologis_klinis_5", "Tamponade Jantung"], ["kriteria_fisiologis_klinis_6", "Coma"],
  ["kriteria_fisiologis_klinis_7", "Sianosis"], ["kriteria_fisiologis_klinis_8", "Luka Bakar > 10 % BSA"],
];
function KriteriaMasukIcu2022Tab({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<EnakesKmIcu2022Row[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Record<string, string | boolean>>({});
  const [waktu, setWaktu] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const [dokList, setDokList] = useState<{ kd_dokter: string; nm_dokter: string }[]>([]);
  const [me, setMe] = useState<{ kd_dokter: string; nm_dokter: string } | null>(null);
  useEffect(() => { enakesKmIcu2022List(noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat, reload]);
  useEffect(() => { igdListDokter().then(r => setDokList(r.data)).catch(() => {}); }, []);
  useEffect(() => { edokterMe().then(r => setMe({ kd_dokter: r.data.kd_dokter, nm_dokter: r.data.nm_dokter })).catch(() => {}); }, []);

  const set = (k: string, v: string | boolean) => setF(p => ({ ...p, [k]: v }));
  const chk = (k: string) => f[k] === true;

  function resetForm() { setF({}); setWaktu(nowLocal()); setEditKey(null); setErr(""); }
  async function startEdit(r: EnakesKmIcu2022Row) {
    const t = r.tanggal ?? "";
    setErr("");
    try {
      const d = (await enakesKmIcu2022Detail(noRawat, t)).data;
      setF((d?.data ?? {}) as Record<string, string | boolean>);
      setWaktu(t.slice(0, 16).replace(" ", "T")); setEditKey(t); setOpen(true);
    } catch { setErr("Gagal memuat detail"); }
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      const data = { ...f,
        dokter_jaga_kd: me?.kd_dokter ?? "", dokter_jaga_nama: me?.nm_dokter ?? "" };
      await enakesKmIcu2022Save({ no_rawat: noRawat, data, waktu, edit: !!editKey, orig_tanggal: editKey ?? undefined });
      resetForm(); setOpen(false); setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan"));
    } finally { setSaving(false); }
  }
  async function hapus(r: EnakesKmIcu2022Row) {
    if (!window.confirm("Hapus formulir kriteria masuk ICU ini?")) return;
    try { await enakesKmIcu2022Hapus({ no_rawat: noRawat, tanggal: r.tanggal ?? "" }); setReload(x => x + 1); }
    catch (e) { const ex = e as { response?: { data?: { error?: string } } }; alert(ex.response?.data?.error ?? "Gagal menghapus"); }
  }

  const grup = (judul: string, items: [string, string][]) => (
    <div>
      <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide mb-1">{judul}</div>
      <div className="space-y-1">
        {items.map(([k, l]) => (
          <label key={k} className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={chk(k)} onChange={e => set(k, e.target.checked)} className="mt-1 accent-rose-600" />
            <span>{l}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
          <div className="text-sm font-bold text-slate-800">{editKey ? "Ubah Kriteria Masuk ICU" : "Kriteria Pasien Masuk Instalasi Rawat Intensif"}</div>
          <div className="text-[10px] text-slate-400">RM.KEP.08.052.2022</div>
          <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Asal Ruangan" value={(f.asal_ruangan as string) ?? ""} onChange={v => set("asal_ruangan", v)} />
            <Field label="Diagnosa" value={(f.diagnosa as string) ?? ""} onChange={v => set("diagnosa", v)} />
            <DokterPicker label="DPJP" list={dokList} kd={(f.dpjp_kd as string) ?? ""} nm={(f.dpjp_nama as string) ?? ""}
              onPick={(k, n) => setF(p => ({ ...p, dpjp_kd: k, dpjp_nama: n }))} />
            <DokterPicker label="Dokter Konsultan" list={dokList} kd={(f.konsultan_kd as string) ?? ""} nm={(f.konsultan_nama as string) ?? ""}
              onPick={(k, n) => setF(p => ({ ...p, konsultan_kd: k, konsultan_nama: n }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Dokter Jaga IGD / Ruangan</label>
            <div className="mt-0.5 text-xs rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700">{me?.nm_dokter || "—"} <span className="text-slate-400">(otomatis dari user login)</span></div>
          </div>
          {grup("I. Pasien Prioritas 1", KMICU_P1)}
          {grup("II. Pasien Prioritas 2", KMICU_P2)}
          {grup("III. Pasien Prioritas 3", KMICU_P3)}
          {grup("IV. Pasien Prioritas 4", KMICU_P4)}
          <div className="border-t border-slate-100 pt-2 space-y-2">
            {grup("V. Kriteria Fisiologis — Tanda Vital", KMICU_FIS_VITAL)}
            {grup("VI. Kriteria Fisiologis — Laboratorium", KMICU_FIS_LAB)}
            {grup("VII. Kriteria Fisiologis — Radiologi", KMICU_FIS_RAD)}
            {grup("VIII. Kriteria Fisiologis — Klinis", KMICU_FIS_KLINIS)}
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : editKey ? "Perbarui" : "Simpan"}
            </button>
            <button onClick={() => { setOpen(false); resetForm(); }}
              className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setOpen(true); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + Kriteria Masuk ICU (RM.KEP.08.052.2022)
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada formulir kriteria masuk ICU.</div>
      ) : (
        list.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">Kriteria Masuk ICU</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {(r.tanggal ?? "").slice(0, 16)}
                {r.milik === 1 && <button onClick={() => startEdit(r)} className="text-rose-600 hover:text-rose-800 font-semibold">Edit</button>}
                {r.milik === 1 && <button onClick={() => hapus(r)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            {r.petugas && <div className="mt-1 text-[11px] text-rose-600">{r.petugas}</div>}
          </div>
        ))
      )}
    </div>
  );
}

function TableEditor<T extends Record<string, string>>({ rows, setRows, kolom, kosong }: {
  rows: T[]; setRows: (r: T[]) => void; kolom: [string, string][]; kosong: T;
}) {
  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="border border-slate-200 rounded-lg p-2 space-y-1">
          {kolom.map(([k, lbl]) => (
            <input key={k} value={row[k] ?? ""} onChange={e => setRows(rows.map((r, j) => j === i ? { ...r, [k]: e.target.value } : r))}
              placeholder={lbl} className="w-full rounded border border-slate-300 text-xs px-2 py-1" />
          ))}
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-[11px] text-red-600">Hapus baris</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, { ...kosong }])} className="text-xs font-semibold text-rose-600">+ Tambah baris</button>
    </div>
  );
}

// Select sederhana (dipakai form Intubasi & Transfer).
function SelField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full mt-0.5 rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400">
        {options.map(o => <option key={o} value={o}>{o || "—"}</option>)}
      </select>
    </div>
  );
}
function DtField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <input type="datetime-local" value={value} onChange={e => onChange(e.target.value)}
        className="w-full mt-0.5 rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
    </div>
  );
}

// ── Formulir Tindakan Intubasi & Ventilator (ICU) ────────────────────────────
const VENT_MODES = ["", "VC (Volume Control)", "PC (Pressure Control)", "SIMV", "PSV", "CPAP", "PRVC", "BiPAP", "APRV", "PC-AC", "VC-AC"];
function IntubasiTab({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<EnakesIntubasi[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [editKey, setEditKey] = useState<string | null>(null);
  useEffect(() => { enakesIntubasiList(noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat, reload]);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const toDt = (s: string | null) => s ? s.slice(0, 16).replace(" ", "T") : "";

  function startEdit(r: EnakesIntubasi) {
    setF({
      waktu: toDt(r.tanggal),
      diagnosa: r.diagnosa ?? "", indikasi_pemasangan: r.indikasi_pemasangan ?? "",
      tgl_intubasi: toDt(r.tgl_intubasi), tgl_pasang_ventilator: toDt(r.tgl_pasang_ventilator),
      tgl_extubasi: toDt(r.tgl_extubasi), tgl_lepas_ventilator: toDt(r.tgl_lepas_ventilator),
      tekanan_darah: r.tekanan_darah ?? "", nadi: r.nadi ?? "", respiratory_rate: r.respiratory_rate ?? "", saturasi_o2: r.saturasi_o2 ?? "",
      mode_ventilator: r.mode_ventilator ?? "", fio2: r.fio2 ?? "", peep: r.peep ?? "", ie_ratio: r.ie_ratio ?? "",
    });
    setEditKey(r.tanggal ?? ""); setErr(""); setOpen(true);
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      await enakesIntubasiSave({ no_rawat: noRawat, ...f, edit: !!editKey, orig_tanggal: editKey ?? undefined });
      setF({}); setEditKey(null); setOpen(false); setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan"));
    } finally { setSaving(false); }
  }
  async function hapus(r: EnakesIntubasi) {
    if (!window.confirm("Hapus formulir intubasi & ventilator ini?")) return;
    try {
      await enakesIntubasiHapus({ no_rawat: noRawat, tanggal: r.tanggal ?? "" });
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }
  const dt = (s: string | null) => s ? s.slice(0, 16).replace("T", " ") : "-";

  return (
    <div className="space-y-3">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="text-sm font-bold text-slate-800">{editKey ? "Ubah Formulir Intubasi & Ventilator" : "Formulir Tindakan Intubasi & Ventilator"}</div>
          <DtField label="Tanggal & jam dibuat" value={f.waktu ?? ""} onChange={v => set("waktu", v)} />
          <ResumeArea label="Diagnosa" value={f.diagnosa ?? ""} onChange={v => set("diagnosa", v)} />
          <ResumeArea label="Indikasi Pemasangan" value={f.indikasi_pemasangan ?? ""} onChange={v => set("indikasi_pemasangan", v)} />
          <div className="grid grid-cols-2 gap-2">
            <DtField label="Tgl Intubasi" value={f.tgl_intubasi ?? ""} onChange={v => set("tgl_intubasi", v)} />
            <DtField label="Tgl Pasang Ventilator" value={f.tgl_pasang_ventilator ?? ""} onChange={v => set("tgl_pasang_ventilator", v)} />
            <DtField label="Tgl Extubasi" value={f.tgl_extubasi ?? ""} onChange={v => set("tgl_extubasi", v)} />
            <DtField label="Tgl Lepas Ventilator" value={f.tgl_lepas_ventilator ?? ""} onChange={v => set("tgl_lepas_ventilator", v)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tekanan Darah (mmHg)" value={f.tekanan_darah ?? ""} onChange={v => set("tekanan_darah", v)} />
            <Field label="Nadi (x/mnt)" value={f.nadi ?? ""} onChange={v => set("nadi", v)} />
            <Field label="Respiratory Rate (x/mnt)" value={f.respiratory_rate ?? ""} onChange={v => set("respiratory_rate", v)} />
            <Field label="Saturasi O2 (%)" value={f.saturasi_o2 ?? ""} onChange={v => set("saturasi_o2", v)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SelField label="Mode Ventilator" value={f.mode_ventilator ?? ""} onChange={v => set("mode_ventilator", v)} options={VENT_MODES} />
            <Field label="FiO2 (%)" value={f.fio2 ?? ""} onChange={v => set("fio2", v)} />
            <Field label="PEEP (cmH2O)" value={f.peep ?? ""} onChange={v => set("peep", v)} />
            <Field label="I:E Ratio" value={f.ie_ratio ?? ""} onChange={v => set("ie_ratio", v)} />
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
            <button onClick={() => { setOpen(false); setF({}); setEditKey(null); setErr(""); }}
              className="px-4 bg-white border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setF({ waktu: nowLocal() }); setEditKey(null); setErr(""); setOpen(true); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + Formulir Intubasi &amp; Ventilator
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada formulir intubasi &amp; ventilator.</div>
      ) : (
        list.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-800">{r.mode_ventilator || "Ventilator"}</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {(r.tanggal ?? "").slice(0, 16)}
                {r.milik === 1 && <button onClick={() => startEdit(r)} className="text-rose-600 hover:text-rose-800 font-semibold">Edit</button>}
                {r.milik === 1 && <button onClick={() => hapus(r)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            {r.diagnosa && <div className="mt-1 text-xs text-slate-600">Dx: {r.diagnosa}</div>}
            {r.indikasi_pemasangan && <div className="text-xs text-slate-600">Indikasi: {r.indikasi_pemasangan}</div>}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
              {r.tekanan_darah && <span>TD {r.tekanan_darah}</span>}
              {r.nadi && <span>N {r.nadi}</span>}
              {r.respiratory_rate && <span>RR {r.respiratory_rate}</span>}
              {r.saturasi_o2 && <span>SpO2 {r.saturasi_o2}</span>}
              {r.fio2 && <span>FiO2 {r.fio2}</span>}
              {r.peep && <span>PEEP {r.peep}</span>}
              {r.ie_ratio && <span>I:E {r.ie_ratio}</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
              <span>Intubasi: {dt(r.tgl_intubasi)}</span>
              <span>Ventilator: {dt(r.tgl_pasang_ventilator)}</span>
              {dt(r.tgl_extubasi) !== "-" && <span>Extubasi: {dt(r.tgl_extubasi)}</span>}
              {dt(r.tgl_lepas_ventilator) !== "-" && <span>Lepas Vent: {dt(r.tgl_lepas_ventilator)}</span>}
            </div>
            {r.petugas && <div className="mt-1 text-[11px] text-rose-600">{r.petugas}{r.dokter ? ` · DPJP ${r.dokter}` : ""}</div>}
          </div>
        ))
      )}
    </div>
  );
}

// ── Transfer Antar Ruang (transfer_internal_rs) — sesuai form desktop ─────────
const TRANSFER_KELOLA: [string, string][] = [
  ["diet", "Diet"], ["keseimbangan_cairan", "Keseimbangan Cairan"], ["mobilisasi", "Mobilisasi"], ["perawatan_luka", "Perawatan Luka"],
  ["iv", "IV / Infus line"], ["oksigen", "Oksigen"], ["kateter", "Kateter"], ["syring", "Syringe Pump"], ["ngt", "NGT"], ["dekubitus", "Dekubitus"],
  ["infus", "Skema Infus"], ["cvp", "CVP"], ["drain", "Drain"], ["lain", "Lain-lain"],
  ["lab", "Lab"], ["radiologi", "Radiologi"], ["ctscan", "CT Scan"], ["obat_infus", "Obat Infus"], ["injeksi", "Obat Injeksi"], ["oral", "Obat Oral"],
];
function TransferTab({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<EnakesTransfer[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [editKey, setEditKey] = useState<string | null>(null);
  useEffect(() => { enakesTransferList(noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat, reload]);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function startEdit(r: EnakesTransfer) {
    const tm = r.tanggal_masuk ?? "";
    setErr("");
    try {
      const d = (await enakesTransferDetail(noRawat, tm)).data;
      const v = { ...(d?.values ?? {}) };
      if (v.tanggal_pindah) v.tanggal_pindah = v.tanggal_pindah.slice(0, 16).replace(" ", "T");
      v.waktu = tm.slice(0, 16).replace(" ", "T"); // tanggal masuk (dibuat)
      setF(v); setEditKey(tm); setOpen(true);
    } catch {
      setErr("Gagal memuat detail transfer");
    }
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      await enakesTransferSave({ no_rawat: noRawat, values: f, edit: !!editKey, orig_tanggal_masuk: editKey ?? undefined });
      setF({}); setEditKey(null); setOpen(false); setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan"));
    } finally { setSaving(false); }
  }
  async function hapus(r: EnakesTransfer) {
    if (!window.confirm("Hapus transfer antar ruang ini?")) return;
    try {
      await enakesTransferHapus({ no_rawat: noRawat, tanggal_masuk: r.tanggal_masuk ?? "" });
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }
  const Vit = (k: string, l: string) => (
    <div className="grid grid-cols-2 gap-2">
      <Field label={`${l} (Sebelum)`} value={f[`${k}_sebelum_transfer`] ?? ""} onChange={v => set(`${k}_sebelum_transfer`, v)} />
      <Field label={`${l} (Sesudah)`} value={f[`${k}_sesudah_transfer`] ?? ""} onChange={v => set(`${k}_sesudah_transfer`, v)} />
    </div>
  );

  return (
    <div className="space-y-3">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="text-sm font-bold text-slate-800">{editKey ? "Ubah Transfer Antar Ruang" : "Transfer Antar Ruang"}</div>
          <DtField label="Tanggal & jam dibuat (tgl masuk)" value={f.waktu ?? ""} onChange={v => set("waktu", v)} />
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">Data Transfer</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Asal Ruang" value={f.asal_ruang ?? ""} onChange={v => set("asal_ruang", v)} />
            <Field label="Ruang Selanjutnya" value={f.ruang_selanjutnya ?? ""} onChange={v => set("ruang_selanjutnya", v)} />
            <DtField label="Tanggal Pindah" value={f.tanggal_pindah ?? ""} onChange={v => set("tanggal_pindah", v)} />
            <SelField label="Derajat" value={f.derajat ?? "Derajat 0"} onChange={v => set("derajat", v)} options={["Derajat 0", "Derajat 1", "Derajat 2", "Derajat 3"]} />
            <Field label="Kode DPJP" value={f.dpjp ?? ""} onChange={v => set("dpjp", v)} />
            <Field label="Kode Konsulen" value={f.konsulen ?? ""} onChange={v => set("konsulen", v)} />
          </div>
          <Field label="Diagnosa Masuk" value={f.diagnosa_masuk ?? ""} onChange={v => set("diagnosa_masuk", v)} />
          <Field label="Diagnosa Sekarang" value={f.diagnosa_sekarang ?? ""} onChange={v => set("diagnosa_sekarang", v)} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Alergi" value={f.alergi ?? ""} onChange={v => set("alergi", v)} />
            <Field label="Petugas Pendamping" value={f.pendamping ?? ""} onChange={v => set("pendamping", v)} />
          </div>

          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide pt-1">Kondisi Sebelum &amp; Sesudah Transfer</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Keadaan Umum (Sebelum)" value={f.keadaan_umum_sebelum_transfer ?? ""} onChange={v => set("keadaan_umum_sebelum_transfer", v)} />
            <Field label="Keadaan Umum (Sesudah)" value={f.keadaan_umum_sesudah_transfer ?? ""} onChange={v => set("keadaan_umum_sesudah_transfer", v)} />
            <SelField label="Kesadaran (Sebelum)" value={f.kesadaran_sebelum_transfer ?? "Compos Mentis"} onChange={v => set("kesadaran_sebelum_transfer", v)} options={["Compos Mentis", "Gelisah", "Delirium", "Koma"]} />
            <SelField label="Kesadaran (Sesudah)" value={f.kesadaran_sesudah_transfer ?? "Compos Mentis"} onChange={v => set("kesadaran_sesudah_transfer", v)} options={["Compos Mentis", "Gelisah", "Delirium", "Koma"]} />
          </div>
          {Vit("td", "Tekanan Darah")}
          {Vit("nadi", "Nadi")}
          {Vit("suhu", "Suhu")}
          {Vit("pernapasan", "Pernapasan")}
          {Vit("saturasi", "Saturasi")}
          {Vit("catatan", "Catatan")}

          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide pt-1">Yang Dikelola / Terpasang</div>
          <div className="grid grid-cols-2 gap-2">
            {TRANSFER_KELOLA.map(([k, l]) => <Field key={k} label={l} value={f[k] ?? ""} onChange={v => set(k, v)} />)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SelField label="Rekam Medis" value={f.rekammedis ?? "Tidak"} onChange={v => set("rekammedis", v)} options={["Tidak", "Ada"]} />
            <Field label="NIP Penerima" value={f.nip_menerima ?? ""} onChange={v => set("nip_menerima", v)} />
          </div>

          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : "Simpan Transfer"}
            </button>
            <button onClick={() => { setOpen(false); setF({}); setEditKey(null); setErr(""); }}
              className="px-4 bg-white border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setF({ waktu: nowLocal() }); setEditKey(null); setErr(""); setOpen(true); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + Transfer Antar Ruang
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada transfer antar ruang.</div>
      ) : (
        list.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-800">{r.asal_ruang || "?"} → {r.ruang_selanjutnya || "?"}</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {(r.tanggal_masuk ?? "").slice(0, 16)}
                {r.milik === 1 && <button onClick={() => startEdit(r)} className="text-rose-600 hover:text-rose-800 font-semibold">Edit</button>}
                {r.milik === 1 && <button onClick={() => hapus(r)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
              {r.derajat && <span className="font-semibold">{r.derajat}</span>}
              {r.tanggal_pindah && <span>Pindah: {(r.tanggal_pindah ?? "").slice(0, 16)}</span>}
            </div>
            {r.diagnosa_sekarang && <div className="mt-0.5 text-xs text-slate-600">Dx: {r.diagnosa_sekarang}</div>}
            <div className="mt-1 text-[11px] text-rose-600">{r.petugas}{r.dpjp ? ` · DPJP ${r.dpjp}` : ""}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Status Anestesi (parity bertahap) — Fase 1: Data Awal, Pra Induksi, Premedikasi
// ── Status Anestesi (parity per-seksi) — tiap seksi tabel & waktu kejadian sendiri
type SAField = { k: string; l: string; t?: "area" | "sel" | "dt"; o?: string[] };
type SASection = { key: string; label: string; fields: SAField[] };
const YN2 = ["Tidak", "Ya"];
const SA_SECTIONS: SASection[] = [
  { key: "data_awal", label: "Data Awal & Checklist Persiapan", fields: [
    { k: "kd_dokter_anestesi", l: "Kode Dokter Anestesi" }, { k: "kd_dokter_bedah", l: "Kode Dokter Bedah" },
    { k: "kd_asisten_anestesi", l: "Kode Asisten Anestesi" }, { k: "kd_asisten_bedah", l: "Kode Asisten Bedah" },
    { k: "diagnosa_prabedah", l: "Diagnosa Prabedah" },
    { k: "informed_consent", l: "Informed Consent", t: "sel", o: YN2 }, { k: "obat_anestesi", l: "Obat-obatan Anestesi", t: "sel", o: YN2 },
    { k: "tatalaksana_jalan_nafas", l: "Tata Laksana Jalan Nafas", t: "sel", o: YN2 }, { k: "mesin_anestesi", l: "Mesin Anestesi", t: "sel", o: YN2 },
    { k: "obat_emergensi", l: "Obat-obatan Emergensi", t: "sel", o: YN2 }, { k: "check_monitoring", l: "Monitoring", t: "sel", o: YN2 },
    { k: "suction_aparatus", l: "Suction Aparatus", t: "sel", o: YN2 },
  ] },
  { key: "umum_data_awal", label: "Anestesi Umum", fields: [
    { k: "induksi", l: "Induksi", t: "sel", o: ["", "Sempurna", "Eksistas", "Muntah", "Batuk", "Spasme", "Lainnya"] }, { k: "induksi_ket", l: "Ket. Induksi" },
    { k: "pengaturan_nafas", l: "Pengaturan Nafas", t: "sel", o: ["", "Spontan", "Assist", "Bantuan"] },
    { k: "tidal_volum", l: "Tidal Volume" }, { k: "rr", l: "RR" }, { k: "ie_ratio", l: "I:E Ratio" }, { k: "peep", l: "PEEP" }, { k: "pip", l: "PIP" }, { k: "fio2", l: "FiO2" },
    { k: "teknik_khusus", l: "Teknik Khusus", t: "sel", o: ["", "Hipotermi", "Hipotensi", "Bypass", "Ventilasi satu paru"] }, { k: "teknik_khusus_ket", l: "Ket. Teknik Khusus" },
  ] },
  { key: "umum_monitoring", label: "Monitoring", fields: [
    { k: "o2", l: "O2" }, { k: "n2o", l: "N2O" }, { k: "air", l: "Air" }, { k: "volatile", l: "Volatile" },
    { k: "spo2", l: "SpO2" }, { k: "infus", l: "Infus" }, { k: "medikasi", l: "Medikasi" },
    { k: "suhu", l: "Suhu" }, { k: "respirasi", l: "Respirasi" }, { k: "tekanan_darah", l: "Tensi" }, { k: "nadi", l: "Nadi" },
    { k: "keluar_cairan_perdarahan", l: "Keluaran Cairan — Perdarahan" }, { k: "keluar_cairan_urin", l: "Urine" },
    { k: "lain_lain", l: "Masalah Durante Operasi", t: "area" },
  ] },
  { key: "umum_keterangan", label: "Masalah Durante Operasi", fields: [
    { k: "medikasi", l: "Medikasi", t: "area" }, { k: "pemberian_cairan", l: "Pemberian Cairan", t: "area" },
    { k: "masalah_durante_operasi", l: "Masalah Durante Operasi", t: "area" }, { k: "tindakan", l: "Tindakan", t: "area" },
  ] },
  { key: "blokade_regional", label: "Blokade Regional", fields: [
    { k: "teknik", l: "Teknik", t: "sel", o: ["", "Caudal", "Saddle block", "Intravenous regional", "Epidural", "Spinal"] },
    { k: "lokasi_tusukan", l: "Lokasi Tusukan" }, { k: "analgesia_setinggi_segmen", l: "Analgesia Setinggi Segmen" }, { k: "anestesi_lokal", l: "Anestesi Lokal" },
    { k: "konsentrasi_jumlah", l: "Konsentrasi / Jumlah" }, { k: "obat_tambahan", l: "Obat Tambahan" }, { k: "dosis", l: "Dosis" },
  ] },
  { key: "keadaan_operasi", label: "Keadaan Selama Operasi", fields: [
    { k: "letak_penderita", l: "Letak Penderita", t: "sel", o: ["", "Supine", "Prone", "Litotomi", "Semi sitting", "Flowler", "Lateral dekubitus", "Right dekubitus", "Left dekubitus", "Trendelenberg", "Knee-chest", "Jask-knife"] },
    { k: "airway", l: "Airway", t: "sel", o: ["", "Face mask", "LMA", "Single lumen ETT", "Singke lumen spiral ETT", "Double lumen ETT R", "Double lumen ETT L", "Nasal kanul"] },
    { k: "ukuran", l: "Ukuran" }, { k: "balon", l: "Balon", t: "sel", o: ["", "Balon", "Tanpa balon"] },
    { k: "lama_operasi", l: "Lama Operasi" }, { k: "lama_anestesi", l: "Lama Anestesi" },
  ] },
  { key: "sectio_caesaria", label: "Sectio Caesaria", fields: [
    { k: "keadaan_bayi", l: "Keadaan Bayi", t: "sel", o: ["", "Hidup", "Mati dalam kandungan"] },
    { k: "jenis_kelamin", l: "Jenis Kelamin", t: "sel", o: ["", "L", "P"] },
    { k: "apgar_1_menit", l: "APGAR 1 menit" }, { k: "apgar_5_menit", l: "APGAR 5 menit" }, { k: "apgar_10_menit", l: "APGAR 10 menit" },
  ] },
  { key: "pasca_masuk_kamar", label: "Pemulihan — Masuk Kamar", fields: [
    { k: "kesadaran", l: "Kesadaran", t: "sel", o: ["", "Sadar", "Belum sadar", "Tidur dalam"] },
    { k: "airway", l: "Airway", t: "sel", o: ["", "Terintubasi", "Tidak Terintubasi"] },
    { k: "tensi", l: "Tekanan Darah (mmHg)" },
    { k: "nadi", l: "Nadi (x/mnt)" }, { k: "nadi_reg", l: "Reguler / Ireguler", t: "sel", o: ["", "Regular", "Irregular"] },
    { k: "respirasi", l: "Respirasi", t: "sel", o: ["", "Spontan", "Bantuan", "Terkontrol"] },
    { k: "rr", l: "RR (x/mnt)" },
    { k: "kanul_nasal", l: "Kanul Nasal", t: "sel", o: ["", "SM", "RM", "NRM"] },
    { k: "o2", l: "O2 (lpm)" }, { k: "spo2", l: "SpO2 (%)" },
  ] },
  { key: "pasca_monitoring", label: "Pemulihan — Monitoring", fields: [
    { k: "suhu", l: "Suhu" }, { k: "rr", l: "RR" }, { k: "nadi", l: "Nadi" }, { k: "tekanan_darah", l: "Tekanan Darah" },
  ] },
  { key: "monitoring", label: "Monitoring Intra-Op", fields: [
    { k: "o2", l: "O2" }, { k: "n2o", l: "N2O" }, { k: "air", l: "Air" }, { k: "isofluran", l: "Isofluran" }, { k: "sevofluran", l: "Sevofluran" }, { k: "infus", l: "Infus" },
    { k: "barbiturat", l: "Barbiturat" }, { k: "relaksan_depol", l: "Relaksan Depol" }, { k: "relaksan_nindipol", l: "Relaksan Non-Depol" }, { k: "analgetika", l: "Analgetika" },
    { k: "neuroleptik", l: "Neuroleptik" }, { k: "lain_lain_obat", l: "Obat Lain" },
    { k: "respirasi", l: "Respirasi" }, { k: "nadi", l: "Nadi" }, { k: "tekanan_darah", l: "Tekanan Darah" }, { k: "spo2", l: "SpO2" }, { k: "perdarahan", l: "Perdarahan" },
    { k: "lain_lain", l: "Lain-lain", t: "area" },
  ] },
  { key: "catatan", label: "Catatan (Pasca Bedah)", fields: [
    { k: "diagnosa_pasca_bedah", l: "Diagnosa Pasca Bedah", t: "area" },
    { k: "lama_operasi", l: "Lama Operasi" }, { k: "lama_anestesi", l: "Lama Anestesi" },
    { k: "cairan_masuk", l: "Cairan Masuk" }, { k: "jumlah_cairan_masuk", l: "Jumlah Cairan Masuk" },
    { k: "cairan_keluar", l: "Cairan Keluar" }, { k: "jumlah_cairan_keluar", l: "Jumlah Cairan Keluar" },
  ] },
  { key: "masuk_kamar", label: "Masuk Kamar Operasi", fields: [
    { k: "jam_masuk", l: "Jam Masuk (HH:MM)" }, { k: "jalan_nafas", l: "Jalan Nafas" },
    { k: "pernapasan", l: "Pernapasan", t: "sel", o: ["", "Spontan", "Assisted", "Controlled"] }, { k: "bila_spontan", l: "Bila Spontan" },
    { k: "kesadaran", l: "Kesadaran", t: "sel", o: ["", "Sadar", "Somnolen", "Sopor", "Koma"] },
    { k: "aktifitas_masuk", l: "Aktifitas" }, { k: "sirkulasi_masuk", l: "Sirkulasi" }, { k: "pernapasan_masuk", l: "Pernapasan (skor)" },
    { k: "kesadaran_masuk", l: "Kesadaran (skor)" }, { k: "warna_kulit_masuk", l: "Warna Kulit" }, { k: "total_masuk", l: "Total" }, { k: "skor_bromage", l: "Skor Bromage" },
  ] },
  { key: "observasi_kamar", label: "Observasi Kamar Operasi", fields: [
    { k: "tvs", l: "TVS" }, { k: "rr", l: "RR" }, { k: "nadi", l: "Nadi" }, { k: "tekanan_darah", l: "Tekanan Darah" }, { k: "vas", l: "VAS" },
  ] },
  { key: "keluar_kamar", label: "Keluar & Pindah", fields: [
    { k: "jam_keluar", l: "Jam Keluar Ruang Pemulihan" },
    { k: "pindah_ke", l: "Pindah Ke", t: "sel", o: ["", "Ruang Rawat", "ICU", "HCU", "NICU", "PICU"] },
  ] },
];
function saField(fld: SAField, f: Record<string, string>, set: (k: string, v: string) => void) {
  if (fld.t === "area") return <div key={fld.k} className="col-span-2"><ResumeArea label={fld.l} value={f[fld.k] ?? ""} onChange={v => set(fld.k, v)} /></div>;
  if (fld.t === "dt") return <DtField key={fld.k} label={fld.l} value={f[fld.k] ?? ""} onChange={v => set(fld.k, v)} />;
  if (fld.t === "sel") return <SelField key={fld.k} label={fld.l} value={f[fld.k] ?? (fld.o?.[0] ?? "")} onChange={v => set(fld.k, v)} options={fld.o ?? [""]} />;
  return <Field key={fld.k} label={fld.l} value={f[fld.k] ?? ""} onChange={v => set(fld.k, v)} />;
}
// ── Monitoring Status Fisiologis Anestesi/Sedasi Diluar Kamar Operasi (RM.IBS.11.011) ──
const MON_H_FIELDS: [string, string][] = [
  ["keadaanumum", "Keadaan Umum"], ["bb", "BB (kg)"], ["kesadaran", "Kesadaran"],
  ["anamnesis", "Riwayat Alergi / Anamnesis"], ["gcs", "GCS"], ["tb", "TB (cm)"],
  ["diagnosa", "Diagnosis"], ["tindakan", "Tindakan"], ["ruangan", "Unit Pelayanan"], ["lain", "Jenis Anestesi (Lokal/Sedasi) / Lain-lain"],
];
const MON_FASE = ["Pre Anestesi", "Durante Anestesi", "Post Anestesi"];
function MonitoringFisiologisTab({ noRawat }: { noRawat: string }) {
  const [detail, setDetail] = useState<MonAnesDetail[] | null>(null);
  const [reload, setReload] = useState(0);
  const [h, setH] = useState<Record<string, string>>({});
  const [savingH, setSavingH] = useState(false);
  const [errH, setErrH] = useState("");
  const [d, setD] = useState({ waktu: "Pre Anestesi", obat: "", dosis: "", tensi: "", nadi: "", rr: "", suhu: "" });
  const [savingD, setSavingD] = useState(false);
  const [errD, setErrD] = useState("");
  const setDf = (k: keyof typeof d, v: string) => setD(p => ({ ...p, [k]: v }));
  const set = (k: string, v: string) => setH(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!noRawat) return;
    monAnesGet(noRawat).then(r => {
      setDetail(r.data.detail);
      const hv: Record<string, string> = {};
      if (r.data.header) for (const [k] of MON_H_FIELDS) hv[k] = (r.data.header as Record<string, string>)[k] ?? "";
      setH(hv);
    }).catch(() => setDetail([]));
  }, [noRawat, reload]);

  async function simpanHeader() {
    setSavingH(true); setErrH("");
    try { await monAnesHeaderSave({ no_rawat: noRawat, values: h }); setReload(x => x + 1); }
    catch (e) { setErrH(notifGagal(e as { response?: { data?: { error?: string } } }, "Gagal menyimpan")); }
    finally { setSavingH(false); }
  }
  async function tambahDetail() {
    setSavingD(true); setErrD("");
    try { await monAnesDetailAdd({ no_rawat: noRawat, ...d }); setD({ waktu: d.waktu, obat: "", dosis: "", tensi: "", nadi: "", rr: "", suhu: "" }); setReload(x => x + 1); }
    catch (e) { setErrD(notifGagal(e as { response?: { data?: { error?: string } } }, "Gagal menambah baris")); }
    finally { setSavingD(false); }
  }
  async function hapusDetail(r: MonAnesDetail) {
    if (!window.confirm("Hapus baris monitoring ini?")) return;
    try { await monAnesDetailHapus({ no_rawat: noRawat, tgl_perawatan: r.tgl_perawatan, jam_rawat: r.jam_rawat }); setReload(x => x + 1); }
    catch (e) { alert((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Gagal menghapus"); }
  }

  return (
    <div className="space-y-4">
      <div className="text-[11px] text-slate-500">Monitoring Status Fisiologis Pasien Selama Pemberian Anestesi Lokal/Sedasi Diluar Kamar Operasi (RM.IBS.11.011).</div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
        <div className="text-sm font-bold text-slate-800">A. Penilaian Pra Anestesi Lokal / Sedasi</div>
        <div className="grid grid-cols-2 gap-2">
          {MON_H_FIELDS.map(([k, l]) => <Field key={k} label={l} value={h[k] ?? ""} onChange={v => set(k, v)} />)}
        </div>
        {errH && <div className="text-xs text-red-600">{errH}</div>}
        <button onClick={simpanHeader} disabled={savingH} className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">{savingH ? "Menyimpan…" : "Simpan Penilaian Pra Anestesi"}</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
        <div className="text-sm font-bold text-slate-800">Monitoring Tanda-Tanda Vital</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <SelField label="Fase" value={d.waktu} onChange={v => setDf("waktu", v)} options={MON_FASE} />
          <Field label="Nama Obat" value={d.obat} onChange={v => setDf("obat", v)} />
          <Field label="Dosis" value={d.dosis} onChange={v => setDf("dosis", v)} />
          <Field label="TD (mmHg)" value={d.tensi} onChange={v => setDf("tensi", v)} />
          <Field label="HR (x/mnt)" value={d.nadi} onChange={v => setDf("nadi", v)} />
          <Field label="RR (x/mnt)" value={d.rr} onChange={v => setDf("rr", v)} />
          <Field label="Suhu (°C)" value={d.suhu} onChange={v => setDf("suhu", v)} />
        </div>
        {errD && <div className="text-xs text-red-600">{errD}</div>}
        <button onClick={tambahDetail} disabled={savingD} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4 py-2">{savingD ? "…" : "+ Tambah Baris Monitoring"}</button>

        {detail === null ? <div className="text-center text-slate-400 text-sm py-4">Memuat…</div>
          : detail.length === 0 ? <div className="text-center text-slate-400 text-sm py-4">Belum ada data monitoring.</div>
          : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr>
                <th className="px-2 py-1.5 text-left">Fase</th><th className="px-2 py-1.5 text-left">Jam</th><th className="px-2 py-1.5 text-left">Obat</th><th className="px-2 py-1.5 text-left">Dosis</th><th className="px-2 py-1.5 text-left">TD</th><th className="px-2 py-1.5 text-left">N</th><th className="px-2 py-1.5 text-left">RR</th><th className="px-2 py-1.5 text-left">S</th><th className="px-2 py-1.5 text-left">Petugas</th><th></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {detail.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.waktu}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{(r.jam_rawat || "").slice(0, 5)}</td>
                    <td className="px-2 py-1.5">{r.obat || "-"}</td><td className="px-2 py-1.5">{r.dosis || "-"}</td>
                    <td className="px-2 py-1.5">{r.tensi || "-"}</td><td className="px-2 py-1.5">{r.nadi || "-"}</td><td className="px-2 py-1.5">{r.rr || "-"}</td><td className="px-2 py-1.5">{r.suhu || "-"}</td>
                    <td className="px-2 py-1.5 text-[11px] text-rose-600">{r.petugas || "-"}</td>
                    <td className="px-2 py-1.5 text-right">{r.milik === 1 && <button onClick={() => hapusDetail(r)} className="text-red-500 font-semibold">Hapus</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
// Navigasi tingkat-1 form Status Anestesi (RM.IBS.11.005.A). "Keadaan Pasca
// Anestesi" adalah grup dengan sub-tab (Data Awal, Monitoring, skor pemulihan).
const SA_GROUPS: { key: string; label: string; section?: string; pasca?: boolean }[] = [
  { key: "data_awal", label: "Data Awal & Checklist", section: "data_awal" },
  { key: "blokade_regional", label: "Blokade Regional", section: "blokade_regional" },
  { key: "umum_data_awal", label: "Anestesi Umum", section: "umum_data_awal" },
  { key: "umum_monitoring", label: "Monitoring", section: "umum_monitoring" },
  { key: "keadaan_operasi", label: "Keadaan Selama Operasi", section: "keadaan_operasi" },
  { key: "sectio_caesaria", label: "Sectio Caesarea", section: "sectio_caesaria" },
  { key: "pasca", label: "Keadaan Pasca Anestesi", pasca: true },
];
// Sub-tab di dalam "Keadaan Pasca Anestesi": seksi form biasa atau skor pemulihan.
const PASCA_SUBS: { key: string; label: string; section?: string; score?: boolean }[] = [
  { key: "pdata", label: "Masuk Kamar", section: "pasca_masuk_kamar" },
  { key: "pmon", label: "Monitoring", section: "pasca_monitoring" },
  { key: "score", label: "Score", score: true },
];
// Sub-tab tingkat-3 di dalam "Score": skor pemulihan + keluar/pindah.
const SCORE_SUBS: { key: string; label: string; skor?: string; section?: string }[] = [
  { key: "bromage", label: "Bromage", skor: "bromage" },
  { key: "aldrette", label: "Modified Aldrete", skor: "aldrette" },
  { key: "steward", label: "Stewart", skor: "steward" },
  { key: "keluar", label: "Keluar & Pindah", section: "keluar_kamar" },
];

function StatusAnestesiTab({ noRawat }: { noRawat: string }) {
  const [grp, setGrp] = useState<string>(SA_GROUPS[0].key);
  const [pascaSub, setPascaSub] = useState<string>(PASCA_SUBS[0].key);
  const [scoreSub, setScoreSub] = useState<string>(SCORE_SUBS[0].key);
  const curGrp = SA_GROUPS.find(g => g.key === grp) ?? SA_GROUPS[0];
  const curSub = PASCA_SUBS.find(s => s.key === pascaSub) ?? PASCA_SUBS[0];
  const isScore = !!(curGrp.pasca && curSub.score);
  const curScore = SCORE_SUBS.find(s => s.key === scoreSub) ?? SCORE_SUBS[0];
  const skorSec = isScore ? (curScore.skor ?? null) : null;
  const sec = isScore
    ? (curScore.section ?? "keluar_kamar")
    : (curGrp.pasca ? (curSub.section ?? "pasca_masuk_kamar") : (curGrp.section ?? SA_SECTIONS[0].key));
  const [list, setList] = useState<EnakesSaRingkas[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [tgl, setTgl] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [editKey, setEditKey] = useState<string | null>(null);
  const cur = SA_SECTIONS.find(s => s.key === sec) ?? SA_SECTIONS[0];
  useEffect(() => { enakesStatusAnestesiList(sec, noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [sec, noRawat, reload]);
  useEffect(() => { setOpen(false); setF({}); setEditKey(null); setErr(""); }, [sec]);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function startEdit(r: EnakesSaRingkas) {
    const t = r.tanggal ?? "";
    setErr("");
    try {
      const d = (await enakesStatusAnestesiDetail(sec, noRawat, t)).data;
      const v = { ...(d?.values ?? {}) };
      // konversi field bertipe datetime → format input datetime-local
      for (const fld of cur.fields) if (fld.t === "dt" && v[fld.k]) v[fld.k] = v[fld.k].slice(0, 16).replace(" ", "T");
      setF(v); setTgl(t.slice(0, 16).replace(" ", "T")); setEditKey(t); setOpen(true);
    } catch {
      setErr("Gagal memuat detail");
    }
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      await enakesStatusAnestesiSave({ section: sec, no_rawat: noRawat, tanggal: tgl, values: f, edit: !!editKey, orig_tanggal: editKey ?? undefined });
      setF({}); setEditKey(null); setOpen(false); setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan"));
    } finally { setSaving(false); }
  }
  async function hapus(r: EnakesSaRingkas) {
    if (!window.confirm(`Hapus ${cur.label} ini?`)) return;
    try {
      await enakesStatusAnestesiHapus({ section: sec, no_rawat: noRawat, tanggal: r.tanggal ?? "" });
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-500">Status Anestesi — pilih seksi, tiap seksi disimpan sendiri dengan waktu kejadiannya.</div>
      <div className="flex flex-wrap gap-1">
        {SA_GROUPS.map(g => (
          <button key={g.key} onClick={() => setGrp(g.key)}
            className={`text-[11px] font-semibold rounded-full px-2.5 py-1 border ${grp === g.key ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200 hover:border-rose-300"}`}>
            {g.label}
          </button>
        ))}
      </div>
      {curGrp.pasca && (
        <div className="flex flex-wrap gap-1 pl-2 border-l-2 border-rose-200">
          {PASCA_SUBS.map(s => (
            <button key={s.key} onClick={() => setPascaSub(s.key)}
              className={`text-[11px] font-semibold rounded-full px-2.5 py-1 border ${pascaSub === s.key ? "bg-rose-500 text-white border-rose-500" : "bg-white text-slate-500 border-slate-200 hover:border-rose-300"}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      {isScore && (
        <div className="flex flex-wrap gap-1 pl-4 border-l-2 border-rose-100">
          {SCORE_SUBS.map(s => (
            <button key={s.key} onClick={() => setScoreSub(s.key)}
              className={`text-[11px] font-semibold rounded-full px-2.5 py-1 border ${scoreSub === s.key ? "bg-rose-400 text-white border-rose-400" : "bg-white text-slate-500 border-slate-200 hover:border-rose-300"}`}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {skorSec ? (
        <SkorPeriopTab noRawat={noRawat} section={skorSec} />
      ) : (
      <>
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="text-sm font-bold text-slate-800">{editKey ? `Ubah ${cur.label}` : cur.label}</div>
          <DtField label="Tanggal & Jam Kejadian" value={tgl} onChange={setTgl} />
          <div className="grid grid-cols-2 gap-2">
            {cur.fields.map(fld => saField(fld, f, set))}
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : `Simpan ${cur.label}`}
            </button>
            <button onClick={() => { setOpen(false); setF({}); setEditKey(null); setErr(""); }}
              className="px-4 bg-white border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setF({}); setEditKey(null); setErr(""); setOpen(true); setTgl(nowLocal()); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + {cur.label}
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada data {cur.label}.</div>
      ) : (
        list.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{r.ringkas || cur.label}</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {(r.tanggal ?? "").slice(0, 16)}
                {r.milik === 1 && <button onClick={() => startEdit(r)} className="text-rose-600 hover:text-rose-800 font-semibold">Edit</button>}
                {r.milik === 1 && <button onClick={() => hapus(r)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            {r.petugas && <div className="mt-1 text-[11px] text-rose-600">{r.petugas}</div>}
          </div>
        ))
      )}
      </>
      )}
    </div>
  );
}

// ── Skor Pemulihan Perioperatif (Aldrette / Steward / Bromage) ───────────────
// Config skala diambil dari backend (otoritatif); nilai per skala = index opsi,
// total dihitung backend. List/edit/hapus owner-only lewat `nip`.
function SkorPeriopTab({ noRawat, section, kdDokter }: { noRawat: string; section: string; kdDokter?: string }) {
  const [cfg, setCfg] = useState<PeriopSkorSection | null>(null);
  const [list, setList] = useState<PeriopSkorRingkas[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [tgl, setTgl] = useState("");
  const [skala, setSkala] = useState<string[]>([]);
  const [keluar, setKeluar] = useState("");
  const [instruksi, setInstruksi] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);

  useEffect(() => {
    periopSkorConfig().then(r => setCfg(r.data.sections.find(s => s.key === section) ?? null)).catch(() => setCfg(null));
  }, [section]);
  useEffect(() => { periopSkorList(section, noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [section, noRawat, reload]);
  useEffect(() => { setOpen(false); setEditKey(null); setErr(""); }, [section]);

  // total live (nilai = index opsi terpilih)
  const total = cfg ? cfg.skala.reduce((sum, s, i) => sum + Math.max(0, s.options.indexOf(skala[i] ?? "")), 0) : 0;

  function resetForm() {
    setSkala(cfg ? cfg.skala.map(s => s.options[0]) : []);
    setKeluar(""); setInstruksi(""); setEditKey(null); setErr(""); setTgl(nowLocal());
  }
  async function startEdit(r: PeriopSkorRingkas) {
    const t = r.tanggal ?? ""; setErr("");
    try {
      const d = (await periopSkorDetail(section, noRawat, t)).data;
      const v = d?.values ?? {};
      setSkala(cfg ? cfg.skala.map((_, i) => v[`skala${i + 1}`] ?? "") : []);
      setKeluar(v.keluar ?? ""); setInstruksi(v.instruksi ?? "");
      setTgl(t.slice(0, 16).replace(" ", "T")); setEditKey(t); setOpen(true);
    } catch { setErr("Gagal memuat detail"); }
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      await periopSkorSave({ section, no_rawat: noRawat, tanggal: tgl, kd_dokter: kdDokter, skala, keluar, instruksi, edit: !!editKey, orig_tanggal: editKey ?? undefined });
      setOpen(false); setEditKey(null); setReload(x => x + 1);
    } catch (e) {
      setErr(notifGagal(e as { response?: { data?: { error?: string } } }, "Gagal menyimpan"));
    } finally { setSaving(false); }
  }
  async function hapus(r: PeriopSkorRingkas) {
    if (!window.confirm(`Hapus ${cfg?.label ?? "skor"} ini?`)) return;
    try { await periopSkorHapus({ section, no_rawat: noRawat, tanggal: r.tanggal ?? "" }); setReload(x => x + 1); }
    catch (e) { alert((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Gagal menghapus"); }
  }

  if (!cfg) return <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>;

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-500">{cfg.label} — pilih tiap parameter; nilai & total dihitung otomatis.</div>

      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="text-sm font-bold text-slate-800">{editKey ? `Ubah ${cfg.label}` : cfg.label}</div>
          <DtField label="Tanggal & Jam Penilaian" value={tgl} onChange={setTgl} />
          <div className="space-y-2">
            {cfg.skala.map((s, i) => (
              <SelField key={i} label={`${s.label} (nilai ${Math.max(0, s.options.indexOf(skala[i] ?? ""))})`}
                value={skala[i] ?? s.options[0]}
                onChange={v => setSkala(p => { const n = [...p]; n[i] = v; return n; })}
                options={s.options} />
            ))}
          </div>
          {cfg.has_total && (
            <div className="text-sm font-bold text-rose-700">Total Skor: {total}</div>
          )}
          <ResumeArea label="Keluar / Pindah Ke" value={keluar} onChange={setKeluar} />
          <ResumeArea label="Instruksi" value={instruksi} onChange={setInstruksi} />
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : `Simpan ${cfg.label}`}
            </button>
            <button onClick={() => { setOpen(false); setEditKey(null); setErr(""); }}
              className="px-4 bg-white border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setOpen(true); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + {cfg.label}
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada data {cfg.label}.</div>
      ) : (
        list.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{r.ringkas || cfg.label}</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {(r.tanggal ?? "").slice(0, 16)}
                {r.milik === 1 && <button onClick={() => startEdit(r)} className="text-rose-600 hover:text-rose-800 font-semibold">Edit</button>}
                {r.milik === 1 && <button onClick={() => hapus(r)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            {r.petugas && <div className="mt-1 text-[11px] text-rose-600">{r.petugas}</div>}
          </div>
        ))
      )}
    </div>
  );
}

// ── Form Perioperatif berbasis field (Edukasi Anestesi / SIA / Konversi) ─────
// Config field diambil dari backend; nilai disimpan generik (kolom di-derive dari
// tabel). List/edit/hapus owner-only lewat `nip`.
function PeriopFormTab({ noRawat, section, kdDokter }: { noRawat: string; section: string; kdDokter?: string }) {
  const [cfg, setCfg] = useState<PeriopFormSection | null>(null);
  const [list, setList] = useState<PeriopFormRingkas[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [tgl, setTgl] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [editKey, setEditKey] = useState<string | null>(null);

  useEffect(() => {
    periopFormConfig().then(r => setCfg(r.data.sections.find(s => s.key === section) ?? null)).catch(() => setCfg(null));
  }, [section]);
  useEffect(() => { periopFormList(section, noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [section, noRawat, reload]);
  useEffect(() => { setOpen(false); setF({}); setEditKey(null); setErr(""); }, [section]);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function startEdit(r: PeriopFormRingkas) {
    const t = r.tanggal ?? ""; setErr("");
    try {
      const d = (await periopFormDetail(section, noRawat, t)).data;
      setF({ ...(d?.values ?? {}) });
      setTgl(t.slice(0, 16).replace(" ", "T")); setEditKey(t); setOpen(true);
    } catch { setErr("Gagal memuat detail"); }
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      await periopFormSave({ section, no_rawat: noRawat, tanggal: tgl, kd_dokter: kdDokter, values: f, edit: !!editKey, orig_tanggal: editKey ?? undefined });
      setF({}); setEditKey(null); setOpen(false); setReload(x => x + 1);
    } catch (e) {
      setErr(notifGagal(e as { response?: { data?: { error?: string } } }, "Gagal menyimpan"));
    } finally { setSaving(false); }
  }
  async function hapus(r: PeriopFormRingkas) {
    if (!window.confirm(`Hapus ${cfg?.label ?? "data"} ini?`)) return;
    try { await periopFormHapus({ section, no_rawat: noRawat, tanggal: r.tanggal ?? "" }); setReload(x => x + 1); }
    catch (e) { alert((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Gagal menghapus"); }
  }

  if (!cfg) return <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>;

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-500">{cfg.label} — tiap entri disimpan dengan waktu kejadiannya.</div>

      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="text-sm font-bold text-slate-800">{editKey ? `Ubah ${cfg.label}` : cfg.label}</div>
          <DtField label="Tanggal & Jam Kejadian" value={tgl} onChange={setTgl} />
          <div className="grid grid-cols-2 gap-2">
            {cfg.fields.filter(fd => fd.k !== "nip").map(fd => {
              if (fd.typ === "area") return <div key={fd.k} className="col-span-2"><ResumeArea label={fd.label} value={f[fd.k] ?? ""} onChange={v => set(fd.k, v)} /></div>;
              if (fd.typ === "sel") return <SelField key={fd.k} label={fd.label} value={f[fd.k] ?? (fd.opts[0] ?? "")} onChange={v => set(fd.k, v)} options={fd.opts.length ? fd.opts : [""]} />;
              return <Field key={fd.k} label={fd.label} value={f[fd.k] ?? ""} onChange={v => set(fd.k, v)} />;
            })}
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : `Simpan ${cfg.label}`}
            </button>
            <button onClick={() => { setOpen(false); setF({}); setEditKey(null); setErr(""); }}
              className="px-4 bg-white border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setF({}); setEditKey(null); setErr(""); setOpen(true); setTgl(nowLocal()); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + {cfg.label}
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada data {cfg.label}.</div>
      ) : (
        list.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{r.ringkas || cfg.label}</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {(r.tanggal ?? "").slice(0, 16)}
                {r.milik === 1 && <button onClick={() => startEdit(r)} className="text-rose-600 hover:text-rose-800 font-semibold">Edit</button>}
                {r.milik === 1 && <button onClick={() => hapus(r)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            {r.petugas && <div className="mt-1 text-[11px] text-rose-600">{r.petugas}</div>}
          </div>
        ))
      )}
    </div>
  );
}

// ── Catatan Keperawatan (CPPT keperawatan) — log TTV+uraian, ralan/IGD & ranap ─
function CatatanKeperawatanTab({ noRawat, jenis }: { noRawat: string; jenis: string }) {
  const sec = jenis === "ranap" ? "ranap" : "ralan";
  const [rows, setRows] = useState<CatatanKeperawatan[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [editKey, setEditKey] = useState<{ tanggal: string; jam: string } | null>(null);
  const [f, setF] = useState<{ tanggal: string; jam: string; td: string; nadi: string; rr: string; suhu: string; spo2: string; uraian: string }>(
    { tanggal: "", jam: "", td: "", nadi: "", rr: "", suhu: "", spo2: "", uraian: "" });
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));
  useEffect(() => { ckList(sec, noRawat).then(r => setRows(r.data)).catch(() => setRows([])); }, [sec, noRawat, reload]);

  function resetForm() {
    const d = new Date(); const p = (n: number) => String(n).padStart(2, "0");
    setF({ tanggal: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, jam: `${p(d.getHours())}:${p(d.getMinutes())}`, td: "", nadi: "", rr: "", suhu: "", spo2: "", uraian: "" });
    setEditKey(null); setErr("");
  }
  function startEdit(r: CatatanKeperawatan) {
    setF({ tanggal: r.tanggal ?? "", jam: (r.jam ?? "").slice(0, 5), td: r.td ?? "", nadi: r.nadi ?? "", rr: r.rr ?? "", suhu: r.suhu ?? "", spo2: r.spo2 ?? "", uraian: r.uraian ?? "" });
    setEditKey({ tanggal: r.tanggal ?? "", jam: r.jam ?? "" }); setErr(""); setOpen(true);
  }
  async function simpan() {
    setSaving(true); setErr("");
    try {
      const jamFull = f.jam.length === 5 ? f.jam + ":00" : f.jam;
      if (editKey) await ckUpdate({ jenis: sec, no_rawat: noRawat, tanggal: f.tanggal, jam: jamFull, td: f.td, nadi: f.nadi, rr: f.rr, suhu: f.suhu, spo2: f.spo2, uraian: f.uraian, orig_tanggal: editKey.tanggal, orig_jam: editKey.jam });
      else await ckCreate({ jenis: sec, no_rawat: noRawat, tanggal: f.tanggal, jam: jamFull, td: f.td, nadi: f.nadi, rr: f.rr, suhu: f.suhu, spo2: f.spo2, uraian: f.uraian });
      setOpen(false); setEditKey(null); setReload(x => x + 1);
    } catch (e) { setErr(notifGagal(e as { response?: { data?: { error?: string } } }, "Gagal menyimpan")); }
    finally { setSaving(false); }
  }
  async function hapus(r: CatatanKeperawatan) {
    if (!window.confirm("Hapus catatan ini?")) return;
    try { await ckHapus({ jenis: sec, no_rawat: noRawat, tanggal: r.tanggal ?? "", jam: r.jam ?? "" }); setReload(x => x + 1); }
    catch (e) { alert((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Gagal menghapus"); }
  }
  function cetak() { window.open(`/cetak-keperawatan?jenis=${sec}&no_rawat=${encodeURIComponent(noRawat)}`, "_blank"); }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-slate-500">Catatan Keperawatan {sec === "ranap" ? "Rawat Inap" : "Rawat Jalan / IGD"} — log TTV & uraian per waktu.</div>
        <button onClick={cetak} className="text-xs bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg px-3 py-1.5">🖨️ Cetak</button>
      </div>

      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="text-sm font-bold text-slate-800">{editKey ? "Ubah" : "Tambah"} Catatan Keperawatan</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500 block">Tanggal<input type="date" value={f.tanggal} onChange={e => set("tanggal", e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-slate-500 block">Jam<input type="time" value={f.jam} onChange={e => set("jam", e.target.value)} className="mt-0.5 block w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" /></label>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <Field label="TD" value={f.td} onChange={v => set("td", v)} placeholder="120/80" />
            <Field label="Nadi" value={f.nadi} onChange={v => set("nadi", v)} />
            <Field label="RR" value={f.rr} onChange={v => set("rr", v)} />
            <Field label="Suhu" value={f.suhu} onChange={v => set("suhu", v)} />
            <Field label="SpO2" value={f.spo2} onChange={v => set("spo2", v)} />
          </div>
          <ResumeArea label="Uraian / Tindakan Keperawatan" value={f.uraian} onChange={v => set("uraian", v)} />
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving} className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">{saving ? "Menyimpan…" : "Simpan Catatan"}</button>
            <button onClick={() => { setOpen(false); setEditKey(null); setErr(""); }} className="px-4 bg-white border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setOpen(true); }} className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">+ Catatan Keperawatan</button>
      )}

      {rows === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada catatan keperawatan.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs"><tr>
              <th className="px-2 py-2 text-left">Tgl/Jam</th><th className="px-2 py-2 text-left">TD</th><th className="px-2 py-2 text-left">N</th><th className="px-2 py-2 text-left">RR</th><th className="px-2 py-2 text-left">S</th><th className="px-2 py-2 text-left">SpO2</th><th className="px-2 py-2 text-left">Uraian</th><th className="px-2 py-2 text-left">Petugas</th><th className="px-2 py-2"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 align-top">
                  <td className="px-2 py-2 whitespace-nowrap text-xs">{r.tanggal} <br />{(r.jam ?? "").slice(0, 5)}</td>
                  <td className="px-2 py-2 text-xs">{r.td ?? "-"}</td><td className="px-2 py-2 text-xs">{r.nadi ?? "-"}</td><td className="px-2 py-2 text-xs">{r.rr ?? "-"}</td><td className="px-2 py-2 text-xs">{r.suhu ?? "-"}</td><td className="px-2 py-2 text-xs">{r.spo2 ?? "-"}</td>
                  <td className="px-2 py-2 text-xs max-w-[280px] whitespace-pre-wrap">{r.uraian ?? "-"}</td>
                  <td className="px-2 py-2 text-[11px] text-rose-600">{r.petugas ?? "-"}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">{r.milik === 1 && <><button onClick={() => startEdit(r)} className="text-indigo-600 text-xs font-semibold mr-2">Edit</button><button onClick={() => hapus(r)} className="text-red-500 text-xs font-semibold">Hapus</button></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Pengkajian Medis Ranap (penilaian_medis_ranap) — dokter, append per tanggal
const NAB = ["", "Normal", "Abnormal", "Tidak Diperiksa"];
const PM_FIELDS: SAField[] = [
  { k: "anamnesis", l: "Anamnesis", t: "sel", o: ["", "Autoanamnesis", "Alloanamnesis"] }, { k: "hubungan", l: "Hubungan (bila allo)" },
  { k: "keluhan_utama", l: "Keluhan Utama", t: "area" }, { k: "rps", l: "Riwayat Penyakit Sekarang", t: "area" },
  { k: "rpd", l: "Riwayat Penyakit Dahulu", t: "area" }, { k: "rpk", l: "Riwayat Penyakit Keluarga", t: "area" },
  { k: "rpo", l: "Riwayat Pengobatan", t: "area" }, { k: "alergi", l: "Alergi" },
  { k: "keadaan", l: "Keadaan Umum", t: "sel", o: ["", "Sehat", "Sakit Ringan", "Sakit Sedang", "Sakit Berat"] },
  { k: "kesadaran", l: "Kesadaran", t: "sel", o: ["", "Compos Mentis", "Apatis", "Somnolen", "Sopor", "Koma"] }, { k: "gcs", l: "GCS" },
  { k: "td", l: "TD (mmHg)" }, { k: "nadi", l: "Nadi" }, { k: "rr", l: "RR" }, { k: "suhu", l: "Suhu" }, { k: "spo", l: "SpO2" }, { k: "bb", l: "BB (kg)" }, { k: "tb", l: "TB (cm)" },
  { k: "kepala", l: "Kepala", t: "sel", o: NAB }, { k: "mata", l: "Mata", t: "sel", o: NAB }, { k: "gigi", l: "Gigi", t: "sel", o: NAB }, { k: "tht", l: "THT", t: "sel", o: NAB },
  { k: "thoraks", l: "Thoraks", t: "sel", o: NAB }, { k: "jantung", l: "Jantung", t: "sel", o: NAB }, { k: "paru", l: "Paru", t: "sel", o: NAB }, { k: "abdomen", l: "Abdomen", t: "sel", o: NAB },
  { k: "genital", l: "Genital", t: "sel", o: NAB }, { k: "ekstremitas", l: "Ekstremitas", t: "sel", o: NAB }, { k: "kulit", l: "Kulit", t: "sel", o: NAB },
  { k: "ket_fisik", l: "Keterangan Pemeriksaan Fisik", t: "area" }, { k: "status_lokalis", l: "Status Lokalis", t: "area" }, { k: "ket_lokalis", l: "Keterangan Lokalis", t: "area" },
  { k: "lab", l: "Laboratorium", t: "area" }, { k: "rad", l: "Radiologi", t: "area" }, { k: "penunjang", l: "Penunjang Lain", t: "area" },
  { k: "diagnosis", l: "Diagnosis" }, { k: "tata", l: "Tata Laksana", t: "area" }, { k: "edukasi", l: "Edukasi", t: "area" },
];
// ── Awal Medis IGD (penilaian_medis_igd) — kolom mirip ranap, tanpa tht/jantung/paru/kulit/penunjang/edukasi; plus leher, ekg
const PM_IGD_FIELDS: SAField[] = [
  { k: "anamnesis", l: "Anamnesis", t: "sel", o: ["", "Autoanamnesis", "Alloanamnesis"] }, { k: "hubungan", l: "Hubungan (bila allo)" },
  { k: "keluhan_utama", l: "Keluhan Utama", t: "area" }, { k: "rps", l: "Riwayat Penyakit Sekarang", t: "area" },
  { k: "rpd", l: "Riwayat Penyakit Dahulu", t: "area" }, { k: "rpk", l: "Riwayat Penyakit Keluarga", t: "area" },
  { k: "rpo", l: "Riwayat Pengobatan", t: "area" }, { k: "alergi", l: "Alergi" },
  { k: "keadaan", l: "Keadaan Umum", t: "sel", o: ["", "Sehat", "Sakit Ringan", "Sakit Sedang", "Sakit Berat"] },
  { k: "kesadaran", l: "Kesadaran", t: "sel", o: ["", "Compos Mentis", "Apatis", "Somnolen", "Sopor", "Koma"] }, { k: "gcs", l: "GCS" },
  { k: "td", l: "TD (mmHg)" }, { k: "nadi", l: "Nadi" }, { k: "rr", l: "RR" }, { k: "suhu", l: "Suhu" }, { k: "spo", l: "SpO2" }, { k: "bb", l: "BB (kg)" }, { k: "tb", l: "TB (cm)" },
  { k: "kepala", l: "Kepala", t: "sel", o: NAB }, { k: "mata", l: "Mata", t: "sel", o: NAB }, { k: "gigi", l: "Gigi", t: "sel", o: NAB }, { k: "leher", l: "Leher", t: "sel", o: NAB },
  { k: "thoraks", l: "Thoraks", t: "sel", o: NAB }, { k: "abdomen", l: "Abdomen", t: "sel", o: NAB },
  { k: "genital", l: "Genital", t: "sel", o: NAB }, { k: "ekstremitas", l: "Ekstremitas", t: "sel", o: NAB },
  { k: "ket_fisik", l: "Keterangan Pemeriksaan Fisik", t: "area" }, { k: "status_lokalis", l: "Status Lokalis", t: "area" }, { k: "ket_lokalis", l: "Keterangan Lokalis", t: "area" },
  { k: "ekg", l: "EKG", t: "area" }, { k: "lab", l: "Laboratorium", t: "area" }, { k: "rad", l: "Radiologi", t: "area" },
  { k: "diagnosis", l: "Diagnosis" }, { k: "tata", l: "Tata Laksana", t: "area" },
];
function PengkajianMedisTab({ noRawat, sumber }: { noRawat: string; sumber?: "igd" }) {
  const isIgd = sumber === "igd";
  const fields = isIgd ? PM_IGD_FIELDS : PM_FIELDS;
  const judul = isIgd ? "Awal Medis IGD" : "Pengkajian Medis Ranap";
  const [list, setList] = useState<EdokterPengkajianMedis[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [tgl, setTgl] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => { edokterPengkajianMedisList(noRawat, sumber).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat, reload, sumber]);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function simpan() {
    setSaving(true); setErr("");
    try {
      await edokterPengkajianMedisSave({ no_rawat: noRawat, tanggal: tgl, values: f, sumber });
      setF({}); setTgl(""); setOpen(false); setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan"));
    } finally { setSaving(false); }
  }
  async function editRow(r: EdokterPengkajianMedis) {
    try {
      const d = await edokterPengkajianMedisDetail(noRawat, r.tanggal ?? "", sumber);
      setF(d.data ?? {}); setTgl((r.tanggal ?? "").slice(0, 16).replace(" ", "T")); setOpen(true);
    } catch { /* ignore */ }
  }
  async function hapus(r: EdokterPengkajianMedis) {
    if (!window.confirm(`Hapus ${judul.toLowerCase()} ini?`)) return;
    try { await edokterPengkajianMedisHapus({ no_rawat: noRawat, tanggal: r.tanggal ?? "", sumber }); setReload(x => x + 1); }
    catch (e) { const ex = e as { response?: { data?: { error?: string } } }; alert(ex.response?.data?.error ?? "Gagal menghapus"); }
  }

  return (
    <div className="space-y-3">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="text-sm font-bold text-slate-800">{judul}</div>
          <DtField label="Tanggal & Jam Pemeriksaan" value={tgl} onChange={setTgl} />
          <div className="grid grid-cols-2 gap-2">
            {fields.map(fld => saField(fld, f, set))}
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : `Simpan ${judul}`}
            </button>
            <button onClick={() => { setOpen(false); setF({}); setTgl(""); setErr(""); }}
              className="px-4 bg-white border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg py-2">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setOpen(true); setF({}); setTgl(nowLocal()); }}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + {judul}
        </button>
      )}
      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada {judul.toLowerCase()}.</div>
      ) : (
        list.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800 truncate">{r.ringkas || judul}</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                {(r.tanggal ?? "").slice(0, 16)}
                {r.milik === 1 && <button onClick={() => editRow(r)} className="text-emerald-600 hover:text-emerald-800 font-semibold">Edit</button>}
                {r.milik === 1 && <button onClick={() => hapus(r)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            {r.dokter && <div className="mt-1 text-[11px] text-teal-600">{r.dokter}</div>}
          </div>
        ))
      )}
    </div>
  );
}

// ── Resume Medis Ranap (resume_pasien_ranap) — dokter, upsert per no_rawat ────
const RM_FIELDS: SAField[] = [
  { k: "diagnosa_awal", l: "Diagnosa Awal" }, { k: "alasan", l: "Alasan Dirawat" },
  { k: "keluhan_utama", l: "Keluhan Utama", t: "area" }, { k: "pemeriksaan_fisik", l: "Pemeriksaan Fisik", t: "area" },
  { k: "jalannya_penyakit", l: "Jalannya Penyakit", t: "area" }, { k: "pemeriksaan_penunjang", l: "Pemeriksaan Penunjang", t: "area" },
  { k: "hasil_laborat", l: "Hasil Laborat", t: "area" }, { k: "tindakan_dan_operasi", l: "Tindakan & Operasi", t: "area" }, { k: "obat_di_rs", l: "Obat di RS", t: "area" },
  { k: "diagnosa_utama", l: "Diagnosa Utama" }, { k: "kd_diagnosa_utama", l: "ICD Diagnosa Utama" },
  { k: "diagnosa_sekunder", l: "Diagnosa Sekunder 1" }, { k: "kd_diagnosa_sekunder", l: "ICD Sekunder 1" },
  { k: "diagnosa_sekunder2", l: "Diagnosa Sekunder 2" }, { k: "kd_diagnosa_sekunder2", l: "ICD Sekunder 2" },
  { k: "diagnosa_sekunder3", l: "Diagnosa Sekunder 3" }, { k: "kd_diagnosa_sekunder3", l: "ICD Sekunder 3" },
  { k: "diagnosa_sekunder4", l: "Diagnosa Sekunder 4" }, { k: "kd_diagnosa_sekunder4", l: "ICD Sekunder 4" },
  { k: "prosedur_utama", l: "Prosedur Utama" }, { k: "kd_prosedur_utama", l: "ICD Prosedur Utama" },
  { k: "prosedur_sekunder", l: "Prosedur Sekunder 1" }, { k: "kd_prosedur_sekunder", l: "ICD Prosedur 1" },
  { k: "prosedur_sekunder2", l: "Prosedur Sekunder 2" }, { k: "kd_prosedur_sekunder2", l: "ICD Prosedur 2" },
  { k: "prosedur_sekunder3", l: "Prosedur Sekunder 3" }, { k: "kd_prosedur_sekunder3", l: "ICD Prosedur 3" },
  { k: "alergi", l: "Alergi" }, { k: "diet", l: "Diet", t: "area" }, { k: "lab_belum", l: "Lab Belum Selesai", t: "area" }, { k: "edukasi", l: "Edukasi", t: "area" },
  { k: "cara_keluar", l: "Cara Keluar", t: "sel", o: ["", "Atas Izin Dokter", "Pindah RS", "Pulang Atas Permintaan Sendiri", "Lainnya"] }, { k: "ket_keluar", l: "Ket. Cara Keluar" },
  { k: "keadaan", l: "Keadaan Keluar", t: "sel", o: ["", "Membaik", "Sembuh", "Keadaan Khusus", "Meninggal"] }, { k: "ket_keadaan", l: "Ket. Keadaan" },
  { k: "dilanjutkan", l: "Perawatan Dilanjutkan", t: "sel", o: ["", "Kembali Ke RS", "RS Lain", "Dokter Luar", "Puskesmes", "Lainnya"] }, { k: "ket_dilanjutkan", l: "Ket. Dilanjutkan" },
  { k: "kontrol", l: "Tanggal Kontrol", t: "dt" }, { k: "obat_pulang", l: "Obat Pulang", t: "area" },
];
function ResumeMedisTab({ noRawat }: { noRawat: string }) {
  const [f, setF] = useState<Record<string, string>>({});
  const [ada, setAda] = useState(false);
  const [dokter, setDokter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);
  useEffect(() => {
    setLoading(true);
    edokterResumeMedisGet(noRawat).then(r => {
      const v = { ...(r.data.values ?? {}) };
      setDokter(v.dokter ?? ""); delete v.dokter;
      if (v.kontrol) v.kontrol = v.kontrol.slice(0, 16).replace(" ", "T");
      setF(v); setAda(r.data.ada);
    }).catch(() => setAda(false)).finally(() => setLoading(false));
  }, [noRawat]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function simpan() {
    setSaving(true); setMsg(null);
    try {
      await edokterResumeMedisSave({ no_rawat: noRawat, values: f });
      setAda(true); setMsg({ t: "ok", m: "Resume medis tersimpan" });
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setMsg({ t: "err", m: ex.response?.data?.error ?? "Gagal menyimpan" });
    } finally { setSaving(false); }
  }
  if (loading) return <div className="py-10 text-center text-slate-400 text-sm">Memuat…</div>;
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-800">Resume Medis Ranap</div>
          {ada && dokter && <div className="text-[11px] text-teal-600">DPJP: {dokter}</div>}
        </div>
        {msg && <div className={`text-xs px-3 py-2 rounded-lg ${msg.t === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{msg.m}</div>}
        <div className="grid grid-cols-2 gap-2">
          {RM_FIELDS.map(fld => saField(fld, f, set))}
        </div>
        <button onClick={simpan} disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
          {saving ? "Menyimpan…" : ada ? "Perbarui Resume Medis" : "Simpan Resume Medis"}
        </button>
      </div>
    </div>
  );
}

// ── Surat Pulang Atas Permintaan Sendiri (APS) — e-Nakes + foto/TTD ──────────
const HUB_OPS = ["Suami", "Istri", "Anak", "Ayah", "Ibu", "Saudara", "Keponakan"];
function ApsTab({ noRawat }: { noRawat: string }) {
  const [f, setF] = useState({
    tgl_pulang: todayISO2(), rs_pilihan: "", nama_pj: "", lahir: "", umur: "", jkpj: "L",
    alamat: "", hubungan: "Anak", saksi_keluarga: "",
  });
  const [existing, setExisting] = useState<{ noSurat?: string; flags?: string; dapatEdit?: boolean } | null>(null);
  const [baru, setBaru] = useState(false);
  const [pFoto, setPFoto] = useState<string | null>(null);
  const [pTtd, setPTtd] = useState<string | null>(null);
  const [sFoto, setSFoto] = useState<string | null>(null);
  const [sTtd, setSTtd] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const [err, setErr] = useState(""); const [okMsg, setOkMsg] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    enakesApsGet(noRawat).then(r => {
      const d = r.data;
      if (d.exists) {
        setF({
          tgl_pulang: (d.tgl_pulang ?? "").slice(0, 10) || todayISO2(), rs_pilihan: d.rs_pilihan ?? "",
          nama_pj: d.nama_pj ?? "", lahir: (d.lahir ?? "").slice(0, 10) === "2000-01-01" ? "" : (d.lahir ?? "").slice(0, 10),
          umur: d.umur ?? "", jkpj: d.jkpj || "L", alamat: d.alamat ?? "", hubungan: d.hubungan || "Anak", saksi_keluarga: d.saksi_keluarga ?? "",
        });
        const fl: string[] = [];
        if (d.pembuat_foto) fl.push("foto pembuat"); if (d.pembuat_ttd) fl.push("TTD pembuat");
        if (d.saksi_foto) fl.push("foto saksi"); if (d.saksi_ttd) fl.push("TTD saksi");
        setExisting({ noSurat: d.no_surat, flags: fl.join(", "), dapatEdit: d.dapat_edit });
      } else setExisting(null);
    }).catch(() => {});
  }, [noRawat, reload]);

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  async function simpan() {
    if (!f.nama_pj.trim()) { setErr("Nama pembuat pernyataan (pasien/penanggung jawab) wajib diisi."); return; }
    setSaving(true); setErr(""); setOkMsg("");
    const editing = !baru && !!existing?.noSurat && !!existing?.dapatEdit;
    try {
      const res = await enakesApsSave({ no_rawat: noRawat, ...f, ...(editing ? { edit: true, no_surat: existing!.noSurat } : {}) });
      const noSurat = res.data.no_surat;
      if (noSurat && (pFoto || pTtd || sFoto || sTtd)) {
        await enakesApsBukti({
          no_surat: noSurat,
          pembuat_foto: pFoto ?? "", pembuat_ttd: pTtd ?? "", saksi_foto: sFoto ?? "", saksi_ttd: sTtd ?? "",
        });
      }
      setOkMsg(editing ? `Surat APS diperbarui (${noSurat}).` : `Surat APS tersimpan (${noSurat}).`);
      setBaru(false); setPFoto(null); setPTtd(null); setSFoto(null); setSTtd(null); setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan surat APS"));
    } finally { setSaving(false); }
  }

  const Fld = (label: string, k: keyof typeof f, type = "text") => (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <input type={type} value={f[k]} onChange={e => set(k, e.target.value)}
        className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
    </div>
  );

  return (
    <div className="space-y-3">
      {existing && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-[11px] text-rose-700 flex items-center justify-between gap-2">
          <span>
            Surat terakhir: {existing.noSurat}{existing.flags ? ` · bukti: ${existing.flags}` : ""}.
            {baru ? " Simpan membuat surat BARU." : existing.dapatEdit ? " Simpan memperbarui surat ini." : " Surat milik petugas lain (lihat saja)."}
          </span>
          {existing.dapatEdit && (
            baru
              ? <button onClick={() => setBaru(false)} className="underline font-semibold shrink-0">Ubah surat ini</button>
              : <button onClick={() => setBaru(true)} className="underline font-semibold shrink-0">Buat surat baru</button>
          )}
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
        <div className="text-sm font-bold text-slate-800">Surat Pulang Atas Permintaan Sendiri</div>
        <div className="grid grid-cols-2 gap-2">
          {Fld("Tanggal pulang", "tgl_pulang", "date")}
          {Fld("RS pilihan (rujukan)", "rs_pilihan")}
        </div>
        <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide pt-1">Pembuat Pernyataan (Pasien / Penanggung Jawab)</div>
        {Fld("Nama", "nama_pj")}
        <div className="grid grid-cols-2 gap-2">
          {Fld("Tanggal lahir", "lahir", "date")}
          {Fld("Umur", "umur")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Jenis kelamin</label>
            <div className="mt-0.5 flex gap-1">
              {["L", "P"].map(v => (
                <button key={v} type="button" onClick={() => set("jkpj", v)}
                  className={`flex-1 text-xs rounded-lg border px-2 py-1.5 font-semibold ${f.jkpj === v ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-500 border-slate-200"}`}>
                  {v === "L" ? "Laki-laki" : "Perempuan"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Hubungan dengan pasien</label>
            <select value={f.hubungan} onChange={e => set("hubungan", e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400">
              {HUB_OPS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        {Fld("Alamat", "alamat")}
        {Fld("Saksi keluarga (nama)", "saksi_keluarga")}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
        <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">Foto & Tanda Tangan — Pembuat Pernyataan</div>
        <PhotoInput value={pFoto} onChange={setPFoto} />
        <SignaturePad onChange={setPTtd} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
        <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">Foto & Tanda Tangan — Saksi Keluarga</div>
        <PhotoInput value={sFoto} onChange={setSFoto} />
        <SignaturePad onChange={setSTtd} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2 sticky bottom-0">
        {err && <div className="text-xs text-red-600">{err}</div>}
        {okMsg && <div className="text-xs text-emerald-700">{okMsg}</div>}
        <button onClick={simpan} disabled={saving || (!!existing && !existing.dapatEdit && !baru)}
          className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
          {saving ? "Menyimpan…" : (existing?.noSurat && existing.dapatEdit && !baru) ? "Perbarui Surat APS + Bukti" : "Simpan Surat APS + Bukti"}
        </button>
      </div>
    </div>
  );
}

function MarkingCanvas({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const pts = (value || "").split(";").map(s => s.trim()).filter(Boolean)
    .map(p => { const [x, y] = p.split(","); return { x: parseFloat(x), y: parseFloat(y) }; })
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  const serialize = (arr: {x:number;y:number}[]) =>
    arr.map(p => `${Math.round(p.x*10000)/10000},${Math.round(p.y*10000)/10000}`).join(";");
  const add = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    // klik dekat titik yang ada (<3% jarak) => hapus, else tambah
    const near = pts.findIndex(p => Math.hypot((p.x-fx)*r.width, (p.y-fy)*r.height) < 12);
    if (near >= 0) { const a = pts.slice(); a.splice(near,1); onChange(serialize(a)); }
    else onChange(serialize([...pts, { x: fx, y: fy }]));
  };
  return (
    <div className="relative inline-block w-full border border-slate-300 rounded-lg overflow-hidden select-none" ref={ref} onClick={add}>
      <img src="/penandaan/area_operasi.png" alt="Area operasi" className="block w-full" draggable={false} />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {pts.map((p, i) => (
          <circle key={i} cx={p.x*100} cy={p.y*100} r={1.6} fill="none" stroke="black" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}

function PenandaanTab({ noRawat }: { noRawat: string }) {
  const [d, setD] = useState<EnakesPenandaan | null>(null);
  const [nama, setNama] = useState("");
  const [hubungan, setHubungan] = useState("Anak");
  const [marking, setMarking] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [ttd, setTtd] = useState<string | null>(null);
  const [setuju, setSetuju] = useState(false);
  const [saving, setSaving] = useState(false); const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState(""); const [okMsg, setOkMsg] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    enakesPenandaanGet(noRawat).then(r => {
      setD(r.data);
      setNama(r.data.nama_penanda ?? "");
      setMarking(r.data.marking_points ?? "");
      if (r.data.hubungan) setHubungan(r.data.hubungan);
    }).catch(() => setD(null));
  }, [noRawat, reload]);

  async function simpan() {
    if (!d || !d.exists) return;
    if (!setuju) { setErr("Centang persetujuan dulu"); return; }
    if (!nama.trim()) { setErr("Nama penanda wajib diisi"); return; }
    if (!marking.trim() && !ttd) { setErr("Isi penandaan lokasi pada gambar atau tanda tangan"); return; }
    setSaving(true); setErr(""); setOkMsg("");
    try {
      const res = await enakesPenandaanTtdSave({
        no_rawat: noRawat, tanggal: d.tanggal ?? "", nama_penanda: nama.trim(),
        hubungan, marking_points: marking, foto: foto ?? "", ttd: ttd ?? "",
      });
      setOkMsg(`Tersimpan. Hash bukti: ${(res.data.hash ?? "").slice(0, 12)}…`);
      setFoto(null); setTtd(null); setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan penandaan"));
    } finally { setSaving(false); }
  }

  async function hapus() {
    if (!d || !d.exists) return;
    if (!window.confirm("Hapus penandaan area operasi ini? Tindakan tidak dapat dibatalkan.")) return;
    setDeleting(true); setErr(""); setOkMsg("");
    try {
      await enakesPenandaanHapus({ no_rawat: noRawat, tanggal: d.tanggal ?? "" });
      setMarking(""); setFoto(null); setTtd(null); setNama(""); setSetuju(false);
      setOkMsg("Penandaan dihapus.");
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } }; status?: number };
      setErr(ex.response?.data?.error ?? "Gagal menghapus. Hanya bisa dihapus oleh petugas yang menginput.");
    } finally { setDeleting(false); }
  }

  if (!d) return <div className="text-xs text-slate-500 p-3">Memuat…</div>;

  if (!d.exists) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">
        Belum ada penandaan lokasi operasi untuk pasien ini. Buat dulu di aplikasi desktop (form Penandaan Area Operasi), lalu TTD &amp; foto pasien diisi di sini.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
        <div className="text-sm font-bold text-slate-800">Penandaan Area Operasi</div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div><span className="font-semibold text-slate-500">Operasi</span><div className="text-slate-800">{d.operasi || "-"}</div></div>
          <div><span className="font-semibold text-slate-500">Ruangan</span><div className="text-slate-800">{d.ruangan || "-"}</div></div>
          <div><span className="font-semibold text-slate-500">Dokter</span><div className="text-slate-800">{d.nm_dokter || "-"}</div></div>
          <div><span className="font-semibold text-slate-500">Tanggal</span><div className="text-slate-800">{d.tanggal || "-"}</div></div>
        </div>
      </div>

      {d.ttd_ada && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 text-[11px] text-sky-700">
          TTD tersimpan (hash: {(d.hash ?? "").slice(0, 12)}…). Menyimpan ulang akan menimpa.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
        <div className="text-[11px] font-bold text-sky-600 uppercase tracking-wide">Penandaan Lokasi Operasi</div>
        <div className="text-[11px] text-slate-500">Klik gambar untuk menandai (klik lagi untuk hapus).</div>
        <div className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          <span className="font-semibold">Standar SKP 4:</span> gunakan simbol <span className="font-bold">lingkaran ◯</span> pada sisi/lokasi operasi.
          Jangan gunakan tanda centang (√). Penanda otomatis berbentuk lingkaran.
        </div>
        <MarkingCanvas value={marking} onChange={setMarking} />
        {d.penginput_nama && (
          <div className="text-[11px] text-slate-500">Penginput: <span className="font-semibold text-slate-700">{d.penginput_nama}</span></div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
        <div className="text-[11px] font-bold text-sky-600 uppercase tracking-wide">Pernyataan Persetujuan</div>
        <div className="text-xs text-slate-700">Saya menyatakan bahwa lokasi operasi yang telah ditetapkan pada gambar adalah benar.</div>
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={setuju} onChange={e => setSetuju(e.target.checked)} className="mt-0.5" />
          <span>Pasien/keluarga menyetujui pernyataan di atas</span>
        </label>
        <div>
          <label className="text-xs font-semibold text-slate-600">Nama penanda</label>
          <input type="text" value={nama} onChange={e => setNama(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Hubungan dengan pasien</label>
          <select value={hubungan} onChange={e => setHubungan(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400">
            {HUB_OPS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <PhotoInput value={foto} onChange={setFoto} />
        <SignaturePad onChange={setTtd} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2 sticky bottom-0">
        {err && <div className="text-xs text-red-600">{err}</div>}
        {okMsg && <div className="text-xs text-emerald-700">{okMsg}</div>}
        <button onClick={simpan} disabled={saving || deleting}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
          {saving ? "Menyimpan…" : "Simpan TTD + Foto"}
        </button>
        {d.bisa_hapus && (
          <button onClick={hapus} disabled={saving || deleting}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
            {deleting ? "Menghapus…" : "Hapus Penandaan"}
          </button>
        )}
      </div>
    </div>
  );
}

function todayISO2() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Nilai default input datetime-local = jam sekarang (waktu lokal, "YYYY-MM-DDTHH:mm").
function nowLocal() {
  const d = new Date(); const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── Checklist Keselamatan Operasi (WHO) — 3 fase terpisah (waktu berbeda) ──────
const SIGNIN_ITEMS: [string, string][] = [
  ["identitas", "Identitas pasien telah dikonfirmasi"],
  ["penandaan_area_operasi", "Sisi/area operasi telah ditandai"],
  ["mesin_anestesi", "Mesin anestesi & obat telah diperiksa"],
  ["pulse_oximetri", "Pulse oximeter terpasang & berfungsi"],
  ["alergi", "Alergi diketahui"],
  ["gangguan_pernapasan", "Risiko gangguan pernapasan / aspirasi"],
  ["resiko_perdarahan", "Risiko perdarahan >500ml (7ml/kg pd anak)"],
];
const TIMEOUT_ITEMS: [string, string][] = [
  ["identitas_perkenalan", "Semua tim memperkenalkan diri (nama & peran)"],
  ["nama_pasien_tindakan_area_insisi", "Konfirmasi nama pasien, tindakan, area insisi"],
  ["profilaksis_antibiotik", "Profilaksis antibiotik <60 menit terakhir"],
  ["hal_khusus_bedah", "dr. Bedah: hal khusus / langkah kritis"],
  ["antisipasi_perdarahan", "dr. Bedah: antisipasi perdarahan"],
  ["kekhawatiran_anestesi", "dr. Anestesi: ada kekhawatiran khusus"],
  ["kesterilan_alat", "Perawat: kesterilan alat dipastikan"],
  ["kesiapan_peralatan", "Perawat: kesiapan / kondisi peralatan"],
  ["hasil_radiologi", "Perawat: hasil radiologi tersedia"],
];
const SIGNOUT_ITEMS: [string, string][] = [
  ["verbal_tindakan", "Konfirmasi nama tindakan"],
  ["verbal_kelengkapan_kasa", "Kelengkapan jumlah kasa"],
  ["verbal_instrumen", "Kelengkapan instrumen"],
  ["verbal_alat_tajam", "Kelengkapan alat tajam / jarum"],
  ["kelengkapan_specimen_label", "Pelabelan spesimen (nama pasien)"],
];

function DokterPicker({ label, list, kd, nm, onPick }: {
  label: string; list: { kd_dokter: string; nm_dokter: string }[];
  kd: string; nm: string; onPick: (kd: string, nm: string) => void;
}) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const f = q.trim().toLowerCase();
  const hasil = (f ? list.filter(d => d.nm_dokter.toLowerCase().includes(f) || d.kd_dokter.toLowerCase().includes(f)) : list).slice(0, 30);
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {kd ? (
        <div className="mt-0.5 flex items-center gap-2">
          <div className="flex-1 text-xs rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-emerald-800">{nm || kd}</div>
          <button type="button" onClick={() => { onPick("", ""); setOpen(true); }} className="text-xs text-slate-500 underline">ganti</button>
        </div>
      ) : (
        <div className="relative">
          <input value={q} onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true); }}
            placeholder="Cari nama dokter…" className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
          {open && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {hasil.length === 0 && <div className="px-2 py-1.5 text-xs text-slate-400">Tidak ada</div>}
              {hasil.map(d => (
                <button key={d.kd_dokter} type="button" onClick={() => { onPick(d.kd_dokter, d.nm_dokter); setOpen(false); setQ(""); }}
                  className="block w-full text-left text-xs px-2 py-1.5 hover:bg-sky-50">{d.nm_dokter} <span className="text-slate-400">({d.kd_dokter})</span></button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistPhaseTab({ noRawat, phase, judul, items, extraText, hasImplan }: {
  noRawat: string; phase: "signin" | "timeout" | "signout"; judul: string;
  items: [string, string][]; extraText?: [string, string]; hasImplan?: boolean;
}) {
  const [chk, setChk] = useState<Record<string, boolean>>({});
  const [tindakan, setTindakan] = useState("");
  const [extra, setExtra] = useState("");
  const [implan, setImplan] = useState(false);
  const [jenis, setJenis] = useState("");
  const [existing, setExisting] = useState<string | null>(null);
  const [origTgl, setOrigTgl] = useState("");   // tanggal record termuat (utk edit in-place / hapus)
  const [dapatEdit, setDapatEdit] = useState(true);
  const [tgl, setTgl] = useState(nowLocal());
  const [dokList, setDokList] = useState<{ kd_dokter: string; nm_dokter: string }[]>([]);
  const [kdBedah, setKdBedah] = useState(""); const [nmBedah, setNmBedah] = useState("");
  const [kdAnes, setKdAnes] = useState(""); const [nmAnes, setNmAnes] = useState("");
  const [jumlahKasa, setJumlahKasa] = useState(""); const [jumlahInstrumen, setJumlahInstrumen] = useState(""); const [jumlahJarum, setJumlahJarum] = useState("");
  const [timAsisten, setTimAsisten] = useState(""); const [timInstrumen, setTimInstrumen] = useState("");
  const [timSirkuler, setTimSirkuler] = useState(""); const [timPenata, setTimPenata] = useState("");
  const [profilaksisObat, setProfilaksisObat] = useState("");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState(""); const [okMsg, setOkMsg] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const getFn = phase === "signin" ? enakesSignInGet : phase === "timeout" ? enakesTimeOutGet : enakesSignOutGet;
    getFn(noRawat).then(r => {
      const d = r.data;
      if (d.exists) {
        const nc: Record<string, boolean> = {};
        items.forEach(([k]) => { nc[k] = d[k] === "Ya"; });
        setChk(nc);
        setTindakan(d.tindakan ?? "");
        if (extraText) setExtra(d[extraText[0]] ?? "");
        if (hasImplan) { setImplan(d.peralatan_khusus === "Ada"); setJenis(d.jenis_peralatan ?? ""); }
        setExisting((d.tanggal ?? "").slice(0, 16).replace("T", " "));
        setOrigTgl(d.tanggal ?? "");
        setDapatEdit(d.dapat_edit !== false);
        setTgl(toLocalInput(d.tanggal) || nowLocal());
        setKdBedah(d.kd_dokter_bedah ?? ""); setNmBedah(d.nm_dokter_bedah ?? "");
        setKdAnes(d.kd_dokter_anestesi ?? ""); setNmAnes(d.nm_dokter_anestesi ?? "");
        setJumlahKasa(d.jumlah_kasa ?? ""); setJumlahInstrumen(d.jumlah_instrumen ?? ""); setJumlahJarum(d.jumlah_jarum ?? "");
        setTimAsisten(d.tim_asisten ?? ""); setTimInstrumen(d.tim_instrumen ?? ""); setTimSirkuler(d.tim_sirkuler ?? ""); setTimPenata(d.tim_penata ?? ""); setProfilaksisObat(d.profilaksis_obat ?? "");
      } else { setChk({}); setTindakan(""); setExtra(""); setImplan(false); setJenis(""); setExisting(null); setOrigTgl(""); setDapatEdit(true); setTgl(nowLocal()); setKdBedah(""); setNmBedah(""); setKdAnes(""); setNmAnes(""); setJumlahKasa(""); setJumlahInstrumen(""); setJumlahJarum(""); setTimAsisten(""); setTimInstrumen(""); setTimSirkuler(""); setTimPenata(""); setProfilaksisObat(""); }
    }).catch(() => {});
  }, [noRawat, reload, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { igdListDokter().then(r => setDokList(r.data)).catch(() => {}); }, []);

  const toggle = (k: string) => { if (existing && !dapatEdit) return; setChk(p => ({ ...p, [k]: !p[k] })); };
  const g = (k: string) => !!chk[k];
  const terkunci = !!existing && !dapatEdit;   // record milik petugas lain

  async function simpan() {
    if (phase === "signin" && (!kdBedah || !kdAnes)) { setErr("Pilih dokter bedah & dokter anestesi terlebih dahulu"); return; }
    if (terkunci) { setErr("Hanya bisa diedit oleh petugas yang menginput"); return; }
    setSaving(true); setErr(""); setOkMsg("");
    try {
      const b: Record<string, unknown> = { no_rawat: noRawat, tindakan, tanggal: tgl, kd_dokter_bedah: kdBedah, kd_dokter_anestesi: kdAnes };
      if (existing && origTgl) b.edit_tanggal = origTgl;   // edit in-place record lama
      items.forEach(([k]) => { b[k] = !!chk[k]; });
      if (phase === "signout") { b.jumlah_kasa = jumlahKasa; b.jumlah_instrumen = jumlahInstrumen; b.jumlah_jarum = jumlahJarum; }
      if (phase === "timeout") {
        b.tim_asisten = timAsisten; b.tim_instrumen = timInstrumen; b.tim_sirkuler = timSirkuler; b.tim_penata = timPenata;
        b.profilaksis_obat = profilaksisObat; b.jumlah_kasa = jumlahKasa; b.jumlah_instrumen = jumlahInstrumen; b.jumlah_jarum = jumlahJarum;
      }
      if (extraText) b[extraText[0]] = extra;
      if (hasImplan) { b.peralatan_khusus = implan; b.jenis_peralatan = jenis; }
      if (phase === "signin") await enakesSignInSave(b as Parameters<typeof enakesSignInSave>[0]);
      else if (phase === "timeout") await enakesTimeOutSave(b as Parameters<typeof enakesTimeOutSave>[0]);
      else await enakesSignOutSave(b as Parameters<typeof enakesSignOutSave>[0]);
      setOkMsg(existing ? "Perubahan tersimpan." : "Tersimpan.");
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan"));
    } finally { setSaving(false); }
  }

  async function hapus() {
    if (!origTgl) return;
    if (!window.confirm(`Hapus ${judul} (${existing})?`)) return;
    setSaving(true); setErr(""); setOkMsg("");
    try {
      const b = { no_rawat: noRawat, tanggal: origTgl };
      if (phase === "signin") await enakesSignInHapus(b);
      else if (phase === "timeout") await enakesTimeOutHapus(b);
      else await enakesSignOutHapus(b);
      setOkMsg("Data dihapus.");
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(ex.response?.data?.error ?? "Gagal menghapus");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      {existing && (
        <div className={`border rounded-xl p-2.5 text-[11px] ${terkunci ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-sky-50 border-sky-200 text-sky-700"}`}>
          Pengisian terakhir: {existing}.{" "}
          {terkunci ? "Diinput petugas lain — tidak bisa diubah/dihapus oleh Anda." : "Menyimpan akan memperbarui catatan ini (jam bisa diganti); atau hapus di bawah."}
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
        <div className="text-[11px] font-bold text-sky-600 uppercase tracking-wide">{judul}</div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Tanggal &amp; jam</label>
          <input type="datetime-local" value={tgl} onChange={e => setTgl(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600">Tindakan / Operasi</label>
          <input value={tindakan} onChange={e => setTindakan(e.target.value)}
            className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
        </div>
        <div className="grid grid-cols-1 gap-2">
          <DokterPicker label={`Dokter Bedah${phase === "signin" ? " *" : ""}`} list={dokList} kd={kdBedah} nm={nmBedah} onPick={(k, n) => { setKdBedah(k); setNmBedah(n); }} />
          <DokterPicker label={`Dokter Anestesi${phase === "signin" ? " *" : ""}`} list={dokList} kd={kdAnes} nm={nmAnes} onPick={(k, n) => { setKdAnes(k); setNmAnes(n); }} />
        </div>
        {items.map(([k, l]) => (
          <div key={k}>
            <button type="button" onClick={() => toggle(k)}
              className={`w-full flex items-center gap-2 text-left text-xs rounded-lg border px-2.5 py-2 ${g(k) ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-slate-200 text-slate-600"}`}>
              <span className={`h-4 w-4 rounded flex-shrink-0 border flex items-center justify-center text-[10px] ${g(k) ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300"}`}>{g(k) ? "✓" : ""}</span>
              {l}
            </button>
            {k === "verbal_kelengkapan_kasa" && (
              <input value={jumlahKasa} onChange={e => setJumlahKasa(e.target.value)} disabled={terkunci} placeholder="Jumlah kasa (mis. 20)"
                className="mt-1 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            )}
            {k === "verbal_instrumen" && (
              <input value={jumlahInstrumen} onChange={e => setJumlahInstrumen(e.target.value)} disabled={terkunci} placeholder="Jumlah instrumen (mis. 15)"
                className="mt-1 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            )}
            {k === "verbal_alat_tajam" && (
              <input value={jumlahJarum} onChange={e => setJumlahJarum(e.target.value)} disabled={terkunci} placeholder="Jumlah jarum (mis. 3)"
                className="mt-1 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            )}
            {phase === "timeout" && k === "identitas_perkenalan" && (
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <input value={timAsisten} onChange={e => setTimAsisten(e.target.value)} disabled={terkunci} placeholder="Asisten :"
                  className="rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                <input value={timInstrumen} onChange={e => setTimInstrumen(e.target.value)} disabled={terkunci} placeholder="Instrumen :"
                  className="rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                <input value={timSirkuler} onChange={e => setTimSirkuler(e.target.value)} disabled={terkunci} placeholder="Sirkuler :"
                  className="rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                <input value={timPenata} onChange={e => setTimPenata(e.target.value)} disabled={terkunci} placeholder="Penata :"
                  className="rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            )}
            {phase === "timeout" && k === "profilaksis_antibiotik" && (
              <input value={profilaksisObat} onChange={e => setProfilaksisObat(e.target.value)} disabled={terkunci} placeholder="Nama obat & dosis (mis. Cefazolin 2 g IV)"
                className="mt-1 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            )}
          </div>
        ))}
        {phase === "timeout" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">Jumlah kassa</label>
              <input value={jumlahKasa} onChange={e => setJumlahKasa(e.target.value)} disabled={terkunci} placeholder="mis. 20"
                className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Jumlah instrumen</label>
              <input value={jumlahInstrumen} onChange={e => setJumlahInstrumen(e.target.value)} disabled={terkunci} placeholder="mis. 15"
                className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Jumlah jarum</label>
              <input value={jumlahJarum} onChange={e => setJumlahJarum(e.target.value)} disabled={terkunci} placeholder="mis. 3"
                className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
            </div>
          </div>
        )}
        {hasImplan && (
          <div className={`rounded-lg border px-2.5 py-2 ${implan ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200"}`}>
            <button type="button" onClick={() => setImplan(v => !v)} className="w-full flex items-center gap-2 text-left text-xs">
              <span className={`h-4 w-4 rounded flex-shrink-0 border flex items-center justify-center text-[10px] ${implan ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300"}`}>{implan ? "✓" : ""}</span>
              <span className={implan ? "text-emerald-800" : "text-slate-600"}>Peralatan khusus diperlukan (implan, dll)</span>
            </button>
            {implan && (
              <input value={jenis} onChange={e => setJenis(e.target.value)} placeholder="Jenis implan / peralatan khusus…"
                className="mt-2 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
            )}
          </div>
        )}
        {extraText && (
          <div>
            <label className="text-xs font-semibold text-slate-600">{extraText[1]}</label>
            <input value={extra} onChange={e => setExtra(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2 sticky bottom-0">
        {err && <div className="text-xs text-red-600">{err}</div>}
        {okMsg && <div className="text-xs text-emerald-700">{okMsg}</div>}
        <button onClick={simpan} disabled={saving || terkunci}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
          {saving ? "Menyimpan…" : existing ? `Perbarui ${judul}` : `Simpan ${judul}`}
        </button>
        {existing && dapatEdit && (
          <button onClick={hapus} disabled={saving}
            className="w-full bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60 text-sm font-semibold rounded-lg py-2">
            Hapus catatan
          </button>
        )}
      </div>
    </div>
  );
}

// ── Asuhan Keperawatan Kamar Bedah (RM.KEP.08.044) ───────────────────────────
// 6 seksi, tiap kolom disimpan sebagai STRING terserialisasi (lihat kontrak).
type KbCtl = "text" | "textarea" | "timejam" | "ck" | "grp" | "gcs" | "pnj" | "grpk" | "diag_nafas" | "diag_hipo" | "petugas_login";
type KbField = { col: string; ctl: KbCtl; label: string; opts?: string[] };
type KbSecKey = "data_awal" | "preop" | "masalah" | "intraop" | "postop" | "diagnosa";
type KbForm = Record<KbSecKey, Record<string, string>>;
const kbEmpty = (): KbForm => ({ data_awal: {}, preop: {}, masalah: {}, intraop: {}, postop: {}, diagnosa: {} });

const KB_SECTIONS: { key: KbSecKey; title: string; fields: KbField[] }[] = [
  { key: "data_awal", title: "Data Awal", fields: [
    { col: "tindakan", ctl: "textarea", label: "Tindakan Operasi" },
    { col: "jenis_anestesi", ctl: "text", label: "Jenis Anestesi" },
    { col: "catatan", ctl: "textarea", label: "Catatan" },
  ] },
  { key: "preop", title: "Pre-Operasi", fields: [
    { col: "puasa", ctl: "text", label: "Puasa (jam)" },
    { col: "informed_consent", ctl: "ck", label: "Informed consent" },
    { col: "identitas_pasien", ctl: "ck", label: "Verifikasi identitas pasien" },
    { col: "lavamen", ctl: "ck", label: "Lavement / huknah" },
    { col: "isolasi", ctl: "ck", label: "Verifikasi isolasi" },
    { col: "marking", ctl: "ck", label: "Penandaan area operasi (marking)" },
    { col: "alergi", ctl: "ck", label: "Verifikasi alergi" },
    { col: "waktu_pengukuran", ctl: "timejam", label: "Jam pengukuran" },
    { col: "verifikasi_tindakan", ctl: "ck", label: "Verifikasi tindakan" },
    { col: "kondisi_kulit", ctl: "grp", label: "Kondisi kulit", opts: ["Dingin", "Hangat", "Kering", "Lembab", "Utuh"] },
    { col: "preop_kesadaran", ctl: "grp", label: "Tingkat kesadaran", opts: ["Compos mentis", "Apatis", "Somnolen", "Soporcoma", "Coma"] },
    { col: "gcs", ctl: "gcs", label: "GCS (M/V/E)" },
    { col: "gangguan_sensorik", ctl: "grp", label: "Gangguan sensorik", opts: ["Tidak ada", "Pendengaran", "Bahasa", "Bicara"] },
    { col: "muskuloskeletal", ctl: "grpk", label: "Muskuloskeletal", opts: ["Tidak ada", "Lumpuh", "Traksi"] },
    { col: "protesa", ctl: "text", label: "Protese" },
    { col: "edema", ctl: "text", label: "Edema (lokasi)" },
    { col: "riwayat_asma", ctl: "ck", label: "Riwayat asma" },
    { col: "respirasi", ctl: "text", label: "Pernapasan (ket)" },
    { col: "ekg", ctl: "ck", label: "EKG" },
    { col: "foto_thorax", ctl: "ck", label: "Foto thorax" },
    { col: "riwayat_hepatitis", ctl: "ck", label: "Riwayat hepatitis" },
    { col: "penyakit_lain", ctl: "text", label: "Penyakit lain" },
    { col: "kesimpulan", ctl: "textarea", label: "Kesimpulan" },
    { col: "kondisi_psikologis", ctl: "grp", label: "Status psiko-sosial", opts: ["Rilek", "Cemas", "Banyak bicara", "Menangis"] },
    { col: "data_penunjang", ctl: "pnj", label: "Data penunjang" },
    { col: "laboratorium", ctl: "textarea", label: "Laboratorium" },
  ] },
  { key: "masalah", title: "Masalah & Intervensi", fields: [
    { col: "masalah_preop_kecemasan", ctl: "text", label: "Kolaborasi terapi (kecemasan)" },
    { col: "cemas_tingkat", ctl: "grp", label: "Tingkat kecemasan", opts: ["Ringan", "Sedang", "Berat"] },
    { col: "intervensi_cemas", ctl: "grp", label: "Intervensi kecemasan", opts: ["Kaji tingkat kecemasan", "Jalin trust dengan pasien", "Observasi tanda-tanda vital", "Dampingi pasien", "Ajak pasien mengungkapkan", "Ciptakan lingkungan nyaman", "Diskusikan situasi", "Kolaborasi obat penenang", "Evaluasi respon"] },
    { col: "masalah_preop_nyeri", ctl: "text", label: "Nyeri berhubungan dengan" },
    { col: "intervensi_nyeri", ctl: "grp", label: "Intervensi nyeri", opts: ["Kaji tingkat nyeri pada lokasi", "Ajarkan teknik relaksasi", "Kolaborasi terapi", "Kaji TTV berkala"] },
    { col: "kaji_ttv_menit", ctl: "text", label: "Kaji TTV tiap (menit)" },
  ] },
  { key: "intraop", title: "Intra-Operasi", fields: [
    { col: "aseptik_antiseptik", ctl: "text", label: "Aseptik/antiseptik dengan" },
    { col: "aseptik_oleh", ctl: "text", label: "Aseptik oleh" },
    { col: "lain_resti_infeksi", ctl: "text", label: "Resiko infeksi lain" },
    { col: "klasifikasi_luka", ctl: "grp", label: "Klasifikasi luka operasi", opts: ["Bersih", "Bersih tercemar", "Tercemar", "Kotor"] },
    { col: "kulit_preop_utuh", ctl: "ck", label: "Kulit sebelum operasi utuh" },
    { col: "kateter", ctl: "ck", label: "Pemasangan kateter urine" },
    { col: "kateter_no", ctl: "text", label: "Kateter no" },
    { col: "kateter_urine_cc", ctl: "text", label: "Urine (cc)" },
    { col: "kateter_oleh", ctl: "text", label: "Kateter oleh" },
    { col: "drain_intraop", ctl: "ck", label: "Drain" },
    { col: "drain_intraop_jenis", ctl: "text", label: "Jenis drain" },
    { col: "drain_intraop_cc", ctl: "text", label: "Cairan drain (cc)" },
    { col: "tampon_intraop", ctl: "ck", label: "Tampon" },
    { col: "tampon_intraop_jenis", ctl: "text", label: "Jenis tampon" },
    { col: "tampon_intraop_lokasi", ctl: "text", label: "Lokasi tampon" },
    { col: "gips", ctl: "ck", label: "Gips" },
    { col: "gips_jenis", ctl: "text", label: "Jenis gips" },
    { col: "gips_lokasi", ctl: "text", label: "Lokasi gips" },
    { col: "matras_penghangat", ctl: "text", label: "Matras penghangat (suhu °C)" },
    { col: "hipo_oleh", ctl: "text", label: "Penanganan hipotermi oleh" },
    { col: "cairan_iv_hangat", ctl: "ck", label: "Pemberian cairan IV hangat" },
    { col: "irigasi_hangat", ctl: "ck", label: "Irigasi cairan hangat" },
    { col: "hipo_lain", ctl: "ck", label: "Lain-lain (hipotermi)" },
    { col: "posisi_operasi", ctl: "grp", label: "Posisi operasi", opts: ["Supine", "Prone", "Lithotomy", "Lateral", "Lateral Kiri", "Lateral Kanan"] },
    { col: "posisi_lain", ctl: "text", label: "Posisi lain" },
    { col: "alat_posisi", ctl: "grp", label: "Alat bantu posisi", opts: ["Bantal/guling", "Bantal/Pasir", "Penyangga Kaki"] },
    { col: "alat_posisi_lain", ctl: "text", label: "Alat bantu lain" },
    { col: "bantalan", ctl: "grp", label: "Pemasangan padding", opts: ["Siku", "Poplitea"] },
    { col: "sabuk_pengaman", ctl: "ck", label: "Sabuk pengaman" },
    { col: "sabuk_pada", ctl: "text", label: "Sabuk pada" },
    { col: "plat_grounding", ctl: "ck", label: "Pemasangan plate diatermi" },
    { col: "plate_pada", ctl: "text", label: "Plate pada" },
    { col: "plate_oleh", ctl: "text", label: "Plate oleh" },
    { col: "kulit_setelah_plate", ctl: "grp", label: "Kondisi kulit area plate", opts: ["Utuh", "Kemerahan", "Lecet", "Luka"] },
    { col: "elektrokauter_koagulasi", ctl: "text", label: "Setting couter (koagulasi)" },
    { col: "elektrokauter_cutting", ctl: "text", label: "Setting cutting" },
    { col: "tourniquet_waktu", ctl: "ck", label: "Pemasangan torniquet" },
    { col: "tourniquet_tekanan", ctl: "text", label: "Tekanan torniquet" },
    { col: "tourniquet_pada", ctl: "text", label: "Torniquet pada" },
    { col: "tourniquet_oleh", ctl: "text", label: "Torniquet oleh" },
    { col: "tourniquet_inflate", ctl: "text", label: "Waktu inflate" },
    { col: "tourniquet_deflate", ctl: "text", label: "Waktu deflate" },
    { col: "hitung_xray", ctl: "ck", label: "Hitung dilakukan X-Ray" },
    { col: "hitung_xray_keterangan", ctl: "text", label: "Keterangan X-Ray" },
    { col: "cairan_infus", ctl: "text", label: "Intake infus (cc)" },
    { col: "cairan_infus_jenis", ctl: "text", label: "Jenis infus" },
    { col: "urine", ctl: "text", label: "Output urine (cc)" },
    { col: "ngt", ctl: "text", label: "Output NGT (cc)" },
    { col: "cairan_ngt_cc", ctl: "text", label: "Perdarahan (cc)" },
    { col: "cairan_lain_cc", ctl: "text", label: "Output cairan lain (cc)" },
    { col: "pemberian_darah", ctl: "ck", label: "Pemberian darah" },
    { col: "spinal_anastesi", ctl: "ck", label: "Spinal anastesi" },
    { col: "pengeluaran_cairan", ctl: "ck", label: "Pengeluaran cairan/darah berlebih" },
  ] },
  { key: "postop", title: "Post-Operasi", fields: [
    { col: "jam_masuk_rr", ctl: "text", label: "Jam masuk RR" },
    { col: "td", ctl: "text", label: "Tekanan darah (mmHg)" },
    { col: "hr", ctl: "text", label: "Heart rate (x/menit)" },
    { col: "spo2", ctl: "text", label: "SpO2 (%)" },
    { col: "rr", ctl: "text", label: "Respiratory rate (x/menit)" },
    { col: "jenis_anestesi_postop", ctl: "grp", label: "Jenis anestesi", opts: ["Umum", "Spinal/Regional", "Blok Perifer"] },
    { col: "kulit_postop", ctl: "grp", label: "Kondisi kulit", opts: ["Dingin", "Hangat", "Kering", "Utuh", "Lembab", "Pink"] },
    { col: "respirasi_postop", ctl: "grp", label: "Pernapasan", opts: ["Intubasi", "Ekstubasi", "Spontan", "Spasme", "Penumpukan sekret"] },
    { col: "kesadaran", ctl: "grp", label: "Kesadaran", opts: ["Bangun", "Sadar"] },
    { col: "posisi_pasien", ctl: "grp", label: "Posisi pasien", opts: ["Terlentang", "Lateral kiri/kanan", "Ekstremitas bawah adduksi/abduksi/elevasi"] },
    { col: "lama_anestesi", ctl: "text", label: "Lama anestesi" },
    { col: "lama_operasi", ctl: "text", label: "Lama pembedahan" },
    { col: "diagnosa_postop", ctl: "textarea", label: "Diagnosa post op" },
    { col: "drain", ctl: "text", label: "Drain" },
    { col: "tampon", ctl: "text", label: "Tampon" },
    { col: "pa", ctl: "text", label: "Patologi anatomi (PA)" },
  ] },
  { key: "diagnosa", title: "Diagnosa", fields: [
    { col: "efektifitas_jalan_nafas", ctl: "diag_nafas", label: "Ketidakefektifan pola nafas" },
    { col: "hipotermi_postop", ctl: "diag_hipo", label: "Hipotermi (post op)" },
    { col: "nip_perawat_rr", ctl: "petugas_login", label: "Perawat ruang pulih" },
    { col: "nip_perawat_ruangan", ctl: "petugas_login", label: "Perawat ruangan" },
  ] },
];

// ── Helper serialisasi grup checkbox (readback via split-token, superset-safe) ──
const kbToks = (s: string) => (s || "").split(",").map(t => t.trim()).filter(Boolean);
const kbHas = (s: string, tok: string) => kbToks(s).includes(tok);
const kbToggle = (cur: string, opts: string[], tok: string) => {
  const set = new Set(opts.filter(o => kbHas(cur, o)));
  if (set.has(tok)) set.delete(tok); else set.add(tok);
  return opts.filter(o => set.has(o)).join(", ");
};

const kbInput = "mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400";
const kbLabel = "text-xs font-semibold text-slate-600";

function KbChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 text-left text-xs rounded-lg border px-2.5 py-1.5 ${active ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-slate-200 text-slate-600"}`}>
      <span className={`h-3.5 w-3.5 rounded flex-shrink-0 border flex items-center justify-center text-[9px] ${active ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300"}`}>{active ? "✓" : ""}</span>
      {label}
    </button>
  );
}

function KbGrp({ value, opts, onChange }: { value: string; opts: string[]; onChange: (v: string) => void }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {opts.map(o => <KbChip key={o} active={kbHas(value, o)} label={o} onClick={() => onChange(kbToggle(value, opts, o))} />)}
    </div>
  );
}

function KbCk({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  const on = value === "Ya";
  return (
    <button type="button" onClick={() => onChange(on ? "Tidak" : "Ya")}
      className={`w-full flex items-center gap-2 text-left text-xs rounded-lg border px-2.5 py-2 ${on ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-slate-200 text-slate-600"}`}>
      <span className={`h-4 w-4 rounded flex-shrink-0 border flex items-center justify-center text-[10px] ${on ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300"}`}>{on ? "✓" : ""}</span>
      {label}
    </button>
  );
}

function KbGcs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p = (value || "").split(",");
  const set = (i: number, v: string) => { const a = [p[0] ?? "", p[1] ?? "", p[2] ?? ""]; a[i] = v; onChange(a.join(",")); };
  const lbl = ["M", "V", "E"];
  return (
    <div className="mt-1 flex gap-2">
      {lbl.map((l, i) => (
        <div key={l} className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-slate-500">{l}</span>
          <input value={p[i] ?? ""} onChange={e => set(i, e.target.value)} className="w-14 rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
        </div>
      ))}
    </div>
  );
}

function KbPnj({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p = (value || "").split("|");
  const set = (i: number, v: string) => { const a = [p[0] ?? "", p[1] ?? "", p[2] ?? "", p[3] ?? ""]; a[i] = v; onChange(a.join("|")); };
  const lbl = ["USG", "CT Scan", "MRI", "Lain-lain"];
  return (
    <div className="mt-1 grid grid-cols-2 gap-2">
      {lbl.map((l, i) => (
        <div key={l}>
          <label className="text-[11px] text-slate-500">{l}</label>
          <input value={p[i] ?? ""} onChange={e => set(i, e.target.value)} className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
        </div>
      ))}
    </div>
  );
}

// grpk: tokens grup + " Kekuatan otot:<nilai>"
function KbGrpk({ value, opts, onChange }: { value: string; opts: string[]; onChange: (v: string) => void }) {
  const SEP = " Kekuatan otot:";
  const idx = (value || "").indexOf(SEP);
  const toks = idx >= 0 ? (value || "").slice(0, idx) : (value || "");
  const kekuatan = idx >= 0 ? (value || "").slice(idx + SEP.length) : "";
  const build = (t: string, k: string) => t + (k ? SEP + k : "");
  return (
    <div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {opts.map(o => <KbChip key={o} active={kbHas(toks, o)} label={o} onClick={() => onChange(build(kbToggle(toks, opts, o), kekuatan))} />)}
      </div>
      <div className="mt-1.5">
        <label className="text-[11px] text-slate-500">Kekuatan otot</label>
        <input value={kekuatan} onChange={e => onChange(build(toks, e.target.value))} className={kbInput} />
      </div>
    </div>
  );
}

// diag_nafas komposit '|': masalah | penyebab-grp | suction | spontan-grp+ket | dibantu-grp | kolaborasi
function KbDiagNafas({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p = (value || "").split("|");
  const masalah = p[0] === "Ya";
  const penyebab = p[1] ?? "";
  const suction = p[2] === "Suction Ya";
  const spoRaw = p[3] ?? "";
  const spoKi = spoRaw.indexOf(" ket:");
  const spontan = spoKi >= 0 ? spoRaw.slice(0, spoKi) : spoRaw;
  const spontanKet = spoKi >= 0 ? spoRaw.slice(spoKi + 5) : "";
  const dibantu = p[4] ?? "";
  const kolaborasi = p[5] ?? "";
  const PEN = ["penumpukan sekret", "efek anastesi"];
  const SPO = ["O2 nasal", "O2 oral"];
  const DIB = ["Bagging", "Triple manuver", "O2 face mask"];
  const build = (o: { masalah?: boolean; penyebab?: string; suction?: boolean; spontan?: string; spontanKet?: string; dibantu?: string; kolaborasi?: string }) => {
    const m = o.masalah ?? masalah;
    const pen = o.penyebab ?? penyebab;
    const suc = o.suction ?? suction;
    const spo = o.spontan ?? spontan;
    const spk = o.spontanKet ?? spontanKet;
    const dib = o.dibantu ?? dibantu;
    const kol = o.kolaborasi ?? kolaborasi;
    return [m ? "Ya" : "Tidak", pen, suc ? "Suction Ya" : "Suction Tidak", spo + (spk ? " ket:" + spk : ""), dib, kol].join("|");
  };
  return (
    <div className="space-y-2">
      <KbCk value={masalah ? "Ya" : "Tidak"} label="Masalah pola nafas ada" onChange={v => onChange(build({ masalah: v === "Ya" }))} />
      <div>
        <div className="text-[11px] text-slate-500">Penyebab</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {PEN.map(o => <KbChip key={o} active={kbHas(penyebab, o)} label={o} onClick={() => onChange(build({ penyebab: kbToggle(penyebab, PEN, o) }))} />)}
        </div>
      </div>
      <KbCk value={suction ? "Ya" : "Tidak"} label="Dilakukan suction" onChange={v => onChange(build({ suction: v === "Ya" }))} />
      <div>
        <div className="text-[11px] text-slate-500">Nafas spontan dengan</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {SPO.map(o => <KbChip key={o} active={kbHas(spontan, o)} label={o} onClick={() => onChange(build({ spontan: kbToggle(spontan, SPO, o) }))} />)}
        </div>
        <input value={spontanKet} onChange={e => onChange(build({ spontanKet: e.target.value }))} placeholder="Keterangan spontan" className={kbInput} />
      </div>
      <div>
        <div className="text-[11px] text-slate-500">Nafas dibantu dengan</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DIB.map(o => <KbChip key={o} active={kbHas(dibantu, o)} label={o} onClick={() => onChange(build({ dibantu: kbToggle(dibantu, DIB, o) }))} />)}
        </div>
      </div>
      <div>
        <label className="text-[11px] text-slate-500">Kolaborasi</label>
        <input value={kolaborasi} onChange={e => onChange(build({ kolaborasi: e.target.value }))} className={kbInput} />
      </div>
    </div>
  );
}

// diag_hipo komposit '|': masalah | penyebab-grp | intervensi-grp(+obat/lain teks)
function KbDiagHipo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p = (value || "").split("|");
  const masalah = p[0] === "Ya";
  const penyebab = p[1] ?? "";
  let intvRaw = p[2] ?? "";
  let lainKet = "", obatKet = "";
  const li = intvRaw.indexOf(" lain:");
  if (li >= 0) { lainKet = intvRaw.slice(li + 6); intvRaw = intvRaw.slice(0, li); }
  const oi = intvRaw.indexOf(" obat:");
  if (oi >= 0) { obatKet = intvRaw.slice(oi + 6); intvRaw = intvRaw.slice(0, oi); }
  const intervensi = intvRaw;
  const PEN = ["Lingkungan OK", "Efek Anastesi"];
  const INT = ["Beri selimut hangat", "Elevasi tungkai", "Kolaborasi obat", "Lain-lain"];
  const build = (o: { masalah?: boolean; penyebab?: string; intervensi?: string; obatKet?: string; lainKet?: string }) => {
    const m = o.masalah ?? masalah;
    const pen = o.penyebab ?? penyebab;
    const intv = o.intervensi ?? intervensi;
    const ob = o.obatKet ?? obatKet;
    const ln = o.lainKet ?? lainKet;
    const intvStr = intv + (ob ? " obat:" + ob : "") + (ln ? " lain:" + ln : "");
    return [m ? "Ya" : "Tidak", pen, intvStr].join("|");
  };
  return (
    <div className="space-y-2">
      <KbCk value={masalah ? "Ya" : "Tidak"} label="Masalah hipotermi ada" onChange={v => onChange(build({ masalah: v === "Ya" }))} />
      <div>
        <div className="text-[11px] text-slate-500">Penyebab</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {PEN.map(o => <KbChip key={o} active={kbHas(penyebab, o)} label={o} onClick={() => onChange(build({ penyebab: kbToggle(penyebab, PEN, o) }))} />)}
        </div>
      </div>
      <div>
        <div className="text-[11px] text-slate-500">Intervensi</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {INT.map(o => <KbChip key={o} active={kbHas(intervensi, o)} label={o} onClick={() => onChange(build({ intervensi: kbToggle(intervensi, INT, o) }))} />)}
        </div>
        {kbHas(intervensi, "Kolaborasi obat") && (
          <input value={obatKet} onChange={e => onChange(build({ obatKet: e.target.value }))} placeholder="Obat kolaborasi" className={kbInput} />
        )}
        {kbHas(intervensi, "Lain-lain") && (
          <input value={lainKet} onChange={e => onChange(build({ lainKet: e.target.value }))} placeholder="Lain-lain" className={kbInput} />
        )}
      </div>
    </div>
  );
}

function KbFieldRow({ field, value, onChange, meNama }: { field: KbField; value: string; onChange: (v: string) => void; meNama?: string }) {
  const opts = field.opts ?? [];
  if (field.ctl === "ck") return <KbCk value={value} label={field.label} onChange={onChange} />;
  if (field.ctl === "petugas_login") return (
    <div>
      <label className={kbLabel}>{field.label}</label>
      <div className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50 text-xs px-2 py-1.5 text-slate-600">
        {meNama || "(user login)"} <span className="text-slate-400">(otomatis dari login)</span>
      </div>
    </div>
  );
  return (
    <div>
      <label className={kbLabel}>{field.label}</label>
      {field.ctl === "text" && <input value={value} onChange={e => onChange(e.target.value)} className={kbInput} />}
      {field.ctl === "textarea" && <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className={kbInput} />}
      {field.ctl === "timejam" && (
        <input type="time" value={(value || "").slice(0, 5)}
          onChange={e => onChange(e.target.value ? e.target.value + ":00" : "")} className={kbInput} />
      )}
      {field.ctl === "grp" && <KbGrp value={value} opts={opts} onChange={onChange} />}
      {field.ctl === "grpk" && <KbGrpk value={value} opts={opts} onChange={onChange} />}
      {field.ctl === "gcs" && <KbGcs value={value} onChange={onChange} />}
      {field.ctl === "pnj" && <KbPnj value={value} onChange={onChange} />}
      {field.ctl === "diag_nafas" && <KbDiagNafas value={value} onChange={onChange} />}
      {field.ctl === "diag_hipo" && <KbDiagHipo value={value} onChange={onChange} />}
    </div>
  );
}

function MonitoringSingleUseTab({ noRawat }: { noRawat: string }) {
  const [rows, setRows] = useState<EnakesMonitoringSingleUse[]>([]);
  const [namaAlat, setNamaAlat] = useState("");
  const [ukuran, setUkuran] = useState("");
  const [kodeWarna, setKodeWarna] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    enakesMonitoringSingleUseGet(noRawat)
      .then(r => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [noRawat]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);

  const tambah = async () => {
    if (!namaAlat.trim()) { setMsg({ t: "err", m: "Nama alat wajib diisi" }); return; }
    setSaving(true);
    try {
      await enakesMonitoringSingleUseSave({ no_rawat: noRawat, nama_alat: namaAlat, ukuran, kode_warna: kodeWarna });
      setNamaAlat(""); setUkuran(""); setKodeWarna("");
      setMsg({ t: "ok", m: "Alat ditambahkan" });
      load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ t: "err", m: err.response?.data?.error ?? "Gagal menyimpan" });
    } finally { setSaving(false); }
  };
  const hapus = async (id: number) => {
    if (!window.confirm("Hapus alat ini?")) return;
    try {
      await enakesMonitoringSingleUseHapus(id);
      setMsg({ t: "ok", m: "Alat dihapus" });
      load();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setMsg({ t: "err", m: err.response?.data?.error ?? "Gagal menghapus" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-bold text-slate-800">Monitoring Peralatan Single Use yang di Reuse</div>
      <p className="text-xs text-slate-500">Diisi oleh Penata Anestesi. Tambahkan tiap alat single-use yang di-reuse.</p>

      {msg && (
        <div className={`text-xs px-3 py-2 rounded-lg ${msg.t === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.m}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="text-xs sm:col-span-1">
            <span className="block text-slate-500 mb-1">Nama Alat</span>
            <input value={namaAlat} onChange={e => setNamaAlat(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Nama alat" />
          </label>
          <label className="text-xs">
            <span className="block text-slate-500 mb-1">Ukuran</span>
            <input value={ukuran} onChange={e => setUkuran(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ukuran" />
          </label>
          <label className="text-xs">
            <span className="block text-slate-500 mb-1">Kode Warna</span>
            <input value={kodeWarna} onChange={e => setKodeWarna(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Kode warna" />
          </label>
        </div>
        <div className="flex justify-end">
          <button onClick={tambah} disabled={saving}
            className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {saving ? "Menyimpan…" : "Tambah Alat"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-10">No.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Nama Alat</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Ukuran</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Kode Warna</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Penata</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400 text-sm">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400 text-sm">Belum ada alat</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id_msur} className="border-b border-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 text-xs font-medium text-slate-800">{r.nama_alat}</td>
                  <td className="px-3 py-2 text-xs">{r.ukuran || "-"}</td>
                  <td className="px-3 py-2 text-xs">{r.kode_warna || "-"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{r.petugas || "-"}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => hapus(r.id_msur)} className="text-red-500 hover:underline text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AskepEventTab({ noRawat, sectionKeys, getFn, saveFn, hapusFn }: {
  noRawat: string;
  sectionKeys: KbSecKey[];
  getFn: (n: string) => Promise<{ data: AsuhanKb }>;
  saveFn: (b: any) => Promise<{ data: { ok: boolean } }>;
  hapusFn: (b: { no_rawat: string; tanggal: string }) => Promise<{ data: { ok: boolean } }>;
}) {
  const hasDiagnosa = sectionKeys.includes("diagnosa");
  const secs = KB_SECTIONS.filter(s => sectionKeys.includes(s.key));
  const emptyForm = (): KbForm => {
    const f = kbEmpty();
    return Object.fromEntries(sectionKeys.map(k => [k, f[k]])) as KbForm;
  };
  const [form, setForm] = useState<KbForm>(emptyForm());
  const [existing, setExisting] = useState<string | null>(null);
  const [origTgl, setOrigTgl] = useState("");
  const [dapatEdit, setDapatEdit] = useState(true);
  const [tgl, setTgl] = useState(nowLocal());
  const [meNama, setMeNama] = useState("");
  const [meNik, setMeNik] = useState("");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState(""); const [okMsg, setOkMsg] = useState("");
  const [reload, setReload] = useState(0);
  const terkunci = !!existing && !dapatEdit;

  useEffect(() => {
    if (!hasDiagnosa) return;
    enakesMe().then(r => { setMeNama(r.data.nama); setMeNik(r.data.nik); }).catch(() => {});
  }, [hasDiagnosa]);

  useEffect(() => {
    getFn(noRawat).then(r => {
      const d: AsuhanKb = r.data;
      if (d.exists) {
        setForm(Object.fromEntries(sectionKeys.map(k => [k, (d as Record<string, any>)[k] ?? {}])) as KbForm);
        setExisting((d.tanggal ?? "").slice(0, 16).replace("T", " "));
        setOrigTgl(d.tanggal ?? "");
        setDapatEdit(d.dapat_edit !== false);
        setTgl(toLocalInput(d.tanggal) || nowLocal());
      } else { setForm(emptyForm()); setExisting(null); setOrigTgl(""); setDapatEdit(true); setTgl(nowLocal()); }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noRawat, reload]);

  // Konsistenkan kolom NIP perawat RR/ruangan ke user login (backend juga memaksa).
  useEffect(() => {
    if (!hasDiagnosa || !meNik) return;
    setForm(f => ({ ...f, diagnosa: { ...f.diagnosa, nip_perawat_rr: meNik, nip_perawat_ruangan: meNik } }));
  }, [hasDiagnosa, meNik]);

  const setCell = (sec: KbSecKey, col: string, val: string) =>
    setForm(f => ({ ...f, [sec]: { ...f[sec], [col]: val } }));

  async function simpan() {
    if (terkunci) { setErr("Hanya bisa diedit oleh petugas yang menginput"); return; }
    setSaving(true); setErr(""); setOkMsg("");
    try {
      const b: Record<string, unknown> = { no_rawat: noRawat, tanggal: tgl, ...form };
      if (existing && origTgl) b.edit_tanggal = origTgl;
      await saveFn(b);
      setOkMsg(existing ? "Perubahan tersimpan." : "Tersimpan.");
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan"));
    } finally { setSaving(false); }
  }

  async function hapus() {
    if (!origTgl) return;
    if (!window.confirm(`Hapus asuhan keperawatan ini (${existing})?`)) return;
    setSaving(true); setErr(""); setOkMsg("");
    try {
      await hapusFn({ no_rawat: noRawat, tanggal: origTgl });
      setOkMsg("Data dihapus.");
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(ex.response?.data?.error ?? "Gagal menghapus");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      {existing && (
        <div className={`border rounded-xl p-2.5 text-[11px] ${terkunci ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-sky-50 border-sky-200 text-sky-700"}`}>
          Pengisian terakhir: {existing}.{" "}
          {terkunci ? "Diinput petugas lain — tidak bisa diubah/dihapus oleh Anda." : "Menyimpan akan memperbarui catatan ini (jam bisa diganti); atau hapus di bawah."}
        </div>
      )}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
        <label className="text-xs font-semibold text-slate-600">Tanggal &amp; jam</label>
        <input type="datetime-local" value={tgl} onChange={e => setTgl(e.target.value)}
          className="mt-0.5 w-full rounded-lg border border-slate-300 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400" />
      </div>
      {secs.map(sec => (
        <details key={sec.key} open className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <summary className="cursor-pointer select-none px-3 py-2.5 text-[11px] font-bold text-sky-600 uppercase tracking-wide">
            {sec.title}
          </summary>
          <div className="px-3 pb-3 space-y-2.5">
            {sec.fields.map(f => (
              <KbFieldRow key={f.col} field={f} value={form[sec.key][f.col] ?? ""}
                onChange={v => setCell(sec.key, f.col, v)} meNama={meNama} />
            ))}
          </div>
        </details>
      ))}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2 sticky bottom-0">
        {err && <div className="text-xs text-red-600">{err}</div>}
        {okMsg && <div className="text-xs text-emerald-700">{okMsg}</div>}
        <button onClick={simpan} disabled={saving || terkunci}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
          {saving ? "Menyimpan…" : existing ? "Perbarui Asuhan Keperawatan Kamar Bedah" : "Simpan Asuhan Keperawatan Kamar Bedah"}
        </button>
        {existing && dapatEdit && (
          <button onClick={hapus} disabled={saving}
            className="w-full bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-60 text-sm font-semibold rounded-lg py-2">
            Hapus catatan
          </button>
        )}
      </div>
    </div>
  );
}

// ── eMAR / Kardek Obat (Jadwal Obat 2) — pencatatan pemberian + bukti foto/TTD ─
const JAM_EMAR = ["07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "01", "02", "03", "04", "05", "06"];
const EMAR_STATUS: [string, string, string][] = [
  ["o", "Diberikan", "bg-emerald-600"], ["T", "Tidak Diberikan", "bg-red-600"],
  ["K", "KTD", "bg-amber-500"], ["ESO", "Efek Samping", "bg-purple-600"], ["TAP", "TAP", "bg-slate-500"],
];
function statusDot(s: string) {
  const f = EMAR_STATUS.find(x => x[0] === s);
  return f ? f[2] : "bg-slate-200";
}
type EmarItemState = { status: string; alasan: string; catatan_klinis: string; nip_double_check: string; nama_penerima: string; hubungan_penerima: string };

function EmarTab({ noRawat }: { noRawat: string }) {
  const [tgl, setTgl] = useState(todayISO2());
  const [obat, setObat] = useState<EnakesEmarObat[]>([]);
  const [detail, setDetail] = useState<EnakesEmarDetail[]>([]);
  const [reload, setReload] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [add, setAdd] = useState({ nama_obat: "", kekuatan: "", bentuk_sediaan: "", aturan_pakai: "", rute_pemberian: "", section: "Oral", high_alert: "Tidak", is_prn: "Tidak" });
  const [jamAktif, setJamAktif] = useState("");
  const [items, setItems] = useState<Record<number, EmarItemState>>({});
  const [foto, setFoto] = useState<string | null>(null);
  const [ttd, setTtd] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const [err, setErr] = useState(""); const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    enakesEmarGet(noRawat, tgl).then(r => { setObat(r.data.obat); setDetail(r.data.detail); }).catch(() => { setObat([]); setDetail([]); });
  }, [noRawat, tgl, reload]);

  const stMap = new Map<string, EnakesEmarDetail>();
  detail.forEach(d => stMap.set(`${d.no_urut}|${d.jam}`, d));

  function bukaJam(jam: string) {
    setJamAktif(jam); setFoto(null); setTtd(null); setErr(""); setOkMsg("");
    const st: Record<number, EmarItemState> = {};
    obat.forEach(o => {
      const d = stMap.get(`${o.no_urut}|${jam}`);
      st[o.no_urut] = {
        status: d?.status ?? "", alasan: d?.alasan ?? "", catatan_klinis: d?.catatan_klinis ?? "",
        nip_double_check: "", nama_penerima: d?.nama_penerima ?? "", hubungan_penerima: d?.hubungan_penerima ?? "",
      };
    });
    setItems(st);
  }
  const setItem = (n: number, k: keyof EmarItemState, v: string) => setItems(p => ({ ...p, [n]: { ...p[n], [k]: v } }));

  async function tambahObat() {
    if (!add.nama_obat.trim()) { setErr("Nama obat wajib"); return; }
    try { await enakesEmarTambahObat({ no_rawat: noRawat, tgl, ...add });
      setAdd({ nama_obat: "", kekuatan: "", bentuk_sediaan: "", aturan_pakai: "", rute_pemberian: "", section: "Oral", high_alert: "Tidak", is_prn: "Tidak" });
      setAddOpen(false); setReload(x => x + 1);
    } catch { setErr("Gagal menambah obat"); }
  }

  async function simpanJam() {
    const isLocked = (no_urut: number) => { const d = stMap.get(`${no_urut}|${jamAktif}`); return !!d && d.milik !== 1; };
    const list: EmarBeriItem[] = obat
      .filter(o => !isLocked(o.no_urut) && (items[o.no_urut]?.status ?? "") !== "")
      .map(o => ({ no_urut: o.no_urut, ...items[o.no_urut] }));
    if (list.length === 0) { setErr("Tandai minimal satu obat (yang dapat Anda ubah)."); return; }
    setSaving(true); setErr(""); setOkMsg("");
    try {
      await enakesEmarBeri({ no_rawat: noRawat, tgl, jam: jamAktif, foto: foto ?? "", ttd: ttd ?? "", items: list });
      setOkMsg(`Pemberian jam ${jamAktif} tersimpan.`); setJamAktif(""); setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan pemberian"));
    } finally { setSaving(false); }
  }

  const chip = (active: boolean, cls = "bg-rose-600") => `text-[11px] rounded-lg border px-2 py-1 font-semibold ${active ? `${cls} text-white border-transparent` : "bg-white text-slate-500 border-slate-200"}`;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Tanggal observasi</label>
          <input type="date" value={tgl} onChange={e => setTgl(e.target.value || todayISO2())}
            className="rounded-lg border border-slate-300 text-xs px-2 py-1.5" />
          <button onClick={() => setAddOpen(o => !o)} className="ml-auto text-xs font-semibold text-rose-600">+ Tambah Obat</button>
        </div>
        {addOpen && (
          <div className="border-t border-slate-100 pt-2 grid grid-cols-2 gap-1.5">
            <input placeholder="Nama obat" value={add.nama_obat} onChange={e => setAdd({ ...add, nama_obat: e.target.value })} className="col-span-2 rounded border border-slate-300 text-xs px-2 py-1" />
            <input placeholder="Kekuatan" value={add.kekuatan} onChange={e => setAdd({ ...add, kekuatan: e.target.value })} className="rounded border border-slate-300 text-xs px-2 py-1" />
            <input placeholder="Bentuk sediaan" value={add.bentuk_sediaan} onChange={e => setAdd({ ...add, bentuk_sediaan: e.target.value })} className="rounded border border-slate-300 text-xs px-2 py-1" />
            <input placeholder="Aturan pakai (mis. 3x1)" value={add.aturan_pakai} onChange={e => setAdd({ ...add, aturan_pakai: e.target.value })} className="rounded border border-slate-300 text-xs px-2 py-1" />
            <input placeholder="Rute" value={add.rute_pemberian} onChange={e => setAdd({ ...add, rute_pemberian: e.target.value })} className="rounded border border-slate-300 text-xs px-2 py-1" />
            <select value={add.section} onChange={e => setAdd({ ...add, section: e.target.value })} className="rounded border border-slate-300 text-xs px-2 py-1">
              {["Oral", "Parenteral", "Lain-lain"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex gap-1 items-center text-[11px]">
              <button onClick={() => setAdd({ ...add, high_alert: add.high_alert === "Ya" ? "Tidak" : "Ya" })} className={chip(add.high_alert === "Ya", "bg-red-600")}>HIGH ALERT</button>
              <button onClick={() => setAdd({ ...add, is_prn: add.is_prn === "Ya" ? "Tidak" : "Ya" })} className={chip(add.is_prn === "Ya", "bg-sky-600")}>PRN</button>
            </div>
            <button onClick={tambahObat} className="col-span-2 bg-rose-600 text-white text-xs font-semibold rounded-lg py-1.5">Simpan Obat</button>
          </div>
        )}
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">Catat pemberian pada jam:</div>
          <div className="flex flex-wrap gap-1">
            {JAM_EMAR.map(j => (
              <button key={j} onClick={() => bukaJam(j)} className={`text-[11px] rounded-md border px-1.5 py-1 font-mono font-semibold ${jamAktif === j ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200"}`}>{j}</button>
            ))}
          </div>
        </div>
      </div>

      {jamAktif && (
        <div className="bg-white rounded-xl border border-rose-200 shadow-sm p-3 space-y-3">
          <div className="text-sm font-bold text-rose-700">Pemberian Obat — Jam {jamAktif}:00</div>
          {obat.length === 0 ? <div className="text-xs text-slate-400">Belum ada obat. Tambah dulu.</div> : obat.map(o => {
            const it = items[o.no_urut] ?? { status: "", alasan: "", catatan_klinis: "", nip_double_check: "", nama_penerima: "", hubungan_penerima: "" };
            const dEx = stMap.get(`${o.no_urut}|${jamAktif}`);
            const locked = !!dEx && dEx.milik !== 1;
            return (
              <div key={o.no_urut} className="border-b border-slate-100 pb-2">
                <div className="text-xs font-semibold text-slate-700">
                  {o.nama_obat} {o.kekuatan} <span className="text-slate-400">· {o.rute_pemberian} · {o.aturan_pakai}</span>
                  {o.high_alert === "Ya" && <span className="ml-1 text-[9px] bg-red-100 text-red-700 rounded px-1">HIGH ALERT</span>}
                  {o.is_prn === "Ya" && <span className="ml-1 text-[9px] bg-sky-100 text-sky-700 rounded px-1">PRN</span>}
                  {locked && <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 rounded px-1">🔒 {dEx?.petugas || "perawat lain"}</span>}
                </div>
                {locked ? (
                  <div className="mt-1 text-[11px] text-amber-700">Dicatat perawat lain — hanya pembuat (atau Admin) yang dapat mengubah.</div>
                ) : (
                <div className="mt-1 flex flex-wrap gap-1">
                  {EMAR_STATUS.map(([code, label]) => (
                    <button key={code} onClick={() => setItem(o.no_urut, "status", it.status === code ? "" : code)} className={chip(it.status === code, statusDot(code))}>{label}</button>
                  ))}
                </div>
                )}
                {!locked && it.status === "T" && (
                  <input placeholder="Alasan tidak diberikan" value={it.alasan} onChange={e => setItem(o.no_urut, "alasan", e.target.value)} className="mt-1 w-full rounded border border-slate-300 text-xs px-2 py-1" />
                )}
                {!locked && it.status === "o" && o.high_alert === "Ya" && (
                  <input placeholder="NIP perawat ke-2 (double check) — wajib" value={it.nip_double_check} onChange={e => setItem(o.no_urut, "nip_double_check", e.target.value)} className="mt-1 w-full rounded border border-red-300 text-xs px-2 py-1" />
                )}
                {!locked && it.status === "o" && o.is_prn === "Ya" && (
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <input placeholder="Nama penerima — wajib" value={it.nama_penerima} onChange={e => setItem(o.no_urut, "nama_penerima", e.target.value)} className="rounded border border-sky-300 text-xs px-2 py-1" />
                    <input placeholder="Hubungan" value={it.hubungan_penerima} onChange={e => setItem(o.no_urut, "hubungan_penerima", e.target.value)} className="rounded border border-slate-300 text-xs px-2 py-1" />
                  </div>
                )}
              </div>
            );
          })}
          <div className="pt-1">
            <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wide mb-1">Bukti pemberian (cukup 1× untuk jam ini)</div>
            <PhotoInput value={foto} onChange={setFoto} />
            <div className="mt-2"><SignaturePad onChange={setTtd} /></div>
          </div>
          {err && <div className="text-xs text-red-600">{err}</div>}
          {okMsg && <div className="text-xs text-emerald-700">{okMsg}</div>}
          <div className="flex gap-2">
            <button onClick={simpanJam} disabled={saving} className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : `Simpan Pemberian Jam ${jamAktif}`}
            </button>
            <button onClick={() => setJamAktif("")} className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Tutup</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
        <div className="text-xs font-bold text-slate-600 mb-1.5">Daftar Obat & Status Pemberian</div>
        {obat.length === 0 ? <div className="text-xs text-slate-400 py-2">Belum ada order obat pada tanggal ini.</div> : obat.map(o => (
          <div key={o.no_urut} className="border-t border-slate-100 py-1.5">
            <div className="text-xs font-semibold text-slate-700">
              <span className="text-[9px] bg-slate-100 text-slate-500 rounded px-1 mr-1">{o.section}</span>
              {o.nama_obat} {o.kekuatan}
              {o.high_alert === "Ya" && <span className="ml-1 text-[9px] bg-red-100 text-red-700 rounded px-1">HA</span>}
              {o.is_prn === "Ya" && <span className="ml-1 text-[9px] bg-sky-100 text-sky-700 rounded px-1">PRN</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-0.5">
              {JAM_EMAR.map(j => {
                const d = stMap.get(`${o.no_urut}|${j}`);
                return (
                  <span key={j} title={`${j}: ${d?.status || "-"}${d?.ada_foto ? " 📷" : ""}`}
                    className={`text-[8px] font-mono rounded-sm w-5 text-center text-white ${statusDot(d?.status ?? "")}`}>
                    {j}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
          {EMAR_STATUS.map(([c, l, cls]) => <span key={c} className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${cls}`} />{l}</span>)}
        </div>
      </div>
    </div>
  );
}

function EwsTab({ noRawat, jenis }: { noRawat: string; jenis: string }) {
  const [instrumen, setInstrumen] = useState<string>(jenis === "ranap" ? "dewasa" : "dewasa");
  const [riwayat, setRiwayat] = useState<EnakesRiwayatEws[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => { enakesEwsRiwayat(noRawat).then(r => setRiwayat(r.data)).catch(() => setRiwayat([])); }, [noRawat, reload]);
  const onSaved = () => { setOpen(false); setReload(x => x + 1); };
  async function hapusEws(r: EnakesRiwayatEws) {
    if (!window.confirm(`Hapus pemantauan (${r.instrumen}) ini?`)) return;
    try {
      await enakesEwsHapus({ no_rawat: noRawat, tanggal: r.tanggal ?? "", instrumen: r.instrumen });
      setReload(x => x + 1);
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }
  const OPSI = [["dewasa", "EWS Dewasa"], ["anak", "PEWS Anak"], ["neonatus", "EWS Neonatus"]];
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Instrumen EWS</label>
        <select value={instrumen} onChange={e => { setInstrumen(e.target.value); setOpen(false); }}
          className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400">
          {OPSI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {!open && (
          <button onClick={() => setOpen(true)}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg py-2 mt-1">+ Isi Pemantauan EWS</button>
        )}
      </div>
      {open && <EwsForm def={EWS_DEFS[instrumen]} noRawat={noRawat} onSaved={onSaved} onCancel={() => setOpen(false)} />}

      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-1">Riwayat Pemantauan</div>
      {riwayat === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : riwayat.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada pemantauan EWS.</div>
      ) : (
        riwayat.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold rounded-md border px-2 py-0.5 ${ewsCls(r.parameter_total)}`}>Skor {r.skor_total}</span>
                <span className="text-sm font-semibold text-slate-700">{r.instrumen}</span>
                {r.code_blue === "Ya" && <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-600 text-white">CODE BLUE</span>}
              </div>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {(r.tanggal ?? "").slice(0, 16)}
                {r.milik === 1 && <button onClick={() => hapusEws(r)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            {r.parameter_total && <div className="mt-1 text-xs text-slate-600">{r.parameter_total}</div>}
            {r.petugas && <div className="mt-1 text-[11px] text-rose-600">{r.petugas}</div>}
          </div>
        ))
      )}
    </div>
  );
}

function EwsForm({ def, noRawat, onSaved, onCancel }: { def: EwsDef; noRawat: string; onSaved: () => void; onCancel: () => void }) {
  const [sel, setSel] = useState<number[]>(def.komponen.map(defaultSel));
  const [codeBlue, setCodeBlue] = useState("Tidak");
  const [waktu, setWaktu] = useState(() => nowLocal());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const skor = def.komponen.map((k, i) => k.opsi[sel[i]].n);
  const param = def.komponen.map((k, i) => k.opsi[sel[i]].t);
  const total = def.total(skor, param);
  const teks = def.interpret(total, skor, param);

  async function simpan() {
    setSaving(true); setErr("");
    try {
      await enakesEwsSave({
        no_rawat: noRawat, instrumen: def.key,
        parameter: param, skor, skor_total: total, parameter_total: teks, waktu,
        ...(def.codeBlue ? { code_blue: codeBlue } : {}),
      });
      onSaved();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan pemantauan EWS"));
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
      <div className="text-sm font-bold text-slate-800">{def.nama}</div>
      <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
      {def.komponen.map((k, i) => (
        <div key={i}>
          <label className="text-xs font-semibold text-slate-600">{k.label}</label>
          <select value={sel[i]} onChange={e => setSel(s => s.map((x, j) => (j === i ? +e.target.value : x)))}
            className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400">
            {k.opsi.map((o, oi) => <option key={oi} value={oi}>{o.t} ({o.n})</option>)}
          </select>
        </div>
      ))}
      {def.codeBlue && (
        <div>
          <label className="text-xs font-semibold text-slate-600">Code Blue</label>
          <select value={codeBlue} onChange={e => setCodeBlue(e.target.value)}
            className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400">
            <option value="Tidak">Tidak</option><option value="Ya">Ya</option>
          </select>
        </div>
      )}
      <div className={`rounded-lg border px-3 py-2 ${ewsCls(teks)}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Skor Total: <span className="tabular-nums">{total}</span></span>
        </div>
        <div className="text-xs mt-1">{teks}</div>
      </div>
      {err && <div className="text-xs text-red-600">{err}</div>}
      <div className="flex gap-2">
        <button onClick={simpan} disabled={saving}
          className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
          {saving ? "Menyimpan…" : "Simpan Pemantauan"}
        </button>
        <button onClick={onCancel} className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
      </div>
    </div>
  );
}

// ── Signature pad + foto (dipakai Edukasi: TTD pasien/keluarga & foto pasien) ─
function downscaleImage(file: File, max: number, q: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > max || height > max) { const s = max / Math.max(width, height); width = Math.round(width * s); height = Math.round(height * s); }
      const c = document.createElement("canvas"); c.width = width; c.height = height;
      c.getContext("2d")?.drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.onerror = reject;
    const fr = new FileReader();
    fr.onload = () => { img.src = fr.result as string; };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
function SignaturePad({ onChange }: { onChange: (d: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const pos = (e: React.PointerEvent) => {
    const c = ref.current!; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const down = (e: React.PointerEvent) => { drawing.current = true; const { x, y } = pos(e); const ctx = ref.current!.getContext("2d")!; ctx.beginPath(); ctx.moveTo(x, y); e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const { x, y } = pos(e); const ctx = ref.current!.getContext("2d")!; ctx.lineTo(x, y); ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke(); dirty.current = true; };
  const up = () => { if (drawing.current) { drawing.current = false; if (dirty.current) onChange(ref.current!.toDataURL("image/jpeg", 0.85)); } };
  const clear = () => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(null); };
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-600">Tanda tangan pasien / keluarga</label>
        <button type="button" onClick={clear} className="text-[11px] font-semibold text-rose-600">Hapus</button>
      </div>
      <canvas ref={ref} width={320} height={110}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        className="w-full border border-slate-300 rounded-lg bg-white touch-none mt-0.5" style={{ height: 110 }} />
    </div>
  );
}
function PhotoInput({ value, onChange }: { value: string | null; onChange: (d: string | null) => void }) {
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    try { onChange(await downscaleImage(f, 900, 0.75)); } catch { /* abaikan */ }
  }
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">Foto pasien</label>
      {value ? (
        <div className="relative mt-0.5">
          <img src={value} alt="Foto pasien" className="w-full max-h-44 object-contain rounded-lg border border-slate-200 bg-slate-50" />
          <button type="button" onClick={() => onChange(null)} className="absolute top-1 right-1 bg-black/60 text-white text-[11px] rounded px-2 py-0.5">Hapus</button>
        </div>
      ) : (
        <label className="mt-0.5 flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-lg py-3 text-sm text-slate-500 cursor-pointer">
          📷 Ambil / pilih foto
          <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
        </label>
      )}
    </div>
  );
}

// ── Penerimaan & Orientasi Pasien Baru + Bukti (foto/TTD penerima) ───────────
function PenerimaanRanapTab({ noRawat, kdDokter }: { noRawat: string; kdDokter?: string }) {
  const [sig, setSig] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [bukti, setBukti] = useState<{ ada_foto: boolean; ada_ttd: boolean; updated_at: string | null } | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => { getPenerimaanBukti(noRawat).then(r => setBukti(r.data)).catch(() => setBukti(null)); }, [noRawat, reload]);

  async function simpanBukti() {
    if (!sig && !foto) { setMsg("Ambil foto atau tanda tangan dulu."); return; }
    setSaving(true); setMsg("");
    try {
      await uploadSuratMedia({ jenis: "penerimaan_ranap", no_rawat: noRawat, ttd_base64: sig ?? undefined, foto_base64: foto ?? undefined });
      setMsg("Bukti penerimaan tersimpan."); setSig(null); setFoto(null); setReload(x => x + 1);
    } catch { setMsg("Gagal menyimpan bukti."); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <PeriopFormTab noRawat={noRawat} section="orientasi_ranap" kdDokter={kdDokter} />
      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="text-sm font-semibold text-slate-700">Bukti Penerimaan — Foto &amp; Tanda Tangan Penerima</div>
          {bukti && (
            <span className="text-xs text-slate-400">
              {bukti.ada_foto ? "Foto ✓" : "Foto –"} · {bukti.ada_ttd ? "TTD ✓" : "TTD –"}
              {bukti.updated_at ? ` · ${bukti.updated_at}` : ""}
            </span>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <PhotoInput value={foto} onChange={setFoto} />
          <SignaturePad onChange={setSig} />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={simpanBukti} disabled={saving}
            className="text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
            {saving ? "Menyimpan…" : "Simpan Bukti Penerimaan"}
          </button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
        </div>
        <p className="text-xs text-slate-400 mt-2">Foto pasien/keluarga &amp; tanda tangan sebagai bukti pasien sudah diterima di ruang rawat inap.</p>
      </div>
    </div>
  );
}

// ── Tanda Tangan Pasien — Surat Pengantar Pulang ────────────────────────────
function PengantarPulangTtdTab({ noRawat }: { noRawat: string }) {
  const [sig, setSig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<{ ada_ttd: boolean; updated_at: string | null } | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => { getPengantarPulangTtd(noRawat).then(r => setStatus(r.data)).catch(() => setStatus(null)); }, [noRawat, reload]);

  async function simpan() {
    if (!sig) { setMsg("Tanda tangan dulu."); return; }
    setSaving(true); setMsg("");
    try {
      await uploadSuratMedia({ jenis: "pengantar_pulang", no_rawat: noRawat, ttd_base64: sig });
      setMsg("Tanda tangan tersimpan."); setSig(null); setReload(x => x + 1);
    } catch { setMsg("Gagal menyimpan tanda tangan."); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3 max-w-md">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-sm font-semibold text-slate-700">Tanda Tangan Pasien — Surat Pengantar Pulang</div>
        {status && (
          <span className="text-xs text-slate-400">{status.ada_ttd ? `TTD ✓${status.updated_at ? ` · ${status.updated_at}` : ""}` : "belum ada"}</span>
        )}
      </div>
      <SignaturePad onChange={setSig} />
      <div className="flex items-center gap-3">
        <button onClick={simpan} disabled={saving}
          className="text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
          {saving ? "Menyimpan…" : "Simpan Tanda Tangan"}
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
      <p className="text-xs text-slate-400">Pasien/keluarga menandatangani sebagai bukti menerima Surat Pengantar Pulang. Tanda tangan tampil saat surat dicetak di Khanza.</p>
    </div>
  );
}

// ── AKP 4 — Bukti Serah Terima Resume ke dokter keluarga/berikutnya ─────────
function ResumeSerahTerimaTab({ noRawat }: { noRawat: string }) {
  const OPSI = ["Pasien", "Keluarga", "Dokter Keluarga (FKTP)", "Faskes Perujuk", "DPJP Berikutnya"];
  const [diserahkanKe, setDiserahkanKe] = useState("Pasien");
  const [namaPenerima, setNamaPenerima] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<import("@/lib/api").ResumeSerahTerima | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    getResumeSerahTerima(noRawat).then(r => {
      setStatus(r.data);
      if (r.data.diserahkan_ke) setDiserahkanKe(r.data.diserahkan_ke);
      if (r.data.nama_penerima) setNamaPenerima(r.data.nama_penerima);
    }).catch(() => setStatus(null));
  }, [noRawat, reload]);

  async function simpan() {
    setSaving(true); setMsg("");
    try {
      await saveResumeSerahTerima({ no_rawat: noRawat, diserahkan_ke: diserahkanKe, nama_penerima: namaPenerima });
      if (foto || sig) {
        await uploadSuratMedia({ jenis: "resume_serah_terima", no_rawat: noRawat, foto_base64: foto ?? undefined, ttd_base64: sig ?? undefined });
      }
      setMsg("Bukti penyerahan tersimpan."); setFoto(null); setSig(null); setReload(x => x + 1);
    } catch { setMsg("Gagal menyimpan bukti."); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3 max-w-md">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-sm font-semibold text-slate-700">Serah Terima Resume Pulang</div>
        {status && (
          <span className="text-xs text-slate-400">
            {status.diserahkan_ke ? `✓ ${status.diserahkan_ke}${status.ada_ttd ? " · TTD" : ""}${status.ada_foto ? " · Foto" : ""}${status.tanggal ? ` · ${status.tanggal}` : ""}` : "belum ada"}
          </span>
        )}
      </div>
      {status && !status.ada_resume && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Resume/ringkasan pulang belum dibuat. Buat resume dulu (tab Resume Medis) sebelum serah terima.
        </div>
      )}
      <label className="block text-xs font-semibold text-slate-600">Resume diserahkan kepada
        <select value={diserahkanKe} onChange={(e) => setDiserahkanKe(e.target.value)}
          className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal">
          {OPSI.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-slate-600">Nama penerima (opsional)
        <input value={namaPenerima} onChange={(e) => setNamaPenerima(e.target.value)}
          placeholder="mis. nama dokter keluarga / faskes / keluarga"
          className="block w-full mt-1 border rounded-lg px-2 py-1.5 text-sm font-normal" />
      </label>
      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1">Foto pasien/keluarga (bukti serah terima)</div>
        <PhotoInput value={foto} onChange={setFoto} />
      </div>
      <div>
        <div className="text-xs font-semibold text-slate-600 mb-1">Tanda tangan penerima</div>
        <SignaturePad onChange={setSig} />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={simpan} disabled={saving}
          className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
          {saving ? "Menyimpan…" : "Simpan Bukti Penyerahan"}
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
      <p className="text-xs text-slate-400">Bukti bahwa ringkasan pulang diserahkan/diberitahukan ke pihak yang melanjutkan asuhan (dokter keluarga/FKTP, faskes perujuk, atau DPJP berikutnya). AKP 4.</p>
    </div>
  );
}

// ── Edukasi Pasien & Keluarga — log pelaksanaan (materi edukasi) ─────────────
function EdukasiTab({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<EnakesEdukasi[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => { enakesEdukasiList(noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat, reload]);

  const [diberikan, setDiberikan] = useState("Pasien");
  const [penerima, setPenerima] = useState("");
  const [materi, setMateri] = useState("");
  const [leaflet, setLeaflet] = useState("");
  const [lama, setLama] = useState("");
  const [verifikasi, setVerifikasi] = useState("Sudah Mengerti");
  const [sig, setSig] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [waktu, setWaktu] = useState("");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const [editKey, setEditKey] = useState<{ t: string; j: string } | null>(null);

  function resetForm() {
    setDiberikan("Pasien"); setPenerima(""); setMateri(""); setLeaflet(""); setLama(""); setVerifikasi("Sudah Mengerti");
    setSig(null); setFoto(null); setWaktu(nowLocal()); setEditKey(null);
  }
  function startEdit(it: EnakesEdukasi) {
    setDiberikan(it.diberikan_pada || "Pasien"); setPenerima(it.penerima_edukasi === "-" ? "" : (it.penerima_edukasi || ""));
    setMateri(it.materi_edukasi || ""); setLeaflet(it.kode_leaflet || ""); setLama(it.lama_edukasi || "");
    setVerifikasi(it.hasil_verifikasi || "Sudah Mengerti"); setSig(null); setFoto(null);
    setWaktu(`${(it.tanggal ?? "").slice(0, 10)}T${(it.jam ?? "").slice(0, 5)}`);
    setEditKey({ t: it.tanggal ?? "", j: it.jam ?? "" }); setErr(""); setOpen(true);
  }
  async function simpan() {
    if (!materi.trim()) { setErr("Materi edukasi wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      await enakesEdukasiSave({
        no_rawat: noRawat, diberikan_pada: diberikan, penerima_edukasi: penerima,
        materi_edukasi: materi, kode_leaflet: leaflet, lama_edukasi: lama, hasil_verifikasi: verifikasi, waktu,
        edit: !!editKey, orig_tanggal: editKey?.t, orig_jam: editKey?.j,
      });
      // TTD & foto → webapps/pelaksanaanedukasi + tabel edukasipasien_ttd (tampil di cetak)
      if (sig || foto) {
        await uploadSuratMedia({
          jenis: "edukasi_pasien", no_rawat: noRawat,
          ttd_base64: sig ?? undefined, foto_base64: foto ?? undefined,
        }).catch(() => {});
      }
      setOpen(false); setReload(x => x + 1); resetForm();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setErr(notifGagal(ex, "Gagal menyimpan edukasi"));
    } finally { setSaving(false); }
  }

  async function hapusEdukasi(it: EnakesEdukasi) {
    if (!window.confirm("Hapus catatan edukasi ini?")) return;
    try {
      await enakesEdukasiHapus({ no_rawat: noRawat, tanggal: it.tanggal ?? "", jam: it.jam ?? "" });
      setReload(x => x + 1);
    } catch (err) {
      const ex = err as { response?: { data?: { error?: string } } };
      alert(ex.response?.data?.error ?? "Gagal menghapus");
    }
  }

  const verCls = (v: string) => v === "Sudah Mengerti" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="space-y-3">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="text-sm font-bold text-slate-800">{editKey ? "Ubah Pelaksanaan Edukasi" : "Pelaksanaan Edukasi"}</div>
          <DtField label="Tanggal & jam dibuat" value={waktu} onChange={setWaktu} />
          <div>
            <label className="text-xs font-semibold text-slate-600">Materi edukasi</label>
            <div className="relative">
              <textarea value={materi} onChange={e => setMateri(e.target.value)} rows={2}
                placeholder="cth Cuci tangan, penggunaan obat, diet, mobilisasi…"
                className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-rose-400" />
              <MicButton value={materi} onChange={setMateri} className="absolute right-1 bottom-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">Diberikan pada</label>
              <select value={diberikan} onChange={e => setDiberikan(e.target.value)}
                className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400">
                <option>Pasien</option><option>Keluarga</option><option>Lain-lain</option>
              </select>
            </div>
            <Field label="Penerima (nama)" value={penerima} onChange={setPenerima} />
            <Field label="Kode leaflet" value={leaflet} onChange={setLeaflet} />
            <Field label="Lama edukasi" value={lama} onChange={setLama} placeholder="cth 10 menit" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Hasil verifikasi</label>
            <select value={verifikasi} onChange={e => setVerifikasi(e.target.value)}
              className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400">
              <option>Sudah Mengerti</option><option>Re - Edukasi</option><option>Re - Demonstrasi</option>
            </select>
          </div>
          <PhotoInput value={foto} onChange={setFoto} />
          <SignaturePad onChange={setSig} />
          {err && <div className="text-xs text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : "Simpan Edukasi"}
            </button>
            <button onClick={() => { setOpen(false); setErr(""); resetForm(); }}
              className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setOpen(true); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + Pelaksanaan Edukasi
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada catatan edukasi.</div>
      ) : (
        list.map((e, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{e.materi_edukasi}</span>
              <span className="flex items-center gap-2 text-[11px] text-slate-400">
                {(e.tanggal ?? "").slice(0, 10)} {(e.jam ?? "").slice(0, 5)}
                {e.milik === 1 && <button onClick={() => startEdit(e)} className="text-emerald-600 hover:text-emerald-800 font-semibold">Edit</button>}
                {e.milik === 1 && <button onClick={() => hapusEdukasi(e)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-500">
              <span>Kepada: {e.diberikan_pada}{e.penerima_edukasi && e.penerima_edukasi !== "-" ? ` (${e.penerima_edukasi})` : ""}</span>
              {e.lama_edukasi && <span>· {e.lama_edukasi}</span>}
              {e.hasil_verifikasi && <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${verCls(e.hasil_verifikasi)}`}>{e.hasil_verifikasi}</span>}
            </div>
            {e.petugas && <div className="mt-1 text-[11px] text-rose-600">{e.petugas}{e.profesi ? ` · ${e.profesi}` : ""}</div>}
          </div>
        ))
      )}
    </div>
  );
}

// ── Pengkajian Awal Keperawatan — form metadata-driven (semua varian/kolom) ──
function humanizeCol(s: string) {
  const t = s.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : s;
}
function PengkajianTab({ noRawat, jenis }: { noRawat: string; jenis: string }) {
  const [instrumens, setInstrumens] = useState<PengkajianInstrumen[]>([]);
  const [instrumen, setInstrumen] = useState(jenis === "ranap" ? "ranap" : jenis === "igd" ? "igd" : "ralan");
  const [skema, setSkema] = useState<PengkajianSkema | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [masMaster, setMasMaster] = useState<PengkajianMaster[]>([]);
  const [renMaster, setRenMaster] = useState<PengkajianMaster[]>([]);
  const [masalahSel, setMasalahSel] = useState<string[]>([]);
  const [rencanaSel, setRencanaSel] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => { enakesPengkajianInstrumen().then(r => setInstrumens(r.data)).catch(() => {}); }, []);
  useEffect(() => {
    enakesPengkajianMaster("masalah").then(r => setMasMaster(r.data)).catch(() => {});
    enakesPengkajianMaster("rencana").then(r => setRenMaster(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true); setSkema(null); setMsg("");
    Promise.all([enakesPengkajianSkema(instrumen), enakesPengkajianGet(instrumen, noRawat)])
      .then(([s, g]) => {
        if (!alive) return;
        setSkema(s.data);
        const data = g.data.data ?? {};
        const init: Record<string, string> = {};
        for (const f of s.data.fields) {
          const v = data[f.name];
          init[f.name] = v != null && v !== "" ? String(v) : (f.kind === "enum" && f.options.length ? f.options[0] : "");
        }
        setForm(init);
        setMasalahSel(g.data.masalah ?? []);
        setRencanaSel(g.data.rencana ?? []);
      })
      .catch(() => { if (alive) setMsg("Gagal memuat skema/data"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [instrumen, noRawat]);

  const set = (name: string, v: string) => setForm(f => ({ ...f, [name]: v }));
  const toggle = (arr: string[], setArr: (v: string[]) => void, kode: string) =>
    setArr(arr.includes(kode) ? arr.filter(k => k !== kode) : [...arr, kode]);
  async function simpan() {
    setSaving(true); setMsg("");
    try {
      await enakesPengkajianSave({
        instrumen, no_rawat: noRawat, data: form,
        masalah: skema?.masalah ? masalahSel : undefined,
        rencana: skema?.rencana ? rencanaSel : undefined,
      });
      setMsg("Tersimpan ✓");
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      setMsg(ex.response?.data?.error ?? "Gagal menyimpan");
    } finally { setSaving(false); }
  }

  const flt = filter.trim().toLowerCase();
  const fields = (skema?.fields ?? []).filter(f => !flt || f.name.includes(flt) || humanizeCol(f.name).toLowerCase().includes(flt));

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 bg-slate-50 -mx-3 px-3 py-2 border-b border-slate-200 space-y-2">
        <div className="flex gap-2">
          <select value={instrumen} onChange={e => setInstrumen(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-rose-400">
            {(instrumens.length ? instrumens : [{ key: instrumen, nama: instrumen }]).map(o => <option key={o.key} value={o.key}>{o.nama}</option>)}
          </select>
          <button onClick={simpan} disabled={saving || loading}
            className="shrink-0 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-4">
            {saving ? "…" : "Simpan"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Cari field…"
            className="flex-1 rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
          {msg && <span className={`text-xs font-semibold ${msg.includes("✓") ? "text-emerald-600" : "text-red-600"}`}>{msg}</span>}
        </div>
        {skema && <div className="text-[11px] text-slate-400">{skema.nama} · {skema.fields.length} field{flt ? ` · ${fields.length} cocok` : ""}</div>}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 text-sm py-10">Memuat skema…</div>
      ) : !skema ? (
        <div className="text-center text-slate-400 text-sm py-10">{msg || "—"}</div>
      ) : (
        <>
          {fields.map(f => {
            const val = form[f.name] ?? "";
            const label = humanizeCol(f.name);
            return (
              <div key={f.name}>
                <label className="text-xs font-semibold text-slate-600">{label}</label>
                {f.kind === "enum" ? (
                  <select value={val} onChange={e => set(f.name, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400">
                    {f.nullable && <option value=""></option>}
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.kind === "textarea" ? (
                  <textarea value={val} onChange={e => set(f.name, e.target.value)} rows={2}
                    className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
                ) : f.kind === "date" ? (
                  <input type="date" value={val.slice(0, 10)} onChange={e => set(f.name, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
                ) : f.kind === "time" ? (
                  <input type="time" value={val.slice(0, 5)} onChange={e => set(f.name, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
                ) : f.kind === "numeric" ? (
                  <input type="number" inputMode="decimal" value={val} onChange={e => set(f.name, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
                ) : (
                  <input type="text" value={val} onChange={e => set(f.name, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
                )}
              </div>
            );
          })}

          {skema.masalah && !flt && (
            <div>
              <label className="text-xs font-semibold text-slate-600">Masalah keperawatan <span className="text-slate-400">({masalahSel.length} dipilih)</span></label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {masMaster.map(m => {
                  const on = masalahSel.includes(m.kode);
                  return (
                    <button key={m.kode} type="button" onClick={() => toggle(masalahSel, setMasalahSel, m.kode)}
                      className={`text-[11px] rounded-full px-2 py-1 border text-left ${on ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-300"}`}>
                      {m.nama}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {skema.rencana && !flt && (() => {
            // Rencana difilter ke masalah terpilih (bila ada); jika belum ada, tampilkan semua.
            const rel = masalahSel.length ? renMaster.filter(r => masalahSel.includes(r.induk)) : renMaster;
            return (
              <div>
                <label className="text-xs font-semibold text-slate-600">Rencana keperawatan <span className="text-slate-400">({rencanaSel.length} dipilih)</span></label>
                {masalahSel.length > 0 && <div className="text-[11px] text-slate-400 mt-0.5">Menampilkan rencana untuk masalah yang dipilih.</div>}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {rel.map(r => {
                    const on = rencanaSel.includes(r.kode);
                    return (
                      <button key={r.kode} type="button" onClick={() => toggle(rencanaSel, setRencanaSel, r.kode)}
                        className={`text-[11px] rounded-full px-2 py-1 border text-left ${on ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-300"}`}>
                        {r.nama}
                      </button>
                    );
                  })}
                  {rel.length === 0 && <span className="text-xs text-slate-400">Tidak ada rencana untuk masalah terpilih.</span>}
                </div>
              </div>
            );
          })()}

          <button onClick={simpan} disabled={saving}
            className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl py-2.5 mt-1">
            {saving ? "Menyimpan…" : "Simpan Pengkajian"}
          </button>
        </>
      )}
    </div>
  );
}

// ── Persetujuan / Penolakan Tindakan Kedokteran (informed consent) ───────────
const PT_ROWS: [string, string][] = [
  ["diagnosa", "Diagnosis"], ["dasar_diagnosa", "Dasar diagnosis"], ["tindakan", "Tindakan kedokteran"],
  ["indikasi_tindakan", "Indikasi tindakan"], ["tujuan", "Tujuan"], ["risiko", "Risiko"],
  ["komplikasi", "Komplikasi"], ["prognosis", "Prognosis"], ["alternatif_dan_risikonya", "Alternatif & risikonya"],
  ["lain_lain", "Lain-lain"],
];
function PenolakanTab({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<EnakesPenolakan[] | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => { enakesPenolakanList(noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat, reload]);

  const [grid, setGrid] = useState<Record<string, string>>({});
  const [konf, setKonf] = useState<Record<string, boolean>>({});
  const [kdDokter, setKdDokter] = useState("");
  const [pernyataan, setPernyataan] = useState("Belum Dikonfirmasi");
  const [penerima, setPenerima] = useState("");
  const [alasan, setAlasan] = useState("");
  const [jk, setJk] = useState("L");
  const [tglLahir, setTglLahir] = useState("");
  const [umur, setUmur] = useState("");
  const [alamat, setAlamat] = useState("");
  const [noHp, setNoHp] = useState("");
  const [hubungan, setHubungan] = useState("Diri Sendiri");
  const [saksi, setSaksi] = useState("");
  const [pFoto, setPFoto] = useState<string | null>(null);
  const [pTtd, setPTtd] = useState<string | null>(null);
  const [sFoto, setSFoto] = useState<string | null>(null);
  const [sTtd, setSTtd] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");

  const g = (k: string) => grid[k] ?? "";
  const setG = (k: string, v: string) => setGrid(s => ({ ...s, [k]: v }));

  function resetForm() {
    setGrid({}); setKonf({}); setKdDokter(""); setPernyataan("Belum Dikonfirmasi"); setPenerima(""); setAlasan("");
    setJk("L"); setTglLahir(""); setUmur(""); setAlamat(""); setNoHp(""); setHubungan("Diri Sendiri"); setSaksi("");
    setPFoto(null); setPTtd(null); setSFoto(null); setSTtd(null); setEditKey(null);
  }
  async function startEdit(p: EnakesPenolakan) {
    setErr("");
    try {
      const d = (await enakesPenolakanDetail(p.no_pernyataan)).data;
      if (!d) { setErr("Detail tidak ditemukan"); return; }
      setGrid(d.grid ?? {}); setKonf(d.konf ?? {}); setKdDokter(d.kd_dokter ?? "");
      setPernyataan(d.pernyataan || "Belum Dikonfirmasi"); setPenerima(d.penerima_informasi ?? "");
      setAlasan(d.alasan_diwakilkan_penerima_informasi ?? ""); setJk(d.jk_penerima_informasi || "L");
      setTglLahir(d.tanggal_lahir_penerima_informasi ?? ""); setUmur(d.umur_penerima_informasi ?? "");
      setAlamat(d.alamat_penerima_informasi ?? ""); setNoHp(d.no_hp ?? ""); setHubungan(d.hubungan_penerima_informasi || "Diri Sendiri");
      setSaksi(d.saksi_keluarga ?? ""); setPFoto(null); setPTtd(null); setSFoto(null); setSTtd(null);
      setEditKey(p.no_pernyataan); setOpen(true);
    } catch { setErr("Gagal memuat detail"); }
  }
  async function hapus(p: EnakesPenolakan) {
    if (!window.confirm("Hapus pernyataan ini?")) return;
    try { await enakesPenolakanHapus({ no_pernyataan: p.no_pernyataan }); setReload(x => x + 1); }
    catch (e) { const ex = e as { response?: { data?: { error?: string } } }; alert(ex.response?.data?.error ?? "Gagal menghapus"); }
  }

  async function simpan() {
    if (!g("tindakan").trim() || !penerima.trim()) { setErr("Tindakan & penerima informasi wajib diisi"); return; }
    setSaving(true); setErr("");
    try {
      const res = await enakesPenolakanSave({
        no_rawat: noRawat, edit: !!editKey, no_pernyataan: editKey ?? undefined, kd_dokter: kdDokter, pernyataan,
        penerima_informasi: penerima, alasan_diwakilkan_penerima_informasi: alasan,
        jk_penerima_informasi: jk, tanggal_lahir_penerima_informasi: tglLahir, umur_penerima_informasi: umur,
        alamat_penerima_informasi: alamat, no_hp: noHp, hubungan_penerima_informasi: hubungan, saksi_keluarga: saksi,
        diagnosa: g("diagnosa"), diagnosa_konfirmasi: !!konf.diagnosa,
        dasar_diagnosa: g("dasar_diagnosa"), dasar_diagnosa_konfirmasi: !!konf.dasar_diagnosa,
        tindakan: g("tindakan"), tindakan_konfirmasi: !!konf.tindakan,
        indikasi_tindakan: g("indikasi_tindakan"), indikasi_tindakan_konfirmasi: !!konf.indikasi_tindakan,
        tujuan: g("tujuan"), tujuan_konfirmasi: !!konf.tujuan,
        risiko: g("risiko"), risiko_konfirmasi: !!konf.risiko,
        komplikasi: g("komplikasi"), komplikasi_konfirmasi: !!konf.komplikasi,
        prognosis: g("prognosis"), prognosis_konfirmasi: !!konf.prognosis,
        alternatif_dan_risikonya: g("alternatif_dan_risikonya"), alternatif_konfirmasi: !!konf.alternatif_dan_risikonya,
        lain_lain: g("lain_lain"), lain_lain_konfirmasi: !!konf.lain_lain,
      });
      // Upload foto + TTD (penerima informasi / pasien & saksi keluarga) → tabel bukti Khanza
      const noPy = res.data?.no_pernyataan;
      if (noPy && (pFoto || pTtd || sFoto || sTtd)) {
        await enakesPenolakanBukti({
          no_pernyataan: noPy,
          penerima_foto: pFoto ?? undefined, penerima_ttd: pTtd ?? undefined,
          saksi_foto: sFoto ?? undefined, saksi_ttd: sTtd ?? undefined,
        }).catch((e) => {
          const ex = e as { response?: { data?: { error?: string } } };
          alert("Pernyataan tersimpan, tetapi foto/tanda tangan GAGAL diunggah: " + (ex.response?.data?.error ?? "kesalahan tidak diketahui") + "\n\nSilakan buka kembali pernyataan ini dan ulangi unggah foto/TTD.");
        });
      }
      setOpen(false); setReload(x => x + 1); resetForm();
    } catch (e) {
      const ex = e as { response?: { data?: { error?: string } } };
      const msg = ex.response?.data?.error ?? "Gagal menyimpan pernyataan. Periksa koneksi lalu coba lagi.";
      setErr(msg);
      alert("GAGAL menyimpan pernyataan:\n" + msg);          // notif blocking agar diperhatikan petugas
    } finally { setSaving(false); }
  }

  const pCls = (p: string) => p === "Penolakan" ? "bg-red-50 text-red-700 border-red-200"
    : p === "Persetujuan" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <div className="space-y-3">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2.5">
          <div className="text-sm font-bold text-slate-800">{editKey ? `Ubah Pernyataan (${editKey})` : "Persetujuan / Penolakan Tindakan"}</div>
          <div className="text-[11px] text-slate-400">Informasi yang dijelaskan (centang bila sudah dikonfirmasi/dipahami):</div>
          {PT_ROWS.map(([k, label]) => (
            <div key={k} className="border border-slate-200 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">{label}</label>
                <label className="flex items-center gap-1 text-[11px] text-slate-500">
                  <input type="checkbox" checked={!!konf[k]} onChange={e => setKonf(s => ({ ...s, [k]: e.target.checked }))} className="accent-rose-600" />
                  dikonfirmasi
                </label>
              </div>
              <textarea value={g(k)} onChange={e => setG(k, e.target.value)} rows={1}
                className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-1 focus:outline-none focus:ring-2 focus:ring-rose-400" />
            </div>
          ))}
          <Field label="Kode DPJP (dokter)" value={kdDokter} onChange={setKdDokter} />

          <div className="pt-1 text-xs font-bold text-slate-600">Penerima informasi</div>
          <Field label="Nama penerima informasi" value={penerima} onChange={setPenerima} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">Hubungan dgn pasien</label>
              <select value={hubungan} onChange={e => setHubungan(e.target.value)}
                className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400">
                <option>Diri Sendiri</option><option>Orang Tua</option><option>Anak</option><option>Saudara Kandung</option><option>Teman</option><option>Lain-lain</option>
              </select>
            </div>
            <Field label="Alasan diwakilkan" value={alasan} onChange={setAlasan} />
            <div>
              <label className="text-xs font-semibold text-slate-600">Jenis kelamin</label>
              <select value={jk} onChange={e => setJk(e.target.value)}
                className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400">
                <option value="L">Laki-laki</option><option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Tanggal lahir</label>
              <input type="date" value={tglLahir} onChange={e => setTglLahir(e.target.value)}
                className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-1.5 mt-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400" />
            </div>
            <Field label="Umur" value={umur} onChange={setUmur} />
            <Field label="No. HP" value={noHp} onChange={setNoHp} />
          </div>
          <Field label="Alamat" value={alamat} onChange={setAlamat} />
          <Field label="Saksi keluarga" value={saksi} onChange={setSaksi} />

          <div>
            <label className="text-xs font-semibold text-slate-600">Pernyataan</label>
            <select value={pernyataan} onChange={e => setPernyataan(e.target.value)}
              className="w-full rounded-lg border border-slate-300 text-sm px-2.5 py-2 mt-0.5 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-400">
              <option>Belum Dikonfirmasi</option><option>Persetujuan</option><option>Penolakan</option>
            </select>
          </div>

          <div className="border-t border-slate-100 pt-2">
            <div className="text-xs font-bold text-slate-600 mb-1">Penerima Informasi (pasien/wakil)</div>
            <PhotoInput value={pFoto} onChange={setPFoto} />
            <SignaturePad onChange={setPTtd} />
          </div>
          <div className="border-t border-slate-100 pt-2">
            <div className="text-xs font-bold text-slate-600 mb-1">Saksi Keluarga</div>
            <PhotoInput value={sFoto} onChange={setSFoto} />
            <SignaturePad onChange={setSTtd} />
          </div>

          {err && (
            <div ref={(el) => { if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }}
              className="flex items-start gap-2 rounded-lg border-2 border-red-400 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm animate-pulse">
              <span className="text-lg leading-none">⚠️</span>
              <span>{err}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving}
              className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2">
              {saving ? "Menyimpan…" : editKey ? "Perbarui Pernyataan" : "Simpan Pernyataan"}
            </button>
            <button onClick={() => { setOpen(false); setErr(""); resetForm(); }}
              className="px-4 text-sm font-semibold text-slate-500 rounded-lg border border-slate-200">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { resetForm(); setErr(""); setOpen(true); }}
          className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + Persetujuan / Penolakan Tindakan
        </button>
      )}

      {list === null ? (
        <div className="text-center text-slate-400 text-sm py-6">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-6">Belum ada pernyataan.</div>
      ) : (
        list.map((p, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800 truncate">{p.tindakan || "—"}</span>
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border ${pCls(p.pernyataan)}`}>{p.pernyataan}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="text-xs text-slate-500">{p.no_pernyataan} · {(p.tanggal ?? "").slice(0, 10)}{p.penerima ? ` · ${p.penerima}` : ""}</div>
              <span className="flex items-center gap-2 text-[11px] shrink-0">
                {p.milik === 1 && <button onClick={() => startEdit(p)} className="text-rose-600 hover:text-rose-800 font-semibold">Edit</button>}
                {p.milik === 1 && <button onClick={() => hapus(p)} className="text-red-500 hover:text-red-700 font-semibold">Hapus</button>}
              </span>
            </div>
            {p.petugas && <div className="mt-0.5 text-[11px] text-rose-600">{p.petugas}</div>}
          </div>
        ))
      )}
    </div>
  );
}

function Vital({ label, value }: { label: string; value?: string }) {
  if (!value || value.trim() === "" || value === "0") return null;
  return (
    <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function Soap({ tag, label, value }: { tag: string; label: string; value?: string }) {
  if (!value || value.trim() === "") return null;
  return (
    <div className="flex gap-2">
      <span className="shrink-0 w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center justify-center mt-0.5">{tag}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">{value}</div>
      </div>
    </div>
  );
}

function SoapieList({ data, onEdit, onDelete }: { data: EdokterSoapie[]; onEdit?: (s: EdokterSoapie) => void; onDelete?: (s: EdokterSoapie) => void }) {
  if (data.length === 0) {
    return <div className="text-center text-slate-400 text-sm py-10">Belum ada catatan pemeriksaan.</div>;
  }
  return (
    <>
      {data.map((s, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-emerald-700">
              {s.tgl_perawatan} {s.jam_rawat ? s.jam_rawat.slice(0, 5) : ""}
            </span>
            <div className="flex items-center gap-2 max-w-[55%]">
              {s.petugas && <span className="text-[11px] text-slate-400 truncate">{s.petugas}</span>}
              {/* Owner-only: Edit/Hapus hanya untuk catatan milik user login (milik=1) */}
              {onEdit && s.milik === 1 && <button onClick={() => onEdit(s)} className="text-[11px] font-medium text-emerald-600 hover:underline shrink-0">Edit</button>}
              {onDelete && s.milik === 1 && <button onClick={() => onDelete(s)} className="text-[11px] font-medium text-red-500 hover:underline shrink-0">Hapus</button>}
            </div>
          </div>

          {/* Vitals */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            <Vital label="TD" value={s.tensi} />
            <Vital label="Nadi" value={s.nadi} />
            <Vital label="Suhu" value={s.suhu_tubuh} />
            <Vital label="RR" value={s.respirasi} />
            <Vital label="SpO2" value={s.spo2} />
            <Vital label="GCS" value={s.gcs} />
            <Vital label="BB" value={s.berat} />
            <Vital label="TB" value={s.tinggi} />
            <Vital label="Kes." value={s.kesadaran} />
          </div>

          {alergiAda(s.alergi) ? (
            <div className="mb-2 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg px-2.5 py-1.5 font-semibold">
              ⚠ Alergi: {s.alergi}
            </div>
          ) : (
            <div className="mb-2 text-xs bg-slate-50 text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5">
              Alergi: Tidak Ada
            </div>
          )}

          {/* SOAPIE */}
          <div className="space-y-2">
            <Soap tag="S" label="Subjektif" value={s.keluhan} />
            <Soap tag="O" label="Objektif" value={s.pemeriksaan} />
            <Soap tag="A" label="Asesmen" value={s.penilaian} />
            <Soap tag="P" label="Plan" value={s.rtl} />
            <Soap tag="I" label="Instruksi" value={s.instruksi} />
            <Soap tag="E" label="Evaluasi" value={s.evaluasi} />
          </div>
        </div>
      ))}
    </>
  );
}

function ResepList({ data, noRawat, jenis, readOnly, onCopied }: { data: EdokterResep[]; noRawat?: string; jenis?: string; readOnly?: boolean; onCopied?: () => void }) {
  const [copying, setCopying] = useState<string>("");
  const salin = async (no_resep: string) => {
    if (!noRawat) return;
    if (!window.confirm(`Salin resep ${no_resep} menjadi resep baru?`)) return;
    setCopying(no_resep);
    try {
      const r = await edokterCopyResep({ no_rawat: noRawat, no_resep, jenis: jenis ?? "ralan" });
      alert(`Resep disalin → ${r.data.no_resep}`);
      onCopied?.();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      alert(err.response?.data?.error ?? "Gagal menyalin resep");
    } finally { setCopying(""); }
  };
  if (data.length === 0) {
    return <div className="text-center text-slate-400 text-sm py-10">Belum ada resep.</div>;
  }
  return (
    <>
      {data.map((r) => (
        <div key={r.no_resep} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <div className="text-sm font-bold text-slate-800">{r.no_resep}</div>
              <div className="text-[11px] text-slate-400">
                {r.tgl_peresepan} {r.jam_peresepan ? r.jam_peresepan.slice(0, 5) : ""}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {r.status && (
                <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200">
                  {r.status}
                </span>
              )}
              {!readOnly && noRawat && (
                <button onClick={() => salin(r.no_resep)} disabled={copying === r.no_resep}
                  className="text-[11px] font-semibold text-emerald-700 border border-emerald-300 rounded-lg px-2 py-1 hover:bg-emerald-50 disabled:opacity-60">
                  {copying === r.no_resep ? "Menyalin…" : "Salin"}
                </button>
              )}
            </div>
          </div>

          {r.obat.length > 0 && (
            <div className="space-y-1.5">
              {r.obat.map((o, i) => (
                <div key={i} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1.5 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-700 truncate">{o.nama_brng ?? o.kode_brng}</div>
                    {o.aturan_pakai && <div className="text-[11px] text-slate-400">{o.aturan_pakai}</div>}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-600">×{o.jml}</span>
                </div>
              ))}
            </div>
          )}

          {r.racikan.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Racikan</div>
              {r.racikan.map((rc, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-700 truncate">{rc.nama_racik}</div>
                    {rc.aturan_pakai && <div className="text-[11px] text-slate-400">{rc.aturan_pakai}</div>}
                    {rc.keterangan && <div className="text-[11px] text-slate-400 truncate">{rc.keterangan}</div>}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-600">×{rc.jml_dr}</span>
                </div>
              ))}
            </div>
          )}

          {r.obat.length === 0 && r.racikan.length === 0 && (
            <div className="text-xs text-slate-400 italic">Detail obat tidak tersedia.</div>
          )}
        </div>
      ))}
    </>
  );
}

// ── Form input SOAPIE (catatan baru) ────────────────────────────────────────
type SoapieState = {
  tensi: string; nadi: string; suhu_tubuh: string; respirasi: string; spo2: string;
  gcs: string; berat: string; tinggi: string; kesadaran: string; alergi: string;
  keluhan: string; pemeriksaan: string; penilaian: string; rtl: string; instruksi: string; evaluasi: string;
};
const SOAPIE_KOSONG: SoapieState = {
  tensi: "", nadi: "", suhu_tubuh: "", respirasi: "", spo2: "", gcs: "", berat: "", tinggi: "",
  kesadaran: "Compos Mentis", alergi: "Tidak Ada", keluhan: "", pemeriksaan: "", penilaian: "", rtl: "", instruksi: "", evaluasi: "",
};

// Nilai alergi dianggap "Ada" (alergen nyata) bila bukan kosong/-/varian "tidak ada".
const alergiAda = (v?: string) => {
  const s = (v ?? "").trim().toLowerCase();
  return s !== "" && s !== "-" && !s.startsWith("tidak") && !s.startsWith("tdk");
};
// Untuk tampilan tabel/riwayat: jangan pernah kosong → "Tidak Ada".
const alergiTampil = (v?: string) => alergiAda(v) ? (v as string) : "Tidak Ada";

function SoapieForm({ noRawat, jenis, edit, onSaved, onCancel }: { noRawat: string; jenis: string; edit?: EdokterSoapie | null; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState<SoapieState>(() => edit
    ? ({ ...SOAPIE_KOSONG, ...(Object.fromEntries(Object.keys(SOAPIE_KOSONG).map(k => [k, (edit as Record<string, string | undefined>)[k] ?? ""])) as Partial<SoapieState>) })
    : SOAPIE_KOSONG);
  const [waktu, setWaktu] = useState<string>(() => (edit && edit.tgl_perawatan)
    ? `${edit.tgl_perawatan}T${(edit.jam_rawat ?? "00:00").slice(0, 5)}`
    : nowLocal());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof SoapieState, v: string) => setF(s => ({ ...s, [k]: v }));
  const [adaAlergi, setAdaAlergi] = useState<boolean>(() => alergiAda(edit?.alergi));

  async function simpan() {
    setSaving(true); setErr("");
    const [d, t] = (waktu || "").split("T");
    const jam = t ? (t.length === 5 ? `${t}:00` : t) : "";
    try {
      await edokterSimpanSoapie({
        no_rawat: noRawat, jenis, ...f,
        alergi: adaAlergi ? (f.alergi.trim() || "Ada") : "Tidak Ada",
        tgl_perawatan: d ?? "", jam_rawat: jam,
        ...(edit ? { edit_tgl: edit.tgl_perawatan ?? "", edit_jam: edit.jam_rawat ?? "" } : {}),
      });
      onSaved();
    }
    catch (e: unknown) { setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal menyimpan"); }
    finally { setSaving(false); }
  }

  const vitals: [keyof SoapieState, string, string][] = [
    ["tensi", "TD (mmHg)", "120/80"], ["nadi", "Nadi (x/mnt)", ""], ["suhu_tubuh", "Suhu (°C)", ""],
    ["respirasi", "RR (x/mnt)", ""], ["spo2", "SpO₂ (%)", ""], ["gcs", "GCS", ""],
    ["berat", "BB (kg)", ""], ["tinggi", "TB (cm)", ""],
  ];
  const soap: [keyof SoapieState, string, string][] = [
    ["keluhan", "S — Subjektif / Keluhan", ""], ["pemeriksaan", "O — Objektif / Pemeriksaan", ""],
    ["penilaian", "A — Asesmen / Diagnosis", ""], ["rtl", "P — Plan / RTL", ""],
    ["instruksi", "I — Instruksi", ""], ["evaluasi", "E — Evaluasi", ""],
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-3">
      <div className="text-sm font-bold text-slate-800">{edit ? "Edit Catatan SOAPIE" : "Catatan SOAPIE Baru"}</div>

      <label className="block text-[11px] text-slate-500">Tanggal &amp; Jam
        <input type="datetime-local" value={waktu} onChange={e => setWaktu(e.target.value)}
          className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-0.5" /></label>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Tanda Vital</div>
        <div className="grid grid-cols-3 gap-2">
          {vitals.map(([k, l, ph]) => (
            <label key={k} className="text-[11px] text-slate-500">{l}
              <input value={f[k]} onChange={e => set(k, e.target.value)} placeholder={ph} inputMode="text"
                className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-0.5" /></label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <label className="text-[11px] text-slate-500">Kesadaran
            <select value={f.kesadaran} onChange={e => set("kesadaran", e.target.value)}
              className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-0.5">
              {KESADARAN.map(k => <option key={k} value={k}>{k}</option>)}
            </select></label>
          <label className="text-[11px] text-slate-500">Alergi
            <select value={adaAlergi ? "Ada" : "Tidak Ada"}
              onChange={e => { const a = e.target.value === "Ada"; setAdaAlergi(a); set("alergi", a ? (alergiAda(f.alergi) ? f.alergi : "") : "Tidak Ada"); }}
              className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 mt-0.5">
              <option>Tidak Ada</option>
              <option>Ada</option>
            </select>
            {adaAlergi && (
              <div className="relative mt-1">
                <input value={f.alergi} onChange={e => set("alergi", e.target.value)} placeholder="Sebutkan alergi (obat/makanan)"
                  className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 pr-8" />
                <MicButton value={f.alergi} onChange={v => set("alergi", v)} className="absolute right-1 bottom-1" />
              </div>
            )}</label>
        </div>
      </div>

      <div className="space-y-2">
        {soap.map(([k, l]) => (
          <label key={k} className="block text-[11px] font-semibold text-slate-500">{l}
            <div className="relative">
              <textarea value={f[k]} onChange={e => set(k, e.target.value)} rows={2}
                className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 pr-8 mt-0.5" />
              <MicButton value={f[k]} onChange={v => set(k, v)} className="absolute right-1.5 bottom-1.5" />
            </div></label>
        ))}
      </div>

      {err && <div className="text-xs text-rose-600">{err}</div>}
      <div className="flex gap-2">
        <button onClick={simpan} disabled={saving}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2.5">
          {saving ? "Menyimpan…" : "Simpan Catatan"}
        </button>
        <button onClick={onCancel} className="px-4 text-sm text-slate-500">Batal</button>
      </div>
    </div>
  );
}

// ── Form input Resep ────────────────────────────────────────────────────────
function ResepForm({ noRawat, jenis, onSaved, onCancel }: { noRawat: string; jenis: string; onSaved: () => void; onCancel: () => void }) {
  const [items, setItems] = useState<(EdokterResepItem & { nama?: string })[]>([]);
  const [cari, setCari] = useState("");
  const [hasil, setHasil] = useState<EdokterObat[]>([]);
  const [cariLoading, setCariLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (cari.trim().length < 2) { setHasil([]); return; }
    const t = setTimeout(async () => {
      setCariLoading(true);
      try { setHasil((await edokterCariObat(cari)).data); } catch { setHasil([]); } finally { setCariLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [cari]);

  function tambah(o: EdokterObat) {
    if (items.some(i => i.kode_brng === o.kode_brng)) return;
    setItems(x => [...x, { kode_brng: o.kode_brng, jml: "1", aturan_pakai: "", nama: o.nama_brng ?? o.kode_brng }]);
    setCari(""); setHasil([]);
  }
  const ubah = (i: number, patch: Partial<EdokterResepItem>) => setItems(x => x.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const hapus = (i: number) => setItems(x => x.filter((_, idx) => idx !== i));

  async function simpan() {
    if (items.length === 0) { setErr("Tambahkan minimal satu obat"); return; }
    setSaving(true); setErr("");
    try {
      await edokterSimpanResep({ no_rawat: noRawat, jenis, obat: items.map(({ kode_brng, jml, aturan_pakai }) => ({ kode_brng, jml, aturan_pakai })) });
      onSaved();
    } catch (e: unknown) { setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal menyimpan"); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-3">
      <div className="text-sm font-bold text-slate-800">Resep Baru</div>

      {/* Cari obat */}
      <div className="relative">
        <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama obat…"
          className="w-full rounded-lg border border-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        {(hasil.length > 0 || cariLoading) && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {cariLoading ? <div className="px-3 py-2 text-xs text-slate-400">Mencari…</div> :
              hasil.map(o => (
                <button key={o.kode_brng} onClick={() => tambah(o)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 border-b border-slate-50 last:border-0">
                  <div className="text-slate-700 truncate">{o.nama_brng ?? o.kode_brng}</div>
                  <div className="text-[11px] text-slate-400">{o.kode_brng}{o.kode_sat ? ` · ${o.kode_sat}` : ""}</div>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Item resep */}
      {items.length === 0 ? (
        <div className="text-xs text-slate-400 italic text-center py-3">Belum ada obat. Cari & pilih di atas.</div>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={it.kode_brng} className="border border-slate-200 rounded-lg p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium text-slate-700 min-w-0 truncate">{it.nama}</div>
                <button onClick={() => hapus(i)} className="text-rose-500 text-xs shrink-0">Hapus</button>
              </div>
              <div className="flex gap-2 mt-1.5">
                <label className="text-[11px] text-slate-500 w-20 shrink-0">Jumlah
                  <input value={it.jml} onChange={e => ubah(i, { jml: e.target.value })} inputMode="numeric"
                    className="block w-full rounded border border-slate-300 text-sm px-2 py-1 mt-0.5" /></label>
                <label className="text-[11px] text-slate-500 flex-1">Aturan pakai
                  <div className="relative">
                    <input value={it.aturan_pakai} onChange={e => ubah(i, { aturan_pakai: e.target.value })} placeholder="mis. 3x1 sesudah makan"
                      className="block w-full rounded border border-slate-300 text-sm px-2 py-1 pr-8 mt-0.5" />
                    <MicButton value={it.aturan_pakai ?? ""} onChange={v => ubah(i, { aturan_pakai: v })} className="absolute right-1 bottom-1" />
                  </div></label>
              </div>
            </div>
          ))}
        </div>
      )}

      {err && <div className="text-xs text-rose-600">{err}</div>}
      <div className="flex gap-2">
        <button onClick={simpan} disabled={saving || items.length === 0}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2.5">
          {saving ? "Menyimpan…" : "Simpan Resep"}
        </button>
        <button onClick={onCancel} className="px-4 text-sm text-slate-500">Batal</button>
      </div>
    </div>
  );
}

// ── Tab Penunjang (Laboratorium / Radiologi) ────────────────────────────────
function PenunjangTab({ kind, noRawat, jenis, viewOnly = false }: { kind: "lab" | "rad"; noRawat: string; jenis: string; viewOnly?: boolean }) {
  // Farmasi (viewOnly): hanya lihat Hasil, tanpa subtab/buat Permintaan.
  const [sub, setSub] = useState<"permintaan" | "hasil">(viewOnly ? "hasil" : "permintaan");
  const label = kind === "lab" ? "Laboratorium" : "Radiologi";
  if (viewOnly) {
    return (
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-500 px-1">Hasil {label}</div>
        <HasilSub kind={kind} noRawat={noRawat} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {(["permintaan", "hasil"] as const).map(s => (
          <button key={s} onClick={() => setSub(s)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              sub === s ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"
            }`}>
            {s === "permintaan" ? `Permintaan ${label}` : `Hasil ${label}`}
          </button>
        ))}
      </div>
      {sub === "permintaan"
        ? <PermintaanSub kind={kind} noRawat={noRawat} jenis={jenis} />
        : <HasilSub kind={kind} noRawat={noRawat} />}
    </div>
  );
}

// ── Subtab Permintaan: daftar + buat baru ───────────────────────────────────
function PermintaanSub({ kind, noRawat, jenis }: { kind: "lab" | "rad"; noRawat: string; jenis: string }) {
  const [list, setList] = useState<EdokterPermintaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [formOpen, setFormOpen] = useState(false);

  const listFn = kind === "lab" ? edokterLabPermintaan : edokterRadPermintaan;
  useEffect(() => {
    setLoading(true);
    listFn(noRawat).then(r => setList(r.data)).catch(() => setList([])).finally(() => setLoading(false));
  }, [kind, noRawat, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2.5">
      {formOpen ? (
        <PermintaanForm kind={kind} noRawat={noRawat} jenis={jenis}
          onSaved={() => { setFormOpen(false); setReload(x => x + 1); }} onCancel={() => setFormOpen(false)} />
      ) : (
        <button onClick={() => setFormOpen(true)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl py-2.5 shadow-sm">
          + Permintaan {kind === "lab" ? "Lab" : "Radiologi"} Baru
        </button>
      )}
      {loading ? <div className="text-center text-slate-400 text-sm py-8">Memuat…</div>
        : list.length === 0 ? <div className="text-center text-slate-400 text-sm py-8">Belum ada permintaan.</div>
        : list.map(p => (
          <div key={p.noorder} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">{p.noorder}</span>
              <span className="text-[11px] text-slate-400">{p.tgl_permintaan} {p.jam_permintaan ? p.jam_permintaan.slice(0,5) : ""}</span>
            </div>
            {p.pemeriksaan && <div className="text-sm text-slate-600 mt-1">{p.pemeriksaan}</div>}
            {p.diagnosa_klinis && <div className="text-[11px] text-slate-400 mt-0.5">Dx: {p.diagnosa_klinis}</div>}
          </div>
        ))}
    </div>
  );
}

function PermintaanForm({ kind, noRawat, jenis, onSaved, onCancel }: { kind: "lab" | "rad"; noRawat: string; jenis: string; onSaved: () => void; onCancel: () => void }) {
  const [cari, setCari] = useState("");
  const [hasil, setHasil] = useState<EdokterJenisPrw[]>([]);
  const [cariLoading, setCariLoading] = useState(false);
  const [dipilih, setDipilih] = useState<EdokterJenisPrw[]>([]);
  const [dx, setDx] = useState("");
  const [info, setInfo] = useState("");
  const [cito, setCito] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const jenisFn = kind === "lab" ? edokterLabJenis : edokterRadJenis;
  const buatFn = kind === "lab" ? edokterBuatLab : edokterBuatRad;

  useEffect(() => {
    if (cari.trim().length < 2) { setHasil([]); return; }
    const t = setTimeout(async () => {
      setCariLoading(true);
      try { setHasil((await jenisFn(cari)).data); } catch { setHasil([]); } finally { setCariLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [cari]); // eslint-disable-line react-hooks/exhaustive-deps

  function tambah(j: EdokterJenisPrw) {
    if (dipilih.some(x => x.kd_jenis_prw === j.kd_jenis_prw)) return;
    setDipilih(x => [...x, j]); setCari(""); setHasil([]);
  }
  const hapus = (kd: string) => setDipilih(x => x.filter(j => j.kd_jenis_prw !== kd));

  async function simpan() {
    if (dipilih.length === 0) { setErr("Pilih minimal satu pemeriksaan"); return; }
    if (!dx.trim()) { setErr("Indikasi / diagnosa klinis wajib diisi (PAP 1.1)"); return; }
    setSaving(true); setErr("");
    try {
      await buatFn({ no_rawat: noRawat, jenis, tests: dipilih.map(j => j.kd_jenis_prw), diagnosa_klinis: dx, informasi_tambahan: info, prioritas: cito ? "Cito" : "Rutin" });
      onSaved();
    } catch (e: unknown) { setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal menyimpan"); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-3">
      <div className="text-sm font-bold text-slate-800">Permintaan {kind === "lab" ? "Lab" : "Radiologi"} Baru</div>
      <div className="relative">
        <input value={cari} onChange={e => setCari(e.target.value)} placeholder={`Cari pemeriksaan ${kind === "lab" ? "lab" : "radiologi"}…`}
          className="w-full rounded-lg border border-slate-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        {(hasil.length > 0 || cariLoading) && (
          <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {cariLoading ? <div className="px-3 py-2 text-xs text-slate-400">Mencari…</div> :
              hasil.map(j => (
                <button key={j.kd_jenis_prw} onClick={() => tambah(j)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 border-b border-slate-50 last:border-0">
                  <div className="text-slate-700 truncate">{j.nm_perawatan ?? j.kd_jenis_prw}</div>
                  <div className="text-[11px] text-slate-400">{j.kd_jenis_prw}</div>
                </button>
              ))}
          </div>
        )}
      </div>

      {dipilih.length === 0 ? (
        <div className="text-xs text-slate-400 italic text-center py-2">Belum ada pemeriksaan dipilih.</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {dipilih.map(j => (
            <span key={j.kd_jenis_prw} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full pl-2.5 pr-1 py-1">
              {j.nm_perawatan ?? j.kd_jenis_prw}
              <button onClick={() => hapus(j.kd_jenis_prw)} className="w-4 h-4 rounded-full hover:bg-emerald-200 text-emerald-600">×</button>
            </span>
          ))}
        </div>
      )}

      <label className="block text-[11px] font-semibold text-slate-500">Indikasi / diagnosa klinis <span className="text-rose-500">*wajib</span>
        <div className="relative">
          <input value={dx} onChange={e => setDx(e.target.value)} placeholder="Wajib diisi (PAP 1.1)"
            className={`block w-full rounded-lg border text-sm px-2 py-1.5 pr-8 mt-0.5 ${dx.trim() ? "border-slate-300" : "border-rose-300"}`} />
          <MicButton value={dx} onChange={setDx} className="absolute right-1 bottom-1" />
        </div></label>
      <label className="block text-[11px] font-semibold text-slate-500">Informasi tambahan
        <div className="relative">
          <input value={info} onChange={e => setInfo(e.target.value)} className="block w-full rounded-lg border border-slate-300 text-sm px-2 py-1.5 pr-8 mt-0.5" />
          <MicButton value={info} onChange={setInfo} className="absolute right-1 bottom-1" />
        </div></label>

      <label className={`flex items-center gap-2 text-sm font-semibold rounded-lg border px-3 py-2 cursor-pointer ${cito ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600"}`}>
        <input type="checkbox" checked={cito} onChange={e => setCito(e.target.checked)} className="w-4 h-4 accent-rose-600" />
        Permintaan CITO (segera) — target hasil ≤ 60 menit
      </label>

      {err && <div className="text-xs text-rose-600">{err}</div>}
      <div className="flex gap-2">
        <button onClick={simpan} disabled={saving || dipilih.length === 0}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2.5">
          {saving ? "Menyimpan…" : "Simpan Permintaan"}
        </button>
        <button onClick={onCancel} className="px-4 text-sm text-slate-500">Batal</button>
      </div>
    </div>
  );
}

// ── Subtab Hasil (read-only) ────────────────────────────────────────────────
function HasilSub({ kind, noRawat }: { kind: "lab" | "rad"; noRawat: string }) {
  const [lab, setLab] = useState<EdokterHasilLab[] | null>(null);
  const [rad, setRad] = useState<EdokterHasilRad[] | null>(null);
  const [gambar, setGambar] = useState<EdokterGambar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const jobs: Promise<unknown>[] = kind === "lab"
      ? [edokterLabHasil(noRawat).then(r => setLab(r.data))]
      : [
          edokterRadHasil(noRawat).then(r => setRad(r.data)).catch(() => setRad([])),
          edokterRadGambar(noRawat).then(r => setGambar(r.data)).catch(() => setGambar([])),
        ];
    Promise.all(jobs).catch(() => { if (kind === "lab") setLab([]); }).finally(() => setLoading(false));
  }, [kind, noRawat]);

  if (loading) return <div className="text-center text-slate-400 text-sm py-8">Memuat…</div>;

  if (kind === "rad") {
    const d = rad ?? [];
    const dipakai = new Set<number>();
    const cocok = (h: EdokterHasilRad) => gambar.filter(g => g.tgl_periksa === h.tgl_periksa && (g.jam ?? "") === (h.jam ?? ""));
    if (d.length === 0 && gambar.length === 0) return <div className="text-center text-slate-400 text-sm py-8">Belum ada hasil radiologi.</div>;
    const sisa = gambar.filter((g, i) => { const m = d.some(h => h.tgl_periksa === g.tgl_periksa && (h.jam ?? "") === (g.jam ?? "")); if (!m) dipakai.add(i); return !m; });
    return (
      <>
        {d.map((h, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 mb-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-emerald-700">{h.tgl_periksa} {h.jam ? h.jam.slice(0,5) : ""}</span>
              {h.jml_gambar > 0 && <span className="text-[11px] text-slate-400">🖼 {h.jml_gambar} gambar</span>}
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">{h.hasil || "—"}</div>
            <GambarGrid items={cocok(h)} />
          </div>
        ))}
        {sisa.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 mb-2.5">
            <div className="text-xs font-semibold text-emerald-700 mb-1.5">Gambar Radiologi</div>
            <GambarGrid items={sisa} />
          </div>
        )}
      </>
    );
  }

  // Lab: kelompokkan per (tgl + jam + nm_perawatan)
  const d = lab ?? [];
  if (d.length === 0) return <div className="text-center text-slate-400 text-sm py-8">Belum ada hasil lab.</div>;
  const groups: { key: string; tgl?: string; jam?: string; nm?: string; rows: EdokterHasilLab[] }[] = [];
  for (const r of d) {
    const key = `${r.tgl_periksa}|${r.jam}|${r.nm_perawatan}`;
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, tgl: r.tgl_periksa, jam: r.jam, nm: r.nm_perawatan ?? undefined, rows: [] }; groups.push(g); }
    g.rows.push(r);
  }
  return <>{groups.map((g, i) => {
    // Sebuah pemeriksaan dianggap "sudah ada hasil" hanya bila minimal 1 parameter
    // punya nilai terisi. Bila semua nilai kosong → belum dikerjakan (jangan tampilkan
    // nilai_rujukan seolah-olah itu hasil).
    const adaHasil = g.rows.some(r => (r.nilai ?? "").trim() !== "");
    return (
    <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 mb-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-800">{g.nm}</span>
        <span className="text-[11px] text-slate-400">{g.tgl} {g.jam ? g.jam.slice(0,5) : ""}</span>
      </div>
      {adaHasil ? (
        <div className="space-y-1">
          {g.rows.map((r, j) => {
            const nilai = (r.nilai ?? "").trim();
            return (
            <div key={j} className="flex items-center justify-between gap-2 text-sm border-b border-slate-50 pb-1 last:border-0">
              <span className="text-slate-600 min-w-0 truncate">{r.pemeriksaan}</span>
              <span className="shrink-0 text-right">
                <span className="font-semibold text-slate-800">{nilai || "-"}</span>
                {nilai && r.satuan && <span className="text-slate-400 text-xs"> {r.satuan}</span>}
                {nilai && r.nilai_rujukan && <span className="block text-[10px] text-slate-400">Rujukan: {r.nilai_rujukan}</span>}
              </span>
            </div>
          );})}
        </div>
      ) : (
        <div className="text-xs italic text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">Belum ada hasil — menunggu pemeriksaan laboratorium.</div>
      )}
    </div>
  );})}</>;
}

// ── Gambar radiologi (lazy-load blob ter-auth) ──────────────────────────────
function GambarGrid({ items }: { items: EdokterGambar[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2 mt-2.5">
      {items.map((g, i) => g.lokasi_gambar ? <RadImg key={i} f={g.lokasi_gambar} /> : null)}
    </div>
  );
}

function RadImg({ f }: { f: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let u: string | null = null;
    edokterRadGambarUrl(f).then(x => { u = x; setUrl(x); }).catch(() => setErr(true));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [f]);

  if (err) return <div className="aspect-square rounded-lg bg-rose-50 text-rose-400 text-[10px] flex items-center justify-center">gagal</div>;
  if (!url) return <div className="aspect-square rounded-lg bg-slate-100 animate-pulse" />;
  return (
    <button onClick={() => window.open(url, "_blank")} className="block aspect-square rounded-lg overflow-hidden border border-slate-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="gambar radiologi" className="w-full h-full object-cover" />
    </button>
  );
}

// ── Tab Telaah Resep (farmasi) ───────────────────────────────────────────────
const RESEP_ITEMS: [keyof Telaah, keyof Telaah, string, string][] = [
  ["resep_identifikasi_pasien", "resep_ket_identifikasi_pasien", "Identifikasi pasien tepat", "Ya"],
  ["resep_tepat_obat", "resep_ket_tepat_obat", "Tepat obat", "Ya"],
  ["resep_tepat_dosis", "resep_ket_tepat_dosis", "Tepat dosis", "Ya"],
  ["resep_tepat_cara_pemberian", "resep_ket_tepat_cara_pemberian", "Tepat cara/rute", "Ya"],
  ["resep_tepat_waktu_pemberian", "resep_ket_tepat_waktu_pemberian", "Tepat waktu", "Ya"],
  ["resep_ada_tidak_duplikasi_obat", "resep_ket_ada_tidak_duplikasi_obat", "Ada duplikasi obat", "Tidak"],
  ["resep_interaksi_obat", "resep_ket_interaksi_obat", "Ada interaksi obat", "Tidak"],
  ["resep_kontra_indikasi_obat", "resep_ket_kontra_indikasi_obat", "Ada kontraindikasi", "Tidak"],
];
const OBAT_ITEMS: [keyof Telaah, string][] = [
  ["obat_tepat_pasien", "Tepat pasien"], ["obat_tepat_obat", "Tepat obat"], ["obat_tepat_dosis", "Tepat dosis"],
  ["obat_tepat_cara_pemberian", "Tepat cara/rute"], ["obat_tepat_waktu_pemberian", "Tepat waktu"],
];

function TelaahTab({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<ResepTelaah[] | null>(null);
  const [sel, setSel] = useState<string>("");
  const [reload, setReload] = useState(0);
  useEffect(() => { getEfarmasiResepTelaah(noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat, reload]);

  if (list === null) return <div className="text-center text-slate-400 text-sm py-10">Memuat…</div>;
  if (list.length === 0) return <div className="text-center text-slate-400 text-sm py-10">Belum ada resep untuk ditelaah.</div>;
  return (
    <div className="space-y-2.5">
      {list.map(r => (
        <div key={r.no_resep} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button onClick={() => setSel(sel === r.no_resep ? "" : r.no_resep)} className="w-full text-left p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-sm font-semibold text-slate-800">{r.no_resep}</div>
              <div className="text-[11px] text-slate-400">{r.jml} item · {r.tgl ?? ""} {r.jam ? r.jam.slice(0, 5) : ""}</div>
            </div>
            <span className={`shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 border ${r.sudah > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
              {r.sudah > 0 ? "Sudah ditelaah" : "Belum"}
            </span>
          </button>
          {sel === r.no_resep && <TelaahForm noResep={r.no_resep} onSaved={() => { setReload(x => x + 1); }} />}
        </div>
      ))}
    </div>
  );
}

function TelaahForm({ noResep, onSaved }: { noResep: string; onSaved: () => void }) {
  const [t, setT] = useState<Telaah | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    getEfarmasiTelaah(noResep).then(r => {
      const d = { ...r.data } as Telaah;
      const dm = d as unknown as Record<string, string>;
      RESEP_ITEMS.forEach(([k, , , def]) => { if (!dm[k as string]) dm[k as string] = def; });
      OBAT_ITEMS.forEach(([k]) => { if (!dm[k as string]) dm[k as string] = "Ya"; });
      d.no_resep = noResep;
      setT(d);
    }).catch(() => {});
  }, [noResep]);
  if (!t) return <div className="px-3 pb-3 text-xs text-slate-400">Memuat…</div>;
  const set = (k: keyof Telaah, v: string) => setT({ ...t, [k]: v });
  const Toggle = ({ k, label, ket }: { k: keyof Telaah; label: string; ket?: keyof Telaah }) => (
    <div className="py-1.5 border-b border-slate-50 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-600">{label}</span>
        <div className="flex rounded-lg overflow-hidden border border-slate-200 shrink-0">
          {["Ya", "Tidak"].map(v => (
            <button key={v} onClick={() => set(k, v)}
              className={`px-3 py-1 text-xs font-semibold ${t[k] === v ? (v === "Ya" ? "bg-emerald-600 text-white" : "bg-rose-500 text-white") : "bg-white text-slate-500"}`}>{v}</button>
          ))}
        </div>
      </div>
      {ket && <input value={(t[ket] as string) || ""} onChange={e => set(ket, e.target.value.slice(0, 30))} placeholder="Keterangan (opsional)"
        className="mt-1 w-full text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-400" />}
    </div>
  );
  async function simpan() {
    setSaving(true); setMsg("");
    try { await saveEfarmasiTelaah(t as Telaah); setMsg("Tersimpan."); onSaved(); }
    catch { setMsg("Gagal menyimpan."); } finally { setSaving(false); }
  }
  return (
    <div className="px-3 pb-3 border-t border-slate-100 bg-slate-50/50">
      <div className="text-[11px] font-bold text-slate-500 uppercase mt-2 mb-1">Telaah Resep</div>
      {RESEP_ITEMS.map(([k, ket, label]) => <Toggle key={k} k={k} label={label} ket={ket} />)}
      <div className="text-[11px] font-bold text-slate-500 uppercase mt-3 mb-1">Telaah Obat (saat penyerahan)</div>
      {OBAT_ITEMS.map(([k, label]) => <Toggle key={k} k={k} label={label} />)}
      <div className="flex items-center gap-2 mt-3">
        <button onClick={simpan} disabled={saving} className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2">{saving ? "Menyimpan…" : "Simpan Telaah"}</button>
        {msg && <span className={`text-xs ${msg === "Tersimpan." ? "text-emerald-600" : "text-rose-600"}`}>{msg}</span>}
      </div>
    </div>
  );
}

// ── Tab Alergi (farmasi) ─────────────────────────────────────────────────────
const SEVERITY = ["", "Ringan", "Sedang", "Berat"];
const KATEGORI_ALERGI = ["Obat", "Makanan", "Lainnya"];
function AlergiTab({ noRawat }: { noRawat: string }) {
  const [data, setData] = useState<AlergiResp | null>(null);
  const [f, setF] = useState({ category: "Obat", allergy_code: "", note: "", reactioncode: "", severity: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const load = () => getEfarmasiAlergi(noRawat).then(r => setData(r.data)).catch(() => setData({ list: [], catatan: "" }));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [noRawat]);
  async function simpan() {
    if (!f.allergy_code.trim() && !f.note.trim()) { setMsg("Isi nama alergi / keterangan"); return; }
    setSaving(true); setMsg("");
    try { await saveEfarmasiAlergi({ no_rawat: noRawat, ...f }); setF({ category: "Obat", allergy_code: "", note: "", reactioncode: "", severity: "" }); setMsg("Tersimpan."); load(); }
    catch { setMsg("Gagal menyimpan."); } finally { setSaving(false); }
  }
  if (!data) return <div className="text-center text-slate-400 text-sm py-10">Memuat…</div>;
  return (
    <div className="space-y-3">
      {data.catatan && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2"><b>Catatan alergi:</b> {data.catatan}</div>}
      {/* Riwayat alergi */}
      {data.list.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-4">Belum ada riwayat alergi tercatat.</div>
      ) : data.list.map((a, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-800">{a.allergy_code || a.note || "-"}</span>
            {a.severity && <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border ${a.severity === "Berat" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{a.severity}</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{a.category}{a.reactioncode ? ` · Reaksi: ${a.reactioncode}` : ""}</div>
          {a.note && <div className="text-xs text-slate-500 mt-1">{a.note}</div>}
          <div className="text-[10px] text-slate-300 mt-1">{a.tgl ?? ""}</div>
        </div>
      ))}
      {/* Form tambah */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
        <div className="text-[11px] font-bold text-slate-500 uppercase">Tambah Alergi</div>
        <div className="grid grid-cols-2 gap-2">
          <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className="text-sm border border-slate-300 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-sky-400">
            {KATEGORI_ALERGI.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={f.severity} onChange={e => setF({ ...f, severity: e.target.value })} className="text-sm border border-slate-300 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-sky-400">
            {SEVERITY.map(o => <option key={o} value={o}>{o || "Tingkat keparahan"}</option>)}
          </select>
        </div>
        <input value={f.allergy_code} onChange={e => setF({ ...f, allergy_code: e.target.value })} placeholder="Nama alergen (mis. Amoxicillin, Udang)"
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
        <input value={f.reactioncode} onChange={e => setF({ ...f, reactioncode: e.target.value })} placeholder="Reaksi (mis. gatal, sesak, ruam)"
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
        <textarea value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Keterangan" rows={2}
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
        <div className="flex items-center gap-2">
          <button onClick={simpan} disabled={saving} className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2">{saving ? "Menyimpan…" : "Simpan Alergi"}</button>
          {msg && <span className={`text-xs ${msg === "Tersimpan." ? "text-emerald-600" : "text-rose-600"}`}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Tab Asuhan Farmasi (PTO / Rekonsiliasi / Pemberian Obat) ─────────────────
function AsuhanTab({ noRawat }: { noRawat: string }) {
  const [sub, setSub] = useState<"pto" | "rekon" | "pemberian" | "konseling">("pto");
  // "Pantau Obat" = log per obat (tabel Khanza). Formulir PTO lengkap sesuai
  // form fisik RM ada di tab "PTO" tersendiri.
  const subs: [typeof sub, string][] = [["pto", "Pantau Obat"], ["rekon", "Rekonsiliasi"], ["pemberian", "Pemberian"], ["konseling", "Konseling"]];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1">
        {subs.map(([s, l]) => (
          <button key={s} onClick={() => setSub(s)}
            className={`flex-1 min-w-[60px] py-1.5 text-xs font-semibold rounded-lg transition-colors ${sub === s ? "bg-white text-sky-700 shadow-sm" : "text-slate-500"}`}>{l}</button>
        ))}
      </div>
      {sub === "pto" ? <PtoSub noRawat={noRawat} />
        : sub === "rekon" ? <RekonSub noRawat={noRawat} />
        : sub === "pemberian" ? <PemberianSub noRawat={noRawat} />
        : <KonselingSub noRawat={noRawat} />}
    </div>
  );
}

function PtoSub({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<Pto[] | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ nama_obat: "", dosis: "", cara_pemberian: "", tgl_mulai_terapi: "", jumlah_hari: "", keterangan: "", status: "Aktif" });
  const [saving, setSaving] = useState(false);
  const load = () => getEfarmasiPto(noRawat).then(r => setList(r.data)).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [noRawat]);
  async function simpan() {
    if (!f.nama_obat.trim()) return;
    setSaving(true);
    try { await saveEfarmasiPto({ no_rawat: noRawat, ...f, jumlah_hari: Number(f.jumlah_hari) || 0 }); setF({ nama_obat: "", dosis: "", cara_pemberian: "", tgl_mulai_terapi: "", jumlah_hari: "", keterangan: "", status: "Aktif" }); setOpen(false); load(); }
    catch { /* noop */ } finally { setSaving(false); }
  }
  if (list === null) return <div className="text-center text-slate-400 text-sm py-8">Memuat…</div>;
  return (
    <div className="space-y-2.5">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Tambah Pemantauan Terapi Obat</div>
          <input value={f.nama_obat} onChange={e => setF({ ...f, nama_obat: e.target.value })} placeholder="Nama obat" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
          <div className="grid grid-cols-2 gap-2">
            <input value={f.dosis} onChange={e => setF({ ...f, dosis: e.target.value })} placeholder="Dosis" className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
            <input value={f.cara_pemberian} onChange={e => setF({ ...f, cara_pemberian: e.target.value })} placeholder="Cara/rute" className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
            <input type="date" value={f.tgl_mulai_terapi} onChange={e => setF({ ...f, tgl_mulai_terapi: e.target.value })} className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
            <input type="number" value={f.jumlah_hari} onChange={e => setF({ ...f, jumlah_hari: e.target.value })} placeholder="Jumlah hari" className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
          </div>
          <textarea value={f.keterangan} onChange={e => setF({ ...f, keterangan: e.target.value })} placeholder="Keterangan / rencana pemantauan" rows={2} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving} className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2">{saving ? "Menyimpan…" : "Simpan"}</button>
            <button onClick={() => setOpen(false)} className="px-4 text-sm text-slate-500 border border-slate-300 rounded-xl">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl py-2.5">+ Tambah PTO</button>
      )}
      {list.length === 0 ? <div className="text-center text-slate-400 text-sm py-6">Belum ada pemantauan terapi obat.</div>
        : list.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-800">{p.nama_obat}</span>
              {p.status && <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200">{p.status}</span>}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{[p.dosis, p.cara, p.jumlah_hari ? `${p.jumlah_hari} hari` : ""].filter(Boolean).join(" · ")}</div>
            {p.keterangan && <div className="text-xs text-slate-500 mt-1">{p.keterangan}</div>}
            <div className="text-[10px] text-slate-300 mt-1">Mulai: {p.tgl_mulai ?? "-"}</div>
          </div>
        ))}
    </div>
  );
}

function RekonSub({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<Rekonsiliasi[] | null>(null);
  const [open, setOpen] = useState(false);
  const [saat, setSaat] = useState("Masuk RS");
  const [alergi, setAlergi] = useState("Tidak");
  const [manif, setManif] = useState("");
  const [obat, setObat] = useState([{ nama_obat: "", dosis_obat: "", frekuensi: "", cara_pemberian: "", tindak_lanjut: "" }]);
  const [saving, setSaving] = useState(false);
  const load = () => getEfarmasiRekonsiliasi(noRawat).then(r => setList(r.data)).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [noRawat]);
  async function simpan() {
    setSaving(true);
    try {
      await saveEfarmasiRekonsiliasi({ no_rawat: noRawat, rekonsiliasi_obat_saat: saat, alergi_obat: alergi, manifestasi_alergi: manif, obat: obat.filter(o => o.nama_obat.trim()) });
      setObat([{ nama_obat: "", dosis_obat: "", frekuensi: "", cara_pemberian: "", tindak_lanjut: "" }]); setManif(""); setOpen(false); load();
    } catch { /* noop */ } finally { setSaving(false); }
  }
  if (list === null) return <div className="text-center text-slate-400 text-sm py-8">Memuat…</div>;
  return (
    <div className="space-y-2.5">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Rekonsiliasi Obat</div>
          <div className="grid grid-cols-2 gap-2">
            <select value={saat} onChange={e => setSaat(e.target.value)} className="text-sm border border-slate-300 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-sky-400">
              {["Masuk RS", "Transfer", "Pulang"].map(o => <option key={o}>{o}</option>)}
            </select>
            <select value={alergi} onChange={e => setAlergi(e.target.value)} className="text-sm border border-slate-300 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-sky-400">
              {["Tidak", "Ada"].map(o => <option key={o}>Alergi: {o}</option>)}
            </select>
          </div>
          {alergi === "Ada" && <input value={manif} onChange={e => setManif(e.target.value)} placeholder="Manifestasi alergi" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />}
          <div className="text-[11px] font-semibold text-slate-500">Daftar obat</div>
          {obat.map((o, i) => (
            <div key={i} className="border border-slate-100 rounded-lg p-2 space-y-1.5">
              <input value={o.nama_obat} onChange={e => setObat(obat.map((x, j) => j === i ? { ...x, nama_obat: e.target.value } : x))} placeholder="Nama obat" className="w-full text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-400" />
              <div className="grid grid-cols-3 gap-1.5">
                <input value={o.dosis_obat} onChange={e => setObat(obat.map((x, j) => j === i ? { ...x, dosis_obat: e.target.value } : x))} placeholder="Dosis" className="text-xs border border-slate-300 rounded-lg px-2 py-1.5" />
                <input value={o.frekuensi} onChange={e => setObat(obat.map((x, j) => j === i ? { ...x, frekuensi: e.target.value } : x))} placeholder="Frekuensi" className="text-xs border border-slate-300 rounded-lg px-2 py-1.5" />
                <input value={o.cara_pemberian} onChange={e => setObat(obat.map((x, j) => j === i ? { ...x, cara_pemberian: e.target.value } : x))} placeholder="Rute" className="text-xs border border-slate-300 rounded-lg px-2 py-1.5" />
              </div>
              <select value={o.tindak_lanjut} onChange={e => setObat(obat.map((x, j) => j === i ? { ...x, tindak_lanjut: e.target.value } : x))} className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                {["", "Lanjut", "Stop", "Ganti", "Tunda"].map(o2 => <option key={o2} value={o2}>{o2 || "Tindak lanjut…"}</option>)}
              </select>
            </div>
          ))}
          <button onClick={() => setObat([...obat, { nama_obat: "", dosis_obat: "", frekuensi: "", cara_pemberian: "", tindak_lanjut: "" }])} className="text-xs text-sky-600 font-medium">+ Tambah obat</button>
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving} className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2">{saving ? "Menyimpan…" : "Simpan"}</button>
            <button onClick={() => setOpen(false)} className="px-4 text-sm text-slate-500 border border-slate-300 rounded-xl">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl py-2.5">+ Rekonsiliasi Baru</button>
      )}
      {list.length === 0 ? <div className="text-center text-slate-400 text-sm py-6">Belum ada rekonsiliasi obat.</div>
        : list.map(r => (
          <div key={r.no_rekonsiliasi} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-800 text-sm">{r.rekonsiliasi_obat_saat || "Rekonsiliasi"}</span>
              <span className="text-[10px] text-slate-400">{r.tanggal ?? ""}</span>
            </div>
            {r.alergi_obat === "Ada" && <div className="text-xs text-rose-600 mt-0.5">Alergi: {r.manifestasi_alergi || "Ada"}</div>}
            <div className="mt-1.5 space-y-1">
              {r.detail.map((d, i) => (
                <div key={i} className="text-xs text-slate-600 flex justify-between gap-2 border-t border-slate-50 pt-1">
                  <span>{d.nama_obat} {d.dosis_obat && `· ${d.dosis_obat}`} {d.frekuensi && `· ${d.frekuensi}`}</span>
                  {d.tindak_lanjut && <span className="shrink-0 text-slate-400">{d.tindak_lanjut}</span>}
                </div>
              ))}
              {r.detail.length === 0 && <div className="text-xs text-slate-300">tanpa detail obat</div>}
            </div>
          </div>
        ))}
    </div>
  );
}

function PemberianSub({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<PemberianObat[] | null>(null);
  useEffect(() => { getEfarmasiPemberianObat(noRawat).then(r => setList(r.data)).catch(() => setList([])); }, [noRawat]);
  if (list === null) return <div className="text-center text-slate-400 text-sm py-8">Memuat…</div>;
  if (list.length === 0) return <div className="text-center text-slate-400 text-sm py-8">Belum ada pemberian obat tercatat.</div>;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-500 uppercase"><tr>
          <th className="px-2 py-2 text-left">Tgl/Jam</th><th className="px-2 py-2 text-left">Obat</th>
          <th className="px-2 py-2 text-right">Jml</th><th className="px-2 py-2 text-left">Status</th>
        </tr></thead>
        <tbody>
          {list.map((p, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-2 py-2 text-slate-500 whitespace-nowrap">{(p.tgl ?? "").slice(5)} {p.jam ? p.jam.slice(0, 5) : ""}</td>
              <td className="px-2 py-2 text-slate-700">{p.nama}{p.bangsal ? <span className="text-slate-400"> · {p.bangsal}</span> : ""}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-600">{p.jml}</td>
              <td className="px-2 py-2 text-slate-500">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KonselingSub({ noRawat }: { noRawat: string }) {
  const [list, setList] = useState<Konseling[] | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ diagnosa: "", obat_pemakaian: "", riwayat_alergi: "", keluhan: "", pernah_datang: "Tidak", tindak_lanjut: "" });
  const [saving, setSaving] = useState(false);
  const load = () => getEfarmasiKonseling(noRawat).then(r => setList(r.data)).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [noRawat]);
  async function simpan() {
    if (!f.keluhan.trim() && !f.tindak_lanjut.trim()) return;
    setSaving(true);
    try { await saveEfarmasiKonseling({ no_rawat: noRawat, ...f }); setF({ diagnosa: "", obat_pemakaian: "", riwayat_alergi: "", keluhan: "", pernah_datang: "Tidak", tindak_lanjut: "" }); setOpen(false); load(); }
    catch { /* noop */ } finally { setSaving(false); }
  }
  if (list === null) return <div className="text-center text-slate-400 text-sm py-8">Memuat…</div>;
  return (
    <div className="space-y-2.5">
      {open ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Konseling Obat</div>
          <input value={f.diagnosa} onChange={e => setF({ ...f, diagnosa: e.target.value })} placeholder="Diagnosa" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
          <textarea value={f.obat_pemakaian} onChange={e => setF({ ...f, obat_pemakaian: e.target.value })} placeholder="Obat yang digunakan" rows={2} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
          <input value={f.riwayat_alergi} onChange={e => setF({ ...f, riwayat_alergi: e.target.value })} placeholder="Riwayat alergi" className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
          <textarea value={f.keluhan} onChange={e => setF({ ...f, keluhan: e.target.value })} placeholder="Keluhan / topik konseling" rows={2} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Pernah konseling?</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              {["Ya", "Tidak"].map(v => <button key={v} onClick={() => setF({ ...f, pernah_datang: v })} className={`px-3 py-1 text-xs font-semibold ${f.pernah_datang === v ? "bg-sky-600 text-white" : "bg-white text-slate-500"}`}>{v}</button>)}
            </div>
          </div>
          <textarea value={f.tindak_lanjut} onChange={e => setF({ ...f, tindak_lanjut: e.target.value })} placeholder="Tindak lanjut / edukasi diberikan" rows={2} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400" />
          <div className="flex gap-2">
            <button onClick={simpan} disabled={saving} className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2">{saving ? "Menyimpan…" : "Simpan"}</button>
            <button onClick={() => setOpen(false)} className="px-4 text-sm text-slate-500 border border-slate-300 rounded-xl">Batal</button>
          </div>
        </div>
      ) : <button onClick={() => setOpen(true)} className="w-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl py-2.5">+ Konseling</button>}
      {list.length === 0 ? <div className="text-center text-slate-400 text-sm py-6">Belum ada konseling.</div>
        : list.map((k, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between"><span className="font-semibold text-slate-800 text-sm">{k.diagnosa || "Konseling"}</span><span className="text-[10px] text-slate-400">{k.tanggal ?? ""}</span></div>
            {k.keluhan && <div className="text-xs text-slate-600 mt-1"><b>Keluhan:</b> {k.keluhan}</div>}
            {k.obat_pemakaian && <div className="text-xs text-slate-500 mt-0.5"><b>Obat:</b> {k.obat_pemakaian}</div>}
            {k.tindak_lanjut && <div className="text-xs text-slate-500 mt-0.5"><b>Tindak lanjut:</b> {k.tindak_lanjut}</div>}
          </div>
        ))}
    </div>
  );
}


// ── Monitoring Bundle PPI (IAD/ISK/Phlebitis/VAP/IDO + Audit IDO Peri-Op) ──────
// Porting form bundle Khanza desktop ke e-Nakes. Header (insersi/pre-op) diisi
// sekali per pemasangan/operasi; detail (maintenance/post-op) diisi tiap hari.
// Flat (Audit IDO Peri-Op) hanya satu bagian. Tabel sama dgn desktop.
type BIndic = [string, string];
interface BCfg {
  key: string; label: string; dateLabel: string;
  headerTitle: string; detailTitle?: string;
  extra?: BIndic[]; headerInd: BIndic[]; detailInd?: BIndic[]; flat?: boolean;
}
const BUNDLES_PPI: BCfg[] = [
  { key: "iad", label: "IAD — Aliran Darah (CVC)", dateLabel: "Tgl Pemasangan CVC",
    headerTitle: "Insersi (Saat Pemasangan)", detailTitle: "Maintenance (Tiap Hari)",
    extra: [["lokasi_insersi", "Lokasi Insersi"]],
    headerInd: [["insersi_hh", "Kebersihan tangan"], ["insersi_apd", "APD sesuai indikasi"], ["insersi_lokasi", "Pilih lokasi minim risiko"], ["insersi_disinfeksi", "Disinfeksi area insersi"]],
    detailInd: [["main_hh", "Kebersihan tangan"], ["main_apd", "APD sesuai indikasi"], ["main_perawatan", "Perawatan CVC tiap hari"], ["main_disinfeksi_hub", "Disinfeksi connecting hub"], ["main_dressing", "Dressing care"], ["main_ganti_set", "Ganti administrasi/infus set"]] },
  { key: "isk", label: "ISK — Saluran Kemih (Kateter Urin)", dateLabel: "Tgl Pemasangan Kateter",
    headerTitle: "Insersi (Saat Pemasangan)", detailTitle: "Maintenance (Tiap Hari)",
    headerInd: [["ins_indikasi", "Pemasangan sesuai indikasi"], ["ins_apd", "APD sesuai paparan"], ["ins_hh", "Kebersihan tangan"], ["ins_steril", "Teknik steril"], ["ins_balon", "Pengisian balon 10ml air steril"], ["ins_fiksasi", "Fiksasi kateter plester"]],
    detailInd: [["main_hh", "Kebersihan tangan"], ["main_pemeliharaan", "Pemeliharaan kateter rutin"], ["main_pelepasan", "Pelepasan segera bila tak ada indikasi"]] },
  { key: "phlebitis", label: "Phlebitis — IV Perifer", dateLabel: "Tgl Pemasangan IV",
    headerTitle: "Insersi (Saat Pemasangan)", detailTitle: "Maintenance (Tiap Hari)",
    extra: [["lokasi_insersi", "Lokasi Insersi"]],
    headerInd: [["ins_hh", "Kebersihan tangan"], ["ins_apd", "APD sesuai indikasi"], ["ins_lokasi", "Pilih lokasi minim risiko"], ["ins_disinfeksi", "Disinfeksi area insersi"], ["ins_dressing", "Transparan dressing"], ["ins_label", "Label tgl & jam pemasangan"]],
    detailInd: [["main_hh", "Kebersihan tangan"], ["main_apd", "APD sesuai indikasi"], ["main_ganti_kateter", "Ganti kateter IV bila ada indikasi"]] },
  { key: "vap", label: "VAP — Ventilator (ETT)", dateLabel: "Tgl Pemasangan ETT",
    headerTitle: "Insersi (Saat Pemasangan)", detailTitle: "Maintenance (Tiap Hari)",
    headerInd: [["ins_hh", "Kebersihan tangan"], ["ins_apd", "APD sesuai paparan"], ["ins_steril", "Teknik steril intubasi/manipulasi ETT"]],
    detailInd: [["main_hh", "Kebersihan tangan"], ["main_apd", "APD sesuai paparan"], ["main_posisi", "Posisi kepala 30-45 derajat"], ["main_oralhygiene", "Oral hygiene rutin"], ["main_sekresi", "Manajemen sekresi oropharingeal/endotrakeal"], ["main_profilaksis", "Profilaksis peptic ulcer/DVT"], ["main_sedasi", "Sedation vacation (weaning)"]] },
  { key: "ido", label: "IDO — Daerah Operasi (Ruang Rawat)", dateLabel: "Tgl Operasi",
    headerTitle: "Pre Operatif (Sebelum Operasi)", detailTitle: "Post Operatif (Tiap Hari)",
    headerInd: [["pre_mandi", "Mandi antiseptik pre-op"], ["pre_hh", "Kebersihan tangan"], ["pre_cukur", "Tidak cukur rambut (kec. ganggu)"], ["pre_suhu", "Suhu tubuh di bawah 38 C"], ["pre_gula", "Gula darah di bawah 200 mg/dl"], ["pre_antibiotik", "Antibiotik profilaksis 1 jam pra-insisi"]],
    detailInd: [["post_perawatan", "Perawatan luka teknik steril/aseptik"], ["post_hh", "Kebersihan tangan"], ["post_penutupan", "Penutupan luka 48 jam (kec. rembes/kotor)"]] },
  { key: "ido_ok", label: "Audit IDO — Peri Operatif (Kamar Operasi)", dateLabel: "Tgl Operasi",
    headerTitle: "Peri Operatif (Saat Operasi)", flat: true,
    headerInd: [["peri_hh", "Kebersihan tangan"], ["peri_apd", "APD sesuai pajanan"], ["peri_antiseptik", "Antiseptik kulit (alkohol 70%/iodine 2%/chlorhexidine 2-4%)"], ["peri_suhu_ruang", "Temperatur ruang 19-24 C & lembab 40-60%"], ["peri_normothermia", "Pertahankan suhu tubuh (normothermia)"]] },
];
function todayISOb() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dmyb(s: string) { if (!s) return ""; const p = s.slice(0, 10).split("-"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : s; }
function pctPatuh(row: BundleRow, cols: BIndic[]) {
  let ya = 0, app = 0;
  for (const [c] of cols) { const v = (row[c] || "").toUpperCase(); if (!v || v === "NA") continue; app++; if (v === "YA") ya++; }
  return app === 0 ? "-" : `${Math.round((ya / app) * 100)} %`;
}

function BundlePpiTab({ noRawat }: { noRawat: string }) {
  const [bundleKey, setBundleKey] = useState("iad");
  const cfg = BUNDLES_PPI.find(b => b.key === bundleKey)!;
  const [section, setSection] = useState<"header" | "detail">("header");
  const [headers, setHeaders] = useState<BundleRow[]>([]);
  const [details, setDetails] = useState<BundleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  // form header
  const [hTgl, setHTgl] = useState(todayISOb());
  const [hExtra, setHExtra] = useState<Record<string, string>>({});
  const [hInd, setHInd] = useState<Record<string, string>>({});
  // form detail
  const [dHeaderTgl, setDHeaderTgl] = useState("");
  const [dTanggal, setDTanggal] = useState(todayISOb());
  const [dInd, setDInd] = useState<Record<string, string>>({});

  const initInd = useCallback((inds: BIndic[]) => Object.fromEntries(inds.map(([c]) => [c, "Ya"])), []);
  const sec = cfg.flat ? "header" : section;

  const load = useCallback(() => {
    if (!noRawat) return;
    setLoading(true); setErr("");
    const jobs: Promise<unknown>[] = [
      enakesBundleHeader(bundleKey, noRawat).then(r => setHeaders(r.data.rows || [])).catch((e) => setErr(String(e?.message || e))),
    ];
    if (!cfg.flat) jobs.push(enakesBundleDetail(bundleKey, noRawat).then(r => setDetails(r.data.rows || [])).catch(() => setDetails([])));
    else setDetails([]);
    Promise.all(jobs).finally(() => setLoading(false));
  }, [noRawat, bundleKey, cfg.flat]);

  useEffect(() => { load(); }, [load]);
  // reset form saat ganti bundle
  useEffect(() => {
    setSection("header"); setHTgl(todayISOb()); setHExtra({}); setHInd(initInd(cfg.headerInd));
    setDHeaderTgl(""); setDTanggal(todayISOb()); setDInd(initInd(cfg.detailInd || [])); setMsg(""); setErr("");
  }, [bundleKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const newHeader = () => { setHTgl(todayISOb()); setHExtra({}); setHInd(initInd(cfg.headerInd)); setMsg(""); };
  const newDetail = () => { setDTanggal(todayISOb()); setDInd(initInd(cfg.detailInd || [])); setMsg(""); };

  const saveHeader = async () => {
    setErr(""); setMsg("");
    try {
      await enakesBundleHeaderSave({ bundle: bundleKey, no_rawat: noRawat, tgl: hTgl, data: { ...hExtra, ...hInd } });
      setMsg("Tersimpan."); newHeader(); load();
    } catch (e: unknown) { setErr(String((e as Error)?.message || e)); }
  };
  const delHeader = async (tgl: string) => {
    if (!confirm(`Hapus data ${cfg.headerTitle} tgl ${dmyb(tgl)}?`)) return;
    setErr("");
    try { await enakesBundleHeaderHapus({ bundle: bundleKey, no_rawat: noRawat, tgl }); load(); }
    catch (e: unknown) { setErr(String((e as Error)?.message || e)); }
  };
  const editHeader = (r: BundleRow) => {
    setHTgl((r.tgl || "").slice(0, 10));
    setHExtra(Object.fromEntries((cfg.extra || []).map(([c]) => [c, r[c] || ""])));
    setHInd(Object.fromEntries(cfg.headerInd.map(([c]) => [c, r[c] || "NA"])));
    setMsg("Memuat data untuk diubah — klik Simpan untuk menimpa.");
  };

  const saveDetail = async () => {
    setErr(""); setMsg("");
    if (!dHeaderTgl) { setErr(`Pilih dulu ${cfg.dateLabel} (dari daftar ${cfg.headerTitle}).`); return; }
    try {
      await enakesBundleDetailSave({ bundle: bundleKey, no_rawat: noRawat, tgl: dHeaderTgl, tanggal: dTanggal, data: dInd });
      setMsg("Tersimpan."); newDetail(); load();
    } catch (e: unknown) { setErr(String((e as Error)?.message || e)); }
  };
  const delDetail = async (r: BundleRow) => {
    if (!confirm(`Hapus data harian tgl ${dmyb(r.tanggal)}?`)) return;
    setErr("");
    try { await enakesBundleDetailHapus({ bundle: bundleKey, no_rawat: noRawat, tgl: (r.tgl || "").slice(0, 10), tanggal: (r.tanggal || "").slice(0, 10) }); load(); }
    catch (e: unknown) { setErr(String((e as Error)?.message || e)); }
  };
  const editDetail = (r: BundleRow) => {
    setDHeaderTgl((r.tgl || "").slice(0, 10)); setDTanggal((r.tanggal || "").slice(0, 10));
    setDInd(Object.fromEntries((cfg.detailInd || []).map(([c]) => [c, r[c] || "NA"])));
    setMsg("Memuat data untuk diubah — klik Simpan untuk menimpa.");
  };

  const inp = "w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm";
  const YN = ({ val, on }: { val: string; on: (v: string) => void }) => (
    <select value={val} onChange={e => on(e.target.value)} className="border border-slate-300 rounded-lg px-2 py-1 text-sm">
      <option>Ya</option><option>Tidak</option><option>NA</option>
    </select>
  );
  const headerDates = Array.from(new Set(headers.map(h => (h.tgl || "").slice(0, 10)).filter(Boolean)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500">Bundle:</span>
        <select value={bundleKey} onChange={e => setBundleKey(e.target.value)} className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold">
          {BUNDLES_PPI.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>
        {loading && <span className="text-xs text-slate-400">memuat…</span>}
      </div>

      {!cfg.flat && (
        <div className="flex gap-1 border-b border-slate-200">
          {(["header", "detail"] as const).map(s => (
            <button key={s} onClick={() => setSection(s)}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 ${sec === s ? "text-rose-700 border-rose-600" : "text-slate-500 border-transparent"}`}>
              {s === "header" ? cfg.headerTitle : cfg.detailTitle}
            </button>
          ))}
        </div>
      )}

      {err && <div className="text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg px-3 py-2">{err}</div>}
      {msg && <div className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-2">{msg}</div>}

      {sec === "header" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-white">
            <div className="text-xs font-bold text-slate-600">{cfg.headerTitle}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">{cfg.flat ? cfg.dateLabel : cfg.dateLabel}
                <input type="date" value={hTgl} onChange={e => setHTgl(e.target.value)} className={inp} /></label>
              {(cfg.extra || []).map(([c, l]) => (
                <label key={c} className="text-xs text-slate-600">{l}
                  <input value={hExtra[c] || ""} onChange={e => setHExtra({ ...hExtra, [c]: e.target.value })} className={inp} /></label>
              ))}
            </div>
            <div className="space-y-1">
              {cfg.headerInd.map(([c, l], i) => (
                <div key={c} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
                  <span className="text-xs text-slate-700">{i + 1}. {l}</span>
                  <YN val={hInd[c] || "Ya"} on={v => setHInd({ ...hInd, [c]: v })} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveHeader} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm font-semibold">Simpan</button>
              <button onClick={newHeader} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm">Baru</button>
            </div>
          </div>
          <BundleList rows={headers} cols={cfg.headerInd} extra={cfg.extra} dateKey="tgl" dateLabel={cfg.dateLabel}
            onEdit={editHeader} onDel={r => delHeader((r.tgl || "").slice(0, 10))} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-white">
            <div className="text-xs font-bold text-slate-600">{cfg.detailTitle}</div>
            {headerDates.length === 0 ? (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Isi data {cfg.headerTitle} dulu sebelum input harian.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-600">{cfg.dateLabel}
                    <select value={dHeaderTgl} onChange={e => setDHeaderTgl(e.target.value)} className={inp}>
                      <option value="">— pilih —</option>
                      {headerDates.map(t => <option key={t} value={t}>{dmyb(t)}</option>)}
                    </select></label>
                  <label className="text-xs text-slate-600">Tgl Monitoring (harian)
                    <input type="date" value={dTanggal} onChange={e => setDTanggal(e.target.value)} className={inp} /></label>
                </div>
                <div className="space-y-1">
                  {(cfg.detailInd || []).map(([c, l], i) => (
                    <div key={c} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
                      <span className="text-xs text-slate-700">{i + 1}. {l}</span>
                      <YN val={dInd[c] || "Ya"} on={v => setDInd({ ...dInd, [c]: v })} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={saveDetail} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm font-semibold">Simpan</button>
                  <button onClick={newDetail} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm">Baru</button>
                </div>
              </>
            )}
          </div>
          <BundleList rows={details} cols={cfg.detailInd || []} dateKey="tanggal" dateLabel="Tgl Monitoring" extraDateKey="tgl" extraDateLabel={cfg.dateLabel}
            onEdit={editDetail} onDel={delDetail} />
        </div>
      )}
    </div>
  );
}

function BundleList({ rows, cols, extra, dateKey, dateLabel, extraDateKey, extraDateLabel, onEdit, onDel }: {
  rows: BundleRow[]; cols: BIndic[]; extra?: BIndic[]; dateKey: string; dateLabel: string;
  extraDateKey?: string; extraDateLabel?: string; onEdit: (r: BundleRow) => void; onDel: (r: BundleRow) => void;
}) {
  if (rows.length === 0) return <div className="text-xs text-slate-400 px-1">Belum ada data.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border border-slate-200 rounded-lg">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-2 py-1.5 text-left font-semibold">{dateLabel}</th>
            {extraDateKey && <th className="px-2 py-1.5 text-left font-semibold">{extraDateLabel}</th>}
            {(extra || []).map(([c, l]) => <th key={c} className="px-2 py-1.5 text-left font-semibold">{l}</th>)}
            {cols.map(([c, l]) => <th key={c} className="px-2 py-1.5 text-center font-semibold" title={l}>{l.length > 14 ? l.slice(0, 13) + "…" : l}</th>)}
            <th className="px-2 py-1.5 text-center font-semibold">Patuh%</th>
            <th className="px-2 py-1.5 text-left font-semibold">Petugas</th>
            <th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-2 py-1.5 whitespace-nowrap">{dmyb(r[dateKey])}</td>
              {extraDateKey && <td className="px-2 py-1.5 whitespace-nowrap">{dmyb(r[extraDateKey])}</td>}
              {(extra || []).map(([c]) => <td key={c} className="px-2 py-1.5">{r[c]}</td>)}
              {cols.map(([c]) => <td key={c} className="px-2 py-1.5 text-center">{r[c]}</td>)}
              <td className="px-2 py-1.5 text-center font-semibold">{pctPatuh(r, cols)}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">{r.nm_petugas}</td>
              <td className="px-2 py-1.5 whitespace-nowrap text-right">
                <button onClick={() => onEdit(r)} className="text-emerald-700 hover:underline mr-2">Ubah</button>
                <button onClick={() => onDel(r)} className="text-rose-600 hover:underline">Hapus</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
