# Bio

Bio es una bóveda privada para Android e iOS. Protege fotos, vídeos y documentos detrás de la biometría del dispositivo y mantiene el contenido dentro del almacenamiento privado de la aplicación.

## Funciones

- Desbloqueo con huella dactilar, Face ID o la biometría disponible en el dispositivo.
- Bóveda vacía en la primera instalación.
- Importación múltiple de fotos, vídeos y documentos.
- Copia al almacenamiento privado de Bio y eliminación del original cuando el proveedor del sistema lo permite.
- Miniaturas y vista previa de imágenes, incluso cuando se importan desde el administrador de archivos.
- Restauración de fotos y vídeos a la biblioteca multimedia.
- Restauración de documentos a una carpeta elegida desde el administrador de archivos.
- Eliminación manual del contenido protegido.
- Bloqueo al salir de la aplicación y al volver a ella. Los selectores de archivos, permisos y diálogos del sistema no provocan bloqueos repetidos.

## Limitación de Google Photos

Google Photos no siempre entrega una referencia que permita a una aplicación externa eliminar el original de la biblioteca multimedia. Si Bio muestra el aviso **“El original no se borró”**, el contenido sí quedó protegido, pero el original todavía permanece en el dispositivo.

Para retirar también el original, vuelve a pulsar **Añadir → Documento o imagen** y selecciónalo directamente desde **Archivos** o el administrador de archivos del teléfono. Bio detectará las extensiones de imagen y conservará la miniatura, la vista previa y la opción **Restaurar**.

## Requisitos

- Node.js LTS.
- Un dispositivo físico con biometría configurada para probar el desbloqueo.
- Expo SDK 57.
- Para probar el acceso completo a la biblioteca multimedia en Android, un development build. Expo Go tiene acceso limitado a estas APIs en versiones recientes de Android.

## Desarrollo local

Instala las dependencias:

```bash
npm install
```

Inicia el servidor para un development build:

```bash
npx expo start --dev-client
```

También se puede usar Expo Go para revisar la interfaz, pero las funciones de eliminación y restauración de la biblioteca multimedia requieren el development build.

## Validación

```bash
npx tsc --noEmit
npm run lint
npx expo export --platform web
```

## Development build en EAS

El perfil `development` genera un APK instalable con el cliente de desarrollo:

```bash
npx eas build --profile development --platform android
```

El proyecto de EAS está configurado en `eas.json`. El identificador Android es `com.lkiyo.bio`.

## Estructura principal

```text
src/app/index.tsx          Interfaz de la bóveda y flujos de importación
src/context/vault-context.tsx
                            Estado, biometría, bloqueo y operaciones de la bóveda
src/lib/vault-storage.ts   Almacenamiento privado, MediaStore y SAF en Android
src/lib/vault-storage.web.ts
                            Implementación compatible con web
app.json                   Permisos y plugins nativos de Expo
eas.json                   Perfil del development build
```

## Privacidad y almacenamiento

El índice de elementos se guarda con `expo-secure-store` y los archivos se copian al directorio privado de la aplicación mediante `expo-file-system`. La eliminación del original depende de los permisos y capacidades del proveedor que abrió el archivo. Bio no sube el contenido a un servidor.

## Licencia

Este proyecto se distribuye bajo la licencia incluida en [`LICENSE`](./LICENSE).
