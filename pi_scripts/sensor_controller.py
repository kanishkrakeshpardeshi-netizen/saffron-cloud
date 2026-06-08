"""
Saffron Hub — Pi Sensor Controller (4-Device Automation)
=========================================================
Run this on the Raspberry Pi.

Devices controlled:
  AC Unit      → GPIO 17  — cools if indoor temp > crop temp_max
  Humidifier   → GPIO 27  — adds moisture if indoor humidity < crop hum_min
  Exhaust Fan  → GPIO 22  — removes moisture if indoor humidity > crop hum_max
  UV Light     → GPIO 23  — supplements light if indoor lux < crop lux_min

Sensors:
  DHT22 (temp + humidity) → GPIO 4
  LDR via ADS1115 (lux)   → I2C ADC channel 0

MQTT topics consumed (pushed by dashboard):
  saffron/crop/temp_min  → crop ideal temp minimum (°C)
  saffron/crop/temp_max  → crop ideal temp maximum (°C)  ← AC trigger
  saffron/crop/hum_min   → crop ideal humidity minimum (%)
  saffron/crop/hum_max   → crop ideal humidity maximum (%)
  saffron/crop/lux_min   → crop ideal lux minimum
  saffron/crop/lux_max   → crop ideal lux maximum
  saffron/external/temp  → live external weather temperature

MQTT topics published (received by dashboard):
  saffron/home/ac           → ON / OFF
  saffron/home/humidifier   → ON / OFF
  saffron/home/exhaust      → ON / OFF
  saffron/home/uv_light     → ON / OFF
  saffron/home/sunlight     → lux reading (int)
  saffron/home/humidity     → indoor humidity (float)
  saffron/home/temp         → indoor temperature (float)
"""

import time
import paho.mqtt.client as mqtt

MQTT_BROKER   = "localhost"
MQTT_PORT     = 1883
POLL_INTERVAL = 10  # seconds between local sensor reads

PIN_AC          = 17
PIN_HUMIDIFIER  = 27
PIN_EXHAUST     = 22
PIN_UV_LIGHT    = 23
PIN_DHT         = 4

limits = {
    "temp_min": 15.0,
    "temp_max": 25.0,
    "hum_min":  40.0,
    "hum_max":  60.0,
    "lux_min":  20000,
    "lux_max":  40000,
}

try:
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)
    for pin in [PIN_AC, PIN_HUMIDIFIER, PIN_EXHAUST, PIN_UV_LIGHT]:
        GPIO.setup(pin, GPIO.OUT, initial=GPIO.LOW)
    HAS_GPIO = True
    print("[GPIO] Pins initialised.")
except (ImportError, RuntimeError):
    HAS_GPIO = False
    print("[GPIO] No GPIO available — simulation mode.")

def read_dht22():
    """Return (temp_C, humidity_%) from DHT22 or (None, None) on error."""
    try:
        import adafruit_dht, board
        sensor = adafruit_dht.DHT22(board.D4)
        return sensor.temperature, sensor.humidity
    except Exception as e:
        print(f"[DHT22] {e}")
        return None, None

def read_lux():
    """Return lux estimate from LDR via ADS1115, or 0 on error."""
    try:
        import board, busio
        import adafruit_ads1x15.ads1115 as ADS
        from adafruit_ads1x15.analog_in import AnalogIn
        i2c  = busio.I2C(board.SCL, board.SDA)
        ads  = ADS.ADS1115(i2c)
        chan = AnalogIn(ads, ADS.P0)
        return max(0, int((chan.voltage / 3.3) * 80000))
    except Exception as e:
        print(f"[LDR] {e}")
        return 0

def set_relay(pin: int, on: bool, label: str, client: mqtt.Client, topic: str):
    state = "ON" if on else "OFF"
    if HAS_GPIO:
        import RPi.GPIO as GPIO
        GPIO.output(pin, GPIO.HIGH if on else GPIO.LOW)
    client.publish(topic, state, retain=True)
    print(f"  [{label}] → {state}")
    return state

def run_automation(client: mqtt.Client, temp: float, humidity: float, lux: int):
    print(f"\n[Automation] temp={temp}°C  hum={humidity}%  lux={lux}")

    set_relay(PIN_AC, temp > limits["temp_max"],
              "AC Unit", client, "saffron/home/ac")

    exhaust_on = humidity > limits["hum_max"]
    set_relay(PIN_EXHAUST, exhaust_on,
              "Exhaust Fan", client, "saffron/home/exhaust")

    humidifier_on = (not exhaust_on) and (humidity < limits["hum_min"])
    set_relay(PIN_HUMIDIFIER, humidifier_on,
              "Humidifier", client, "saffron/home/humidifier")

    set_relay(PIN_UV_LIGHT, lux < limits["lux_min"],
              "UV Light", client, "saffron/home/uv_light")

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"[MQTT] Connected to {MQTT_BROKER}:{MQTT_PORT}")
        client.subscribe("saffron/crop/#")
        client.subscribe("saffron/external/temp")
        print("[MQTT] Subscribed — waiting for crop profile from dashboard...")
    else:
        print(f"[MQTT] Connection failed rc={rc}")

def on_message(client, userdata, msg):
    topic   = msg.topic
    payload = msg.payload.decode().strip()

    limit_map = {
        "saffron/crop/temp_min": ("temp_min", float),
        "saffron/crop/temp_max": ("temp_max", float),
        "saffron/crop/hum_min":  ("hum_min",  float),
        "saffron/crop/hum_max":  ("hum_max",  float),
        "saffron/crop/lux_min":  ("lux_min",  int),
        "saffron/crop/lux_max":  ("lux_max",  int),
    }

    if topic in limit_map:
        key, cast = limit_map[topic]
        try:
            limits[key] = cast(payload)
            print(f"[Crop] {key} = {limits[key]}")
        except ValueError:
            pass
        return

    if topic == "saffron/external/temp":
        try:
            ext_temp = float(payload)
            print(f"[External] Temp = {ext_temp}°C — reading local sensors...")
        except ValueError:
            return

        indoor_temp, indoor_hum = read_dht22()
        lux = read_lux()

        temp = indoor_temp if indoor_temp is not None else ext_temp
        hum  = indoor_hum  if indoor_hum  is not None else 50.0

        client.publish("saffron/home/sunlight", str(lux),             retain=True)
        client.publish("saffron/home/humidity",  str(round(hum, 1)),  retain=True)
        client.publish("saffron/home/temp",      str(round(temp, 1)), retain=True)

        run_automation(client, temp, hum, lux)

def main():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    client.loop_start()

    print("[Saffron Pi] Running. Select a crop on the dashboard to activate automation.")

    try:
        while True:

            temp, hum = read_dht22()
            lux = read_lux()
            if temp is not None:
                client.publish("saffron/home/temp",     str(round(temp, 1)), retain=True)
            if hum is not None:
                client.publish("saffron/home/humidity", str(round(hum, 1)),  retain=True)
            if lux:
                client.publish("saffron/home/sunlight", str(lux),            retain=True)
            time.sleep(POLL_INTERVAL)
    except KeyboardInterrupt:
        print("\n[Saffron Pi] Shutting down...")
    finally:
        if HAS_GPIO:
            import RPi.GPIO as GPIO
            GPIO.cleanup()
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
