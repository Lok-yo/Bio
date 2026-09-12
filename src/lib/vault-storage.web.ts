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

export async function loadVaultItems(): Promise<VaultItem[]> {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return [];
  const stored = parseItems(localStorage.getItem(INDEX_KEY));
  const migratedItems = stored.map(migrateStoredItem);
  const realItems = migratedItems.filter((item) => !item.isSample);
  if (realItems.length !== stored.length || realItems.some((item, index) => item !== stored[index])) {
    await persistVaultItems(realItems);
  }
  return realItems;
}

export async function persistVaultItems(items: VaultItem[]) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(INDEX_KEY, JSON.stringify(items));
  }
}

export async function removeStoredVaultItem(_item: VaultItem) {}

export async function copyIntoVault(sourceUri: string, _originalName: string) {
  return sourceUri;
}

export async function deleteOriginalMediaAsset(
  _assetId?: string | null,
  _sourceUri?: string | null,
  _details?: OriginalMediaDetails,
): Promise<CleanupResult> {
  return {
    deleted: false,
    reason: 'La eliminación del original solo está disponible en el móvil.',
  };
}

export async function deleteOriginalFile(): Promise<CleanupResult> {
  return {
    deleted: false,
    reason: 'La eliminación del original solo está disponible en el móvil.',
  };
}

export async function restoreVaultItem(): Promise<RestoreResult> {
  return {
    restored: false,
    removedFromVault: false,
    reason: 'La restauración solo está disponible en el móvil.',
  };
}
