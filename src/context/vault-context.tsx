import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import {
  copyIntoVault,
  deleteOriginalFile,
  deleteOriginalMediaAsset,
  loadVaultItems,
  persistVaultItems,
  removeStoredVaultItem,
  restoreVaultItem,
  type VaultItem,
  type VaultItemKind,
  type RestoreResult,
  type OriginalMediaDetails,
  type OriginalCleanupStrategy,
} from '@/lib/vault-storage';

type VaultStatus = 'checking' | 'locked' | 'authenticating' | 'ready' | 'unavailable';

type VaultContextValue = {
  items: VaultItem[];
  status: VaultStatus;
  isUnlocked: boolean;
  biometricLabel: string;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  errorMessage: string | null;
  unlock: () => Promise<void>;
  lock: () => void;
  beginExternalFlow: () => void;
  endExternalFlow: () => void;
  openDeviceSettings: () => Promise<void>;
  clearError: () => void;
  addPickedItem: (input: {
    name: string;
    sourceUri: string;
    kind: VaultItemKind;
    mimeType?: string;
    size?: number;
    accent?: string;
    originalAssetId?: string | null;
    originalUri?: string | null;
    originalFileName?: string | null;
    originalWidth?: number;
    originalHeight?: number;
    originalCleanupStrategy?: OriginalCleanupStrategy;
  }) => Promise<{ originalDeleted: boolean; cleanupReason?: string }>;
  deleteItem: (item: VaultItem) => Promise<void>;
  restoreItem: (item: VaultItem) => Promise<RestoreResult>;
};

const VaultContext = createContext<VaultContextValue | null>(null);
const FILE_ACCENTS = ['#C4A77D', '#8FA7B3', '#9D8FB0', '#899B83', '#D28D70'];

function getBiometricLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === 'ios' ? 'Face ID' : 'reconocimiento facial';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'huella dactilar';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'escáner biométrico';
  return 'biometría';
}

function getAuthErrorMessage(error?: LocalAuthentication.LocalAuthenticationError) {
  switch (error) {
    case 'not_enrolled':
      return 'Configura una huella o un rostro en los ajustes del dispositivo para continuar.';
    case 'lockout':
      return 'La biometría está temporalmente bloqueada. Inténtalo de nuevo en unos segundos.';
    case 'passcode_not_set':
      return 'Configura un código de acceso en tu dispositivo para habilitar la biometría.';
    case 'not_available':
      return 'Este dispositivo no tiene un sensor biométrico disponible.';
    case 'authentication_failed':
      return 'No pudimos verificar tu identidad. Vuelve a intentarlo.';
    default:
      return 'No se pudo desbloquear la bóveda. Vuelve a intentarlo.';
  }
}

