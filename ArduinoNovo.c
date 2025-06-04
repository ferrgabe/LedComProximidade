#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// --- Definições de pinos ---
#define TRIG_PIN      13 // D7
#define ECHO_PIN      12 // D6
#define LED_RED       14 // D5
#define LED_GREEN     5  // D1
#define LED_BLUE      4  // D2

// --- Config WiFi & WebSocket ---
const char* WIFI_SSID     = "ROBERTO";
const char* WIFI_PASSWORD = "zzzzxxxx";
const char* WS_HOST       = "192.168.171.56";
const int   WS_PORT       = 8080;
const char* WS_PATH       = "/ws";

// --- Intervals ---
const unsigned long HEARTBEAT_INTERVAL = 30000;
const unsigned long SENSOR_INTERVAL    = 200;
const unsigned long HOLD_INTERVAL      = 5000;
const unsigned long BLINK_INTERVAL     = 500;

// --- Estados ---
bool isConnected = false;
bool blinkActive = false;
bool holdActive = false;
bool proxAndHoldActive = false;
bool proximityActive = false;
bool proximityRed = false, proximityGreen = false, proximityBlue = false;

// --- Temporizadores ---
unsigned long lastBlinkTime = 0;
unsigned long lastHoldTime = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastSensorRead = 0;

// --- Sensor ultrassônico ---
long distance = 0;
bool measuringDistance = false;
unsigned long pulseStartTime = 0;

WebSocketsClient webSocket;

// --- Inicialização ---
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT);
  pinMode(LED_RED, OUTPUT); pinMode(LED_GREEN, OUTPUT); pinMode(LED_BLUE, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
  digitalWrite(TRIG_PIN, LOW);

  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.setSleepMode(WIFI_NONE_SLEEP);

  connectWiFi();
  setupWebSocket();
}

// --- Loop Principal ---
void loop() {
  static unsigned long lastWifiCheck = 0;
  webSocket.loop();
  yield();
  
  
  static unsigned long lastYield = 0;
  unsigned long now = millis();
  
  // Yield a cada 100ms para evitar WDT
  //if (now - lastYield > 100) {
  //  yield();
  //  lastYield = now;
  //};
  
  if (millis() - lastWifiCheck > 5000) {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi desconectado, tentando reconectar...");
      connectWiFi();
      if (WiFi.status() == WL_CONNECTED) {
        setupWebSocket(); // Reconfigura WebSocket se WiFi reconectar
      }
    }
    lastWifiCheck = millis();
  }

  if (isConnected && now - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = now;
  }

  if (holdActive && now - lastHoldTime >= HOLD_INTERVAL) {
    turnOffLights();
  }

  if (blinkActive && now - lastBlinkTime >= BLINK_INTERVAL) {
    lastBlinkTime = now;
    static int blinkState = 0;
    blinkState = (blinkState + 1) % 3;
    switch (blinkState) {
      case 0: turnOnColor(true, false, false); break;
      case 1: turnOnColor(false, true, false); break;
      case 2: turnOnColor(false, false, true); break;
    }
  }
  handleDistanceSensor(now);
  checkProximity(now);
}

// --- Funções de rede ---
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.println();
  Serial.print("Conectando ao WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.disconnect();
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED && tentativas < 20) {
    delay(500);
    Serial.print(".");
    tentativas++;
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN)); // Piscar LED durante tentativa
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("Conectado com sucesso!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_BUILTIN, LOW); // LED aceso quando conectado
  } else {
    Serial.println();
    Serial.println("Falha na conexão WiFi!");
    digitalWrite(LED_BUILTIN, HIGH); // LED apagado quando falha
  }
}

void setupWebSocket() {
  webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  Serial.println("WebSocket configurado");
}

// --- Sensor ultrassônico ---
void handleDistanceSensor(unsigned long now) {
  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;
    
    if (!measuringDistance) {
      // Inicia a medição
      digitalWrite(TRIG_PIN, HIGH);
      pulseStartTime = micros();
      measuringDistance = true;
    } else {
      // Finaliza o pulso após 10μs
      if (micros() - pulseStartTime >= 10) {
        digitalWrite(TRIG_PIN, LOW);
        measuringDistance = false;
        
        // Usar pulseIn com timeout mais curto
        unsigned long duration = pulseIn(ECHO_PIN, HIGH, 25000); // 25ms timeout
        distance = duration ? (duration / 2) / 29.1 : 999; // Valor alto se timeout
      }
    }
  }
}

