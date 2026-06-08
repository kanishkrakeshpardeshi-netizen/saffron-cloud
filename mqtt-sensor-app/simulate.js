import mqtt from 'mqtt';

const client = mqtt.connect('mqtt://broker.hivemq.com:1883', {
  clean: true,
  connectTimeout: 4000
});

client.on('connect', () => {
    console.log('Test publisher connected to MQTT broker.');
    
    // Publish every 2 seconds
    setInterval(() => {
        const temp = (20 + (Math.random() * 10)).toFixed(1);
        const humidity = (40 + (Math.random() * 20)).toFixed(1);
        const aqi = Math.floor(20 + Math.random() * 30);
        
        console.log(`Publishing: Temp=${temp}, Hum=${humidity}, AQI=${aqi}`);
        
        client.publish('esp32/sensor/temperature', temp);
        client.publish('esp32/sensor/humidity', humidity);
        client.publish('esp32/sensor/aqi', aqi.toString());
    }, 2000);
});

client.on('error', (err) => {
    console.error('MQTT error:', err);
});
