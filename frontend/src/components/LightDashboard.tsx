"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Droplets, Thermometer, Leaf, Wifi, WifiOff, Search, Wind, Gauge, MapPin, Moon, LogOut, ArrowLeft } from "lucide-react";
import Terminal from "@/components/Terminal";
import type { DashboardProps } from "@/types/dashboard";
import { getAuthHeaders } from "@/utils/auth";
import { resilientFetch } from "@/utils/api";
import { useRouter } from "next/navigation";

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`backdrop-blur-lg border shadow-lg overflow-hidden ${className}`}
    style={{ background: "rgba(255,248,220,0.22)", borderColor: "rgba(255,255,255,0.30)" }}
  >
    {children}
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="text-xs tracking-widest uppercase px-5 py-3.5 border-b font-semibold"
    style={{ color: "#78350F", borderColor: "rgba(69,26,3,0.12)" }}
  >
    {children}
  </h2>
);

export default function LightDashboard({
  API, weather, error, lastUpdated, isRefreshing,
  location, setLocation, fetchWeather,
  cropList, selectedCropId, handleCropSelect, activeCrop,
  wsConnected, telemetry, threshold, setThreshold, 
  humThreshold, setHumThreshold, luxThreshold, setLuxThreshold,
  isAdmin, selectedUserId, setSelectedUserId, targetNode,
}: DashboardProps) {
  const router = useRouter();

  const handleLogout = () => {
    document.cookie = "auth_token=; path=/; max-age=0; SameSite=Lax";
    router.refresh();
    router.push("/login");
  };

  return (
    <main className="min-h-screen p-8 lg:p-24 relative overflow-y-auto">

      {}
      <div className="fixed inset-0 -z-20">
        <div className="absolute inset-0" style={{ background: "rgba(255,248,210,0.45)" }} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.15]">
          <div className="relative w-[300px] h-[300px] md:w-[500px] md:h-[500px]">
            <Image
              src="/saffines-logo.jpg"
              alt="Saffine Watermark"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </div>

      {}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6 relative z-10"
      >
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 lg:w-16 lg:h-16 overflow-hidden rounded-full border border-amber-900/10 shadow-md">
            <Image
              src="/saffines-logo.jpg"
              alt="Saffine Logo"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="text-4xl lg:text-6xl font-serif drop-shadow-sm" style={{ color: "#451A03" }}>
              Saffine
            </h1>
            <div className="flex gap-4 items-center mt-2 font-sans text-xs tracking-widest uppercase">
              <div className="flex items-center gap-1.5" style={{ opacity: 0.65, color: "#451A03" }}>
                {wsConnected
                  ? <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                  : <div className="w-2 h-2 rounded-full bg-red-600" />}
                <span>{wsConnected ? "System Online" : "System Offline"}</span>
              </div>
              <div className="flex items-center gap-1.5 pl-4" style={{ opacity: 0.65, color: "#451A03", borderLeft: "1px solid rgba(69,26,3,0.3)" }}>
                {telemetry.connected_to_pi
                  ? <Wifi size={14} className="text-green-600" />
                  : <WifiOff size={14} className="text-red-600" />}
                <span>{telemetry.connected_to_pi ? "Hardware Synced" : "Hardware Disconnected"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          {isAdmin && selectedUserId && setSelectedUserId && (
            <button
              onClick={() => setSelectedUserId("")}
              className="flex items-center gap-2 px-3 py-2 backdrop-blur-sm transition-colors hover:bg-black/5"
              style={{ border: "1px solid rgba(69,26,3,0.25)", background: "rgba(255,248,210,0.45)" }}
            >
              <ArrowLeft size={14} style={{ color: "#B45309" }} className="shrink-0" />
              <span className="font-sans text-[10px] font-bold tracking-widest uppercase" style={{ color: "#451A03" }}>Back to Farmers</span>
            </button>
          )}

          <div
            className="flex items-center gap-2 px-3 py-2 backdrop-blur-sm"
            style={{ border: "1px solid rgba(69,26,3,0.25)", background: "rgba(255,248,210,0.45)" }}
          >
            <Leaf size={14} style={{ color: "#B45309" }} className="shrink-0" />
            <select
              value={selectedCropId}
              onChange={handleCropSelect}
              className="bg-transparent font-serif italic text-base focus:outline-none appearance-none cursor-pointer pr-2 min-w-[180px]"
              style={{ color: "#451A03" }}
            >
              <option value="" className="bg-[#FEF3C7] text-[#451A03]">Select Crop Profile</option>
              {cropList.map(c => (
                <option key={c.id} value={c.id} className="bg-[#FEF3C7] text-[#451A03]">{c.name}</option>
              ))}
            </select>
            <svg className="w-3 h-3 shrink-0 pointer-events-none" style={{ color: "#B45309" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {}
          <div
            className="flex items-center gap-2 px-3 py-2 backdrop-blur-sm"
            style={{ border: "1px solid rgba(69,26,3,0.25)", background: "rgba(255,248,210,0.45)" }}
          >
            <Search size={14} style={{ color: "#B45309" }} className="shrink-0" />
            <input
              type="text"
              placeholder="Global location..."
              value={location}
              onChange={e => setLocation(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchWeather(location)}
              className="bg-transparent text-sm focus:outline-none w-44 placeholder:opacity-40"
              style={{ color: "#451A03" }}
            />
            {location && (
              <button onClick={() => fetchWeather(location)} className="shrink-0" style={{ color: "#B45309" }}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>

          {}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold tracking-widest uppercase transition-all bg-red-100 text-red-600 hover:bg-red-500 hover:text-white border border-red-200"
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      </motion.header>

      {}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mb-8 text-sm font-sans tracking-wide px-4 py-3 border-l-2"
            style={{ background: "rgba(220,38,38,0.08)", color: "#DC2626", borderColor: "#DC2626" }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">

        {}
        <div className="lg:col-span-3 flex flex-col gap-8">

          <GlassCard>
            <div className="px-5 py-3.5 border-b" style={{ borderColor: "rgba(69,26,3,0.12)" }}>
              <h2 className="text-xs tracking-widest uppercase font-semibold" style={{ color: "#78350F" }}>Indoor Readings</h2>
              <p className="text-[10px] mt-0.5" style={{ color: "#78350F", opacity: 0.45 }}>Live from Pi sensors</p>
            </div>
            <div className="divide-y divide-amber-900/10">
              {[
                { icon: <Thermometer style={{ color: "#B45309" }} size={22} />, label: "Indoor Temperature", value: `${telemetry.indoor_temp}°C` },
                { icon: <Droplets style={{ color: "#60A5FA" }} size={22} />, label: "Indoor Humidity",    value: `${telemetry.humidity_local}%` },
                { icon: <Sun style={{ color: "#F59E0B" }} size={22} />,        label: "Lux / Light Index", value: String(telemetry.sunlight) },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-4 px-5 py-4">
                  <span className="mt-1">{icon}</span>
                  <div>
                    <p className="text-3xl font-serif" style={{ color: "#451A03" }}>{value}</p>
                    <p className="text-xs tracking-widest uppercase mt-0.5 font-semibold" style={{ color: "#78350F", opacity: 0.6 }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <SectionLabel>Appliances</SectionLabel>
            <div className="divide-y divide-amber-900/10">
              {[
                { label: "AC Unit",     key: "ac",          status: telemetry.ac_status,        color: "#B45309" },
                { label: "Humidifier",  key: "humidifier",  status: telemetry.humidifier_status, color: "#7C3AED" },
                { label: "Exhaust Fan", key: "exhaust",     status: telemetry.exhaust_status,    color: "#0891B2" },
                { label: "UV Light",    key: "uv_light",    status: telemetry.uv_light_status,   color: "#7C3AED" },
              ].map(({ label, key, status, color }) => {
                const isOn = status === "ON";
                const toggle = async () => {
                  const newState = isOn ? "OFF" : "ON";
                  try {
                    await resilientFetch(`${API}/api/command?device=${key}&state=${newState}`, { method: "POST", headers: getAuthHeaders() });
                  } catch (e) { console.error(e); }
                };
                return (
                  <div key={key} className="flex justify-between items-center px-5 py-4">
                    <div>
                      <p className="tracking-wide font-medium" style={{ color: "#451A03" }}>{label}</p>
                      <p className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: "#78350F", opacity: 0.45 }}>
                        {isOn ? "● Active" : "○ Standby"}
                      </p>
                    </div>
                    <button onClick={toggle} className="flex items-center gap-2 group">
                      <span className="text-[10px] tracking-widest uppercase group-hover:opacity-70 transition-opacity" style={{ color: "#78350F", opacity: 0.5 }}>
                        {isOn ? "ON" : "OFF"}
                      </span>
                      <div
                        className="relative w-11 h-6 rounded-full transition-all duration-300"
                        style={{ background: isOn ? color : "rgba(69,26,3,0.12)" }}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 rounded-full shadow-md transition-all duration-300 ${isOn ? "left-6" : "left-1"}`}
                          style={{ background: isOn ? "white" : "#78350F", opacity: isOn ? 1 : 0.5 }}
                        />
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>

        {}
        <div className="lg:col-span-9 flex flex-col gap-10">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {}
            <GlassCard>
              <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "rgba(69,26,3,0.12)" }}>
                <h2 className="text-xs tracking-widest uppercase font-semibold" style={{ color: "#78350F" }}>External Conditions</h2>
                {weather && (
                  <button
                    onClick={() => fetchWeather(location)}
                    className="text-xs tracking-widest uppercase px-3 py-1 transition-opacity hover:opacity-100"
                    style={{ color: "#B45309", opacity: isRefreshing ? 1 : 0.6, border: "1px solid rgba(180,83,9,0.35)" }}
                  >
                    {isRefreshing ? <span className="animate-pulse">Refreshing...</span> : "↻ Refresh"}
                  </button>
                )}
              </div>
              {weather ? (
                <div className="p-5">
                  <div className="mb-4">
                    <p className="text-5xl font-serif font-black" style={{ color: "#451A03" }}>{weather.temp.toFixed(1)}°C</p>
                    <p className="font-semibold mt-1 flex items-center gap-1" style={{ color: "#B45309" }}>
                      <MapPin size={14} />{weather.location}
                    </p>
                    {lastUpdated && <p className="text-xs mt-0.5" style={{ color: "#78350F", opacity: 0.45 }}>Updated {lastUpdated}</p>}
                  </div>
                  <div className="space-y-2">
                    {[
                      { icon: <Droplets size={14} />, label: "Humidity", value: `${weather.humidity}%` },
                      { icon: <Wind size={14} />, label: "Wind Speed", value: `${weather.wind_speed} m/s` },
                      { icon: <Gauge size={14} />, label: "Pressure", value: `${weather.pressure} hPa` },
                      { icon: <Sun size={14} />, label: "External Light", value: `${weather.external_lux.toLocaleString()} lux` },
                    ].map(({ icon, label, value }) => (
                      <div key={label} className="flex justify-between items-center text-sm px-3 py-2" style={{ background: "rgba(180,83,9,0.07)", color: "#451A03" }}>
                        <span className="flex items-center gap-2" style={{ color: "#78350F" }}>
                          <span style={{ color: "#B45309" }}>{icon}</span>{label}
                        </span>
                        <span className="font-bold">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-12 flex flex-col items-center justify-center gap-3 text-center">
                  <MapPin size={48} style={{ color: "#B45309", opacity: 0.25 }} />
                  <p className="font-serif italic text-xl" style={{ color: "#78350F", opacity: 0.6 }}>Search a location to fetch live conditions...</p>
                </div>
              )}
            </GlassCard>

            {}
            <div className="flex flex-col gap-8">
              <GlassCard>
                <div className="px-5 py-3.5 border-b" style={{ borderColor: "rgba(69,26,3,0.12)" }}>
                  <h2 className="text-xs tracking-widest uppercase font-semibold" style={{ color: "#78350F" }}>Automation Settings</h2>
                  <p className="text-xs mt-0.5" style={{ color: "#78350F", opacity: 0.5 }}>Adjust manual thresholds. Triggers devices automatically on the Pi when conditions exceed these limits.</p>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-4 px-5 py-4 border-b" style={{ borderColor: "rgba(69,26,3,0.06)" }}>
                    <Thermometer style={{ color: "#B45309" }} size={20} />
                    <span className="text-sm font-serif" style={{ color: "#451A03" }}>AC Limit:</span>
                    <input
                      type="number"
                      value={threshold}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        setThreshold(v);
                        resilientFetch(`${API}/api/threshold?threshold=${v}`, { method: "POST", headers: getAuthHeaders() });
                      }}
                      className="w-16 text-xl font-serif font-bold bg-transparent focus:outline-none border-b text-center ml-auto"
                      style={{ color: "#B45309", borderColor: "#B45309" }}
                    />
                    <span className="text-sm font-serif" style={{ color: "#451A03" }}>°C</span>
                  </div>
                  <div className="flex items-center gap-4 px-5 py-4 border-b" style={{ borderColor: "rgba(69,26,3,0.06)" }}>
                    <Droplets style={{ color: "#7C3AED" }} size={20} />
                    <span className="text-sm font-serif" style={{ color: "#451A03" }}>Humidifier:</span>
                    <input
                      type="number"
                      value={humThreshold}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        setHumThreshold(v);
                        resilientFetch(`${API}/api/threshold/humidifier?threshold=${v}`, { method: "POST", headers: getAuthHeaders() });
                      }}
                      className="w-16 text-xl font-serif font-bold bg-transparent focus:outline-none border-b text-center ml-auto"
                      style={{ color: "#7C3AED", borderColor: "#7C3AED" }}
                    />
                    <span className="text-sm font-serif" style={{ color: "#451A03" }}>%</span>
                  </div>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <Sun style={{ color: "#D97706" }} size={20} />
                    <span className="text-sm font-serif" style={{ color: "#451A03" }}>UV Light:</span>
                    <input
                      type="number"
                      value={luxThreshold}
                      onChange={e => {
                        const v = parseInt(e.target.value);
                        setLuxThreshold(v);
                        resilientFetch(`${API}/api/threshold/uv_light?threshold=${v}`, { method: "POST", headers: getAuthHeaders() });
                      }}
                      className="w-20 text-xl font-serif font-bold bg-transparent focus:outline-none border-b text-center ml-auto"
                      style={{ color: "#D97706", borderColor: "#D97706" }}
                    />
                    <span className="text-sm font-serif" style={{ color: "#451A03" }}>lux</span>
                  </div>
                </div>
              </GlassCard>

              <AnimatePresence>
                {activeCrop && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                    <GlassCard>
                      <div className="flex justify-between items-start px-5 py-4 border-b" style={{ borderColor: "rgba(69,26,3,0.12)" }}>
                        <div>
                          <h2 className="text-xs tracking-widest uppercase font-semibold mb-1" style={{ color: "#78350F", opacity: 0.7 }}>Crop Profile</h2>
                          <h3 className="font-serif text-xl" style={{ color: "#451A03" }}>{activeCrop.name}</h3>
                        </div>
                        <Leaf style={{ color: "#B45309", opacity: 0.8 }} size={28} />
                      </div>
                      <div className="px-5 py-4 space-y-3 font-sans text-sm">
                        {[
                          { label: "Temperature", value: `${activeCrop.temp_min}° – ${activeCrop.temp_max}°C`, accent: true },
                          { label: "Humidity", value: `${activeCrop.hum_min}% – ${activeCrop.hum_max}%`, accent: false },
                          { label: "Light (Lux)", value: `${activeCrop.lux_min.toLocaleString()} – ${activeCrop.lux_max.toLocaleString()}`, accent: true },
                          { label: "Wind", value: activeCrop.wind, accent: false },
                          { label: "Photoperiod", value: activeCrop.photoperiod, accent: true },
                        ].map(({ label, value, accent }) => (
                          <div key={label} className="flex justify-between border-b pb-2" style={{ borderColor: "rgba(69,26,3,0.08)" }}>
                            <span style={{ color: "#78350F", opacity: 0.8 }}>{label}</span>
                            <span className="font-bold" style={{ color: accent ? "#B45309" : "#451A03" }}>{value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="px-5 py-3 text-xs italic border-t" style={{ color: "#78350F", opacity: 0.5, borderColor: "rgba(69,26,3,0.1)" }}>
                        AC threshold auto-synced to {activeCrop.temp_max}°C.
                      </div>
                    </GlassCard>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {}
          <GlassCard>
            <SectionLabel>Pi Command Console</SectionLabel>
            <div className="p-5">
              <Terminal apiBase={API} embedded targetNode={targetNode} />
            </div>
          </GlassCard>

        </div>
      </div>
    </main>
  );
}
