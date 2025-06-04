#include <ESP8266WiFi.h>
#include <WebSocketsClient.h> // instalar lib WebSockets by Markus Sattler
#include <ArduinoJson.h>

// Define distance sensor pins
#define trigPin 13 // D7
#define echoPin 12 // D6

// Define led strip pins
#define PINO_LED_R 14 // D5 - Vermelho
#define PINO_LED_G 5 // D1 - Verde
#define PINO_LED_B 4 // D2 - Azul

// Variables
// Websocket Variables
const char * websocketServer = "192.168.0.1"; // IP do seu backend
const char * websocketPath = "/ws"; // Caminho do WebSocket no seu backend
const int websocketPort = 8080;
const unsigned long heartbeatInterval = 30000; // 30 segundos
unsigned long lastHeartbeat = 0;
bool isConnected = false;

// Wifi Variables
const char * wifiSsid = "GABRIEL_2.4G";
const char * wifiPassword = "@Gabriel1980##";

// Blink variables
bool blinkActive = false;
int blinkState = 0;
unsigned long lastBlinkTime = 0;
unsigned long blinkInterval = 200;

// Hold variables
bool holdActive = false;
bool proxAndHoldActive = false;
unsigned long lastHoldTime = 0;;
unsigned long holdInterval = 30000;

// Proximity variables
bool proximityActive = false;
bool proximityRed = false;
bool proximityGreen = false;
bool proximityBlue = false;


// Initialize Websocket Client
WebSocketsClient webSocket;

void setup() {
  Serial.begin(115200);
  Serial.println("Iniciando cliente WebSocket...");

  // Set builtin led
  pinMode(LED_BUILTIN, OUTPUT);

  // Set distance sensor
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // Set led strip
  pinMode(PINO_LED_R, OUTPUT);
  pinMode(PINO_LED_G, OUTPUT);
  pinMode(PINO_LED_B, OUTPUT);

  // Connect to wifi and setup socket
  setupWiFi();
  setupWebSocket();
}

void loop() {
  // Start websocket loop
  webSocket.loop();

  // Sent heartbeats
  if (isConnected && millis() - lastHeartbeat > heartbeatInterval) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }

  // Virify if is connected to wifi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi desconectado! Tentando reconectar...");
    setupWiFi();
  }

  // Handle LED Holding time
  if (holdActive && millis() - lastHoldTime >= holdInterval) {
    lastHoldTime = millis();
    turnOffLights();
  }

  // Handle LED Color Cycling
  if (blinkActive && millis() - lastBlinkTime >= blinkInterval) {
    lastBlinkTime = millis();

    // turnOffLights();

    switch (blinkState) {
      case 0: 
        turnOnRed();
        break;
      case 1:
        turnOnGreen();
        break;
      case 2:
        turnOnBlue();
        break;
    }

    blinkState = (blinkState + 1) % 3;
  }

   //Leitura do sensor
   long duration, distance;
   digitalWrite(trigPin, LOW);
   delayMicroseconds(2);
   digitalWrite(trigPin, HIGH);
   delayMicroseconds(10);
   digitalWrite(trigPin, LOW);
   duration = pulseIn(echoPin, HIGH);
   distance = (duration / 2) / 29.1;

   Serial.print("Distancia: ");
   Serial.print(distance);
   Serial.println(" cm");

  if (distance <= 30 && proximityActive == true){
    digitalWrite(PINO_LED_R, proximityRed ? HIGH : LOW);
    digitalWrite(PINO_LED_G, proximityGreen ? HIGH : LOW);
    digitalWrite(PINO_LED_B, proximityBlue ? HIGH : LOW);
  }
  else if (distance > 30 && proximityActive == true){
    turnOffLights();
  }

  if (distance <= 100 && proxAndHoldActive == true){
    digitalWrite(PINO_LED_R, proximityRed ? HIGH : LOW);
    digitalWrite(PINO_LED_G, proximityGreen ? HIGH : LOW);
    digitalWrite(PINO_LED_B, proximityBlue ? HIGH : LOW);
  }
  else if (distance > 100 && proxAndHoldActive == true && holdActive == true){
    turnOffLights();
  
  }

  delay(200);
}

void setupWiFi() {
  WiFi.begin(wifiSsid, wifiPassword);
  Serial.print("Conectando ao WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print("Tentando conectar novamente ao wifi\n");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi conectado!");
    Serial.println("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Falha ao conectar WiFi!");
  }
}

void setupWebSocket() {
  webSocket.onEvent(webSocketEvent);
  webSocket.begin(websocketServer, websocketPort, websocketPath);
  webSocket.setReconnectInterval(5000);
  Serial.println("WebSocket configurado!");
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WebSocket] Desconectado!");
      isConnected = false;
      break;

    case WStype_CONNECTED:
      Serial.printf("[WebSocket] Conectado ao servidor: %s\n", payload);
      isConnected = true;
      sendIdentification();
      break;

    case WStype_TEXT:
      Serial.printf("[WebSocket] Mensagem recebida: %s\n", payload);
      handleMessage((char * ) payload);
      break;

    case WStype_BIN:
      Serial.printf("[WebSocket] Dados binários recebidos (%u bytes)\n", length);
      break;

    case WStype_PING:
      Serial.println("[WebSocket] Ping recebido");
      break;

    case WStype_PONG:
      Serial.println("[WebSocket] Pong recebido");
      break;

    case WStype_ERROR:
      Serial.printf("[WebSocket] Erro: %s\n", payload);
      break;

    default:
      break;
  }
}

