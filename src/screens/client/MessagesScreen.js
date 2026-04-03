import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function MessagesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Ionicons name="chatbubble-ellipses" size={48} color={colors.primary} style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.sub}>Coming soon — real-time chat with your coach</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  title: { ...typography.h2, color: colors.textPrimary },
  sub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
});
