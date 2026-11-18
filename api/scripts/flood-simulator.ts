/**
 * I-Link IoT Flood Early Warning Telemetry Simulator
 * Emulates the Arduino HC-SR04 ultrasonic sensor + LoRa Python relay described
 * in the I-Link concept document, streaming water distance readings to
 * POST /api/iot/readings so live WebSocket alerts can be demonstrated.
 *
 * Usage:
 *   cd api && npm run simulate:flood
 */
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const API_URL = (process.env.API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
const DEVICE_KEY = process.env.FLOOD_DEVICE_KEY || 'ilink_demo_kinalumsan_sensor_key_2026';

// Simulated depths progressing Normal -> Advisory -> Warning -> Danger -> Critical -> Normal
const DEPTH_SEQUENCE_CM = [35, 58, 85, 112, 158, 205, 130, 40];

async function run() {
  console.log(`Streaming simulated ultrasonic telemetry to ${API_URL}/iot/readings ...`);
  for (const depthCm of DEPTH_SEQUENCE_CM) {
    const distanceCm = 400 - depthCm;
    const res = await fetch(`${API_URL}/iot/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-key': DEVICE_KEY,
      },
      body: JSON.stringify({ distanceCm }),
    });
    const body = await res.json();
    if (!res.ok) {
      console.error(`HTTP ${res.status}:`, body);
      process.exit(1);
    }
    console.log(
      `Sent distance=${distanceCm}cm -> depth=${body.reading?.depth_cm}cm | rise=${body.reading?.rise_cm_min ?? 0}cm/min | tier=${body.sensor?.current_tier?.toUpperCase()}`,
    );
    await new Promise((r) => setTimeout(r, 3500));
  }
  console.log('Flood telemetry simulation sequence finished.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
