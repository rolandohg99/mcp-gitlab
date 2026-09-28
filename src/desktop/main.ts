import { app, BrowserWindow, dialog, Menu, Notification, nativeImage, shell, Tray } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer, type RunningServer } from "../dashboard/server.js";
import { construirSnapshot } from "../dashboard/snapshot.js";
import { GitLabClient } from "../gitlab/client.js";
import { consultarUltimaVersion, esMasNueva, origenActualizaciones } from "./actualizaciones.js";
import { borrarCredencial, leerToken } from "./credenciales.js";
import {
  avisoDeHoras,
  comparar,
  estadoInicial,
  tocaAvisoDeHoras,
  type Aviso,
  type Estado
} from "../dashboard/comparador.js";
import { servirSetup } from "./setup.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ICONO = resolve(ROOT, "build", "icon.png");
const PUERTO = Number(process.env.DASHBOARD_PORT ?? 5178);
const PUERTO_SETUP = Number(process.env.SETUP_PORT ?? PUERTO + 100);
const MINUTOS = Number(process.env.POLL_MINUTES ?? 5);
const MAX_NOTIFICACIONES = 4;
const GITLAB_URL = (process.env.GITLAB_URL ?? "https://project.comsatel.com.pe").replace(/\/+$/, "");

// Sin esto Windows atribuye las notificaciones a "electron.exe" y a veces las descarta.
app.setAppUserModelId("com.comsatel.panel-gitlab");

// userData sale de `name` en package.json ("dev-gitlab-mcp"), no de
// build.productName: renombrar el producto no mueve el token ni el estado.
// No cambiar `name` sin migrar %APPDATA%/dev-gitlab-mcp.

const ES_MAC = process.platform === "darwin";

/**
 * macOS toma los atajos de teclado del menu de la aplicacion: sin un menu con
 * los roles de edicion, Cmd+C/V/A no funcionan en ningun campo — y la pantalla
 * de token existe precisamente para pegar. En Windows y Linux el menu se deja
 * oculto (autoHideMenuBar) porque la app no lo necesita.
 */
function instalarMenu(): void {
  if (!ES_MAC) {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: "appMenu" },
      { role: "editMenu" },
      { role: "windowMenu" }
    ])
  );
}

let ventana: BrowserWindow | null = null;
let bandeja: Tray | null = null;
let servidor: RunningServer | null = null;
let estado: Estado = estadoInicial();
let temporizador: NodeJS.Timeout | null = null;
let revisando = false;
let ultimaRevision: Date | null = null;
let ultimaComprobacionVersion = 0;
let saliendo = false;

function rutaEstado(): string {
  return resolve(app.getPath("userData"), "estado.json");
}

async function cargarEstado(): Promise<Estado> {
  try {
    return JSON.parse(await readFile(rutaEstado(), "utf8")) as Estado;
  } catch {
    return estadoInicial();
  }
}

async function guardarEstado(): Promise<void> {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(rutaEstado(), JSON.stringify(estado, null, 2), "utf8");
}

function notificar(aviso: Aviso): void {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: aviso.titulo, body: aviso.cuerpo, icon: ICONO });
  n.on("click", () => {
    if (aviso.url) void shell.openExternal(aviso.url);
    else mostrarVentana();
  });
  n.show();
}

function crearVentana(url: string): void {
  ventana = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    title: "Panel de desarrollo Comsatel",
    icon: ICONO,
    backgroundColor: "#0b1220", // --bg de app.css: sin destello al cargar
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  void ventana.loadURL(url);

  // Los enlaces a GitLab abren en el navegador del sistema.
  ventana.webContents.setWindowOpenHandler(({ url: destino }) => {
    void shell.openExternal(destino);
    return { action: "deny" };
  });

  // La X esconde a la bandeja; el vigilante debe seguir vivo para notificar.
  ventana.on("close", (evento) => {
    if (saliendo) return;
    evento.preventDefault();
    ventana?.hide();
  });
}

/**
 * Muestra `url` en la ventana de la app. Reutiliza la existente: crear una
 * segunda dejaba la anterior consultando un servidor ya cerrado, y el panel
 * fallaba con "Failed to fetch" en bucle.
 */
function abrirEn(url: string): void {
  if (ventana && !ventana.isDestroyed()) {
    void ventana.loadURL(url);
    ventana.show();
    ventana.focus();
    return;
  }
  crearVentana(url);
}

function mostrarVentana(): void {
  const destino = servidor?.url ?? `http://127.0.0.1:${PUERTO_SETUP}`;
  if (!ventana || ventana.isDestroyed()) crearVentana(destino);
  ventana?.show();
  ventana?.focus();
}

