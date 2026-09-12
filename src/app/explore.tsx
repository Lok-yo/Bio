import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVault } from '@/context/vault-context';

const COLORS = {
  ink: '#1C2421',
  muted: '#72807B',
  paper: '#F6F7F4',
  card: '#FFFFFF',
  line: '#E7EBE7',
  green: '#2F8064',
  greenSoft: '#E2F0E9',
  dark: '#16251F',
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { biometricLabel, status, isUnlocked, openDeviceSettings, lock } = useVault();
  const active = status === 'ready' && isUnlocked;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 94 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>BIO · CONFIGURACIÓN</Text>
            <Text style={styles.title}>Controla tu privacidad.</Text>
          </View>
          <View style={styles.settingsIcon}><Ionicons name="options-outline" size={22} color={COLORS.green} /></View>
        </View>

        <View style={styles.securityCard}>
          <View style={styles.securityIcon}><Ionicons name="shield-checkmark" size={25} color={COLORS.green} /></View>
          <View style={styles.securityCopy}>
            <Text style={styles.securityTitle}>Protección biométrica</Text>
            <Text style={styles.securityDescription}>{active ? `Activa con ${biometricLabel}` : 'Requiere configuración en tu dispositivo'}</Text>
          </View>
          <View style={[styles.statusPill, !active && styles.statusPillOff]}>
            <View style={[styles.statusDot, !active && styles.statusDotOff]} />
            <Text style={[styles.statusText, !active && styles.statusTextOff]}>{active ? 'ACTIVA' : 'PENDIENTE'}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>SEGURIDAD</Text>
        <View style={styles.menuCard}>
          <Pressable style={styles.menuRow} onPress={() => void openDeviceSettings()}>
            <View style={[styles.menuIcon, { backgroundColor: '#E6F2EC' }]}><Ionicons name="finger-print-outline" size={21} color={COLORS.green} /></View>
            <View style={styles.menuCopy}>
              <Text style={styles.menuTitle}>Configurar biometría</Text>
              <Text style={styles.menuSub}>Gestiona huella o reconocimiento facial</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9BA8A2" />
          </Pressable>
          <View style={styles.separator} />
          <Pressable style={styles.menuRow} onPress={lock}>
            <View style={[styles.menuIcon, { backgroundColor: '#F1ECE4' }]}><Ionicons name="lock-closed-outline" size={21} color="#A47531" /></View>
            <View style={styles.menuCopy}>
              <Text style={styles.menuTitle}>Bloquear ahora</Text>
              <Text style={styles.menuSub}>Pide biometría la próxima vez que abras la bóveda</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9BA8A2" />
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>SOBRE BIO</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="phone-portrait-outline" size={19} color={COLORS.green} />
            <Text style={styles.infoText}>Tus archivos se guardan únicamente en este dispositivo.</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="key-outline" size={19} color={COLORS.green} />
            <Text style={styles.infoText}>El índice de tu bóveda se almacena con SecureStore.</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="eye-off-outline" size={19} color={COLORS.green} />
            <Text style={styles.infoText}>Bio no sube tu contenido a ningún servidor.</Text>
          </View>
        </View>

        <Text style={styles.version}>BIO · bóveda privada · v1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper },
  content: { paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  eyebrow: { color: COLORS.green, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: COLORS.ink, fontSize: 28, lineHeight: 33, fontWeight: '800', letterSpacing: -0.8, marginTop: 8, maxWidth: 280 },
  settingsIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.greenSoft, alignItems: 'center', justifyContent: 'center' },
  securityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.dark, padding: 16, borderRadius: 19 },
  securityIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#C9E7D8', alignItems: 'center', justifyContent: 'center' },
  securityCopy: { flex: 1, paddingLeft: 12 },
  securityTitle: { color: '#F4FAF6', fontSize: 14, fontWeight: '800' },
  securityDescription: { color: '#AFC5B9', fontSize: 11, marginTop: 5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(201, 231, 216, 0.15)', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99 },
  statusPillOff: { backgroundColor: 'rgba(255, 217, 189, 0.14)' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8CD1B0' },
  statusDotOff: { backgroundColor: '#E6AF83' },
  statusText: { color: '#BCE6D1', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  statusTextOff: { color: '#FFD9BD' },
  sectionLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginTop: 29, marginBottom: 11 },
  menuCard: { backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  menuIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, paddingLeft: 12, paddingRight: 8 },
  menuTitle: { color: COLORS.ink, fontSize: 13, fontWeight: '800' },
  menuSub: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  separator: { height: 1, backgroundColor: COLORS.line, marginLeft: 54 },
  infoCard: { backgroundColor: COLORS.card, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, padding: 16, gap: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { flex: 1, color: COLORS.muted, fontSize: 12, lineHeight: 17 },
  version: { textAlign: 'center', color: '#AAB4AE', fontSize: 10, marginTop: 31 },
});
