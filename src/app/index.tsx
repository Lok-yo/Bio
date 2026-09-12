import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVault } from '@/context/vault-context';
import type { VaultItem, VaultItemKind } from '@/lib/vault-storage';

type Filter = 'all' | VaultItemKind;

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

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'photo', label: 'Fotos' },
  { id: 'video', label: 'Vídeos' },
  { id: 'document', label: 'Documentos' },
];

function formatSize(bytes: number) {
  if (!bytes) return 'Tamaño desconocido';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(date));
}

function kindLabel(kind: VaultItemKind) {
  return kind === 'photo' ? 'FOTO' : kind === 'video' ? 'VÍDEO' : 'PDF';
}

function kindIcon(kind: VaultItemKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'photo') return 'image-outline';
  if (kind === 'video') return 'play-circle-outline';
  return 'document-text-outline';
}

function restoreLabel(kind: VaultItemKind) {
  return 'Restaurar';
}

function kindFromMimeType(mimeType?: string | null, name?: string): VaultItemKind {
  if (mimeType?.startsWith('image/')) return 'photo';
  if (mimeType?.startsWith('video/')) return 'video';
  const extension = name?.toLowerCase().split('.').pop();
  if (extension && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'bmp', 'avif'].includes(extension)) return 'photo';
  if (extension && ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'].includes(extension)) return 'video';
  return 'document';
}

type CleanupNotice = {
  source: 'media' | 'file';
  count: number;
};

function LockScreen() {
  const { biometricLabel, errorMessage, status, unlock, openDeviceSettings, clearError } = useVault();
  const isChecking = status === 'checking' || status === 'authenticating';
  const isUnavailable = status === 'unavailable';
  const biometricIcon = biometricLabel.toLowerCase().includes('face') ? 'scan-outline' : 'finger-print-outline';

  return (
    <View style={styles.lockRoot}>
      <StatusBar style="light" />
      <View style={styles.lockOrbOne} />
      <View style={styles.lockOrbTwo} />
      <View style={styles.lockTopRow}>
        <View style={styles.brandMarkSmall}>
          <Ionicons name="shield-checkmark" size={17} color="#C9E7D8" />
        </View>
        <Text style={styles.lockBrand}>BIO</Text>
        <View style={styles.privatePill}>
          <View style={styles.privateDot} />
          <Text style={styles.privatePillText}>PRIVADO</Text>
        </View>
      </View>

      <View style={styles.lockContent}>
        <View style={styles.biometricHaloOuter}>
          <View style={styles.biometricHaloInner}>
            <Ionicons name={biometricIcon} size={54} color="#BCE6D1" />
          </View>
        </View>
        <Text style={styles.lockEyebrow}>BÓVEDA PERSONAL</Text>
        <Text style={styles.lockTitle}>Tu privacidad,{`\n`}bajo llave.</Text>
        <Text style={styles.lockCopy}>
          Desbloquea con {biometricLabel} para ver tus fotos, vídeos y documentos guardados.
        </Text>

        {errorMessage ? (
          <Pressable style={styles.lockError} onPress={clearError} accessibilityRole="alert">
            <Ionicons name="information-circle-outline" size={18} color="#FFD9BD" />
            <Text style={styles.lockErrorText}>{errorMessage}</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.unlockButton, pressed && styles.pressed]}
          onPress={() => void unlock()}
          disabled={isChecking || isUnavailable}
          accessibilityRole="button"
          accessibilityLabel={`Desbloquear con ${biometricLabel}`}>
          {isChecking ? (
            <ActivityIndicator color={COLORS.dark} />
          ) : (
            <Ionicons name={biometricIcon} size={22} color={COLORS.dark} />
          )}
          <Text style={styles.unlockButtonText}>{isChecking ? 'Verificando…' : `Desbloquear con ${biometricLabel}`}</Text>
          {!isChecking && <Ionicons name="arrow-forward" size={19} color={COLORS.dark} />}
        </Pressable>

        {isUnavailable ? (
          <Pressable onPress={() => void openDeviceSettings()} style={styles.settingsLink}>
            <Ionicons name="settings-outline" size={16} color="#BCE6D1" />
            <Text style={styles.settingsLinkText}>Abrir ajustes de biometría</Text>
          </Pressable>
        ) : (
          <Text style={styles.lockFootnote}>Tus archivos permanecen en este dispositivo</Text>
        )}
      </View>
    </View>
  );
}

