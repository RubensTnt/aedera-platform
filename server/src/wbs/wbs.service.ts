import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";


type ElementRef = { modelId: string; guid: string };

type BulkSetAssignmentsInput = {
  projectId: string;
  modelId: string;
  items: { guid: string; wbsNodeId: string | null }[];
  source: string;
  changedByUserId: string;
};

export type EnsurePathInput = {
  segments: Array<{
    code: string;
    name?: string;
  }>;
};


function toPathKey(segments: { code: string }[]): string {
  return segments.map((s) => s.code).join("/");
}

function nodeSnapshot(n: { id: string; code: string; name: string }) {
  return { wbsNodeId: n.id, code: n.code, name: n.name };
}

@Injectable()
export class WbsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tree read-optimized: torna tutti i nodi flat + adjacency.
   * (La UI può ricostruire il tree senza query ricorsive.)
   */
  async listTree(projectId: string) {
    const nodes = await this.prisma.wbsNode.findMany({
      where: { projectId },
      orderBy: [{ parentId: "asc" }, { sortIndex: "asc" }, { code: "asc" }],
      select: {
        id: true,
        parentId: true,
        code: true,
        name: true,
        sortIndex: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { nodes };
  }

  async createNode(
    projectId: string,
    body: { code: string; name: string; parentId?: string | null; sortIndex?: number },
  ) {
    return this.prisma.wbsNode.create({
      data: {
        projectId,
        code: body.code,
        name: body.name,
        parentId: body.parentId ?? null,
        sortIndex: body.sortIndex ?? 0,
      },
    });
  }

  async updateNode(
    projectId: string,
    id: string,
    body: { code?: string; name?: string; parentId?: string | null; sortIndex?: number },
  ) {
    // safety: ensure node belongs to project
    const existing = await this.prisma.wbsNode.findFirst({ where: { id, projectId } });
    if (!existing) throw new BadRequestException("WBS node not found");

    return this.prisma.wbsNode.update({
      where: { id },
      data: {
        code: body.code ?? undefined,
        name: body.name ?? undefined,
        parentId: body.parentId === undefined ? undefined : (body.parentId ?? null),
        sortIndex: body.sortIndex ?? undefined,
      },
    });
  }

  async deleteNode(projectId: string, id: string) {
    const existing = await this.prisma.wbsNode.findFirst({ where: { id, projectId } });
    if (!existing) throw new BadRequestException("WBS node not found");

    // onDelete: Cascade sul tree; Restrict su assignments (schema), quindi fallirà se usato
    return this.prisma.wbsNode.delete({ where: { id } });
  }

  /**
   * Crea (se mancanti) i nodi lungo i percorsi richiesti e ritorna gli id foglia.
   * Utile per import massivo da IFC.
   */
  async ensurePaths(projectId: string, paths: EnsurePathInput[]) {
    // normalizzazione + dedup
    const normalized: EnsurePathInput[] = [];
    const seen = new Set<string>();

    for (const p of paths) {
      if (!p || !Array.isArray(p.segments) || p.segments.length === 0) continue;
      const segments = p.segments
        .map((s) => ({
          code: String(s.code ?? "").trim(),
          name: (s.name ?? s.code ?? "").toString().trim(),
        }))
        .filter((s) => s.code.length > 0);
      if (segments.length === 0) continue;

      const key = toPathKey(segments);
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({ segments });
    }

    if (normalized.length === 0) return { leaves: [] as { key: string; wbsNodeId: string }[] };

    const leaves = await this.prisma.$transaction(async (tx) => {
      const out: { key: string; wbsNodeId: string }[] = [];

      for (const path of normalized) {
        let parentId: string | null = null;
        let currentId: string | null = null;

        for (let i = 0; i < path.segments.length; i++) {
          const seg = path.segments[i];

          // Unicità: (projectId, code) globale nel progetto.
          // Se vuoi riusare lo stesso code sotto parent diversi, dovremo cambiare la constraint.
          let node = await tx.wbsNode.findUnique({
            where: { projectId_code: { projectId, code: seg.code } },
          });

          if (!node) {
            node = await tx.wbsNode.create({
              data: {
                projectId,
                code: seg.code,
                name: seg.name ?? seg.code,
                parentId,
                sortIndex: i,
              },
            });
          } else {
            // se esiste ma è "attaccato" ad un parent diverso, lasciamo com'è (MVP)
            // possiamo aggiungere una modalità strict in seguito.
            if (node.name !== seg.name && seg.name) {
              // aggiorna il nome solo se vuoto o diverso
              await tx.wbsNode.update({
                where: { id: node.id },
                data: { name: seg.name },
              });
            }
          }

          parentId = node.id;
          currentId = node.id;
        }

        if (!currentId) continue;
        out.push({ key: toPathKey(path.segments), wbsNodeId: currentId });
      }

      return out;
    });

    return { leaves };
  }

  async bulkGetAssignments(projectId: string, modelId: string, guids: string[]) {
    if (!guids.length) return [];

    const rows = await this.prisma.aederaClassification.findMany({
      where: {
        projectId,
        modelId,
        guid: { in: guids },
      },
      select: {
        guid: true,
        wbsNodeId: true,
        updatedAt: true,
        wbsNode: { select: { id: true, code: true, name: true } },
      },
    });

    const byGuid = new Map(rows.map((r) => [r.guid, r]));

    return guids.map((guid) => {
      const r = byGuid.get(guid);
      return {
        guid,
        wbsNodeId: r?.wbsNodeId ?? null,
        wbsCode: r?.wbsNode?.code ?? null,
        wbsName: r?.wbsNode?.name ?? null,
        updatedAt: r?.updatedAt ?? null,
      };
    });
  }

  async bulkSetAssignments(input: BulkSetAssignmentsInput & { modelId: string }) {
    const { projectId, modelId, items, source, changedByUserId } = input;
    if (!changedByUserId) throw new BadRequestException("Missing user");

    const clean = (items ?? [])
      .map((it) => ({
        guid: String((it as any).guid ?? (it as any).globalId ?? "").trim(),
        wbsNodeId: it.wbsNodeId ? String(it.wbsNodeId) : null,
      }))
      .filter((it) => it.guid.length > 0);

    if (!clean.length) return { updated: 0 };

    return this.prisma.$transaction(async (tx) => {
      // preload existing classifications (current wbs)
      const existing = await tx.aederaClassification.findMany({
        where: {
          projectId,
          modelId,
          guid: { in: clean.map((c) => c.guid) },
        },
        select: { guid: true, wbsNodeId: true },
      });
      const prevByGuid = new Map(existing.map((e) => [e.guid, e.wbsNodeId]));

      // preload nodes involved
      const nodeIds = [...new Set(clean.map((c) => c.wbsNodeId).filter(Boolean) as string[])];
      const nodes = nodeIds.length
        ? await tx.wbsNode.findMany({
            where: { projectId, id: { in: nodeIds } },
            select: { id: true, code: true, name: true },
          })
        : [];
      const nodeById = new Map(nodes.map((n) => [n.id, n]));

      let updated = 0;

      for (const it of clean) {
        const prevWbsNodeId = prevByGuid.get(it.guid) ?? null;

        // no-op
        if (prevWbsNodeId === it.wbsNodeId) continue;

        // validate node belongs to project (or null = clear)
        const nextNode = it.wbsNodeId ? nodeById.get(it.wbsNodeId) : null;
        if (it.wbsNodeId && !nextNode) {
          throw new BadRequestException(`Invalid wbsNodeId for guid=${it.guid}`);
        }

        // se stai “clearing” e non esiste nessuna riga, non creare nulla
        if (!it.wbsNodeId && prevWbsNodeId === null) continue;

        await tx.aederaClassification.upsert({
          where: {
            modelId_guid: { modelId, guid: it.guid },
          },
          create: {
            projectId,
            modelId,
            guid: it.guid,
            source: "MANUAL",
            wbsNodeId: it.wbsNodeId,
          },
          update: {
            source: "MANUAL",
            wbsNodeId: it.wbsNodeId,
          },
        });

        // history
        const prevNode =
          prevWbsNodeId && prevWbsNodeId !== it.wbsNodeId
            ? await tx.wbsNode.findFirst({
                where: { projectId, id: prevWbsNodeId },
                select: { id: true, code: true, name: true },
              })
            : null;

        await tx.elementParamHistory.create({
          data: {
            projectId,
            modelId,
            guid: it.guid,
            kind: "WBS",
            oldValueJson: prevNode ? nodeSnapshot(prevNode) : Prisma.JsonNull,
            newValueJson: nextNode ? nodeSnapshot(nextNode) : Prisma.JsonNull,
            changedByUserId,
            source,
          },
        });

        updated++;
      }

      return { updated };
    });
  }
}
