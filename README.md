# Proximity LED System

Este projeto consiste em um ecossistema de Internet das Coisas (IoT) que integra um sistema embarcado baseado em **ESP8266** a uma interface web em **React**, permitindo o controle e monitoramento de hardware em tempo real via **WebSockets**.

## Tecnologias e Decisões de Engenharia

### **Hardware & Firmware (C)**

* **ESP8266:** Escolhido pelo seu excelente custo-benefício e módulo Wi-Fi nativo, ideal para aplicações de baixo consumo e alta conectividade.
* **Linguagem C:** Utilizada para garantir performance e controle granular sobre o microcontrolador.
* **Sensor de Proximidade:** Implementado para criar uma camada de interação física automatizada (Edge Computing), onde o dispositivo reage ao ambiente antes mesmo da intervenção do usuário.

### **Back-end e persistência (Node.js / JavaScript / Mongoose ODM / MongoDB)**

* **WebSockets:** Diferente do protocolo HTTP convencional, o uso de WebSockets foi estratégico para permitir uma **comunicação full-duplex de baixa latência**. Isso garante que o estado do LED e as leituras do sensor sejam atualizados instantaneamente na interface, sem necessidade de *polling*.
* **Banco de dados:** Persistência dos comandos e dos estados em banco de dados NOSQL, para elaboração de relatórios e acompanhamento de histórico de uso da aplicação.

### **Front-end (React)**

* **React.js:** Escolhido para criar uma interface declarativa e reativa. A aplicação permite que o usuário defina a lógica de comportamento do LED (modos de operação) de forma intuitiva, refletindo o estado do hardware em tempo real através de componentes dinâmicos.

---

## Funcionalidades

* **Configuração Remota:** Alteração do comportamento do LED via interface web sem necessidade de re-upload do firmware.
* **Conexão Robusta:** Tratamento de quedas de conexão e reconexão automática do WebSocket.

## Estrutura do Repositório

* `ArduinoNovo.c`: Código fonte em C para o ESP8266.
* `index.js`: Servidor Node.js para intermediação de mensagens.
* `/view`: App.js configurando o front-end e renderizações em tela.
