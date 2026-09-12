import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type VaultItemKind = 'photo' | 'video' | 'document';
export type OriginalCleanupStrategy = 'media' | 'file';

export type VaultItem = {
  id: string;
  name: string;
  kind: VaultItemKind;
  uri: string;
  mimeType: string;
  size: number;
  createdAt: string;
  accent: string;
  originalDeleted?: boolean;
  originalAssetId?: string;
  originalCleanupStrategy?: OriginalCleanupStrategy;
  isSample?: boolean;
};

export type CleanupResult = {
  deleted: boolean;
  reason?: string;
};

export type RestoreResult = {
  restored: boolean;
  removedFromVault: boolean;
  reason?: string;
};

export type OriginalMediaDetails = {
  kind: 'photo' | 'video';
  fileName?: string | null;
  width?: number;
  height?: number;
};

const INDEX_KEY = 'bio.vault.index.v1';
const ITEM_KEY_PREFIX = 'bio.vault.item.';
const vaultDirectory = new Directory(Paths.document, 'bio-vault');

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function safeFileName(name: string) {
  const normalized = name.trim().replace(/[^a-zA-Z0-9._-]/g, '-');
  return normalized || `archivo-${Date.now()}`;
}

function getItemKey(id: string) {
  return `${ITEM_KEY_PREFIX}${id}`;
}

function parseIds(raw: string | null) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function getWebItems() {
  if (typeof localStorage === 'undefined') return [];
  return parseItems(localStorage.getItem(INDEX_KEY));
}

function parseItems(raw: string | null): VaultItem[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function migrateStoredItem(item: VaultItem): VaultItem {
  if (item.kind !== 'document') return item;

  const mimeType = item.mimeType.toLowerCase();
  const extension = item.name.toLowerCase().split('.').pop();
  const isPhoto = mimeType.startsWith('image/') || Boolean(extension && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'bmp', 'avif'].includes(extension));
  const isVideo = mimeType.startsWith('video/') || Boolean(extension && ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'].includes(extension));

  if (!isPhoto && !isVideo) return item;
  return {
    ...item,
    kind: isVideo ? 'video' : 'photo',
    originalCleanupStrategy: item.originalCleanupStrategy ?? 'file',
  };
}

async function ensureVaultDirectory() {
  if (Platform.OS === 'web' || vaultDirectory.exists) return;
  vaultDirectory.create({ idempotent: true, intermediates: true });
}

export async function loadVaultItems(): Promise<VaultItem[]> {
  if (Platform.OS === 'web') {
    const stored = getWebItems();
    const realItems = stored.filter((item) => !item.isSample);
    if (realItems.length !== stored.length) await persistVaultItems(realItems);
    return realItems;
  }

  const rawIndex = await SecureStore.getItemAsync(INDEX_KEY, secureStoreOptions);
  const ids = parseIds(rawIndex);
  if (!ids.length) return [];

  const entries = await Promise.all(
    ids.map(async (id) => {
      const rawItem = await SecureStore.getItemAsync(getItemKey(id), secureStoreOptions);
      if (!rawItem) return null;
      try {
        return JSON.parse(rawItem) as VaultItem;
      } catch {
        return null;
      }
    }),
  );

  const storedItems = entries.filter((item): item is VaultItem => Boolean(item)).map(migrateStoredItem);
  const realItems = storedItems.filter((item) => !item.isSample);
  if (realItems.length !== storedItems.length || realItems.some((item, index) => item !== storedItems[index])) {
    await persistVaultItems(realItems);
  }
  return realItems;
}

export async function persistVaultItems(items: VaultItem[]) {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(INDEX_KEY, JSON.stringify(items));
    }
    return;
  }

  const ids = items.map((item) => item.id);
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(ids), secureStoreOptions);
  await Promise.all(
    items.map((item) =>
      SecureStore.setItemAsync(getItemKey(item.id), JSON.stringify(item), secureStoreOptions),
    ),
  );
}

export async function removeStoredVaultItem(item: VaultItem) {
  if (Platform.OS === 'web' || item.isSample || !item.uri) return;
  deleteStoredVaultFile(item.uri);
}

function deleteStoredVaultFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The index is still removed when the original file is no longer available.
  }
}

async function copyFileWithStreams(sourceUri: string, destinationUri: string) {
  const reader = new File(sourceUri).readableStream().getReader();
  const writer = new File(destinationUri).writableStream().getWriter();

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      await writer.write(chunk.value);
    }
    await writer.close();
  } catch (error) {
    await writer.abort(error);
    throw error;
  } finally {
    reader.releaseLock();
    writer.releaseLock();
  }
}

