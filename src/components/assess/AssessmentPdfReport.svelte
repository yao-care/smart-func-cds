<script lang="ts">
  import type { Assessment, AssessmentPatient } from '../../lib/db/schema';
  import { ageInYears } from '../../lib/utils/age-groups';
  import { loadChineseFontInto } from '../../lib/pdf/font-loader';

  interface Props {
    assessment: Assessment;
    patient: AssessmentPatient;
    onGenerated?: () => void;
  }

  let { assessment, patient, onGenerated }: Props = $props();

  let generating = $state(false);
  let error = $state<string | null>(null);

  const categoryLabelsCn: Record<string, string> = {
    normal: '功能良好',
    observe: '建議觀察',
    consult: '建議諮詢醫師',
    incomplete: '評估未完成',
  };

  const statusLabelsCn: Record<string, string> = {
    in_progress: '進行中',
    completed: '已完成',
    interrupted: '已中斷',
  };

  function formatDate(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  function formatTimestamp(d: Date): string {
    return d.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function abbreviateId(id: string): string {
    return id.length > 8 ? id.slice(0, 8) + '...' : id;
  }

  async function generatePdf() {
    if (generating) return;
    generating = true;
    error = null;

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      await loadChineseFontInto(doc);

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      function drawLine(text: string, fontSize: number, fontStyle: 'normal' | 'bold' = 'normal', align: 'left' | 'center' = 'left') {
        doc.setFontSize(fontSize);
        doc.setFont('NotoSansTC', fontStyle);
        const x = align === 'center' ? pageWidth / 2 : margin;
        doc.text(text, x, y, { align });
        y += fontSize * 0.5 + 2;
      }

      function drawSeparator() {
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;
      }

      // ===== Title =====
      drawLine('成人功能健康評估報告', 16, 'bold', 'center');
      y += 4;
      drawSeparator();

      // ===== Basic Info =====
      drawLine('評估資訊', 12, 'bold');
      y += 2;

      const assessDate = assessment.completedAt
        ? formatDate(assessment.completedAt)
        : formatDate(assessment.startedAt);
      const yearsAtAssess = ageInYears(patient.birthDate);

      drawLine(`受測者識別碼：${abbreviateId(patient.id)}`, 10);
      drawLine(`評估日期：${assessDate}`, 10);
      drawLine(`評估時年齡:${yearsAtAssess} 歲`, 10);
      drawLine(`狀態：${statusLabelsCn[assessment.status] ?? assessment.status}`, 10);
      y += 4;
      drawSeparator();

      // ===== Triage Result =====
      const triage = assessment.triageResult;
      if (triage) {
        drawLine('分流結果', 12, 'bold');
        y += 2;

        const catLabel = categoryLabelsCn[triage.category] ?? triage.category;
        drawLine(`分類：${catLabel}`, 10);
        drawLine(`信心度：${Math.round(triage.confidence * 100)}%`, 10);
        const summaryLines = doc.splitTextToSize(`摘要：${triage.summary}`, contentWidth);
        doc.setFontSize(10);
        doc.setFont('NotoSansTC', 'normal');
        doc.text(summaryLines, margin, y);
        y += summaryLines.length * 5 + 2;
        y += 4;
        drawSeparator();
      }

      // ===== Disclaimer =====
      y += 4;
      doc.setFontSize(9);
      doc.setFont('NotoSansTC', 'bold');
      doc.text('免責聲明', pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.setFont('NotoSansTC', 'normal');
      doc.setFontSize(8);
      const disclaimer = '本評估結果僅供參考，不構成醫療診斷。如有疑慮請諮詢專業醫療人員。';
      const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth);
      doc.text(disclaimerLines, margin, y);
      y += disclaimerLines.length * 4 + 6;

      // ===== Footer =====
      drawSeparator();
      doc.setFontSize(8);
      doc.setFont('NotoSansTC', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(`產製時間：${formatTimestamp(new Date())}`, margin, y);
      doc.text('Smart Func 成人功能健康評估', pageWidth - margin, y, { align: 'right' });

      const filename = `func-report-${abbreviateId(assessment.id)}-${assessDate.replace(/\//g, '')}.pdf`;
      doc.save(filename);

      onGenerated?.();
    } catch (err) {
      error = err instanceof Error ? err.message : 'PDF generation failed';
    } finally {
      generating = false;
    }
  }
</script>

<button class="btn-pdf" onclick={generatePdf} disabled={generating}>
  {#if generating}
    PDF 產生中...
  {:else}
    下載 PDF 報告
  {/if}
</button>

{#if error}
  <p class="pdf-error">{error}</p>
{/if}

<style>
  .btn-pdf {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-5);
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    cursor: pointer;
    min-height: 44px;
    transition: border-color 0.2s, background 0.2s;
  }

  .btn-pdf:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accent);
    color: white;
  }

  .btn-pdf:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .pdf-error {
    font-size: var(--text-xs);
    color: var(--danger);
    margin-top: var(--space-2);
  }
</style>
