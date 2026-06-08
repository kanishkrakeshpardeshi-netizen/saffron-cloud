from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import paho.mqtt.client as mqtt
import requests
import asyncio
import os
import json
import time
import base64
import hmac
import hashlib
from typing import List, Optional, Dict
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# --- Configuration ---
SECRET_KEY = os.getenv("SECRET_KEY", "saffron-hub-super-secret-key")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./saffron.db")
MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.hivemq.com")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
OWM_API_KEY = "69a1cb876d3f5726400226f8b66e6dde"

# --- Database ---
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String, default="user")
    
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Auth ---
def create_jwt(payload: dict) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip('=')
    payload["exp"] = int(time.time()) + 60 * 60 * 24 * 7
    payload_enc = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
    signature = base64.urlsafe_b64encode(
        hmac.new(SECRET_KEY.encode(), f"{header}.{payload_enc}".encode(), hashlib.sha256).digest()
    ).decode().rstrip('=')
    return f"{header}.{payload_enc}.{signature}"

def verify_jwt(token: str):
    try:
        parts = token.split('.')
        if len(parts) != 3: return None
        header, payload_enc, signature = parts
        expected_sig = base64.urlsafe_b64encode(
            hmac.new(SECRET_KEY.encode(), f"{header}.{payload_enc}".encode(), hashlib.sha256).digest()
        ).decode().rstrip('=')
        if not hmac.compare_digest(signature, expected_sig): return None

        pad = len(payload_enc) % 4
        if pad: payload_enc += "=" * (4 - pad)
        payload = json.loads(base64.urlsafe_b64decode(payload_enc).decode())
        if payload.get("exp", 0) < time.time(): return None
        return payload
    except Exception:
        return None

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.split(" ")[1]
    payload = verify_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token is invalid or expired")
    return payload

_loop: asyncio.AbstractEventLoop | None = None

@asynccontextmanager
async def lifespan(application: FastAPI):
    global _loop
    _loop = asyncio.get_running_loop()
    yield