export function VaultProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [status, setStatus] = useState<VaultStatus>('checking');
  const [biometricLabel, setBiometricLabel] = useState('biometría');
  const [supportedTypes, setSupportedTypes] = useState<LocalAuthentication.AuthenticationType[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const unlocking = useRef(false);
  const externalFlowDepth = useRef(0);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const unlock = useCallback(async () => {
    if (unlocking.current) return;

    if (Platform.OS === 'web') {
      setStatus('authenticating');
      const savedItems = await loadVaultItems();
      setItems(savedItems);
      setStatus('ready');
      return;
    }

    unlocking.current = true;
    setStatus('authenticating');
    setErrorMessage(null);

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Desbloquea tu bóveda privada',
        promptDescription: 'Solo tú puedes ver tus fotos, vídeos y documentos.',
        cancelLabel: 'Ahora no',
        fallbackLabel: 'Usar código',
        biometricsSecurityLevel: 'strong',
      });

      if (!result.success) {
        setStatus('locked');
        if (result.error !== 'user_cancel' && result.error !== 'system_cancel' && result.error !== 'app_cancel') {
          setErrorMessage(getAuthErrorMessage(result.error));
        }
        return;
      }

      const savedItems = await loadVaultItems();
      setItems(savedItems);
      setStatus('ready');
    } catch {
      setStatus('locked');
      setErrorMessage('La autenticación no está disponible en este momento.');
    } finally {
      unlocking.current = false;
    }
  }, []);

  const checkBiometrics = useCallback(async () => {
    if (Platform.OS === 'web') {
      setStatus('locked');
      return;
    }

    try {
      const [hasHardware, isEnrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      setSupportedTypes(types);
      setBiometricLabel(getBiometricLabel(types));

      if (!hasHardware || !isEnrolled || !types.length) {
        setStatus('unavailable');
        if (!hasHardware) setErrorMessage('Necesitas un dispositivo con sensor biométrico para usar Bio.');
        else setErrorMessage('Registra tu huella o tu rostro en los ajustes del dispositivo.');
        return;
      }

      await unlock();
    } catch {
      setStatus('unavailable');
      setErrorMessage('No pudimos comprobar la configuración biométrica.');
    }
  }, [unlock]);

  useEffect(() => {
    const bootstrapTimer = setTimeout(() => {
      void checkBiometrics();
    }, 0);
    return () => clearTimeout(bootstrapTimer);
  }, [checkBiometrics]);

  const lock = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
    setStatus((currentStatus) => (currentStatus === 'unavailable' ? currentStatus : 'locked'));
  }, []);

  const beginExternalFlow = useCallback(() => {
    externalFlowDepth.current += 1;
  }, []);

  const endExternalFlow = useCallback(() => {
    externalFlowDepth.current = Math.max(0, externalFlowDepth.current - 1);
    if (externalFlowDepth.current === 0 && AppState.currentState === 'background') lock();
  }, [lock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && externalFlowDepth.current === 0) lock();
    });
    return () => subscription.remove();
  }, [lock]);

  const openDeviceSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      setErrorMessage('Abre Ajustes del dispositivo y configura una huella o un rostro.');
    }
  }, []);

  const addPickedItem = useCallback(
    async (input: {
      name: string;
      sourceUri: string;
      kind: VaultItemKind;
      mimeType?: string;
      size?: number;
      accent?: string;
      originalAssetId?: string | null;
      originalUri?: string | null;
      originalFileName?: string | null;
      originalWidth?: number;
      originalHeight?: number;
      originalCleanupStrategy?: OriginalCleanupStrategy;
    }): Promise<{ originalDeleted: boolean; cleanupReason?: string }> => {
      const storedUri = await copyIntoVault(input.sourceUri, input.name);
      const item: VaultItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: input.name,
        kind: input.kind,
        uri: storedUri,
        mimeType: input.mimeType ?? 'application/octet-stream',
        size: input.size ?? 0,
        createdAt: new Date().toISOString(),
        accent: input.accent ?? FILE_ACCENTS[Math.floor(Math.random() * FILE_ACCENTS.length)],
        originalDeleted: false,
        originalAssetId: input.originalAssetId ?? undefined,
        originalCleanupStrategy: input.originalCleanupStrategy,
      };
      const nextItems = [item, ...itemsRef.current];
      itemsRef.current = nextItems;
      setItems(nextItems);
      await persistVaultItems(nextItems);
      const cleanup = input.originalCleanupStrategy === 'file' || input.kind === 'document'
        ? await deleteOriginalFile(input.originalUri)
        : input.kind === 'photo' || input.kind === 'video'
          ? await deleteOriginalMediaAsset(input.originalAssetId, input.originalUri, {
            kind: input.kind,
            fileName: input.originalFileName ?? undefined,
            width: input.originalWidth,
            height: input.originalHeight,
          } satisfies OriginalMediaDetails)
          : await deleteOriginalFile(input.originalUri);
      const savedItem = { ...item, originalDeleted: cleanup.deleted };
      const finalItems = [savedItem, ...nextItems.slice(1)];
      itemsRef.current = finalItems;
      setItems(finalItems);
      await persistVaultItems(finalItems);
      return { originalDeleted: cleanup.deleted, cleanupReason: cleanup.reason };
    },
    [],
  );

  const deleteItem = useCallback(
    async (item: VaultItem) => {
      await removeStoredVaultItem(item);
      const nextItems = itemsRef.current.filter((candidate) => candidate.id !== item.id);
      itemsRef.current = nextItems;
      setItems(nextItems);
      await persistVaultItems(nextItems);
    },
    [],
  );

  const restoreItem = useCallback(async (item: VaultItem): Promise<RestoreResult> => {
    const result = await restoreVaultItem(item);
    if (!result.removedFromVault) return result;

    const nextItems = itemsRef.current.filter((candidate) => candidate.id !== item.id);
    itemsRef.current = nextItems;
    setItems(nextItems);
    await persistVaultItems(nextItems);
    return result;
  }, []);

  const clearError = useCallback(() => setErrorMessage(null), []);

  const value = useMemo<VaultContextValue>(
    () => ({
      items,
      status,
      isUnlocked: status === 'ready',
      biometricLabel,
      supportedTypes,
      errorMessage,
      beginExternalFlow,
      endExternalFlow,
      unlock,
      lock,
      openDeviceSettings,
      clearError,
      addPickedItem,
      deleteItem,
      restoreItem,
    }),
    [
      addPickedItem,
      biometricLabel,
      clearError,
      deleteItem,
      errorMessage,
      endExternalFlow,
      items,
      beginExternalFlow,
      lock,
      openDeviceSettings,
      status,
      supportedTypes,
      unlock,
      restoreItem,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used inside VaultProvider');
  return context;
}