void turnOnRed() {
  digitalWrite(PINO_LED_R, HIGH);
  digitalWrite(PINO_LED_G, LOW);
  digitalWrite(PINO_LED_B, LOW);
}

void turnOnGreen() {
  digitalWrite(PINO_LED_R, LOW);
  digitalWrite(PINO_LED_G, HIGH);
  digitalWrite(PINO_LED_B, LOW);
}

void turnOnBlue() {
  digitalWrite(PINO_LED_R, LOW);
  digitalWrite(PINO_LED_G, LOW);
  digitalWrite(PINO_LED_B, HIGH);
}

void turnOffLights() {
  digitalWrite(PINO_LED_R, LOW);
  digitalWrite(PINO_LED_G, LOW);
  digitalWrite(PINO_LED_B, LOW);
}


void turnOffAllBehaviors() {
  blinkActive = false;
  holdActive = false
  proximityActive = false;
  turnOffLights();
}

void behaviorStatic(bool red, bool green, bool blue) {
  digitalWrite(PINO_LED_R, red);
  digitalWrite(PINO_LED_G, green);
  digitalWrite(PINO_LED_B, blue);
}

void behaviorBlink(bool start) {
  blinkActive = start;
  blinkState = 0;
  lastBlinkTime = millis();
};

void behaviorProxAndHold(bool start, bool red, bool green, bool blue) {
  holdActive = start;
  proxAndHoldActive = start;
  lastHoldTime = millis()
}

void behaviorProximity(bool start, bool red, bool green, bool blue) {
  proximityActive = start;
  proximityRed = red;
  proximityGreen = green;
  proximityBlue = blue;
}

void handleMessage(String message) {
  DynamicJsonDocument doc(1024);
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print("Erro ao fazer parse do JSON: ");
    Serial.println(error.c_str());
    return;
  }

  String type = doc["type"];

  if (type == "command") {
    String command = doc["command"];
    JsonObject parameters = doc["parameters"];

    Serial.println("Comando recebido: " + command);

    if (command == "led_update") {
      bool on = parameters["on"];
      bool red = parameters["red"];
      bool green = parameters["green"];
      bool blue = parameters["blue"];
      int behavior = parameters["behavior"];

      // Turn off all lights before start a behavior
      turnOffLights();
      turnOffAllBehaviors();

      if (on == true) {
        switch (behavior) {
          case 1: // Static
            behaviorStatic(red, green, blue);
            break;

          case 2: //blink
            behaviorBlink(true);
            break;

          case 3: //proximity
            behaviorProximity(true, red, green, blue);
            break;

          case 4: //aproxima e segura n segundos.
            behaviorProxAndHold(true, red, green, blue)
            break

          default:
            turnOffLights();
            turnOffAllBehaviors(); 
            break;
        }
      } else if
        (on == false) {
          turnOffLights();
          turnOffAllBehaviors();
        }

      sendResponse("led_update_status", "accepted");
    } else if (command == "led_on") {
      digitalWrite(LED_BUILTIN, LOW); // LED ligado (LOW no ESP8266)
      sendResponse("led_status", "on");
    } else if (command == "led_off") {
      digitalWrite(LED_BUILTIN, HIGH); // LED desligado
      sendResponse("led_status", "off");
    } else if (command == "get_status") {
      sendStatus();
    }
  } else if (type == "ping") {
    sendPong();
  }
}

void sendIdentification() {
  DynamicJsonDocument doc(512);
  doc["deviceID"] = "1";
  doc["type"] = "identification";
  doc["device"] = "Wemos D1 R2";
  doc["mac"] = WiFi.macAddress();
  doc["ip"] = WiFi.localIP().toString();
  doc["version"] = "1.0.0";

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);

  Serial.println("Identificação enviada: " + message);
}

void sendHeartbeat() {
  DynamicJsonDocument doc(256);
  doc["type"] = "heartbeat";
  doc["timestamp"] = millis();
  doc["uptime"] = millis() / 1000;

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);

  Serial.println("Heartbeat enviado");
}

void sendResponse(String key, String value) {
  DynamicJsonDocument doc(256);
  doc["type"] = "response";
  doc[key] = value;
  doc["timestamp"] = millis();

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);

  Serial.println("Resposta enviada: " + message);
}

void sendStatus() {
  DynamicJsonDocument doc(512);
  doc["type"] = "status";
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["free_heap"] = ESP.getFreeHeap();
  doc["uptime"] = millis() / 1000;
  doc["led_status"] = digitalRead(LED_BUILTIN) == LOW ? "on" : "off";

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);

  Serial.println("Status enviado: " + message);
}

void sendPong() {
  DynamicJsonDocument doc(128);
  doc["type"] = "pong";
  doc["timestamp"] = millis();

  String message;
  serializeJson(doc, message);
  webSocket.sendTXT(message);

  Serial.println("Pong enviado");
}