app = FastAPI(title="Saffron Cloud", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Multi-Tenant Telemetry State ---
telemetry_data: Dict[str, dict] = {}
user_thresholds: Dict[str, float] = {}

def get_default_telemetry():
    return {
        "sunlight": 0,
        "humidity_local": 0.0,
        "indoor_temp": 0.0,
        "ac_status": "OFF",
        "humidifier_status": "OFF",
        "exhaust_status": "OFF",
        "uv_light_status": "OFF",
        "connected_to_pi": False
    }

class ConnectionManager:
    def __init__(self):
        self.user_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        if username not in self.user_connections:
            self.user_connections[username] = []
        self.user_connections[username].append(websocket)
        
        if username not in telemetry_data:
            telemetry_data[username] = get_default_telemetry()
        await websocket.send_json(telemetry_data[username])

    def disconnect(self, websocket: WebSocket, username: str):
        if username in self.user_connections:
            if websocket in self.user_connections[username]:
                self.user_connections[username].remove(websocket)

    async def broadcast(self, username: str, message: dict):
        if username in self.user_connections:
            for connection in self.user_connections[username]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

# --- MQTT Cloud Integration ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"[MQTT] Connected to {MQTT_BROKER} successfully.")
        # Listen to ALL users' topics. The backend routes the data to the right WebSocket.
        client.subscribe("saffron/+/home/#")
    else:
        print(f"[MQTT] Connection failed. Code: {rc}")

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode().strip()

    # Topic format: saffron/{username}/home/{sensor}
    parts = topic.split("/")
    if len(parts) < 4: return
    username = parts[1]
    sensor = parts[3]

    if username not in telemetry_data:
        telemetry_data[username] = get_default_telemetry()
    
    telemetry_data[username]["connected_to_pi"] = True

    field_map = {
        "sunlight":   ("sunlight",         lambda v: int(float(v))),
        "humidity":   ("humidity_local",   lambda v: round(float(v), 1)),
        "temp":       ("indoor_temp",      lambda v: round(float(v), 1)),
        "ac":         ("ac_status",        str),
        "humidifier": ("humidifier_status",str),
        "exhaust":    ("exhaust_status",   str),
        "uv_light":   ("uv_light_status",  str),
    }

    if sensor in field_map:
        key, cast = field_map[sensor]
        try:
            telemetry_data[username][key] = cast(payload)
            if _loop and _loop.is_running():
                asyncio.run_coroutine_threadsafe(manager.broadcast(username, telemetry_data[username].copy()), _loop)
        except (ValueError, TypeError):
            pass

mqtt_client = mqtt.Client()
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()
except Exception as e:
    print(f"[MQTT] Initialization Error: {e}")

# --- API Endpoints ---
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: Optional[str] = "saffine2026"

@app.post("/api/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(UserDB).filter(UserDB.username == req.username).first() or req.username.lower() == "admin":
        raise HTTPException(status_code=400, detail="Username already exists")
    
    salt = "saffron_secure"
    password = req.password or "saffine2026"
    hashed_pw = hashlib.sha256(f"{password}{salt}".encode()).hexdigest()

    new_user = UserDB(username=req.username, password_hash=hashed_pw, role="user")
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully"}

@app.post("/api/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    if req.username == "admin" and req.password == "saffron2026":
        token = create_jwt({"sub": req.username, "role": "admin"})
        return {"access_token": token, "token_type": "bearer", "role": "admin"}
        
    user = db.query(UserDB).filter(UserDB.username == req.username).first()
    if user:
        salt = "saffron_secure"
        hashed_pw = hashlib.sha256(f"{req.password}{salt}".encode()).hexdigest()
        if hashed_pw == user.password_hash:
            token = create_jwt({"sub": req.username, "role": "user"})
            return {"access_token": token, "token_type": "bearer", "role": "user"}

    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.get("/api/admin/nodes")
def get_admin_nodes(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = db.query(UserDB).all()
    nodes = []
    for u in users:
        # For cloud architectures, "online" means they have active telemetry
        is_online = telemetry_data.get(u.username, {}).get("connected_to_pi", False)
        nodes.append({
            "owner": u.username,
            "ip": "Cloud Linked", # IP/SSH removed
            "username": "N/A",
            "password": "N/A",
            "online": is_online
        })
    return {"nodes": nodes}

@app.delete("/api/admin/users/{username}")
def delete_user(username: str, user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    target_user = db.query(UserDB).filter(UserDB.username == username).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(target_user)
    db.commit()
    
    if username in telemetry_data:
        del telemetry_data[username]
        
    return {"message": f"User {username} deleted successfully"}

CROP_PROFILES = {
    "wheat": {"name": "Wheat", "temp_min": 15.0, "temp_max": 25.0, "hum_min": 50, "hum_max": 60, "wind": "Moderate", "lux_min": 20000, "lux_max": 40000, "photoperiod": "12-14 hours"},
    "sugarcane": {"name": "Sugarcane", "temp_min": 20.0, "temp_max": 35.0, "hum_min": 70, "hum_max": 85, "wind": "High", "lux_min": 30000, "lux_max": 60000, "photoperiod": "12-14 hours"},
    "cotton": {"name": "Cotton", "temp_min": 21.0, "temp_max": 30.0, "hum_min": 50, "hum_max": 70, "wind": "Low", "lux_min": 25000, "lux_max": 50000, "photoperiod": "12-14 hours"},
    "saffron": {"name": "Saffron (Kesar)", "temp_min": 15.0, "temp_max": 20.0, "hum_min": 40, "hum_max": 60, "wind": "Moderate", "lux_min": 20000, "lux_max": 40000, "photoperiod": "11-13 hours"}
}

@app.get("/api/crops")
def get_all_crops():
    return [{"id": k, "name": v["name"]} for k, v in CROP_PROFILES.items()]

@app.get("/api/crop/{crop_id}")
def get_crop_profile(crop_id: str):
    if crop_id not in CROP_PROFILES:
        raise HTTPException(status_code=404, detail="Crop not found")
    return CROP_PROFILES[crop_id]

@app.get("/api/weather")
def get_weather(location: str, user: dict = Depends(get_current_user)):
    if not location:
        raise HTTPException(status_code=400, detail="Location is required")
    username = user["sub"]
        
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?q={location}&appid={OWM_API_KEY}&units=metric"
        res = requests.get(url)
        data = res.json()
        
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=data.get("message", "Failed to fetch weather"))

        temp = data.get("main", {}).get("temp", 0.0)
        humidity = data.get("main", {}).get("humidity", 0)
        pressure = data.get("main", {}).get("pressure", 0.0)
        wind_speed = data.get("wind", {}).get("speed", 0.0)
        clouds = data.get("clouds", {}).get("all", 0)

        external_lux = max(10000, int(80000 - (clouds / 100.0) * 70000))

        # Push to the specific user's Raspberry Pi client via Cloud MQTT
        mqtt_client.publish(f"saffron/{username}/external/temp", str(round(temp, 2)))
        mqtt_client.publish(f"saffron/{username}/external/humidity", str(humidity))
        mqtt_client.publish(f"saffron/{username}/external/lux", str(external_lux))

        return {
            "location": data.get("name", location),
            "temp": temp,
            "humidity": humidity,
            "pressure": pressure,
            "wind_speed": wind_speed,
            "external_lux": external_lux,
        }
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=500, detail="Error fetching weather data")

class CropActivateRequest(BaseModel):
    temp_min: float
    temp_max: float
    hum_min: float
    hum_max: float
    lux_min: int
    lux_max: int

@app.post("/api/crop/activate")
def activate_crop(profile: CropActivateRequest, user: dict = Depends(get_current_user)):
    username = user["sub"]
    user_thresholds[username] = profile.temp_max
    
    # Push profile down to user's hardware
    mqtt_client.publish(f"saffron/{username}/crop/temp_min", str(profile.temp_min))
    mqtt_client.publish(f"saffron/{username}/crop/temp_max", str(profile.temp_max))
    mqtt_client.publish(f"saffron/{username}/crop/hum_min",  str(profile.hum_min))
    mqtt_client.publish(f"saffron/{username}/crop/hum_max",  str(profile.hum_max))
    mqtt_client.publish(f"saffron/{username}/crop/lux_min",  str(profile.lux_min))
    mqtt_client.publish(f"saffron/{username}/crop/lux_max",  str(profile.lux_max))
    return {"message": "Crop profile pushed to your hardware"}

@app.post("/api/threshold")
def set_threshold(threshold: float, user: dict = Depends(get_current_user)):
    username = user["sub"]
    user_thresholds[username] = threshold
    mqtt_client.publish(f"saffron/{username}/crop/temp_max", str(threshold))
    return {"message": f"AC Threshold set to {threshold}"}

@app.post("/api/threshold/humidifier")
def set_humidifier_threshold(threshold: float, user: dict = Depends(get_current_user)):
    username = user["sub"]
    mqtt_client.publish(f"saffron/{username}/crop/hum_min", str(threshold))
    return {"message": f"Humidifier threshold set to {threshold}"}

@app.post("/api/threshold/uv_light")
def set_uv_light_threshold(threshold: int, user: dict = Depends(get_current_user)):
    username = user["sub"]
    mqtt_client.publish(f"saffron/{username}/crop/lux_min", str(threshold))
    return {"message": f"UV Light threshold set to {threshold}"}

@app.post("/api/command")
def send_command(device: str, state: str, user: dict = Depends(get_current_user)):
    username = user["sub"]
    valid_devices = ["ac", "humidifier", "exhaust", "uv_light"]
    if device not in valid_devices:
        raise HTTPException(status_code=400, detail=f"Invalid device")
    if state not in ["ON", "OFF"]:
        raise HTTPException(status_code=400, detail="State must be ON or OFF")

    # Command via Cloud MQTT to specific user's hardware
    mqtt_client.publish(f"saffron/{username}/home/{device}", state)
    mqtt_client.publish(f"saffron/{username}/override/{device}", state)

    if username not in telemetry_data:
        telemetry_data[username] = get_default_telemetry()
    telemetry_data[username][f"{device}_status"] = state
    
    if _loop and _loop.is_running():
        asyncio.run_coroutine_threadsafe(manager.broadcast(username, telemetry_data[username].copy()), _loop)

    return {"message": f"{device} → {state}"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    # Authenticate WebSocket so it only receives its own user's telemetry
    if not token:
        await websocket.close(code=1008)
        return
    payload = verify_jwt(token)
    if not payload:
        await websocket.close(code=1008)
        return
        
    username = payload["sub"]
    await manager.connect(websocket, username)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, username)

# --- Frontend Serving (For Single Container Deployments) ---
frontend_out_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "out")
if os.path.exists(frontend_out_path):
    app.mount("/", StaticFiles(directory=frontend_out_path, html=True), name="frontend")
    @app.exception_handler(404)
    async def custom_404_handler(request, exc):
        index_file = os.path.join(frontend_out_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"detail": "Not Found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
