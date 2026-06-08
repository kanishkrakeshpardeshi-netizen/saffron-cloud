"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Lock, User, Server, Terminal, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [piIp, setPiIp] = useState("");
  const [piUsername, setPiUsername] = useState("");
  const [piPassword, setPiPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
      const res = await fetch(`${API}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username, password, 
          pi_ip: piIp, pi_username: piUsername, pi_password: piPassword 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Registration failed. Please check inputs.");
      }

      setSuccess("Farm registered successfully! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-y-auto bg-[#FFFBF0] py-12">
      <div className="absolute inset-0 z-0">
        <Image
          src="/stigma.png"
          alt="Saffron background"
          fill
          className="object-cover object-center opacity-30 fixed"
          quality={100}
        />
        <div className="absolute inset-0 fixed" style={{ background: "rgba(255,248,210,0.45)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="w-full max-w-xl p-8 relative z-10"
      >
        <div className="mb-10 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="flex justify-center mb-6"
          >
            <div className="relative w-20 h-20 overflow-hidden rounded-full border border-amber-900/10 shadow-[0_0_30px_rgba(226,114,3,0.15)]">
              <Image
                src="/saffines-logo.jpg"
                alt="Saffine Logo"
                fill
                className="object-cover"
              />
            </div>
          </motion.div>
          <h1 className="text-3xl font-serif text-[#451A03] drop-shadow-sm mb-2">
            Farmer <span className="text-[var(--color-saffron)] italic">Registration</span>
          </h1>
          <p className="text-xs tracking-widest uppercase opacity-60 font-sans text-[#78350F]">
            Create a new farmer node
          </p>
        </div>

        <div className="backdrop-blur-md border shadow-lg relative overflow-hidden p-8 rounded-xl" style={{ background: "rgba(255,248,220,0.65)", borderColor: "rgba(255,255,255,0.60)" }}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--color-saffron)] to-transparent opacity-50" />
          
          <form onSubmit={handleRegister} className="flex flex-col gap-6">
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-red-600 text-sm font-sans bg-red-100 p-3 border-l-2 border-red-500 rounded-md">
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-green-700 text-sm font-sans bg-green-100 p-3 border-l-2 border-green-500 rounded-md">
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] tracking-widest uppercase opacity-70 mb-2 block ml-1 text-[#451A03] font-bold">Farmer Name / Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 text-[var(--color-saffron)]" size={16} />
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-white/60 border border-[#451A03]/20 rounded-md p-3 pl-10 text-sm text-[#451A03] focus:outline-none focus:border-[var(--color-saffron)] transition-colors placeholder:text-[#451A03]/40" placeholder="e.g. farm_alpha" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] tracking-widest uppercase opacity-70 mb-2 block ml-1 text-[#451A03] font-bold">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 text-[var(--color-saffron)]" size={16} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-white/60 border border-[#451A03]/20 rounded-md p-3 pl-10 text-sm text-[#451A03] focus:outline-none focus:border-[var(--color-saffron)] transition-colors placeholder:text-[#451A03]/40" placeholder="••••••••" />
              </div>
            </div>

            {/* Optional Pi Node Config */}
            <div className="border-t border-[#451A03]/10 pt-4 mt-2">
              <h3 className="text-xs font-serif font-bold text-[#451A03]/80 uppercase tracking-wider mb-4">Pi Node Details (Optional)</h3>
              
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] tracking-widest uppercase opacity-70 mb-2 block ml-1 text-[#451A03] font-bold">Pi IP Address</label>
                  <div className="relative">
                    <Server className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 text-[var(--color-saffron)]" size={16} />
                    <input type="text" value={piIp} onChange={e => setPiIp(e.target.value)} className="w-full bg-white/60 border border-[#451A03]/20 rounded-md p-3 pl-10 text-sm text-[#451A03] focus:outline-none focus:border-[var(--color-saffron)] transition-colors placeholder:text-[#451A03]/40" placeholder="e.g. 192.168.1.100" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] tracking-widest uppercase opacity-70 mb-2 block ml-1 text-[#451A03] font-bold">Pi SSH Username</label>
                    <div className="relative">
                      <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 text-[var(--color-saffron)]" size={16} />
                      <input type="text" value={piUsername} onChange={e => setPiUsername(e.target.value)} className="w-full bg-white/60 border border-[#451A03]/20 rounded-md p-3 pl-10 text-sm text-[#451A03] focus:outline-none focus:border-[var(--color-saffron)] transition-colors placeholder:text-[#451A03]/40" placeholder="e.g. pi" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] tracking-widest uppercase opacity-70 mb-2 block ml-1 text-[#451A03] font-bold">Pi SSH Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60 text-[var(--color-saffron)]" size={16} />
                      <input type="password" value={piPassword} onChange={e => setPiPassword(e.target.value)} className="w-full bg-white/60 border border-[#451A03]/20 rounded-md p-3 pl-10 text-sm text-[#451A03] focus:outline-none focus:border-[var(--color-saffron)] transition-colors placeholder:text-[#451A03]/40" placeholder="••••••••" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="mt-6 flex items-center justify-center gap-2 w-full rounded-md bg-[var(--color-saffron)] hover:bg-[#c46200] text-white p-4 font-sans text-sm tracking-widest uppercase transition-colors disabled:opacity-50 group shadow-[0_0_20px_rgba(226,114,3,0.3)] hover:shadow-[0_0_30px_rgba(226,114,3,0.5)]">
              {loading ? "Registering..." : <>Complete Setup <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>}
            </button>
            
            <p className="text-center text-xs opacity-80 mt-4 text-[#451A03]">
              Already have an account? <Link href="/login" className="text-[var(--color-saffron)] hover:underline font-bold">Login here.</Link>
            </p>
          </form>
        </div>
      </motion.div>
    </main>
  );
}