function getMediaStoreIds(
  assetId: string | null | undefined,
  sourceUri: string | null | undefined,
  kind: OriginalMediaDetails['kind'],
) {
  const ids: string[] = [];
  const mediaCollection = kind === 'video' ? 'video' : 'images';

  const add = (value?: string | null) => {
    if (value && !ids.includes(value)) ids.push(value);
  };

  for (const candidate of [assetId, sourceUri]) {
    if (!candidate) continue;

    // Android Photo Picker can return a picker URI, while Asset expects the
    // corresponding MediaStore URI. The numeric ID is shared by both forms.
    const numericId =
      candidate.match(/(?:^|\/)media\/(\d+)(?:[/?#]|$)/)?.[1] ??
      candidate.match(/(?:^|\/)file\/(\d+)(?:[/?#]|$)/)?.[1] ??
      (/^\d+$/.test(candidate) ? candidate : undefined);

    if (numericId && (candidate.startsWith('content://media/') || /^\d+$/.test(candidate))) {
      add(`content://media/external/${mediaCollection}/media/${numericId}`);
    }
    add(candidate);
  }

  return ids;
}

async function requestPhotoVideoPermissions() {
  let permission = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
  if (permission.granted && permission.accessPrivileges === 'limited') {
    try {
      await MediaLibrary.presentPermissionsPicker(['photo', 'video']);
      permission = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);
    } catch {
      // The permission picker is unavailable on older Android versions.
    }
  }
  return permission;
}

export async function deleteOriginalMediaAsset(
  assetId?: string | null,
  sourceUri?: string | null,
  details?: OriginalMediaDetails,
): Promise<CleanupResult> {
  if (Platform.OS === 'web') {
    return { deleted: false, reason: 'La eliminación del original solo está disponible en el móvil.' };
  }

  try {
    const permission = await requestPhotoVideoPermissions();
    if (!permission.granted) {
      return { deleted: false, reason: 'No se concedió permiso para eliminar el original de la galería.' };
    }

    const directIds = getMediaStoreIds(assetId, sourceUri, details?.kind ?? 'photo');
    for (const directId of directIds) {
      try {
        await new MediaLibrary.Asset(directId).delete();
        return { deleted: true };
      } catch {
        // Some Android pickers return a temporary URI or an ID the media store cannot resolve.
      }
    }

    const sourceFileName = sourceUri?.startsWith('file://')
      ? decodeURIComponent(sourceUri.split('?')[0].split('/').pop() ?? '')
      : undefined;
    const targetFileName = details?.fileName?.trim() || sourceFileName || undefined;

    if (targetFileName || (details?.width && details.height)) {
      const mediaType = details?.kind === 'video' ? MediaLibrary.MediaType.VIDEO : MediaLibrary.MediaType.IMAGE;
      const candidates = await new MediaLibrary.Query()
        .eq(MediaLibrary.AssetField.MEDIA_TYPE, mediaType)
        .orderBy({ key: MediaLibrary.AssetField.MODIFICATION_TIME, ascending: false })
        .limit(5000)
        .exeForMetadata();
      const filenameMatches = targetFileName
        ? candidates.filter((candidate) => candidate.filename === targetFileName)
        : [];
      const dimensionMatches = details?.width && details.height
        ? (targetFileName ? filenameMatches : candidates).filter(
            (candidate) => candidate.width === details.width && candidate.height === details.height,
          )
        : [];
      const matches = dimensionMatches.length ? dimensionMatches : filenameMatches;

      if (matches.length === 1) {
        await new MediaLibrary.Asset(matches[0].id).delete();
        return { deleted: true };
      }
    }

    return {
      deleted: false,
      reason: 'No se pudo identificar el elemento original en la galería. Selecciónalo desde Fotos/Galería y vuelve a intentarlo.',
    };
  } catch {
    return { deleted: false, reason: 'El sistema no permitió eliminar el original de la galería.' };
  }
}

export async function deleteOriginalFile(sourceUri?: string | null): Promise<CleanupResult> {
  if (Platform.OS === 'web') {
    return { deleted: false, reason: 'La eliminación del original solo está disponible en el móvil.' };
  }
  if (!sourceUri) {
    return { deleted: false, reason: 'El selector no proporcionó una ruta para borrar el original.' };
  }

  try {
    new File(sourceUri).delete();
    return { deleted: true };
  } catch {
    return {
      deleted: false,
      reason: 'El proveedor del documento no permitió eliminar el archivo original.',
    };
  }
}

export async function restoreVaultItem(item: VaultItem): Promise<RestoreResult> {
  if (Platform.OS === 'web') {
    return {
      restored: false,
      removedFromVault: false,
      reason: 'La restauración solo está disponible en el móvil.',
    };
  }
  if (item.isSample) {
    return { restored: false, removedFromVault: false, reason: 'Este elemento es solo una muestra.' };
  }

  try {
    if (item.kind === 'photo' || item.kind === 'video') {
      const permission = await requestPhotoVideoPermissions();
      if (!permission.granted) {
        return {
          restored: false,
          removedFromVault: false,
          reason: 'Concede permiso para guardar el archivo en la galería del dispositivo.',
        };
      }
      await MediaLibrary.Asset.create(item.uri);
      deleteStoredVaultFile(item.uri);
      return { restored: true, removedFromVault: true };
    }

    if (Platform.OS === 'android') {
      const directoryPermission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!directoryPermission.granted) {
        return {
          restored: false,
          removedFromVault: false,
          reason: 'Selecciona una carpeta para restaurar el documento.',
        };
      }

      const destinationUri = await StorageAccessFramework.createFileAsync(
        directoryPermission.directoryUri,
        item.name,
        item.mimeType,
      );
      await copyFileWithStreams(item.uri, destinationUri);
      deleteStoredVaultFile(item.uri);
      return {
        restored: true,
        removedFromVault: true,
        reason: 'El documento volvió a la carpeta que seleccionaste.',
      };
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      return {
        restored: false,
        removedFromVault: false,
        reason: 'Este dispositivo no tiene disponible una forma de restaurar documentos.',
      };
    }
    await Sharing.shareAsync(item.uri, {
      dialogTitle: `Restaurar ${item.name}`,
      mimeType: item.mimeType,
    });
    return {
      restored: true,
      removedFromVault: false,
      reason: 'Elige una aplicación o ubicación para guardar el documento.',
    };
  } catch {
    return {
      restored: false,
      removedFromVault: false,
      reason: 'No se pudo restaurar este archivo.',
    };
  }
}

export async function copyIntoVault(sourceUri: string, originalName: string) {
  if (Platform.OS === 'web') return sourceUri;

  await ensureVaultDirectory();
  const destination = new File(vaultDirectory, `${Date.now()}-${safeFileName(originalName)}`);
  const source = new File(sourceUri);
  await source.copy(destination);
  return destination.uri;
}
