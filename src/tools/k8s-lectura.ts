import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  cargarConfigSsh,
  citar,
  ejecutar,
  ErrorSsh,
  validarNombre,
  type ConfigSsh
} from "../ssh/cliente.js";

export type Resultado = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function texto(valor: string): Resultado {
  return { content: [{ type: "text", text: valor }] };
}

export function fallo(mensaje: string): Resultado {
  return { content: [{ type: "text", text: mensaje }], isError: true };
}

/** Errores de SSH o de kubectl llegan como texto accionable, no como excepción. */
export function guardarK8s<A>(
  handler: (args: A, config: ConfigSsh) => Promise<Resultado>
): (args: A) => Promise<Resultado> {
  return async (args: A) => {
    try {
      return await handler(args, cargarConfigSsh());
    } catch (error) {
      if (error instanceof ErrorSsh) return fallo(error.message);
      return fallo(`Error inesperado: ${(error as Error).message}`);
    }
  };
}

/**
 * Puerta de las operaciones que modifican el clúster.
 *
 * Por defecto CERRADA: solo se abre si K8S_SOLO_LECTURA es exactamente
 * "false". Si la variable falta, está vacía o mal escrita, se queda en modo
 * seguro — un error de configuración nunca debe habilitar la escritura.
 */
export function escrituraHabilitada(): boolean {
  return process.env.K8S_SOLO_LECTURA?.trim().toLowerCase() === "false";
}

/**
 * Igual que `guardarK8s`, pero antes comprueba que la escritura esté
 * habilitada. Las simulaciones (`--dry-run`) pasan siempre: no tocan nada y son
 * justo lo que hace falta para decidir si autorizar la operación de verdad.
 */
export function guardarEscrituraK8s<A>(
  handler: (args: A, config: ConfigSsh) => Promise<Resultado>
): (args: A) => Promise<Resultado> {
  return async (args: A) => {
    // El genérico va sin restricción a propósito: con `A extends
    // { simulacion?: boolean }` TypeScript deja de inferir la forma real de los
    // argumentos de cada herramienta y se queda con la restricción, dejando sin
    // tipar todo lo demás. `simulacion` se consulta con cast.
    const simulacion = (args as { simulacion?: boolean } | null)?.simulacion === true;

    if (!escrituraHabilitada() && !simulacion) {
      return fallo(
        "El clúster está en modo solo lectura. Para operar, cambia " +
          "K8S_SOLO_LECTURA=false en el .env y reinicia Claude Code."
      );
    }
    return guardarK8s(handler)(args);
  };
}

/** Ejecuta y presenta el resultado; un código distinto de 0 se marca como error. */
export async function correr(config: ConfigSsh, comando: string): Promise<Resultado> {
  const r = await ejecutar(config, comando);
  const cuerpo = [r.salida.trim(), r.error.trim()].filter(Boolean).join("\n").trim();

  if (r.codigo !== 0) {
    return fallo(cuerpo || `El comando terminó con código ${r.codigo}.`);
  }
  return texto(cuerpo || "(sin salida)");
}

/** `-n x` o `--all-namespaces`, según lo que pidan. */
export function ambito(namespace?: string): string {
  if (!namespace || namespace === "*" || namespace.toLowerCase() === "todos") {
    return "--all-namespaces";
  }
  return `-n ${citar(validarNombre(namespace, "namespace"))}`;
}

