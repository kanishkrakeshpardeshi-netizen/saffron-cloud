import subprocess
import sys
import time
import os

def main():
    print("========================================")
    print("Starting Saffron Hub Development Servers")
    print("========================================")
    
    project_root = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(project_root, "backend")
    frontend_dir = os.path.join(project_root, "frontend")

    print("\n[+] Starting FastAPI Backend self-healing thread...")
    if os.name == "nt":  # Windows
        python_exec = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
    else:  # Linux/Mac
        python_exec = os.path.join(backend_dir, "venv", "bin", "python")
        
    def run_backend_loop():
        while True:
            print("[+] Initializing FastAPI API Server...")
            proc = subprocess.Popen([python_exec, "main.py"], cwd=backend_dir)
            proc.wait()
            print("[!] API Server process terminated unexpectedly! Auto-restarting in 3 seconds...")
            time.sleep(3)
            
    import threading
    backend_thread = threading.Thread(target=run_backend_loop, daemon=True)
    backend_thread.start()

    print("[+] Starting Next.js Frontend on port 3000...")
    if os.name == "nt":
        frontend_proc = subprocess.Popen("npm run dev", shell=True, cwd=frontend_dir)
    else:
        frontend_proc = subprocess.Popen(["npm", "run", "dev"], cwd=frontend_dir)
    
    print("\n[INFO] Both servers are running. Press Ctrl+C to stop both.\n")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[INFO] Shutting down servers...")
        if os.name != "nt":
            frontend_proc.terminate()
            subprocess.run(["pkill", "-f", "main.py"]) # Kill the backend loop children
        else:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(frontend_proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            # Find and kill the python main.py process on windows
            subprocess.run(["taskkill", "/F", "/IM", "python.exe", "/FI", "WINDOWTITLE eq main.py*"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        print("[INFO] Servers stopped successfully.")

if __name__ == "__main__":
    main()
