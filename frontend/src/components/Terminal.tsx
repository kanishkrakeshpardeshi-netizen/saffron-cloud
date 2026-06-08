"use client";
import React, { useState, useEffect, useRef } from "react";
import { Terminal as TerminalIcon, Play, Square, ShieldCheck } from "lucide-react";
import { getAuthHeaders, getAuthRole } from "@/utils/auth";
import { resilientFetch } from "@/utils/api";

interface TerminalProps {
  apiBase: string;
  embedded?: boolean;
  targetNode?: { ip: string; username: string; password?: string };
}

export default function Terminal({ apiBase, embedded = false, targetNode }: TerminalProps) {
  const [ip, setIp] = useState("172.22.157.144");
  const [username, setUsername] = useState("raspberrylocal"); 
  const [password, setPassword] = useState("");
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [output, setOutput] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("user");
  const [adminNodes, setAdminNodes] = useState<any[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (targetNode) {
      setIp(targetNode.ip);
      setUsername(targetNode.username);
      if (targetNode.password) setPassword(targetNode.password);
    }
  }, [targetNode]);

  useEffect(() => {
    const currentRole = getAuthRole();
    setRole(currentRole);
    if (currentRole === "admin") {
      resilientFetch(`${apiBase}/api/admin/nodes`, { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
          if (data.nodes) setAdminNodes(data.nodes);
        })
        .catch(console.error);
    }
  }, [apiBase]);

  const handleConnect = async () => {
    setLoading(true);
    setOutput(prev => [...prev, `Connecting to ${username}@${ip}...`]);
    try {
      const sysInfoCmd = `echo "--- SECURE UPLINK ESTABLISHED ---" && echo "Hostname: $(hostname)" && echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '"')" && echo "Kernel: $(uname -r)" && echo "Uptime: $(uptime -p)" && echo "Mem: $(free -m | awk 'NR==2{printf "%s/%sMB", $3,$2 }')" && echo "Temp: $(vcgencmd measure_temp 2>/dev/null || echo 'N/A')"`;
      const res = await resilientFetch(`${apiBase}/api/ssh/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ip, username, password, command: sysInfoCmd }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsConnected(true);
        setOutput(prev => [...prev, data.output]);
      } else {
        setOutput(prev => [...prev, `Error: ${data.detail}`]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setOutput(prev => [...prev, `Connection failed: ${msg}`]);
    }
    setLoading(false);
  };

  const handleCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!command.trim() || !isConnected) return;

    setOutput(prev => [...prev, `> ${command}`]);
    setLoading(true);
    const cmdToSend = command;
    setCommand("");
    setHistory(prev => [cmdToSend, ...prev]);
    setHistoryIndex(-1);

    try {
      const res = await resilientFetch(`${apiBase}/api/ssh/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ip, username, password, command: cmdToSend }),
      });
      const data = await res.json();
      if (res.ok) {
        setOutput(prev => [...prev, data.output]);
      } else {
        setOutput(prev => [...prev, `Error: ${data.detail}`]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setOutput(prev => [...prev, `Command failed: ${msg}`]);
    }
    setLoading(false);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setCommand(history[nextIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCommand(history[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand("");
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {}
      {!embedded && (
        <div className="flex items-center gap-2 opacity-70">
          <TerminalIcon size={18} className="text-[var(--color-saffron)]" />
          <h2 className="text-sm tracking-widest uppercase font-sans font-semibold m-0">
            Pi Command Console
          </h2>
        </div>
      )}

      {}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
        {!isConnected ? (
          <div className="flex items-center gap-3 flex-wrap bg-[var(--term-card-bg)] backdrop-blur-sm p-2 border border-[var(--color-charcoal)]/10 rounded">
            {role === "admin" ? (
              <div className="w-full flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap w-full">
                  <input
                    type="text"
                    value={ip}
                    onChange={e => setIp(e.target.value)}
                    placeholder="Pi IP Address"
                    className="bg-transparent border-b border-[var(--color-charcoal)]/30 focus:outline-none focus:border-[var(--color-saffron)] text-xs w-36 pb-1 transition-colors placeholder:opacity-40"
                    style={{ color: "var(--term-text)" }}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="User"
                    className="bg-transparent border-b border-[var(--color-charcoal)]/30 focus:outline-none focus:border-[var(--color-saffron)] text-xs w-20 pb-1 transition-colors placeholder:opacity-40"
                    style={{ color: "var(--term-text)" }}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    className="bg-transparent border-b border-[var(--color-charcoal)]/30 focus:outline-none focus:border-[var(--color-saffron)] text-xs w-24 pb-1 transition-colors placeholder:opacity-40"
                    style={{ color: "var(--term-text)" }}
                  />
                  <button
                    onClick={handleConnect}
                    disabled={loading}
                    className="bg-[var(--color-saffron)] hover:opacity-90 text-white text-[10px] font-sans uppercase tracking-widest font-bold px-4 py-1.5 rounded-sm shadow-sm transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {loading ? "Connecting..." : <><Play size={12} /> Connect</>}
                  </button>
                </div>
                
                {adminNodes.length > 0 && (
                  <div className="w-full mt-1 pt-3 border-t border-[var(--color-charcoal)]/20">
                    <span className="text-[9px] uppercase tracking-widest font-bold opacity-50 mb-2 block font-sans flex items-center gap-2" style={{ color: "var(--term-text)" }}>
                      <ShieldCheck size={12} /> Registered Farmer Nodes
                    </span>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[var(--color-saffron)]/30 scrollbar-track-transparent">
                      {adminNodes.map((node, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setIp(node.ip);
                            setUsername(node.username);
                            setPassword(node.password);
                          }}
                          className="flex flex-col text-left p-2 min-w-[130px] rounded border border-white/5 bg-black/20 hover:border-[var(--color-saffron)]/50 hover:bg-black/40 transition-all group"
                        >
                          <span className="text-xs font-bold text-white group-hover:text-[var(--color-saffron)] transition-colors">{node.owner}</span>
                          <span className={`text-[10px] font-mono mt-0.5 ${node.ip ? "opacity-60 text-white" : "text-red-400/80 italic"}`}>{node.ip || "Not Configured"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs font-sans tracking-widest opacity-70" style={{ color: "var(--term-text)" }}>
                  <ShieldCheck size={14} className="text-green-500" />
                  <span>Verified Identity</span>
                </div>
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="bg-[var(--color-saffron)] hover:opacity-90 text-white text-[10px] font-sans uppercase tracking-widest font-bold px-4 py-1.5 rounded-sm shadow-sm transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? "Connecting to Your Pi..." : <><Play size={12} /> Connect to My Pi</>}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-3 py-1.5 rounded shadow-sm" style={{ background: "rgba(0,0,0,0.5)" }}>
            <span className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-medium font-sans" style={{ color: "var(--term-text)" }}>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.7)]" />
              {role === "admin" ? `${username}@${ip}` : "Connected to Personal Pi Node"}
            </span>
            <button
              onClick={() => { setIsConnected(false); setOutput(prev => [...prev, "Disconnected."]); }}
              className="text-[9px] tracking-widest uppercase border-l border-[var(--term-text)]/40 pl-3 ml-1 transition-all font-bold flex items-center gap-1 opacity-80 hover:opacity-100"
              style={{ color: "var(--term-text)" }}
            >
              <Square size={10} /> Disconnect
            </button>
          </div>
        )}
      </div>

      {}
      {/* Console Output */}
      <div className={`bg-[var(--term-card-bg)] shadow-lg border border-[var(--color-charcoal)]/10 rounded-sm overflow-hidden flex flex-col transition-all duration-500 ${role === "admin" ? "h-[380px]" : "h-[200px]"}`}>
        <div className="p-5 overflow-y-auto flex-1 font-mono text-xs leading-relaxed selection:bg-[var(--color-saffron)] selection:text-white" style={{ color: "var(--term-text)" }}>
          {output.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40 select-none space-y-2 font-sans">
              <TerminalIcon size={28} className="stroke-1 text-[var(--color-saffron)] animate-pulse" />
              <p className="text-[11px] tracking-widest uppercase font-bold">Console Awaiting Uplink</p>
              <p className="text-[10px] italic">Enter host credentials and connect to the Raspberry Pi node.</p>
            </div>
          )}
          {output.map((line, i) => {
            const isCmd = line.startsWith("> ");
            const isErr = line.toLowerCase().includes("error:") || line.toLowerCase().includes("failed:");
            return (
              <div
                key={i}
                className={`mb-2 flex items-start font-mono ${isCmd ? "text-[var(--color-saffron)] font-semibold" : isErr ? "text-red-500" : ""}`}
              >
                {isCmd && <span className="mr-2 text-[var(--color-purple)] font-bold">➜</span>}
                <div className="flex-1 whitespace-pre-wrap">{line}</div>
              </div>
            );
          })}
          {loading && isConnected && (
            <div className="mb-2 flex items-center gap-2 text-[var(--color-saffron)]/80 font-sans text-[10px] uppercase tracking-widest font-bold italic animate-pulse">
              <div className="w-1.5 h-1.5 bg-[var(--color-saffron)] rounded-full animate-ping" />
              Executing remote routine...
            </div>
          )}
          <div ref={endRef} />
        </div>

        {isConnected && role === "admin" && (
          <div className="flex gap-2 px-4 py-2 border-t border-[var(--color-charcoal)]/10" style={{ background: "rgba(0,0,0,0.15)" }}>
            <span className="text-[9px] uppercase tracking-widest font-bold opacity-40 mr-2 self-center font-sans" style={{ color: "var(--term-text)" }}>Macros</span>
            <button onClick={() => setCommand("sudo systemctl restart saffron")} className="text-[9px] uppercase tracking-widest px-2 py-1 rounded transition-colors" style={{ background: "var(--term-macro-bg)", color: "var(--term-text)" }}>Restart Srv</button>
            <button onClick={() => setCommand("htop -b -n 1 | head -n 15")} className="text-[9px] uppercase tracking-widest px-2 py-1 rounded transition-colors" style={{ background: "var(--term-macro-bg)", color: "var(--term-text)" }}>Sys Top</button>
            <button onClick={() => setCommand("tail -n 20 /var/log/syslog")} className="text-[9px] uppercase tracking-widest px-2 py-1 rounded transition-colors" style={{ background: "var(--term-macro-bg)", color: "var(--term-text)" }}>Logs</button>
            <button onClick={() => setOutput([])} className="text-[9px] uppercase tracking-widest px-2 py-1 rounded transition-colors ml-auto text-red-400 hover:bg-red-900/30" style={{ background: "var(--term-macro-bg)" }}>Clear</button>
          </div>
        )}

        {isConnected && role === "admin" && (
          <form
            onSubmit={handleCommand}
            className="border-t border-[var(--color-charcoal)]/10 bg-[var(--term-card-bg)] flex items-center px-4 py-1 relative" style={{ color: "var(--term-text)" }}
          >
            <span className="text-[var(--color-saffron)] text-xs font-bold mr-2 font-mono select-none">$</span>
            <input
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoFocus
              className="flex-1 bg-transparent border-none outline-none py-3 font-mono text-xs placeholder:opacity-30" style={{ color: "var(--term-text)" }}
              placeholder="Broadcast command to remote core..."
            />
            {command && (
              <span className="absolute right-4 text-[9px] opacity-40 tracking-widest uppercase animate-pulse font-sans">
                Press Enter
              </span>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
