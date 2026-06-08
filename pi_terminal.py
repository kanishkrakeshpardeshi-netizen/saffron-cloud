import paramiko
from paramiko.ssh_exception import NoValidConnectionsError
import threading
import time
import sys
from datetime import datetime
from typing import List, Optional

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich import box

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # type: ignore

PI_HOST     = "192.168.1.45"
PI_USER     = "pi"
PI_PASSWORD = "raspberry"
PI_PORT     = 22

REFRESH_INTERVAL_SECONDS = 600

AUTO_COMMANDS = [
    "echo '--- SAFFRON HUB AUTO-SYNC ---'",
    "date",
    "uptime",
    "free -h | grep Mem",
    "df -h / | tail -1",
    "echo '--- Services Status ---'",
    "pgrep -a uvicorn | head -5 || echo 'Backend: NOT running'",
    "pgrep -a node    | head -3 || echo 'Frontend: NOT running'",
    "echo '--- MQTT Broker ---'",
    "pgrep -a mosquitto | head -3 || echo 'MQTT: NOT running'",
    "echo '--- END OF SYNC ---'",
]

console = Console()

log_lines: List[str] = []
log_lock  = threading.Lock()
running   = True
ssh_client: Optional[paramiko.SSHClient] = None
shell_channel = None
last_refresh  = None
next_refresh  = None
connection_status = "⬤ Disconnected"
status_color = "red"

def timestamp() -> str:
    return datetime.now().strftime("%H:%M:%S")

def log(msg: str, style: str = "white"):
    ts = timestamp()
    with log_lock:
        line = f"[dim]{ts}[/dim]  {msg}"
        log_lines.append(line)
        if len(log_lines) > 300:
            log_lines.pop(0)
    console.print(f"[dim]{ts}[/dim]  {msg}")

def connect() -> bool:
    global ssh_client, shell_channel, connection_status, status_color, last_refresh, next_refresh
    try:
        log(f"[yellow]Connecting to {PI_USER}@{PI_HOST}:{PI_PORT}...[/yellow]")
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=PI_HOST,
            port=PI_PORT,
            username=PI_USER,
            password=PI_PASSWORD,
            timeout=10,
            banner_timeout=15,
        )
        ssh_client       = client
        connection_status = "⬤ Connected"
        status_color      = "green"
        last_refresh      = datetime.now()
        next_refresh      = time.time() + REFRESH_INTERVAL_SECONDS
        log(f"[bold green]✔ Connected to Raspberry Pi at {PI_HOST}[/bold green]")
        return True
    except paramiko.AuthenticationException:
        log("[bold red]✘ Authentication failed — check PI_USER / PI_PASSWORD[/bold red]")
    except NoValidConnectionsError:
        log(f"[bold red]✘ Cannot reach {PI_HOST}:{PI_PORT} — check IP and that Pi is on[/bold red]")
    except Exception as e:
        log(f"[bold red]✘ Connection error: {e}[/bold red]")
    connection_status = "⬤ Disconnected"
    status_color      = "red"
    return False

def disconnect():
    global ssh_client, connection_status, status_color
    if ssh_client:
        try:
            ssh_client.close()
        except Exception:
            pass
        ssh_client = None
    connection_status = "⬤ Disconnected"
    status_color      = "red"

def run_command(cmd: str, tag: str = "") -> str:
    """Send a command over SSH and return stdout+stderr."""
    if not ssh_client:
        return "[red]Not connected.[/red]"
    try:
        stdin, stdout, stderr = ssh_client.exec_command(cmd, timeout=30)
        out = stdout.read().decode(errors="replace").strip()
        err = stderr.read().decode(errors="replace").strip()
        combined = out + ("\n" + err if err else "")
        return combined
    except Exception as e:
        return f"[red]Command failed: {e}[/red]"

def auto_refresh_loop():
    """Background thread: auto-refresh every 10 minutes."""
    global running, next_refresh, last_refresh, connection_status, status_color

    time.sleep(REFRESH_INTERVAL_SECONDS)

    while running:
        log(f"\n[bold cyan]━━━ AUTO-REFRESH (every {REFRESH_INTERVAL_SECONDS//60} min) ━━━[/bold cyan]")
        if not ssh_client:
            log("[yellow]Not connected — attempting reconnect...[/yellow]")
            connect()

        if ssh_client:
            for cmd in AUTO_COMMANDS:
                result = run_command(cmd)
                log(f"[dim cyan]$[/dim cyan] [cyan]{cmd}[/cyan]")
                if result:
                    for line in result.splitlines():
                        log(f"  [white]{line}[/white]")
        else:
            log("[red]Reconnect failed — will retry at next interval.[/red]")

        last_refresh = datetime.now()
        next_refresh = time.time() + REFRESH_INTERVAL_SECONDS
        log("[bold cyan]━━━ END AUTO-REFRESH ━━━[/bold cyan]\n")

        time.sleep(REFRESH_INTERVAL_SECONDS)