function MediaTile({ item, onPress, onDelete }: { item: VaultItem; onPress: () => void; onDelete: () => void }) {
  const showImage = item.kind === 'photo' || item.kind === 'video';

  return (
    <Pressable style={({ pressed }) => [styles.mediaTile, pressed && styles.tilePressed]} onPress={onPress}>
      <View style={[styles.mediaPreview, { backgroundColor: item.accent }]}>
        {showImage ? (
          <Image source={{ uri: item.uri }} style={styles.mediaImage} contentFit="cover" transition={180} />
        ) : (
          <View style={styles.documentPreview}>
            <Ionicons name="document-text" size={40} color="#FFF7E6" />
            <View style={styles.documentLines}>
              <View style={styles.documentLineWide} />
              <View style={styles.documentLineShort} />
              <View style={styles.documentLineWide} />
            </View>
          </View>
        )}
        <View style={styles.previewShade} />
        <View style={styles.mediaKindBadge}>
          <Ionicons name={kindIcon(item.kind)} size={12} color="#FFFFFF" />
          <Text style={styles.mediaKindText}>{kindLabel(item.kind)}</Text>
        </View>
        {item.kind === 'video' && (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={17} color="#FFFFFF" />
          </View>
        )}
        <Pressable
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          style={styles.deleteButton}
          accessibilityRole="button"
          accessibilityLabel={`Eliminar ${item.name}`}>
          <Ionicons name="ellipsis-horizontal" size={17} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.mediaInfo}>
        <Text style={styles.mediaName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.mediaMeta}>{formatDate(item.createdAt)} · {formatSize(item.size)}</Text>
      </View>
    </Pressable>
  );
}

