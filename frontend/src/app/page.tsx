"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Thermometer, Droplets, Sun, MapPin, Wifi, WifiOff, Wind, Gauge, Leaf, LogOut, Moon, ArrowLeft, Trash2, Settings, X } from "lucide-react";
import Image from "next/image";
import Terminal from "@/components/Terminal";
import LightDashboard from "@/components/LightDashboard";
import type { WeatherData, CropProfile, CropListItem, Telemetry } from "@/types/dashboard";
import { getAuthHeaders } from "@/utils/auth";
import { resilientFetch } from "@/utils/api";
import { useRouter } from "next/navigation";

function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

const API = "https://saffron-cloud.onrender.com";

export default function Home() {
  const [location, setLocation] = useState("");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cropList, setCropList] = useState<CropListItem[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string>("");
  const [activeCrop, setActiveCrop] = useState<CropProfile | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [threshold, setThreshold] = useState(25.0);
  const [humThreshold, setHumThreshold] = useState(50.0);
  const [luxThreshold, setLuxThreshold] = useState(20000);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    sunlight: 0,
    humidity_local: 0.0,
    indoor_temp: 0.0,
    ac_status: "OFF",
    humidifier_status: "OFF",
    exhaust_status: "OFF",
    uv_light_status: "OFF",
    connected_to_pi: false,
  });
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminNodes, setAdminNodes] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Edit Node Config states
  const [editingNode, setEditingNode] = useState<any>(null);
  const [editIp, setEditIp] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  const router = useRouter();

  const handleLogout = () => {
    document.cookie = "auth_token=; path=/; max-age=0; SameSite=Lax";
    router.refresh();
    router.push("/login");
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode) return;
    setSavingConfig(true);
    try {
      const res = await resilientFetch(`${API}/api/admin/users/${editingNode.owner}/pi`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ip: editIp, username: editUsername, password: editPassword }),
      });
      if (res.ok) {
        setEditingNode(null);
        fetchAdminNodes();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to update configuration");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    } finally {
      setSavingConfig(false);
    }
  };

  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);

  useEffect(() => {
    document.body.classList.add("light");
  }, []);

  const fetchAdminNodes = useCallback(() => {
    resilientFetch(`${API}/api/admin/nodes`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => setAdminNodes(data.nodes || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const match = document.cookie.match(new RegExp('(^| )auth_token=([^;]+)'));
    if (match) {
      const decoded = parseJwt(match[2]);
      if (decoded?.role === "admin") {
        setIsAdmin(true);
        fetchAdminNodes();
      }
    }
  }, [fetchAdminNodes]);

  useEffect(() => {
    resilientFetch(`${API}/api/crops`)
      .then(res => res.json())
      .then(data => setCropList(data))
      .catch(console.error);
  }, []);

  const fetchWeather = useCallback(async (loc?: string) => {
    const target = loc ?? locationRef.current;
    if (!target) return;
    setError("");
    setIsRefreshing(true);
    try {
      const res = await resilientFetch(`${API}/api/weather?location=${target}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok) {
        setWeather(data);
        setLastUpdated(new Date().toLocaleTimeString());

        // Auto-update thresholds based on searched location
        setThreshold(data.temp);
        setHumThreshold(data.humidity);
        setLuxThreshold(data.external_lux);

        resilientFetch(`${API}/api/threshold?threshold=${data.temp}`, { method: "POST", headers: getAuthHeaders() }).catch(console.error);
        resilientFetch(`${API}/api/threshold/humidifier?threshold=${data.humidity}`, { method: "POST", headers: getAuthHeaders() }).catch(console.error);
        resilientFetch(`${API}/api/threshold/uv_light?threshold=${data.external_lux}`, { method: "POST", headers: getAuthHeaders() }).catch(console.error);
      } else {
        setError(data.detail || "Failed to fetch weather.");
      }
    } catch {
      setError("Network error. Backend might be unreachable.");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (locationRef.current) fetchWeather();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const handleCropSelect = async (e: React.ChangeEvent<HTMLSelectElement> | string) => {
    const cid = typeof e === "string" ? e : e.target.value;
    setSelectedCropId(cid);
    if (!cid) { setActiveCrop(null); return; }
    try {
      const res = await resilientFetch(`${API}/api/crop/${cid}`);
      const data = await res.json();
      if (res.ok) {
        setActiveCrop(data);
        setThreshold(data.temp_max);
        setHumThreshold(data.hum_min);
        setLuxThreshold(data.lux_min);

        await resilientFetch(`${API}/api/crop/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            temp_min: data.temp_min,
            temp_max: data.temp_max,
            hum_min:  data.hum_min,
            hum_max:  data.hum_max,
            lux_min:  data.lux_min,
            lux_max:  data.lux_max,
          }),
        });
      }
    } catch (err) {
      console.error("Failed to load crop profile:", err);
    }
  };

  const handleDeviceToggle = async (device: string, currentStatus: string) => {
    const newState = currentStatus === "ON" ? "OFF" : "ON";
    try {
      await resilientFetch(`${API}/api/command?device=${device}&state=${newState}`, { 
        method: "POST", 
        headers: getAuthHeaders() 
      });
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  useEffect(() => {
    let ws: WebSocket;
    const connect = () => {
      const match = document.cookie.match(new RegExp('(^| )auth_token=([^;]+)'));
      const token = match ? match[2] : "";
      const wsUrl = API.replace(/^http/, "ws") + "/ws?token=" + token;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => { setWsConnected(false); setTimeout(connect, 3000); };
      ws.onmessage = (event) => setTelemetry(JSON.parse(event.data));
    };
    connect();
    return () => { if (ws) ws.close(); };
  }, []);

  const handleDeleteUser = async (username: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete user @${username}?`)) return;
    try {
      const res = await resilientFetch(`${API}/api/admin/users/${username}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchAdminNodes();
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete user");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  };

  const targetNode = isAdmin && selectedUserId ? adminNodes.find(n => n.owner === selectedUserId) : undefined;

  const sharedProps = {
    API,
    weather,
    error,
    lastUpdated,
    isRefreshing,
    location,
    setLocation,
    fetchWeather,
    cropList,
    selectedCropId,
    handleCropSelect,
    activeCrop,
    wsConnected,
    telemetry,
    threshold,
    setThreshold,
    humThreshold,
    setHumThreshold,
    luxThreshold,
    setLuxThreshold,
    isAdmin,
    selectedUserId,
    setSelectedUserId,
    targetNode,
  };

  if (isAdmin && !selectedUserId) {
    return (
      <main className="min-h-screen p-8 lg:p-24 relative overflow-y-auto bg-[#FFFBF0] text-[#451A03]">
        <div className="fixed inset-0 -z-20">
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

        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
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
              <h1 className="text-4xl lg:text-6xl font-serif drop-shadow-sm text-[#451A03]">
                Saffine
              </h1>
              <p className="mt-2 text-xs tracking-widest uppercase opacity-60">Admin Control Panel</p>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-current/10">
            <svg className="w-6 h-6 text-[var(--color-saffron)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            <h2 className="text-2xl font-serif">Active Farmer Nodes</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminNodes.map((node) => (
              <div 
                key={node.owner}
                onClick={() => setSelectedUserId(node.owner)}
                className="group cursor-pointer p-6 rounded-xl border border-current/10 bg-current/5 backdrop-blur-md hover:border-[var(--color-saffron)] hover:shadow-[0_0_30px_rgba(226,114,3,0.15)] transition-all flex flex-col"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-xl font-serif font-bold">@{node.owner}</h3>
                    {node.owner !== "admin" && (
                      <div className="flex gap-3 items-center mt-1">
                        <button 
                          onClick={(e) => handleDeleteUser(node.owner, e)}
                          className="text-red-500 hover:text-red-700 flex items-center gap-1 text-xs tracking-widest uppercase opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNode(node);
                            setEditIp(node.ip || "");
                            setEditUsername(node.username || "");
                            setEditPassword(node.password || "");
                          }}
                          className="text-amber-700 hover:text-amber-900 flex items-center gap-1 text-xs tracking-widest uppercase opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Settings size={12} /> Configure
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${node.online ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    <div className={`w-2 h-2 rounded-full ${node.online ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                  </div>
                </div>
                <div className="mb-4 text-sm font-sans opacity-70">
                  <p>Pi IP: <span className={`font-mono ${node.ip ? "" : "text-red-500/70 italic"}`}>{node.ip || "Not Configured"}</span></p>
                </div>
                <div className="mt-auto flex items-center justify-between text-xs tracking-widest uppercase opacity-60 group-hover:opacity-100 group-hover:text-[var(--color-saffron)] transition-colors pt-4 border-t border-current/10">
                  <span>View Dashboard</span>
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            ))}
            
            <div className="p-6 rounded-xl border-2 border-dashed border-current/20 flex flex-col items-center justify-center gap-3 opacity-50 hover:opacity-100 hover:border-[var(--color-saffron)] hover:text-[var(--color-saffron)] cursor-pointer transition-all min-h-[160px]" onClick={() => router.push('/register')}>
              <div className="w-10 h-10 rounded-full border border-current flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              </div>
              <span className="text-sm font-bold tracking-widest uppercase">New Farmer</span>
            </div>
          </div>
        </motion.div>

        {/* Configure Pi Modal */}
        <AnimatePresence>
          {editingNode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="w-full max-w-md p-6 relative border shadow-2xl rounded-xl text-[#451A03] overflow-hidden"
                style={{ background: "rgba(255,251,240,0.95)", borderColor: "rgba(69,26,3,0.15)" }}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-saffron)] to-transparent opacity-75" />
                
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-serif font-bold">Configure Node @{editingNode.owner}</h3>
                  <button 
                    onClick={() => setEditingNode(null)} 
                    className="p-1 rounded-full hover:bg-black/5 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveConfig} className="flex flex-col gap-4 font-sans">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] tracking-widest uppercase opacity-70 font-bold">Pi IP Address</label>
                    <input
                      type="text"
                      value={editIp}
                      onChange={e => setEditIp(e.target.value)}
                      placeholder="e.g. 192.168.1.100"
                      className="w-full bg-white border border-[#451A03]/20 rounded-md p-3 text-sm focus:outline-none focus:border-[var(--color-saffron)] transition-colors placeholder:opacity-30"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] tracking-widest uppercase opacity-70 font-bold">Pi SSH Username</label>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={e => setEditUsername(e.target.value)}
                      placeholder="e.g. pi"
                      className="w-full bg-white border border-[#451A03]/20 rounded-md p-3 text-sm focus:outline-none focus:border-[var(--color-saffron)] transition-colors placeholder:opacity-30"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] tracking-widest uppercase opacity-70 font-bold">Pi SSH Password</label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-[#451A03]/20 rounded-md p-3 text-sm focus:outline-none focus:border-[var(--color-saffron)] transition-colors placeholder:opacity-30"
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setEditingNode(null)}
                      className="flex-1 rounded-md border border-[#451A03]/20 p-3 text-xs tracking-widest uppercase transition-colors hover:bg-black/5 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingConfig}
                      className="flex-1 rounded-md bg-[var(--color-saffron)] hover:bg-[#c46200] text-white p-3 text-xs tracking-widest uppercase transition-colors disabled:opacity-50 font-bold shadow-md"
                    >
                      {savingConfig ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    );
  }

  return <LightDashboard {...sharedProps} />;
}
