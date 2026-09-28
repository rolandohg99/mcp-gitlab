# Publicar una versión nueva

La app avisa de actualizaciones leyendo un manifiesto desde GitLab **con el token
del propio usuario**. No hace falta ningún servidor: si la persona puede ver el
repo, puede ver el manifiesto.

## Dónde vive el manifiesto

Por defecto:

| Qué | Valor | Variable de entorno |
|---|---|---|
| Proyecto | `comsatel/development/products/collaboration` | `UPDATE_PROJECT` |
| Ruta | `panel-desarrollo/version.json` | `UPDATE_PATH` |
| Rama | `main` | `UPDATE_REF` |

## Pasos para publicar

1. Sube `PanelDesarrolloComsatel-<version>-setup.exe` a donde tu equipo comparta
   binarios (una wiki de GitLab, una carpeta de red publicada por HTTP, un
   release del repo). Necesitas una **URL http/https** que abra la descarga.

2. Sube el `package.json` de este proyecto a la versión nueva y regenera el
   instalador con `npm run dist`.

3. Commitea `version.json` en la ruta de arriba con la versión y la URL:

```json
{
  "version": "0.2.0",
  "url": "https://…/PanelDesarrolloComsatel-0.2.0-setup.exe",
  "notas": "Qué cambió, en una línea.",
  "publicada": "2026-09-15"
}
```

Cada app lo detecta en menos de una hora y notifica una sola vez por versión.
Al hacer clic, se abre la URL en el navegador.

## Reglas que aplica la app

El manifiesto es dato escrito por una persona, así que se valida antes de usarlo:

- `version` debe ser `major.minor.patch`; los sufijos como `-beta` se ignoran al
  comparar.
- `url` **solo** acepta `http://` o `https://`. Un `file://` o `javascript:` se
  descarta y no se notifica nada.
- `notas` se recorta a 300 caracteres.
- Si el archivo no existe, no se puede leer o está mal formado, la app **calla**
  en vez de molestar en cada vuelta.

La comparación es numérica, no alfabética: `0.10.0` es más nueva que `0.9.0`.

## Qué NO hace

No descarga ni instala nada por su cuenta. La persona decide cuándo actualizar.
Para instalación automática hace falta `electron-updater` y un servidor HTTP que
sirva `latest.yml` — ver la conversación sobre despliegue en Kubernetes.
