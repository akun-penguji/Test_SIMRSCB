"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  getPermRegistry, getPermUsers, getUserPerms, setUserPerms,
  PermEntry, PermUser,
} from "@/lib/api";

export default function PermissionsPage() {
  const [registry, setRegistry] = useState<PermEntry[]>([]);
  const [users, setUsers]       = useState<PermUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [errMsg, setErrMsg]     = useState("");
  const [okMsg, setOkMsg]       = useState("");

  // Selected user state
  const [selectedNip, setSelectedNip] = useState<string>("");
  const [searchUser, setSearchUser]   = useState("");
  const [userPerms, setUserPermsState] = useState<Record<string, boolean>>({});
  const [origPerms, setOrigPerms]      = useState<Record<string, boolean>>({});

  // ── Load registry + users ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([getPermRegistry(), getPermUsers()])
      .then(([reg, us]) => {
        setRegistry(reg.data.registry);
        setUsers(us.data.users);
      })
      .catch(e => setErrMsg(e?.response?.data?.error || "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, []);

  // ── Filter users by search ────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = searchUser.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.nip.toLowerCase().includes(q) || u.nama.toLowerCase().includes(q)
    );
  }, [users, searchUser]);

  // ── Load user perms when selected ─────────────────────────────────────────
  const loadUserPerms = useCallback((nip: string) => {
    setSelectedNip(nip);
    setErrMsg(""); setOkMsg("");
    getUserPerms(nip).then(r => {
      const m: Record<string, boolean> = {};
      r.data.perms.forEach(p => { m[p.perm_key] = p.enabled === 1; });
      setUserPermsState(m);
      setOrigPerms({ ...m });
    }).catch(() => setErrMsg("Gagal memuat permission user"));
  }, []);

  const toggle = (key: string) => {
    setUserPermsState(p => ({ ...p, [key]: !p[key] }));
  };

  const dirty = useMemo(() => {
    if (!selectedNip) return false;
    const keys = new Set([...Object.keys(userPerms), ...Object.keys(origPerms)]);
    for (const k of keys) {
      if (!!userPerms[k] !== !!origPerms[k]) return true;
    }
    return false;
  }, [userPerms, origPerms, selectedNip]);

  const save = async () => {
    if (!selectedNip) return;
    setErrMsg(""); setOkMsg("");
    try {
      const res = await setUserPerms(selectedNip, userPerms);
      setOkMsg(`✔ ${res.data.count_enabled} permission aktif tersimpan untuk ${selectedNip}`);
      setOrigPerms({ ...userPerms });
      setTimeout(() => setOkMsg(""), 3000);
    } catch (e: any) {
      setErrMsg(e?.response?.data?.error || "Gagal menyimpan");
    }
  };

  const grantAll = () => {
    const m: Record<string, boolean> = {};
    registry.forEach(p => { m[p.key] = true; });
    setUserPermsState(m);
  };
  const revokeAll = () => setUserPermsState({});

  // ── Group registry by kategori ────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const m: Record<string, PermEntry[]> = {};
    registry.forEach(p => { (m[p.kategori] ||= []).push(p); });
    return m;
  }, [registry]);

  const selectedUser = users.find(u => u.nip === selectedNip);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <nav className="text-sm mb-4">
        <Link href="/pengaturan" className="text-indigo-600 hover:underline">← Pengaturan</Link>
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Manajemen Permission Web</h1>
        <p className="text-sm text-slate-600 mt-1">
          Atur hak akses fitur web (SIRS / KB / Akreditasi / Log Kinerja) per user. Permission Khanza (registrasi/kasir/dst.) tetap dikelola dari aplikasi desktop.
          Hanya <strong>Admin Utama</strong> yang bisa mengakses halaman ini.
        </p>
      </header>

      {errMsg && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded p-3 mb-3">{errMsg}</div>}
      {okMsg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded p-3 mb-3">{okMsg}</div>}

      {loading ? <div className="text-slate-500 text-sm">Memuat...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* ── User list ── */}
          <aside className="md:col-span-4 border border-slate-200 rounded bg-white">
            <div className="p-3 border-b border-slate-200">
              <input type="text" value={searchUser} placeholder="Cari NIP / nama..."
                onChange={e => setSearchUser(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" />
              <div className="text-xs text-slate-500 mt-1">{filteredUsers.length} dari {users.length} user</div>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">Tidak ada user cocok</div>
              ) : filteredUsers.map(u => (
                <button key={u.nip} onClick={() => loadUserPerms(u.nip)}
                  className={`w-full text-left px-3 py-2 border-b border-slate-100 hover:bg-slate-50 ${selectedNip === u.nip ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`}>
                  <div className="font-semibold text-sm text-slate-900">{u.nama || "(tanpa nama)"}</div>
                  <div className="text-xs text-slate-500 font-mono">{u.nip}</div>
                </button>
              ))}
            </div>
          </aside>

          {/* ── Permission matrix ── */}
          <div className="md:col-span-8">
            {!selectedNip ? (
              <div className="border-2 border-dashed border-slate-300 rounded p-10 text-center text-slate-400">
                ← Pilih user di kiri untuk mengatur permission
              </div>
            ) : (
              <div className="border border-slate-200 rounded bg-white">
                <div className="p-4 border-b border-slate-200 flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs text-slate-500">Mengatur permission untuk</div>
                    <div className="text-lg font-bold text-slate-900">{selectedUser?.nama || "?"}</div>
                    <div className="text-xs text-slate-600 font-mono">{selectedNip}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={revokeAll}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1 rounded border border-slate-300">Revoke All</button>
                    <button onClick={grantAll}
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs px-3 py-1 rounded border border-emerald-300">Grant All</button>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {Object.entries(byCategory).map(([kat, perms]) => (
                    <div key={kat} className="border border-slate-200 rounded">
                      <div className="bg-slate-100 px-3 py-2 font-semibold text-slate-900 text-sm">
                        {kat} <span className="text-slate-500 font-normal">({perms.filter(p => userPerms[p.key]).length}/{perms.length} aktif)</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {perms.map(p => (
                          <label key={p.key} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={!!userPerms[p.key]}
                              onChange={() => toggle(p.key)} />
                            <div className="flex-1">
                              <div className="text-sm text-slate-900">{p.label}</div>
                              <code className="text-xs text-slate-500">{p.key}</code>
                            </div>
                            {(!!userPerms[p.key]) !== (!!origPerms[p.key]) && (
                              <span className="text-xs text-amber-600">●</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                  <button onClick={() => loadUserPerms(selectedNip)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 py-2 rounded border border-slate-300">Reset</button>
                  <button onClick={save} disabled={!dirty}
                    className={`text-white text-sm px-4 py-2 rounded ${dirty ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 cursor-not-allowed"}`}>
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