/**
 * Pide el token la primera vez. Sirve el formulario en un puerto local y espera
 * a que valide contra GitLab; recien entonces arranca el panel.
 */
async function pedirCredencial(): Promise<string> {
  const setup = servirSetup(PUERTO_SETUP, GITLAB_URL);
  abrirEn(setup.url);

  const { token, usuario } = await setup.listo;
  await setup.cerrar();

  notificar({
    tipo: "todo",
    titulo: `Conectado como ${usuario.name}`,
    cuerpo: "El panel vigilará tus issues, MRs, pipelines y horas."
  });

  return token;
}

/**
 * Con `mostrar` en false (arranque con --oculto) no se abre ventana: la app
 * queda en la bandeja vigilando. Si ya hay una ventana, como la de la pantalla
 * de token, se reutiliza para enseñar el panel.
 */
async function iniciarPanel(token: string, mostrar = true): Promise<void> {
  servidor = await startServer(PUERTO, { gitlabUrl: GITLAB_URL, token }, {
    alCerrarSesion: () => void cerrarSesion()
  });
  if (mostrar || (ventana && !ventana.isDestroyed())) abrirEn(servidor.url);
  refrescarMenu();
}

async function cerrarSesion(): Promise<void> {
  const respuesta = await dialog.showMessageBox({
    type: "question",
    buttons: ["Cancelar", "Cerrar sesión"],
    defaultId: 0,
    cancelId: 0,
    message: "¿Cerrar sesión?",
    detail:
      "Se borrará el token guardado en este equipo. Tendrás que pegarlo de nuevo " +
      "la próxima vez. El token seguirá existiendo en GitLab hasta que lo revoques allí."
  });
  if (respuesta.response !== 1) return;

  borrarCredencial();
  if (temporizador) clearInterval(temporizador);
  await servidor?.close().catch(() => {});
  servidor = null;
  estado = estadoInicial();
  refrescarMenu();

  const token = await pedirCredencial();
  await iniciarPanel(token);
  arrancarVigilante();
}

