import { createHash } from "node:crypto";
import type { PrismaClient } from "@cowork/db";
import type { FastifyInstance } from "fastify";
import { inspectWorkbook } from "./excel.js";

export type FileDatabase = Pick<PrismaClient, "task" | "fileAsset" | "auditEvent">;

const visibleTask = (userId: string) => ({
  ownerId: userId,
  project: { members: { some: { userId } }, team: { memberships: { some: { userId } } } },
});

export function registerFileRoutes(app: FastifyInstance, database: FileDatabase) {
  app.post("/tasks/:taskId/files/excel", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const taskId = (request.params as { taskId: string }).taskId;
    const task = await database.task.findFirst({ where: { id: taskId, ...visibleTask(user.userId) }, select: { id: true, project: { select: { teamId: true } } } });
    if (!task) return reply.code(404).send({ error: "TASK_NOT_FOUND" });
    const upload = await request.file();
    if (!upload) return reply.code(400).send({ error: "FILE_REQUIRED" });
    const lowerName = upload.filename.toLowerCase();
    if (!lowerName.endsWith(".xlsx")) return reply.code(415).send({ error: "XLSX_REQUIRED" });
    const content = await upload.toBuffer();
    let workbookSummary;
    try { workbookSummary = await inspectWorkbook(content); }
    catch { return reply.code(400).send({ error: "INVALID_WORKBOOK" }); }
    const asset = await database.fileAsset.create({
      data: {
        taskId, ownerId: user.userId, name: upload.filename,
        mediaType: upload.mimetype || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: content.length, sha256: createHash("sha256").update(content).digest("hex"),
        content: Uint8Array.from(content), workbookSummary,
      },
      select: { id: true, taskId: true, name: true, mediaType: true, size: true, sha256: true, workbookSummary: true, createdAt: true },
    });
    await database.auditEvent.create({ data: { teamId: task.project.teamId, taskId, actorId: user.userId, eventType: "EXCEL_UPLOADED", subjectType: "file", subjectId: asset.id, metadata: { name: asset.name, size: asset.size, sha256: asset.sha256 } } });
    return reply.code(201).send(asset);
  });

  app.get("/tasks/:taskId/files", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const taskId = (request.params as { taskId: string }).taskId;
    const task = await database.task.findFirst({ where: { id: taskId, ...visibleTask(user.userId) }, select: { id: true } });
    if (!task) return reply.code(404).send({ error: "TASK_NOT_FOUND" });
    return database.fileAsset.findMany({ where: { taskId, ownerId: user.userId }, select: { id: true, taskId: true, name: true, mediaType: true, size: true, sha256: true, workbookSummary: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  });

  app.get("/files/:fileId/download", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.currentUser;
    if (!user) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const file = await database.fileAsset.findFirst({ where: { id: (request.params as { fileId: string }).fileId, ownerId: user.userId, task: visibleTask(user.userId) }, select: { name: true, mediaType: true, content: true } });
    if (!file) return reply.code(404).send({ error: "FILE_NOT_FOUND" });
    return reply.header("Content-Type", file.mediaType).header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`).send(Buffer.from(file.content));
  });
}