function AddSheet({ visible, onClose, onPickMedia, onPickDocument }: {
  visible: boolean;
  onClose: () => void;
  onPickMedia: () => void;
  onPickDocument: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Añadir a tu bóveda</Text>
          <Text style={styles.sheetCopy}>Bio pedirá permiso para guardar una copia privada y eliminar el original de tu galería.</Text>
          <View style={styles.sheetActions}>
            <Pressable style={styles.sheetAction} onPress={onPickMedia}>
              <View style={[styles.sheetIcon, { backgroundColor: '#E6F2EC' }]}>
                <Ionicons name="images-outline" size={24} color={COLORS.green} />
              </View>
              <View style={styles.sheetActionText}>
                <Text style={styles.sheetActionTitle}>Fotos y vídeos</Text>
                <Text style={styles.sheetActionSub}>Desde tu galería</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A0AAA5" />
            </Pressable>
            <Pressable style={styles.sheetAction} onPress={onPickDocument}>
              <View style={[styles.sheetIcon, { backgroundColor: '#F7EEDC' }]}>
                <Ionicons name="document-text-outline" size={24} color="#A47531" />
              </View>
              <View style={styles.sheetActionText}>
                <Text style={styles.sheetActionTitle}>Documento o imagen</Text>
                <Text style={styles.sheetActionSub}>Desde Archivos · recomendado para Google Photos</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A0AAA5" />
            </Pressable>
          </View>
          <Pressable style={styles.cancelAction} onPress={onClose}>
            <Text style={styles.cancelActionText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CleanupNoticeModal({ notice, onClose }: { notice: CleanupNotice | null; onClose: () => void }) {
  if (!notice) return null;

  const isMediaSource = notice.source === 'media';
  const countLabel = notice.count === 1 ? 'un original' : `${notice.count} originales`;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.noticeBackdrop}>
        <View style={styles.noticeCard}>
          <View style={styles.noticeIcon}>
            <Ionicons name={isMediaSource ? 'images-outline' : 'document-text-outline'} size={27} color={COLORS.green} />
          </View>
          <Text style={styles.noticeEyebrow}>IMPORTACIÓN COMPLETADA</Text>
          <Text style={styles.noticeTitle}>El original no se borró</Text>
          <Text style={styles.noticeCopy}>
            El contenido quedó protegido en Bio, pero no pudimos eliminar {countLabel} del dispositivo.
          </Text>

          <View style={styles.noticeTip}>
            <Ionicons name="information-circle-outline" size={21} color={COLORS.green} />
            <View style={styles.noticeTipCopy}>
              {isMediaSource ? (
                <>
                  <Text style={styles.noticeTipTitle}>¿Usas Google Photos?</Text>
                  <Text style={styles.noticeTipText}>
                    Google Photos no siempre permite que Bio elimine directamente el original. Vuelve a añadir la imagen desde{' '}
                    <Text style={styles.noticeTipStrong}>Documento</Text> y selecciónala en el administrador de archivos del teléfono.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.noticeTipTitle}>Intenta de nuevo desde Archivos</Text>
                  <Text style={styles.noticeTipText}>
                    Selecciona el archivo directamente en el administrador de archivos para que Bio pueda retirarlo del dispositivo.
                  </Text>
                </>
              )}
            </View>
          </View>

          <Pressable style={({ pressed }) => [styles.noticeButton, pressed && styles.pressed]} onPress={onClose}>
            <Text style={styles.noticeButtonText}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ItemPreview({ item, onClose, onRestore, onDelete, onOpenFile }: {
  item: VaultItem | null;
  onClose: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onOpenFile: (item: VaultItem) => void;
}) {
  if (!item) return null;
  return (
    <Modal visible={Boolean(item)} animationType="fade" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.previewModal}>
        <View style={styles.previewHeader}>
          <View>
            <Text style={styles.previewEyebrow}>{kindLabel(item.kind)}</Text>
            <Text style={styles.previewTitle} numberOfLines={1}>{item.name}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closePreview} hitSlop={10}>
            <Ionicons name="close" size={22} color={COLORS.ink} />
          </Pressable>
        </View>
        <View style={[styles.previewCanvas, { backgroundColor: item.accent }]}>
          {item.kind === 'photo' ? (
            <Image source={{ uri: item.uri }} style={styles.fullPreviewImage} contentFit="contain" />
          ) : item.kind === 'video' ? (
            <View style={styles.videoPreview}>
              <Image source={{ uri: item.uri }} style={styles.fullPreviewImage} contentFit="cover" />
              <View style={styles.videoOverlay}>
                <View style={styles.bigPlayButton}>
                  <Ionicons name="play" size={28} color={COLORS.dark} />
                </View>
                <Text style={styles.videoHint}>Vídeo guardado en tu dispositivo</Text>
              </View>
            </View>
          ) : (
            <View style={styles.documentModalPreview}>
              <Ionicons name="document-text" size={76} color="#FFF7E6" />
              <Text style={styles.documentModalLabel}>Documento protegido</Text>
              <Text style={styles.documentModalSub}>{item.mimeType || 'Archivo local'}</Text>
            </View>
          )}
        </View>
        <View style={styles.previewDetails}>
          <View>
            <Text style={styles.previewDetailLabel}>Guardado</Text>
            <Text style={styles.previewDetailValue}>{formatDate(item.createdAt)} · {formatSize(item.size)}</Text>
          </View>
          <View style={styles.previewActions}>
            <Pressable style={styles.restoreButton} onPress={onRestore}>
              <Ionicons name={item.kind === 'document' ? 'share-outline' : 'return-up-back-outline'} size={17} color="#FFFFFF" />
              <Text style={styles.restoreButtonText}>{restoreLabel(item.kind)}</Text>
            </Pressable>
            <Pressable style={styles.deletePreviewButton} onPress={onDelete}>
              <Ionicons name="trash-outline" size={17} color="#A34F42" />
              <Text style={styles.deletePreviewButtonText}>Eliminar</Text>
            </Pressable>
          </View>
          {item.kind !== 'photo' && (
            <Pressable style={styles.openFileButton} onPress={() => onOpenFile(item)}>
              <Ionicons name="open-outline" size={17} color="#FFFFFF" />
              <Text style={styles.openFileButtonText}>Abrir archivo</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const {
    isUnlocked,
    items,
    addPickedItem,
    deleteItem,
    restoreItem,
    lock,
    beginExternalFlow,
    endExternalFlow,
  } = useVault();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [previewItem, setPreviewItem] = useState<VaultItem | null>(null);
  const [cleanupNotice, setCleanupNotice] = useState<CleanupNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Guardando en tu bóveda…');

  const visibleItems = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.kind === filter)),
    [filter, items],
  );

  const handlePickMedia = async () => {
    setSheetVisible(false);
    beginExternalFlow();
    try {
      const deletionPermission = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
      if (!deletionPermission.granted) {
        Alert.alert('Permiso necesario', 'Concede acceso a fotos y vídeos para que Bio pueda borrar el original después de guardarlo.');
        return;
      }
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false);
      if (!permission.granted) {
        Alert.alert('Permiso necesario', 'Concede acceso a tu galería para guardar fotos y vídeos en Bio.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        defaultTab: 'photos',
        allowsMultipleSelection: true,
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) return;
      setBusy(true);
      setBusyLabel('Guardando en tu bóveda…');
      const cleanupIssues: string[] = [];
      for (const asset of result.assets) {
        const kind: VaultItemKind = asset.type === 'video' ? 'video' : 'photo';
        const cleanup = await addPickedItem({
          name: asset.fileName ?? `${kind === 'video' ? 'video' : 'foto'}-${Date.now()}`,
          sourceUri: asset.uri,
          kind,
          mimeType: asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
          size: asset.fileSize,
          originalAssetId: asset.assetId,
          originalUri: asset.uri,
          originalFileName: asset.fileName,
          originalWidth: asset.width,
          originalHeight: asset.height,
        });
        if (!cleanup.originalDeleted) cleanupIssues.push(cleanup.cleanupReason ?? 'No se pudo eliminar un original.');
      }
      if (cleanupIssues.length) {
        setCleanupNotice({ source: 'media', count: cleanupIssues.length });
      }
    } catch {
      Alert.alert('No se pudo guardar', 'Intenta seleccionar el contenido de nuevo.');
    } finally {
      endExternalFlow();
      setBusy(false);
    }
  };

  const handlePickDocument = async () => {
    setSheetVisible(false);
    beginExternalFlow();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: false,
      });
      if (result.canceled) return;
      setBusy(true);
      setBusyLabel('Guardando en tu bóveda…');
      const cleanupIssues: string[] = [];
      for (const asset of result.assets) {
        const kind = kindFromMimeType(asset.mimeType, asset.name);
        const cleanup = await addPickedItem({
          name: asset.name,
          sourceUri: asset.uri,
          kind,
          mimeType: asset.mimeType,
          size: asset.size,
          originalUri: asset.uri,
          originalCleanupStrategy: 'file',
        });
        if (!cleanup.originalDeleted) cleanupIssues.push(cleanup.cleanupReason ?? 'No se pudo eliminar un original.');
      }
      if (cleanupIssues.length) {
        setCleanupNotice({ source: 'file', count: cleanupIssues.length });
      }
    } catch {
      Alert.alert('No se pudo guardar', 'Intenta seleccionar el documento de nuevo.');
    } finally {
      endExternalFlow();
      setBusy(false);
    }
  };

  const confirmDelete = (item: VaultItem) => {
    Alert.alert('Eliminar contenido', `¿Quieres eliminar “${item.name}” de tu bóveda?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setPreviewItem(null);
          void deleteItem(item);
        },
      },
    ]);
  };

  const handleRestore = async (item: VaultItem) => {
    setPreviewItem(null);
    setBusy(true);
    setBusyLabel(`${restoreLabel(item.kind)}…`);
    beginExternalFlow();
    try {
      const result = await restoreItem(item);
      if (result.restored) {
        Alert.alert(
          item.kind === 'document' ? 'Exportación iniciada' : 'Contenido restaurado',
          result.reason ?? (item.kind === 'document' ? 'Elige dónde guardar el documento.' : 'El archivo volvió a tu galería.'),
        );
      } else {
        Alert.alert('No se pudo restaurar', result.reason ?? 'Intenta de nuevo.');
      }
    } catch {
      Alert.alert('No se pudo restaurar', 'Intenta de nuevo.');
    } finally {
      endExternalFlow();
      setBusy(false);
    }
  };

  const handleOpenFile = async (item: VaultItem) => {
    beginExternalFlow();
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('No se puede abrir', 'No hay una aplicación disponible para abrir este archivo.');
        return;
      }
      await Sharing.shareAsync(item.uri, {
        dialogTitle: `Abrir ${item.name}`,
        mimeType: item.mimeType,
      });
    } catch {
      Alert.alert('No se puede abrir', 'No se encontró una aplicación compatible con este archivo.');
    } finally {
      endExternalFlow();
    }
  };

  if (!isUnlocked) return <LockScreen />;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={{ paddingBottom: insets.bottom + 92, paddingTop: insets.top + 12 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View style={styles.headerBrandRow}>
                <View style={styles.brandMark}>
                  <Ionicons name="shield-checkmark" size={19} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.brandName}>BIO</Text>
                  <Text style={styles.brandSubtitle}>BÓVEDA PERSONAL</Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                <View style={styles.secureBadge}>
                  <View style={styles.secureBadgeDot} />
                  <Text style={styles.secureBadgeText}>SEGURO</Text>
                </View>
                <Pressable style={styles.lockButton} onPress={lock}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.ink} />
                </Pressable>
              </View>
            </View>
            <Text style={styles.pageTitle}>Todo lo tuyo,{`\n`}en privado.</Text>
            <Text style={styles.pageCopy}>Tu contenido importante, protegido en este dispositivo.</Text>

            <View style={styles.statsCard}>
              <View style={styles.statsIcon}>
                <Ionicons name="layers-outline" size={23} color={COLORS.green} />
              </View>
              <View style={styles.statsMain}>
                <Text style={styles.statsLabel}>CONTENIDO PROTEGIDO</Text>
                <Text style={styles.statsValue}>{items.length} <Text style={styles.statsValueSmall}>{items.length === 1 ? 'elemento' : 'elementos'}</Text></Text>
              </View>
              <View style={styles.statsDivider} />
              <View style={styles.statsSide}>
                <Ionicons name="finger-print-outline" size={17} color={COLORS.green} />
                <Text style={styles.statsSideText}>Biometría{`\n`}activa</Text>
              </View>
            </View>

            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Tu contenido</Text>
              <Text style={styles.sectionCount}>{visibleItems.length} mostrados</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
              {filters.map((option) => (
                <Pressable
                  key={option.id}
                  style={[styles.filterChip, filter === option.id && styles.filterChipActive]}
                  onPress={() => setFilter(option.id)}>
                  <Text style={[styles.filterText, filter === option.id && styles.filterTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <MediaTile item={item} onPress={() => setPreviewItem(item)} onDelete={() => confirmDelete(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Ionicons name="file-tray-outline" size={30} color={COLORS.green} /></View>
            <Text style={styles.emptyTitle}>Aún no hay elementos aquí</Text>
            <Text style={styles.emptyCopy}>Añade contenido desde tu dispositivo para mantenerlo protegido.</Text>
          </View>
        }
      />

      <Pressable style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]} onPress={() => setSheetVisible(true)}>
        <Ionicons name="add" size={23} color="#FFFFFF" />
        <Text style={styles.fabText}>Añadir</Text>
      </Pressable>

      {busy && (
        <View style={styles.busyToast}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.busyText}>{busyLabel}</Text>
        </View>
      )}

      <AddSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} onPickMedia={() => void handlePickMedia()} onPickDocument={() => void handlePickDocument()} />
      <CleanupNoticeModal notice={cleanupNotice} onClose={() => setCleanupNotice(null)} />
      <ItemPreview
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onOpenFile={handleOpenFile}
        onRestore={() => {
          if (previewItem) void handleRestore(previewItem);
        }}
        onDelete={() => {
          if (previewItem) confirmDelete(previewItem);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.paper },
  pressed: { opacity: 0.78 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  headerBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: COLORS.dark, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: COLORS.ink, fontSize: 15, fontWeight: '800', letterSpacing: 1.7 },
  brandSubtitle: { color: COLORS.muted, fontSize: 8, fontWeight: '700', letterSpacing: 1.2, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.greenSoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99 },
  secureBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.green },
  secureBadgeText: { color: COLORS.green, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  lockButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.line },
  pageTitle: { color: COLORS.ink, fontSize: 34, lineHeight: 37, fontWeight: '800', letterSpacing: -1.2, marginTop: 31, marginHorizontal: 20 },
  pageCopy: { color: COLORS.muted, fontSize: 14, lineHeight: 20, marginTop: 11, marginHorizontal: 20 },
  statsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, marginHorizontal: 20, marginTop: 26, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line },
  statsIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.greenSoft, alignItems: 'center', justifyContent: 'center' },
  statsMain: { flex: 1, paddingLeft: 12 },
  statsLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  statsValue: { color: COLORS.ink, fontSize: 24, fontWeight: '800', marginTop: 2 },
  statsValueSmall: { color: COLORS.muted, fontSize: 12, fontWeight: '500' },
  statsDivider: { width: 1, height: 35, backgroundColor: COLORS.line, marginRight: 14 },
  statsSide: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  statsSideText: { color: COLORS.green, fontSize: 10, fontWeight: '700', lineHeight: 13 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 29, paddingHorizontal: 20 },
  sectionTitle: { color: COLORS.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  sectionCount: { color: COLORS.muted, fontSize: 11 },
  filtersContent: { gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18 },
  filterChip: { borderRadius: 99, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 15, paddingVertical: 9 },
  filterChipActive: { backgroundColor: COLORS.dark, borderColor: COLORS.dark },
  filterText: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  gridRow: { gap: 12, paddingHorizontal: 20 },
  mediaTile: { flex: 1, maxWidth: '50%', backgroundColor: COLORS.card, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.line, marginBottom: 12 },
  tilePressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  mediaPreview: { height: 155, overflow: 'hidden', position: 'relative' },
  mediaImage: { width: '100%', height: '100%' },
  previewShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(13, 24, 20, 0.10)' },
  documentPreview: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  documentLines: { gap: 5, width: 61 },
  documentLineWide: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)' },
  documentLineShort: { height: 4, width: 39, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.42)' },
  mediaKindBadge: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, backgroundColor: 'rgba(22, 37, 31, 0.72)' },
  mediaKindText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800', letterSpacing: 0.7 },
  playBadge: { position: 'absolute', alignSelf: 'center', top: 61, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(22, 37, 31, 0.74)', alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  deleteButton: { position: 'absolute', right: 8, top: 8, width: 25, height: 25, borderRadius: 9, backgroundColor: 'rgba(22, 37, 31, 0.62)', alignItems: 'center', justifyContent: 'center' },
  mediaInfo: { paddingHorizontal: 12, paddingVertical: 12 },
  mediaName: { color: COLORS.ink, fontSize: 13, fontWeight: '700' },
  mediaMeta: { color: COLORS.muted, fontSize: 10, marginTop: 5 },
  emptyState: { alignItems: 'center', paddingHorizontal: 40, paddingVertical: 48 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: COLORS.greenSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '800', marginTop: 16 },
  emptyCopy: { color: COLORS.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  fab: { position: 'absolute', right: 20, bottom: 22, height: 54, paddingHorizontal: 18, borderRadius: 19, backgroundColor: COLORS.dark, flexDirection: 'row', alignItems: 'center', gap: 7, shadowColor: '#16251F', shadowOpacity: 0.2, shadowRadius: 13, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
  fabText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  fabPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  busyToast: { position: 'absolute', alignSelf: 'center', bottom: 91, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: COLORS.dark, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 13 },
  busyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(14, 27, 21, 0.38)' },
  sheet: { backgroundColor: COLORS.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 11, paddingBottom: 24 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#CDD5D0', marginBottom: 23 },
  sheetTitle: { color: COLORS.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.5 },
  sheetCopy: { color: COLORS.muted, fontSize: 13, marginTop: 7, marginBottom: 20 },
  sheetActions: { gap: 10 },
  sheetAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: COLORS.line },
  sheetIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetActionText: { flex: 1, paddingLeft: 12 },
  sheetActionTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '800' },
  sheetActionSub: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  cancelAction: { alignItems: 'center', paddingVertical: 16 },
  cancelActionText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  noticeBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, backgroundColor: 'rgba(14, 27, 21, 0.58)' },
  noticeCard: { width: '100%', backgroundColor: COLORS.paper, borderRadius: 26, paddingHorizontal: 22, paddingTop: 23, paddingBottom: 18, shadowColor: '#0D1C16', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  noticeIcon: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.greenSoft, marginBottom: 17 },
  noticeEyebrow: { color: COLORS.green, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  noticeTitle: { color: COLORS.ink, fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.5, marginTop: 7 },
  noticeCopy: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  noticeTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: COLORS.greenSoft, borderRadius: 16, padding: 13, marginTop: 18 },
  noticeTipCopy: { flex: 1 },
  noticeTipTitle: { color: COLORS.dark, fontSize: 13, fontWeight: '800' },
  noticeTipText: { color: '#4C6A5D', fontSize: 12, lineHeight: 18, marginTop: 4 },
  noticeTipStrong: { color: COLORS.dark, fontWeight: '800' },
  noticeButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.dark, minHeight: 50, borderRadius: 15, marginTop: 18 },
  noticeButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  previewModal: { flex: 1, backgroundColor: COLORS.paper, paddingTop: 22 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 18 },
  previewEyebrow: { color: COLORS.green, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  previewTitle: { color: COLORS.ink, fontSize: 19, fontWeight: '800', marginTop: 4, maxWidth: 280 },
  closePreview: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  previewCanvas: { flex: 1, marginHorizontal: 20, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fullPreviewImage: { width: '100%', height: '100%' },
  videoPreview: { width: '100%', height: '100%' },
  videoOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22, 37, 31, 0.25)' },
  bigPlayButton: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#D7F0E2', alignItems: 'center', justifyContent: 'center', paddingLeft: 4 },
  videoHint: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginTop: 14 },
  documentModalPreview: { alignItems: 'center', justifyContent: 'center' },
  documentModalLabel: { color: '#FFF7E6', fontSize: 18, fontWeight: '800', marginTop: 17 },
  documentModalSub: { color: 'rgba(255, 247, 230, 0.72)', fontSize: 12, marginTop: 6 },
  previewDetails: { paddingHorizontal: 20, paddingTop: 19, paddingBottom: 32 },
  previewDetailLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  previewDetailValue: { color: COLORS.ink, fontSize: 13, fontWeight: '700', marginTop: 4 },
  previewActions: { flexDirection: 'row', gap: 9, marginTop: 17 },
  restoreButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.green, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 12 },
  restoreButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  deletePreviewButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#FBEDEA', borderWidth: 1, borderColor: '#F0D4CE', paddingHorizontal: 13, paddingVertical: 12, borderRadius: 12 },
  deletePreviewButtonText: { color: '#A34F42', fontSize: 12, fontWeight: '800' },
  openFileButton: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.dark, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 12 },
  openFileButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  lockRoot: { flex: 1, backgroundColor: '#16251F', overflow: 'hidden' },
  lockOrbOne: { position: 'absolute', width: 360, height: 360, borderRadius: 180, backgroundColor: '#1F3A30', top: -150, right: -130, opacity: 0.72 },
  lockOrbTwo: { position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 1, borderColor: 'rgba(188, 230, 209, 0.15)', bottom: -115, left: -100 },
  lockTopRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 25, paddingHorizontal: 24, gap: 9 },
  brandMarkSmall: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(188, 230, 209, 0.15)', alignItems: 'center', justifyContent: 'center' },
  lockBrand: { color: '#E2F2E9', fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  privatePill: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(188,230,209,0.22)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  privateDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8CD1B0' },
  privatePillText: { color: '#BCE6D1', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  lockContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  biometricHaloOuter: { width: 154, height: 154, borderRadius: 77, borderWidth: 1, borderColor: 'rgba(188,230,209,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 31 },
  biometricHaloInner: { width: 112, height: 112, borderRadius: 56, backgroundColor: 'rgba(188,230,209,0.12)', borderWidth: 1, borderColor: 'rgba(188,230,209,0.38)', alignItems: 'center', justifyContent: 'center' },
  lockEyebrow: { color: '#8CC9A8', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  lockTitle: { color: '#F4FAF6', fontSize: 39, lineHeight: 42, fontWeight: '800', textAlign: 'center', letterSpacing: -1.5, marginTop: 12 },
  lockCopy: { color: '#AFC5B9', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 300, marginTop: 15 },
  lockError: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 17, backgroundColor: 'rgba(180, 107, 70, 0.2)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, maxWidth: 340 },
  lockErrorText: { flex: 1, color: '#FFD9BD', fontSize: 12, lineHeight: 17 },
  unlockButton: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#C9E7D8', minHeight: 56, borderRadius: 17, paddingHorizontal: 17, marginTop: 27, width: '100%', justifyContent: 'center' },
  unlockButtonText: { color: COLORS.dark, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  settingsLink: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 22, padding: 8 },
  settingsLinkText: { color: '#BCE6D1', fontSize: 12, fontWeight: '700' },
  lockFootnote: { color: '#769387', fontSize: 11, marginTop: 21 },
});
