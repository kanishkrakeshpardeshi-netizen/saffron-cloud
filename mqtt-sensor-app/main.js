import mqtt from 'mqtt';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker
const updateSW = registerSW({
  onNeedRefresh() {
    addLog('New update available. Refreshing... ', 'info');
  },
  onOfflineReady() {
    addLog('App ready to work offline', 'success');
  },
});

// DOM Elements
const connectionBadge = document.getElementById('connection-status');
const tempValue = document.getElementById('temp-value');
const tempUpdated = document.querySelector('.card:nth-child(1) .last-updated');
const humidityValue = document.getElementById('humidity-value');
const humidityUpdated = document.querySelector('.card:nth-child(2) .last-updated');
const aqiValue = document.getElementById('aqi-value');
const aqiUpdated = document.querySelector('.card:nth-child(3) .last-updated');
const logContainer = document.getElementById('log-container');

// MQTT Broker Setup
// Using a publicly available testing wrapper (broker.hivemq.com) over WebSockets
const BROKER_URL = 'wss://broker.hivemq.com:8000/mqtt';
const TOPIC_TEMP = 'esp32/sensor/temperature';
const TOPIC_HUMIDITY = 'esp32/sensor/humidity';
const TOPIC_AQI = 'esp32/sensor/aqi';

function addLog(msg, type = 'info') {
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  const time = new Date().toLocaleTimeString();
  div.innerHTML = `<span class="log-time">[${time}]</span> ${msg}`;
  logContainer.prepend(div);
  
  if (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

function updateValue(el, timeEl, value, isAqi = false) {
  el.textContent = isAqi ? Math.round(value) : Number(value).toFixed(1);
  timeEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
  
  // Trigger animation
  el.parentElement.classList.remove('value-updated');
  void el.parentElement.offsetWidth; // trigger reflow
  el.parentElement.classList.add('value-updated');
}

addLog(`Connecting to ${BROKER_URL}...`, 'info');

const client = mqtt.connect(BROKER_URL, {
  clientId: `esp32-dash-${Math.random().toString(16).slice(3)}`,
  clean: true,
  connectTimeout: 4000
});

client.on('connect', () => {
  connectionBadge.textContent = 'Connected';
  connectionBadge.className = 'status-badge connected';
  addLog('Successfully connected to MQTT broker', 'success');

  // Subscribe to topics
  const topics = [TOPIC_TEMP, TOPIC_HUMIDITY, TOPIC_AQI];
  client.subscribe(topics, (err) => {
    if (!err) {
      addLog(`Subscribed to ${topics.join(', ')}`, 'info');
    } else {
      addLog(`Subscription error: ${err.message}`, 'error');
    }
  });
});

client.on('message', (topic, message) => {
  const payload = message.toString();
  console.log(`Received ${payload} on ${topic}`);
  
  try {
    // Attempt parse if json, otherwise use as string
    let value = payload;
    try {
        const json = JSON.parse(payload);
        if(json.value !== undefined) value = json.value;
    } catch(e) {
        // Assume raw string/number
    }

    switch (topic) {
      case TOPIC_TEMP:
        updateValue(tempValue, tempUpdated, value);
        break;
      case TOPIC_HUMIDITY:
        updateValue(humidityValue, humidityUpdated, value);
        break;
      case TOPIC_AQI:
        updateValue(aqiValue, aqiUpdated, value, true);
        break;
    }
  } catch (error) {
     addLog(`Error parsing msg block: ${error}`, 'error');
  }
});

client.on('reconnect', () => {
   addLog('Reconnecting to MQTT broker...', 'info');
});

client.on('offline', () => {
  connectionBadge.textContent = 'Disconnected';
  connectionBadge.className = 'status-badge disconnected';
  addLog('Client went offline', 'error');
});

client.on('error', (err) => {
  addLog(`MQTT Error: ${err.message}`, 'error');
  connectionBadge.textContent = 'Error';
  connectionBadge.className = 'status-badge disconnected';
});

// For testing purposes: Simulate data continuously if requested, or just have user run a mock script
window.simulateData = () => {
    setInterval(() => {
        client.publish(TOPIC_TEMP, (22 + (Math.random() * 5 - 2)).toFixed(1).toString());
        client.publish(TOPIC_HUMIDITY, (45 + (Math.random() * 10 - 5)).toFixed(1).toString());
        client.publish(TOPIC_AQI, Math.floor(40 + Math.random() * 20).toString());
    }, 3000);
    addLog('Data simulation started', 'info');
};

// Initial state logs
addLog('Waiting for sensor signals from ESP32 -> Raspi -> MQTT broker', 'info');