def print_header():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    console.print(Panel(
        f"[bold #e0a96d]SAFFRON HUB[/bold #e0a96d]  [dim]Raspberry Pi SSH Terminal[/dim]\n"
        f"[dim]Target:[/dim] [cyan]{PI_USER}@{PI_HOST}:{PI_PORT}[/cyan]   "
        f"[dim]Auto-refresh:[/dim] [yellow]every {REFRESH_INTERVAL_SECONDS//60} minutes[/yellow]\n"
        f"[dim]Started:[/dim] {now}",
        title="[bold]Saffron Hub Pi Terminal[/bold]",
        border_style="#e0a96d",
        box=box.DOUBLE_EDGE,
    ))
    console.print(
        "[dim]Commands:[/dim]  "
        "[green]sync[/green]=run status check   "
        "[green]reboot[/green]=restart Pi   "
        "[green]start[/green]=start services   "
        "[green]stop[/green]=stop services   "
        "[green]log[/green]=show backend log   "
        "[green]exit[/green]=quit\n"
        "[dim]Or type any raw Linux command to run it on the Pi.[/dim]\n"
    )

SHORTCUT_COMMANDS = {
    "sync": AUTO_COMMANDS,
    "start": [
        "cd /home/pi/saffron_hub && bash start_pi.sh &",
    ],
    "stop": [
        "pkill -f uvicorn || true",
        "pkill -f 'next start' || true",
        "pkill -f cloudflared || true",
        "echo 'All services stopped.'",
    ],
    "reboot": ["sudo reboot"],
    "log": [
        "tail -30 /home/pi/saffron_hub/backend/uvicorn.log 2>/dev/null || echo 'Log not found.'",
    ],
    "status": AUTO_COMMANDS,
}

def handle_input(user_input: str):
    user_input = user_input.strip()
    if not user_input:
        return

    if user_input.lower() == "exit":
        return

    if not ssh_client:
        log("[red]Not connected. Run 'reconnect' first or check Pi IP.[/red]")
        return

    if user_input.lower() in SHORTCUT_COMMANDS:
        cmds = SHORTCUT_COMMANDS[user_input.lower()]
        log(f"[bold yellow]→ Running shortcut: {user_input.upper()}[/bold yellow]")
        for cmd in cmds:
            log(f"[dim cyan]$[/dim cyan] [cyan]{cmd}[/cyan]")
            result = run_command(cmd)
            if result:
                for line in result.splitlines():
                    log(f"  [white]{line}[/white]")
        return

    if user_input.lower() == "reconnect":
        disconnect()
        connect()
        return

    if user_input.lower() == "clear":
        console.clear()
        print_header()
        return

    log(f"[dim cyan]$[/dim cyan] [cyan]{user_input}[/cyan]")
    result = run_command(user_input)
    if result:
        for line in result.splitlines():
            log(f"  [white]{line}[/white]")

def countdown_display():
    """Show a live countdown to next auto-refresh in the prompt."""
    if next_refresh is None:
        return ""
    remaining = max(0, int(next_refresh - time.time()))
    mins, secs = divmod(remaining, 60)
    return f" [dim](next refresh in {mins:02d}:{secs:02d})[/dim]"

def main():
    global running

    console.clear()
    print_header()

    connected = connect()
    if connected:
        log("[bold]Running initial status check...[/bold]")
        for cmd in AUTO_COMMANDS:
            log(f"[dim cyan]$[/dim cyan] [cyan]{cmd}[/cyan]")
            result = run_command(cmd)
            if result:
                for line in result.splitlines():
                    log(f"  [white]{line}[/white]")

    refresh_thread = threading.Thread(target=auto_refresh_loop, daemon=True)
    refresh_thread.start()

    log("\n[bold #e0a96d]Terminal ready. Type a command or press Enter.[/bold #e0a96d]\n")

    try:
        while running:
            countdown = countdown_display()
            try:
                user_input = Prompt.ask(
                    f"\n[bold #e0a96d]saffron@pi[/bold #e0a96d]{countdown} [bold]›[/bold]"
                )
            except (EOFError, KeyboardInterrupt):
                break

            if user_input.strip().lower() == "exit":
                break

            handle_input(user_input)

    except KeyboardInterrupt:
        pass
    finally:
        running = False
        disconnect()
        console.print("\n[bold #e0a96d]Saffron Hub Terminal closed. Goodbye![/bold #e0a96d]")

if __name__ == "__main__":
    main()
