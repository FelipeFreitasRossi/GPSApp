import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { SafeAreaView } from "react-native-safe-area-context";

export default function History() {
  const history = useSelector((state: RootState) => state.walks.history);

  return (
    <SafeAreaView style={[styles.container]}>
      <Text style={styles.title}>Histórico de Caminhadas</Text>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text>{item.date}</Text>
            <Text>{(item.distance / 1000).toFixed(2)} km</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 10, color: "white" },
  item: {
    padding: 10,
    marginBottom: 5,
    backgroundColor: "white",
    borderRadius: 8,
    elevation: 2,
  },
});
