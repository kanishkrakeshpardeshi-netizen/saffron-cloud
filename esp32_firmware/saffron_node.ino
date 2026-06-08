#include <WiFi.h>
#include <PubSubClient.h>

// Replace with your network credentials
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";

// Replace with your Raspberry Pi IP address
const char* mqtt_server = "192.168.1.XXX"; 

WiFiClient espClient;
PubSubClient client(espClient);

// Pins
const int ldrPin = 34; // Analog pin for Sunlight Sensor
const int acRelayPin = 26;
const int humidifierRelayPin = 27;

long lastMsg = 0;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* message, unsigned int length) {
  Serial.print("Message arrived on topic: ");
  Serial.print(topic);
  Serial.print(". Message: ");
  String messageTemp;
  
  for (int i = 0; i < length; i++) {
    Serial.print((char)message[i]);
    messageTemp += (char)message[i];
  }
  Serial.println();

  // Handle Relay Commands
  if (String(topic) == "saffron/home/ac") {
    if(messageTemp == "ON") {
      digitalWrite(acRelayPin, HIGH);
      Serial.println("AC is ON");
    } else if(messageTemp == "OFF") {
      digitalWrite(acRelayPin, LOW);
      Serial.println("AC is OFF");
    }
  }
  
  if (String(topic) == "saffron/home/humidifier") {
    if(messageTemp == "ON") {
      digitalWrite(humidifierRelayPin, HIGH);
      Serial.println("Humidifier is ON");
    } else if(messageTemp == "OFF") {
      digitalWrite(humidifierRelayPin, LOW);
      Serial.println("Humidifier is OFF");
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Create a random client ID
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
      // Subscribe to topics
      client.subscribe("saffron/home/ac");
      client.subscribe("saffron/home/humidifier");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);

  pinMode(ldrPin, INPUT);
  pinMode(acRelayPin, OUTPUT);
  pinMode(humidifierRelayPin, OUTPUT);
  
  // Default states
  digitalWrite(acRelayPin, LOW);
  digitalWrite(humidifierRelayPin, LOW);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  long now = millis();
  if (now - lastMsg > 5000) { // Publish every 5 seconds
    lastMsg = now;
    
    // Read Sunlight Level (LDR)
    int sunlightValue = analogRead(ldrPin);
    
    // Publish telemetry
    char sunlightString[8];
    dtostrf(sunlightValue, 1, 0, sunlightString);
    Serial.print("Sunlight Level: ");
    Serial.println(sunlightString);
    client.publish("saffron/home/sunlight", sunlightString);
    
    // Placeholder for local humidity if a DHT is added
    client.publish("saffron/home/humidity", "45.0"); 
  }
}