function refrescarMenu(): void {
  if (!bandeja) return;
  const quien = servidor?.me.username ?? "sin conectar";

  bandeja.setToolTip(
    `Panel Comsatel · ${quien}\nÚltima revisión: ${ultimaRevision?.toLocaleTimeString("es-PE") ?? "aún no"}`
  );

  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Conectado como ${quien}`, enabled: false },
      {
        label: `Última revisión: ${ultimaRevision?.toLocaleTimeString("es-PE") ?? "aún no"}`,
        enabled: false
      },
      { type: "separator" },
      { label: "Abrir panel", click: () => mostrarVentana() },
      {
        label: revisando ? "Revisando…" : "Revisar ahora",
        enabled: !revisando && !!servidor,
        click: () => void ciclo()
      },
      { label: "Mis horas de hoy", enabled: !!servidor, click: () => void mostrarHoras() },
      { label: "Abrir GitLab", click: () => void shell.openExternal(GITLAB_URL) },
      {
        label: `Buscar actualizaciones (v${app.getVersion()})`,
        enabled: !!servidor,
        click: () => void revisarActualizacion(true)
      },
      { type: "separator" },
      {
        label: "Enviar notificación de prueba",
        click: () =>
          notificar({
            tipo: "todo",
            titulo: "Panel Comsatel funciona",
            cuerpo: "Si ves esto, las notificaciones están bien configuradas."
          })
      },
      {
        label: ES_MAC ? "Abrir al iniciar sesión" : "Iniciar con Windows",
        type: "checkbox",
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked, args: ["--oculto"] });
          refrescarMenu();
        }
      },
      { label: "Cerrar sesión", enabled: !!servidor, click: () => void cerrarSesion() },
      { type: "separator" },
      {
        label: "Salir",
        click: () => {
          saliendo = true;
          app.quit();
        }
      }
    ])
  );
}

/**
 * Aviso de version nueva. No instala nada: lee un manifiesto en GitLab con el
 * token del propio usuario y, si hay algo mas reciente, notifica con el enlace.
 * Se consulta como mucho una vez por hora salvo que se pida a mano.
 */
async function revisarActualizacion(forzar = false): Promise<void> {
  if (!servidor) {
    if (forzar) {
      notificar({
        tipo: "actualizacion",
        titulo: "Conecta primero",
        cuerpo: "Necesito tu sesión de GitLab para leer el manifiesto de versiones."
      });
    }
    return;
  }

  const UNA_HORA = 60 * 60 * 1000;
  if (!forzar && Date.now() - ultimaComprobacionVersion < UNA_HORA) return;
  ultimaComprobacionVersion = Date.now();

  const remota = await consultarUltimaVersion(servidor.client);
  const actual = app.getVersion();

  if (!remota) {
    if (forzar) {
      const { proyecto, ruta } = origenActualizaciones();
      notificar({
        tipo: "actualizacion",
        titulo: "Sin información de versiones",
        cuerpo: `No se encontró ${ruta} en ${proyecto.split("/").slice(-2).join("/")}.`
      });
    }
    return;
  }

  if (!esMasNueva(remota.version, actual)) {
    if (forzar) {
      notificar({
        tipo: "actualizacion",
        titulo: `Estás al día (v${actual})`,
        cuerpo: `La última publicada es la ${remota.version}.`
      });
    }
    return;
  }

  // Una sola vez por version, salvo comprobacion manual.
  if (!forzar && estado.versionAvisada === remota.version) return;

  notificar({
    tipo: "actualizacion",
    titulo: `Nueva versión disponible: ${remota.version}`,
    cuerpo:
      (remota.notas ? `${remota.notas}\n` : "") +
      `Tienes la ${actual}. Clic para descargar el instalador.`,
    url: remota.url
  });

  estado.versionAvisada = remota.version;
  await guardarEstado();
}

function clienteActual(): GitLabClient {
  if (!servidor) throw new Error("El panel aún no está conectado.");
  return servidor.client;
}

async function mostrarHoras(): Promise<void> {
  try {
    const snap = await construirSnapshot(
      clienteActual(),
      servidor!.me.username,
      GITLAB_URL,
      true
    );
    if (!snap.horas) throw new Error("No se pudieron leer los registros de tiempo.");
    const aviso = avisoDeHoras(snap.horas, true);
    if (aviso) notificar(aviso);
  } catch (error) {
    notificar({
      tipo: "horas",
      titulo: "No se pudieron leer tus horas",
      cuerpo: (error as Error).message
    });
  }
}

async function ciclo(): Promise<void> {
  if (revisando || !servidor) return;
  revisando = true;
  refrescarMenu();

  try {
    const snap = await construirSnapshot(
      servidor.client,
      servidor.me.username,
      GITLAB_URL,
      tocaAvisoDeHoras(estado)
    );

    const { avisos, estado: nuevo } = comparar(snap, estado);
    estado = nuevo;
    await guardarEstado();

    // El historial de la campana se alimenta de aqui: la ventana lista lo mismo
    // que se notifico, sin volver a consultar GitLab.
    servidor.centro.registrar(avisos);
    servidor.centro.adoptarEstado(nuevo);

    // Muchos cambios a la vez se resumen: 12 toasts seguidos no los lee nadie.
    for (const aviso of avisos.slice(0, MAX_NOTIFICACIONES)) notificar(aviso);
    if (avisos.length > MAX_NOTIFICACIONES) {
      notificar({
        tipo: "todo",
        titulo: `${avisos.length - MAX_NOTIFICACIONES} novedades más`,
        cuerpo: "Abre el panel para verlas todas."
      });
    }

    ultimaRevision = new Date();

    // No bloquea el ciclo: si falla, se reintenta a la siguiente hora.
    void revisarActualizacion().catch(() => {});

    if (ventana && !ventana.isDestroyed() && ventana.isVisible()) {
      ventana.webContents.executeJavaScript("typeof cargar === 'function' && cargar()").catch(() => {});
    }
  } catch (error) {
    process.stderr.write(`[vigilante] ${(error as Error).message}\n`);
  } finally {
    revisando = false;
    refrescarMenu();
  }
}

function arrancarVigilante(): void {
  if (temporizador) clearInterval(temporizador);
  void ciclo();
  temporizador = setInterval(() => void ciclo(), MINUTOS * 60_000);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => mostrarVentana());

  // macOS: clic en el icono del Dock con la ventana escondida debe reabrirla.
  app.on("activate", () => mostrarVentana());

  app.whenReady().then(async () => {
    instalarMenu();
    estado = await cargarEstado();

    bandeja = new Tray(nativeImage.createFromPath(ICONO).resize({ width: 16, height: 16 }));
    bandeja.on("click", () => mostrarVentana());
    refrescarMenu();

    try {
      // Sin credencial se pide siempre con ventana, aunque arranque oculta:
      // no tiene sentido vigilar en silencio algo a lo que no hay acceso.
      const token = leerToken() ?? (await pedirCredencial());

      await iniciarPanel(token, !process.argv.includes("--oculto"));
      arrancarVigilante();
    } catch (error) {
      dialog.showErrorBox("No se pudo iniciar el panel", (error as Error).message);
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    // No se cierra: la app vive en la bandeja hasta que se elija Salir.
  });

  app.on("before-quit", async () => {
    saliendo = true;
    if (temporizador) clearInterval(temporizador);
    await servidor?.close().catch(() => {});
  });
}
