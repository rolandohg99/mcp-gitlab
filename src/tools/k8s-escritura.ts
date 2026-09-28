import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { citar, validarNombre } from "../ssh/cliente.js";
import { correr, guardarEscrituraK8s, guardarK8s } from "./k8s-lectura.js";

/**
 * Herramientas que MODIFICAN el clúster.
 *
 * Van en un archivo aparte y con el prefijo del verbo en el título para que, al
 * pedir permiso, se distinga de un vistazo lo que solo mira de lo que actúa.
 * Todas las descripciones dicen explícitamente qué se rompe si sale mal: quien
 * aprueba la ejecución merece saberlo antes, no después.
 */
export function registrarEscrituraK8s(server: McpServer): void {
  server.registerTool(
    "k8s_reiniciar",
    {
      title: "MODIFICA · Reiniciar un deployment",
      description:
        "Relanza los pods de un deployment (rollout restart). Durante el reinicio el " +
        "servicio puede quedar intermitente para quien esté probando.",
      inputSchema: {
        deployment: z.string(),
        namespace: z.string()
      }
    },
    guardarEscrituraK8s(async (args, config) =>
      correr(
        config,
        `kubectl rollout restart deployment/${citar(validarNombre(args.deployment, "deployment"))} ` +
          `-n ${citar(validarNombre(args.namespace, "namespace"))}`
      )
    )
  );

  server.registerTool(
    "k8s_estado_despliegue",
    {
      title: "Seguir un despliegue en curso",
      description:
        "Espera a que termine el rollout de un deployment y reporta si salió bien. " +
        "No modifica nada, pero se queda esperando hasta 45 segundos.",
      inputSchema: {
        deployment: z.string(),
        namespace: z.string()
      }
    },
    // Solo consulta: vive en este archivo por cercanía temática, pero no
    // modifica nada y por eso no pasa por la puerta de escritura.
    guardarK8s(async (args, config) =>
      correr(
        config,
        `kubectl rollout status deployment/${citar(validarNombre(args.deployment, "deployment"))} ` +
          `-n ${citar(validarNombre(args.namespace, "namespace"))} --timeout=40s`
      )
    )
  );

  server.registerTool(
    "k8s_escalar",
    {
      title: "MODIFICA · Cambiar el número de réplicas",
      description:
        "Escala un deployment. Poner 0 apaga el servicio por completo; subirlo mucho " +
        "puede agotar los recursos del nodo y afectar a otros servicios.",
      inputSchema: {
        deployment: z.string(),
        namespace: z.string(),
        replicas: z.number().int().min(0).max(20)
      }
    },
    guardarEscrituraK8s(async (args, config) =>
      correr(
        config,
        `kubectl scale deployment/${citar(validarNombre(args.deployment, "deployment"))} ` +
          `-n ${citar(validarNombre(args.namespace, "namespace"))} --replicas=${args.replicas}`
      )
    )
  );

  server.registerTool(
    "k8s_deshacer_despliegue",
    {
      title: "MODIFICA · Volver a la versión anterior",
      description:
        "Revierte un deployment a su revisión previa. Consulta antes el historial " +
        "para saber a qué versión vuelves.",
      inputSchema: {
        deployment: z.string(),
        namespace: z.string(),
        revision: z.number().int().optional().describe("Revisión concreta; vacío = la anterior")
      }
    },
    guardarEscrituraK8s(async (args, config) => {
      const rev = args.revision ? ` --to-revision=${args.revision}` : "";
      return correr(
        config,
        `kubectl rollout undo deployment/${citar(validarNombre(args.deployment, "deployment"))} ` +
          `-n ${citar(validarNombre(args.namespace, "namespace"))}${rev}`
      );
    })
  );

  server.registerTool(
    "helm_deshacer",
    {
      title: "MODIFICA · Rollback de un release de Helm",
      description:
        "Devuelve un release a una revisión anterior. Afecta a todos los recursos del " +
        "chart, no solo a un deployment. Mira helm_historial antes.",
      inputSchema: {
        release: z.string(),
        namespace: z.string(),
        revision: z.number().int().min(1).describe("Revisión de destino, según helm_historial")
      }
    },
    guardarEscrituraK8s(async (args, config) =>
      correr(
        config,
        `helm rollback ${citar(validarNombre(args.release, "release"))} ${args.revision} ` +
          `-n ${citar(validarNombre(args.namespace, "namespace"))} --wait --timeout 40s`
      )
    )
  );

  server.registerTool(
    "k8s_borrar_pod",
    {
      title: "MODIFICA · Borrar un pod",
      description:
        "Elimina un pod. Si pertenece a un deployment, Kubernetes lo recrea — es la " +
        "forma habitual de forzar el reinicio de una sola réplica atascada.",
      inputSchema: {
        pod: z.string(),
        namespace: z.string()
      }
    },
    guardarEscrituraK8s(async (args, config) =>
      correr(
        config,
        `kubectl delete pod ${citar(validarNombre(args.pod, "pod"))} ` +
          `-n ${citar(validarNombre(args.namespace, "namespace"))}`
      )
    )
  );

  server.registerTool(
    "k8s_aplicar",
    {
      title: "MODIFICA · Aplicar un manifiesto YAML",
      description:
        "Aplica un manifiesto que se le pasa por texto (kubectl apply -f -). Crea o " +
        "modifica recursos: revisa el YAML antes de aprobarlo.",
      inputSchema: {
        manifiesto: z.string().describe("El YAML completo"),
        namespace: z.string().optional(),
        simulacion: z
          .boolean()
          .default(true)
          .describe("Si es true, solo valida sin aplicar (--dry-run=server)")
      }
    },
    guardarEscrituraK8s(async (args, config) => {
      const ns = args.namespace
        ? ` -n ${citar(validarNombre(args.namespace, "namespace"))}`
        : "";
      const seco = args.simulacion ? " --dry-run=server" : "";
      // Heredoc con delimitador entrecomillado: el YAML llega literal, sin que
      // bash expanda variables ni comandos que contenga.
      return correr(
        config,
        `kubectl apply -f -${ns}${seco} <<'YAML_MCP_FIN'\n${args.manifiesto}\nYAML_MCP_FIN`
      );
    })
  );

  server.registerTool(
    "k8s_borrar",
    {
      title: "MODIFICA · Borrar un recurso",
      description:
        "Elimina un recurso del clúster. Es la operación más destructiva de todas: " +
        "borrar un deployment, un service o un PVC no se deshace, y un PVC se lleva " +
        "los datos. Empieza siempre con simulacion en true.",
      inputSchema: {
        tipo: z.string().describe("deployment, service, configmap, pod…"),
        nombre: z.string(),
        namespace: z.string(),
        simulacion: z
          .boolean()
          .default(true)
          .describe("Si es true, solo muestra qué se borraría")
      }
    },
    guardarEscrituraK8s(async (args, config) => {
      const seco = args.simulacion ? " --dry-run=server" : "";
      return correr(
        config,
        `kubectl delete ${citar(validarNombre(args.tipo, "tipo"))} ` +
          `${citar(validarNombre(args.nombre))} ` +
          `-n ${citar(validarNombre(args.namespace, "namespace"))}${seco}`
      );
    })
  );

  server.registerTool(
    "kubectl_crudo",
    {
      title: "MODIFICA · Ejecutar kubectl o helm a mano",
      description:
        "Escotilla de salida para lo que no cubran las demás herramientas. El comando " +
        "debe empezar por kubectl o helm. Puede modificar o borrar cualquier cosa del " +
        "clúster: úsalo solo cuando ninguna herramienta específica sirva.",
      inputSchema: {
        comando: z.string().describe("Comando completo, ej: kubectl top pods -n applications")
      }
    },
    guardarEscrituraK8s(async (args, config) => {
      const limpio = args.comando.trim();
      // Se acota a kubectl y helm: no es un shell remoto de proposito general.
      if (!/^(kubectl|helm)\s/.test(limpio)) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Solo se admiten comandos que empiecen por `kubectl` o `helm`."
            }
          ],
          isError: true
        };
      }
      return correr(config, limpio);
    })
  );
}
