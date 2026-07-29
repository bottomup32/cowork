"use client";

import { useCallback, useEffect, useState } from "react";
import { apiEndpoint, apiFetch } from "../lib/api";
import type { ExcelFile } from "../lib/types";

export function ExcelFiles({ taskId }: { taskId: string }) {
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { setFiles(await apiFetch<ExcelFile[]>(`/tasks/${taskId}/files`)); } catch { setError("Excel 파일을 불러오지 못했습니다."); } }, [taskId]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  async function upload(file: File) {
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.append("file", file);
      await apiFetch(`/tasks/${taskId}/files/excel`, { method: "POST", body: form });
      await load();
    } catch { setError("유효한 .xlsx 파일(최대 10MB)을 선택해 주세요."); }
    finally { setBusy(false); }
  }
  return <section className="excel-files">
    <div><div><span className="context-label">Local Excel</span><h2>Excel 작업 파일</h2></div><label className="upload-button">파일 선택<input aria-label="Excel 파일 선택" disabled={busy} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} /></label></div>
    {error && <p role="alert" className="inline-alert">{error}</p>}
    {files.length === 0 ? <p className="empty-copy">Notion에 올리지 않고 이 작업에 직접 Excel 파일을 첨부할 수 있습니다.</p> : <ul>{files.map((file) => <li key={file.id}><div><strong>{file.name}</strong><span>{file.workbookSummary.sheets.map((sheet) => `${sheet.name} ${sheet.rowCount}행`).join(" · ")}</span></div><a href={apiEndpoint(`/files/${file.id}/download`)}>원본 다운로드</a></li>)}</ul>}
  </section>;
}
