import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/src/theme/colors';

// This screen is hidden from tabs - Social tab replaces it
export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>This screen has been replaced by Social</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  text: { color: Colors.textSecondary },
});
