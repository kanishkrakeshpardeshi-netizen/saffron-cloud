import paho.mqtt.client as mqtt
import time
import random

# --- Configuration ---
# You and your users will run this script on their Raspberry Pi.
# Change the USERNAME to match the account registered in the app!
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
USERNAME = "testuser123"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Connected to Cloud MQTT! Listening for commands for user: {USERNAME}...")
        # Subscribe to commands from the cloud
        client.subscribe(f"saffron/{USERNAME}/home/#")
        client.subscribe(f"saffron/{USERNAME}/crop/#")
    else:
        print(f"Failed to connect! Error code: {rc}")

def on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode()
    print(f"Received Command: {topic} -> {payload}")
    
    # ---------------------------------------------------------
    # HARDWARE INTEGRATION:
    # This is where your users will add their specific GPIO code.
    # For example: if topic ends with /ac and payload is "ON",
    # turn on the relay connected to Pin 14.
    # ---------------------------------------------------------
    if topic.endswith("/ac"):
        print(f"--> Action: Turning AC {payload}")
    elif topic.endswith("/humidifier"):
        print(f"--> Action: Turning Humidifier {payload}")
    elif topic.endswith("/exhaust"):
        print(f"--> Action: Turning Exhaust {payload}")
    elif topic.endswith("/uv_light"):
        print(f"--> Action: Turning UV Light {payload}")

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

print("Connecting to Saffron Cloud...")
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

try:
    print("Sending sensor data to cloud every 5 seconds...")
    while True:
        # Simulate sensor readings (Users will replace this with real DHT11/DHT22 code)
        temp = 25.0 + random.uniform(-1, 1)
        hum = 60.0 + random.uniform(-2, 2)
        sunlight = int(30000 + random.uniform(-1000, 1000))
        
        # Publish telemetry UP to the cloud
        client.publish(f"saffron/{USERNAME}/home/temp", str(temp))
        client.publish(f"saffron/{USERNAME}/home/humidity", str(hum))
        client.publish(f"saffron/{USERNAME}/home/sunlight", str(sunlight))
        
        time.sleep(5)
except KeyboardInterrupt:
    print("Disconnecting...")
    client.disconnect()
