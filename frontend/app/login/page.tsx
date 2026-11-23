"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { login, getCaptcha, getSetting, SettingRS } from "@/lib/api";
import { saveSession } from "@/lib/auth";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-100">Memuat...</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [setting, setSetting] = useState<SettingRS | null>(null);
  useEffect(() => { getSetting().then(r => setSetting(r.data)).catch(() => {}); }, []);
  const [loading, setLoading] = useState(false);

  // CAPTCHA (anti-bot)
  const [captchaId, setCaptchaId] = useState("");
  const [captchaImg, setCaptchaImg] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  async function refreshCaptcha() {
    setCaptchaInput("");
    try {
      const r = await getCaptcha();
      setCaptchaId(r.data.id);
      setCaptchaImg(r.data.image);
    } catch { setCaptchaImg(""); }
  }
  useEffect(() => { refreshCaptcha(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(username, password, captchaId, captchaInput);
      saveSession(res.data);
      const next = searchParams.get("next");
      // Hanya izinkan path relatif internal (anti open-redirect)
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.push(safeNext);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Login gagal";
      setError(msg);
      // Captcha bersifat one-time — selalu muat ulang setelah gagal.
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      {/* Wallpaper */}
      <Image
        src="/wallpaper-hospital.jpg"
        alt="wallpaper"
        fill
        className="object-cover"
        priority
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden">
          {/* Header hijau */}
          <div className="bg-green-700 px-8 pt-8 pb-6 flex flex-col items-center">
            <div className="bg-white rounded-2xl px-5 py-3 shadow-lg mb-4">
              <Image
                src="/logo-rs.png"
                alt={`Logo ${setting?.nama_instansi ?? "Rumah Sakit"}`}
                width={180}
                height={60}
                className="object-contain"
              />
            </div>
            <h1 className="text-white text-lg font-bold text-center leading-tight">
              Sistem Informasi Manajemen RS
            </h1>
            <p className="text-green-200 text-sm text-center mt-0.5">
              {setting?.nama_instansi ?? "Rumah Sakit"}
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ID User */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  ID User
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                               bg-slate-50 hover:bg-white transition-colors placeholder:text-slate-400"
                    placeholder="Masukkan ID User"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                               bg-slate-50 hover:bg-white transition-colors placeholder:text-slate-400"
                    placeholder="Masukkan password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* CAPTCHA */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Kode Keamanan
                </label>
                <div className="flex items-center gap-2 mb-2">
                  {captchaImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={captchaImg} alt="captcha" className="h-16 rounded-lg border border-slate-200 bg-white select-none" draggable={false} />
                  ) : (
                    <div className="h-16 w-[180px] rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-xs text-slate-400">memuat…</div>
                  )}
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    title="Muat ulang kode"
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm tracking-widest
                             focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                             bg-slate-50 hover:bg-white transition-colors placeholder:text-slate-400"
                  placeholder="Ketik kode pada gambar"
                  autoComplete="off"
                  required
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-700 hover:bg-green-800 active:bg-green-900 disabled:bg-green-400
                           text-white font-semibold py-2.5 rounded-xl transition-all duration-150
                           shadow-md shadow-green-200 hover:shadow-lg
                           flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Memproses...
                  </>
                ) : (
                  "Masuk"
                )}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-6">
              &copy; {new Date().getFullYear()} {setting?.nama_instansi ?? "Rumah Sakit"}
              {setting?.kabupaten ? ` — ${setting.kabupaten}` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
