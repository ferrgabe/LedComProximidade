import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';

const IP_LOCAL = '192.168.0.30:8080';
const deviceId = '1'

export default function App() {

  const [coresSelecionadas, setCoresSelecionadas] = useState([]);
  const [modoSelecionado, setModoSelecionado] = useState(null);

  const toggleCor = (cor) => {
    if (coresSelecionadas.includes(cor)) {
      setCoresSelecionadas(coresSelecionadas.filter(c => c !== cor));
    } else {
      setCoresSelecionadas([...coresSelecionadas, cor]);
    }
  };

  const enviarComando = async () => {
    const jsonParaEnviar = {
      command: "led_update",
      parameters: {
        on: true,
        red: coresSelecionadas.includes('red'),
        blue: coresSelecionadas.includes('blue'),
        green: coresSelecionadas.includes('green'),
        behavior: modoSelecionado === 'Fixo' ? 1 :
                  modoSelecionado === 'Pisca' ? 2 :
                  modoSelecionado === 'Sensor' ? 3 :
                  modoSelecionado === 'Sensor timer' ? 4 : 0
      }
    };

    console.log("Enviando JSON:", jsonParaEnviar);

    try {
      const response = await fetch(`http://${IP_LOCAL}/api/device/1/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonParaEnviar)
      });

      const data = await response.json();
      console.log("Resposta do servidor:", data);
      Alert.alert("Sucesso", data.mensagem || "Comando enviado com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar comando:", error);
      Alert.alert("Erro", "Não foi possível enviar o comando");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>Controle de LED</Text>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginVertical: 20 }}>
        {[
          { cor: 'red', corClara: '#ff9999' },
          { cor: 'green', corClara: '#99ff99' },
          { cor: 'blue', corClara: '#9999ff' },
        ].map(({ cor, corClara }) => {
          const selecionado = coresSelecionadas.includes(cor);

          return (
            <TouchableOpacity
              key={cor}
              onPress={() => toggleCor(cor)}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: selecionado ? cor : corClara,
                borderWidth: selecionado ? 4 : 0,
                borderColor: selecionado ? 'black' : 'transparent',
              }}
            />
          );
        })}
      </View>

      <View style={styles.modosContainer}>
        {['Fixo', 'Pisca', 'Sensor', 'Sensor timer'].map((modo) => (
          <TouchableOpacity
            key={modo}
            style={[
              styles.botaoModo,
              modoSelecionado === modo && styles.botaoModoSelecionado,
            ]}
            onPress={() => setModoSelecionado(modo)}
          >
            <Text style={styles.textoModo}>{modo}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.botaoIniciar} onPress={enviarComando}>
        <Text style={styles.textoIniciar}>INICIAR</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  coresContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  botaoCor: {
    width: 50,
    height: 50,
    borderRadius: 25,
    opacity: 0.5,
  },
  botaoCorSelecionado: {
    borderWidth: 3,
    borderColor: '#000',
    opacity: 1,
  },
  modosContainer: {
    width: '100%',
    marginBottom: 32,
    gap: 16,
  },
  botaoModo: {
    backgroundColor: '#ddd',
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  botaoModoSelecionado: {
    backgroundColor: '#4caf50',
  },
  textoModo: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  botaoIniciar: {
    backgroundColor: '#2196f3',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 16,
  },
  textoIniciar: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
});