// --- Proximidade ---
void checkProximity(unsigned long now) {
  if (proximityActive && distance <= 30) {
    turnOnColor(proximityRed, proximityGreen, proximityBlue);
  } else if (proxAndHoldActive && distance <= 30) {
    turnOnColor(proximityRed, proximityGreen, proximityBlue);
    lastHoldTime = now;
  } else if (proximityActive && distance > 30) {
    turnOffLights();
  }
}

// --- LED Control ---
void turnOnColor(bool red, bool green, bool blue) {
  digitalWrite(LED_RED, red); digitalWrite(LED_GREEN, green); digitalWrite(LED_BLUE, blue);
}

void turnOffLights() {
  turnOnColor(false, false, false);
}

void stopAllBehaviors() {
  blinkActive = false; holdActive = false; proxAndHoldActive = false; proximityActive = false;
  turnOffLights();
}

// --- Comportamentos ---
void handleBehavior(JsonObject params) {
  bool on = params["on"];
  bool r = params["red"], g = params["green"], b = params["blue"];
  int behavior = params["behavior"];
  stopAllBehaviors();

  if (!on) return;

  switch (behavior) {
    case 1: turnOnColor(r, g, b); break;
    case 2: blinkActive = true; lastBlinkTime = millis(); break;
    case 3: proximityActive = true; proximityRed = r; proximityGreen = g; proximityBlue = b; break;
    case 4:
      proxAndHoldActive = true; holdActive = true;
      proximityRed = r; proximityGreen = g; proximityBlue = b;
      lastHoldTime = millis();
      break;
    default: break;
  }
}

// --- WebSocket Eventos ---
void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED: isConnected = true; sendIdentification(); break;
    case WStype_DISCONNECTED: isConnected = false; break;
    case WStype_TEXT: handleMessage((char*)payload); break;
    default: break;
  }
}

// --- Comandos JSON ---
void handleMessage(const String& message) {
  DynamicJsonDocument doc(1024);
  DeserializationError err = deserializeJson(doc, message);
  if (err) return;

  String type = doc["type"];
  if (type == "command") {
    String command = doc["command"];
    JsonObject parameters = doc["parameters"];

    if (command == "led_update") handleBehavior(parameters);
    else if (command == "led_on") digitalWrite(LED_BUILTIN, LOW);
    else if (command == "led_off") digitalWrite(LED_BUILTIN, HIGH);
    else if (command == "get_status") sendStatus();
  } else if (type == "ping") {
    sendSimple("pong");
  }
}

// --- Envio de mensagens ---
void sendIdentification() {
  DynamicJsonDocument doc(512);
  doc["type"] = "identification";
  doc["deviceID"] = "1";
  doc["device"] = "Wemos D1 R2";
  doc["mac"] = WiFi.macAddress();
  doc["ip"] = WiFi.localIP().toString();
  doc["version"] = "1.0.0";

  String msg; serializeJson(doc, msg);
  webSocket.sendTXT(msg);
}

void sendHeartbeat() {
  DynamicJsonDocument doc(256);
  doc["type"] = "heartbeat";
  doc["timestamp"] = millis();
  doc["uptime"] = millis() / 1000;

  String msg; serializeJson(doc, msg);
  webSocket.sendTXT(msg);
}

void sendStatus() {
  DynamicJsonDocument doc(256);
  doc["type"] = "status";
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["free_heap"] = ESP.getFreeHeap();
  doc["uptime"] = millis() / 1000;

  String msg; serializeJson(doc, msg);
  webSocket.sendTXT(msg);
}

void sendSimple(const char* type) {
  DynamicJsonDocument doc(128);
  doc["type"] = type;
  doc["timestamp"] = millis();

  String msg; serializeJson(doc, msg);
  webSocket.sendTXT(msg);
}
