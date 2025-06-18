import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

export default function App() {
  // Seleções de cores (Pois mais de uma cor pode ser selecionada)
  const [coresSelecionadas, setCoresSelecionadas] = useState([]);

  const toggleCor = (cor) => {
    if (coresSelecionadas.includes(cor)) {
      setCoresSelecionadas(coresSelecionadas.filter(c => c !== cor));
    } else {
      setCoresSelecionadas([...coresSelecionadas, cor]);
    }
  };

  // Seleção de Modo (apenas um pode estar ativo)
  const [modoSelecionado, setModoSelecionado] = useState(null);

  const modos = ['Fixo', 'Pisca', 'Sensor', 'Sensor timer'];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>Controle de LED</Text>

      {/* Botões de cor */}
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

      {/* Botões de modo */}
      <View style={styles.modosContainer}>
        {modos.map((modo) => (
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

      {/* Botão iniciar */}
      <TouchableOpacity style={styles.botaoIniciar}>
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