export function registrarLecturaK8s(server: McpServer): void {
  server.registerTool(
    "k8s_conexion",
    {
      title: "Probar la conexión con el clúster",
      description:
        "Diagnóstico: comprueba el acceso SSH al bastión y que kubectl responda. " +
        "Úsalo primero cuando algo falle.",
      inputSchema: {}
    },
    guardarK8s(async (_args, config) =>
      correr(
        config,
        "echo \"host: $(hostname)\"; echo \"usuario: $(whoami)\"; " +
          "echo '--- kubectl ---'; kubectl version --short 2>/dev/null || kubectl version --client; " +
          "echo '--- contexto ---'; kubectl config current-context; " +
          "echo '--- nodos ---'; kubectl get nodes -o wide 2>&1 | head -20"
      )
    )
  );

  server.registerTool(
    "k8s_namespaces",
    {
      title: "Listar namespaces",
      description: "Todos los namespaces del clúster con su estado y antigüedad.",
      inputSchema: {}
    },
    guardarK8s(async (_args, config) => correr(config, "kubectl get namespaces -o wide"))
  );

  server.registerTool(
    "k8s_pods",
    {
      title: "Listar pods",
      description:
        "Pods con su estado, reinicios y antigüedad. Sin namespace, busca en todos. " +
        "Para diagnosticar, empieza por aquí y sigue con k8s_logs o k8s_describe.",
      inputSchema: {
        namespace: z.string().optional().describe("Namespace; vacío = todos"),
        selector: z.string().optional().describe("Filtro por etiquetas, ej. app=sigo-bff"),
        problemas: z
          .boolean()
          .default(false)
          .describe("Solo pods que no estén Running o Succeeded")
      }
    },
    guardarK8s(async (args, config) => {
      const sel = args.selector ? ` -l ${citar(args.selector)}` : "";
      const filtro = args.problemas
        ? " --field-selector=status.phase!=Running,status.phase!=Succeeded"
        : "";
      return correr(config, `kubectl get pods ${ambito(args.namespace)}${sel}${filtro} -o wide`);
    })
  );

  server.registerTool(
    "k8s_logs",
    {
      title: "Ver logs de un pod",
      description:
        "Últimas líneas del log. Con `anterior` se leen las del contenedor que murió, " +
        "que es donde suele estar la causa de un CrashLoopBackOff.",
      inputSchema: {
        namespace: z.string().describe("Namespace del pod"),
        pod: z.string().describe("Nombre del pod, o deployment/nombre"),
        contenedor: z.string().optional().describe("Contenedor, si el pod tiene varios"),
        lineas: z.number().int().min(1).max(2000).default(200),
        anterior: z.boolean().default(false).describe("Logs de la ejecución anterior"),
        buscar: z.string().optional().describe("Filtra las líneas que contengan este texto")
      }
    },
    guardarK8s(async (args, config) => {
      const ns = citar(validarNombre(args.namespace, "namespace"));
      const cont = args.contenedor ? ` -c ${citar(validarNombre(args.contenedor, "contenedor"))}` : "";
      const prev = args.anterior ? " --previous" : "";
      const grep = args.buscar ? ` | grep -i -- ${citar(args.buscar)}` : "";
      return correr(
        config,
        `kubectl logs -n ${ns} ${citar(args.pod)}${cont}${prev} --tail=${args.lineas}${grep}`
      );
    })
  );

  server.registerTool(
    "k8s_describe",
    {
      title: "Describir un recurso",
      description:
        "Detalle completo de un recurso, incluidos sus eventos. Es lo que explica " +
        "por qué un pod no arranca: imagen que no se descarga, sonda que falla, falta de recursos.",
      inputSchema: {
        tipo: z.string().describe("pod, deployment, service, ingress, node, pvc…"),
        nombre: z.string(),
        namespace: z.string().optional()
      }
    },
    guardarK8s(async (args, config) =>
      correr(
        config,
        `kubectl describe ${citar(validarNombre(args.tipo, "tipo"))} ` +
          `${citar(validarNombre(args.nombre))} ${ambito(args.namespace)}`
      )
    )
  );

  server.registerTool(
    "k8s_eventos",
    {
      title: "Eventos recientes",
      description:
        "Eventos ordenados por fecha. Útil para ver qué pasó justo antes de que algo fallara.",
      inputSchema: {
        namespace: z.string().optional(),
        solo_avisos: z.boolean().default(false).describe("Solo los de tipo Warning"),
        limite: z.number().int().min(1).max(200).default(40)
      }
    },
    guardarK8s(async (args, config) => {
      const tipo = args.solo_avisos ? " --field-selector type=Warning" : "";
      return correr(
        config,
        `kubectl get events ${ambito(args.namespace)}${tipo} ` +
          `--sort-by=.lastTimestamp 2>&1 | tail -${args.limite}`
      );
    })
  );

  server.registerTool(
    "k8s_deployments",
    {
      title: "Estado de los deployments",
      description: "Réplicas listas frente a deseadas, y antigüedad de cada deployment.",
      inputSchema: {
        namespace: z.string().optional(),
        selector: z.string().optional()
      }
    },
    guardarK8s(async (args, config) => {
      const sel = args.selector ? ` -l ${citar(args.selector)}` : "";
      return correr(config, `kubectl get deployments ${ambito(args.namespace)}${sel} -o wide`);
    })
  );

  server.registerTool(
    "k8s_recurso",
    {
      title: "Obtener cualquier recurso",
      description:
        "Equivale a `kubectl get <tipo>`. Para services, ingress, configmaps, pvc, " +
        "statefulsets, cronjobs y demás.",
      inputSchema: {
        tipo: z.string().describe("Tipo de recurso en plural: services, ingress, configmaps…"),
        namespace: z.string().optional(),
        nombre: z.string().optional().describe("Uno concreto; vacío = todos"),
        formato: z.enum(["wide", "yaml", "json"]).default("wide")
      }
    },
    guardarK8s(async (args, config) => {
      const nombre = args.nombre ? ` ${citar(validarNombre(args.nombre))}` : "";
      return correr(
        config,
        `kubectl get ${citar(validarNombre(args.tipo, "tipo"))}${nombre} ` +
          `${ambito(args.namespace)} -o ${args.formato}`
      );
    })
  );

  server.registerTool(
    "helm_releases",
    {
      title: "Listar releases de Helm",
      description:
        "Releases instalados con su revisión, estado y versión del chart. " +
        "Tus despliegues van por Helm, así que aquí se ve qué versión corre en cada sitio.",
      inputSchema: { namespace: z.string().optional() }
    },
    guardarK8s(async (args, config) => {
      const ns =
        !args.namespace || args.namespace === "*"
          ? "--all-namespaces"
          : `-n ${citar(validarNombre(args.namespace, "namespace"))}`;
      return correr(config, `helm list ${ns}`);
    })
  );

  server.registerTool(
    "helm_historial",
    {
      title: "Historial de un release",
      description:
        "Revisiones de un release, con su estado y descripción. Necesario antes de " +
        "hacer un rollback: te dice a qué revisión volver.",
      inputSchema: {
        release: z.string(),
        namespace: z.string()
      }
    },
    guardarK8s(async (args, config) =>
      correr(
        config,
        `helm history ${citar(validarNombre(args.release, "release"))} ` +
          `-n ${citar(validarNombre(args.namespace, "namespace"))}`
      )
    )
  );
}
