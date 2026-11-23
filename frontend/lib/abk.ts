import { api } from "./api";

export interface AbkBebanKerja {
  id: number;
  abk_unit_id: number;
  nama_kegiatan: string;
  waktu_rata2_menit: number;
  total_kegiatan: number;
  keterangan: string;
  sbk: number;
  kebutuhan_sdm: number;
}

export interface AbkUnit {
  id: number;
  unit: string;
  kategori_sdm: string;
  tahun: number;
  jumlah_sdm_saat_ini: number;
  hari_kerja: number;
  cuti_hari: number;
  diklat_hari: number;
  libur_nasional_hari: number;
  ketidakhadiran_hari: number;
  jam_kerja_hari: number;
  ftp: number;
  keterangan: string;
  wkt: number;
  kebutuhan_sdm_abk: number;
  kekurangan: number;
  beban_kerja?: AbkBebanKerja[];
}

export interface AbkSummary {
  total_unit: number;
  kebutuhan_sdm_abk: number;
  sdm_saat_ini: number;
  kekurangan: number;
}

export interface CreateUnitPayload {
  unit: string;
  kategori_sdm: string;
  tahun?: number;
  jumlah_sdm_saat_ini?: number;
  hari_kerja?: number;
  cuti_hari?: number;
  diklat_hari?: number;
  libur_nasional_hari?: number;
  ketidakhadiran_hari?: number;
  jam_kerja_hari?: number;
  ftp?: number;
  keterangan?: string;
}

export interface CreateBebanPayload {
  nama_kegiatan: string;
  waktu_rata2_menit?: number;
  total_kegiatan?: number;
  keterangan?: string;
}

export const getAbkSummary = (tahun?: number) =>
  api
    .get<{ data: AbkSummary } | AbkSummary>(`/abk/summary${tahun ? `?tahun=${tahun}` : ""}`)
    .then((r) => {
      const d = r.data as any;
      return (d && d.data !== undefined ? d.data : d) as AbkSummary;
    });

export const getAbkUnits = (params?: { tahun?: number; keyword?: string }) => {
  const p = new URLSearchParams();
  if (params?.tahun) p.append("tahun", String(params.tahun));
  if (params?.keyword) p.append("keyword", params.keyword);
  return api
    .get<{ data: AbkUnit[] } | AbkUnit[]>(`/abk/unit?${p.toString()}`)
    .then((r) => {
      const d = r.data as any;
      if (Array.isArray(d)) return d;
      if (d && Array.isArray(d.data)) return d.data;
      return [];
    });
};

export const getAbkUnitDetail = (id: number) =>
  api.get<{ data: AbkUnit } | AbkUnit>(`/abk/unit/${id}`).then((r) => {
    const d = r.data as any;
    return (d && d.data !== undefined ? d.data : d) as AbkUnit;
  });

export const createAbkUnit = (payload: CreateUnitPayload) =>
  api.post<{ ok: boolean; id: number }>("/abk/unit", payload).then((r) => r.data);

export const updateAbkUnit = (id: number, payload: CreateUnitPayload) =>
  api.put<{ ok: boolean }>(`/abk/unit/${id}`, payload).then((r) => r.data);

export const deleteAbkUnit = (id: number) =>
  api.delete<{ ok: boolean }>(`/abk/unit/${id}`).then((r) => r.data);

export const getAbkBebanKerja = (unitId: number) =>
  api
    .get<{ data: AbkBebanKerja[] } | AbkBebanKerja[]>(`/abk/beban-kerja/unit/${unitId}`)
    .then((r) => {
      const d = r.data as any;
      if (Array.isArray(d)) return d;
      if (d && Array.isArray(d.data)) return d.data;
      return [];
    });

export const createAbkBebanKerja = (unitId: number, payload: CreateBebanPayload) =>
  api.post<{ ok: boolean; id: number }>(`/abk/beban-kerja/unit/${unitId}`, payload).then((r) => r.data);

export const updateAbkBebanKerja = (id: number, payload: CreateBebanPayload) =>
  api.put<{ ok: boolean }>(`/abk/beban-kerja/${id}`, payload).then((r) => r.data);

export const deleteAbkBebanKerja = (id: number) =>
  api.delete<{ ok: boolean }>(`/abk/beban-kerja/${id}`).then((r) => r.data);

