import PDFDocument from 'pdfkit';
import { Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from 'docx';
import { getMemberTimeline, getMemberStats } from './timelineService.ts';
import { query } from '../db/database.ts';
import { logAudit } from './auditService.ts';
import crypto from 'crypto';

export interface ExportOptions {
  jempId: string;
  format: 'pdf' | 'docx' | 'markdown' | 'json';
  scope?: 'full' | 'year' | 'project' | 'shareable';
  filterVal?: string;
  shareableOnly?: boolean;
  actor?: string;
}

export async function generateExport(options: ExportOptions): Promise<{
  buffer?: Buffer;
  text?: string;
  contentType: string;
  filename: string;
  eventCount: number;
}> {
  const { jempId, format, scope = 'full', filterVal } = options;

  // Query events based on scope
  const queryOpts: any = { jempId, limit: 1000 };
  if (options.shareableOnly || scope === 'shareable') {
    queryOpts.visibility = ['SHAREABLE', 'PUBLIC'];
  }
  if (scope === 'year' && filterVal) {
    queryOpts.year = parseInt(filterVal, 10);
  }
  if (scope === 'project' && filterVal) {
    queryOpts.projectId = filterVal;
  }

  const { events } = await getMemberTimeline(queryOpts);
  const stats = await getMemberStats(jempId);

  const exportId = 'EXP-' + crypto.randomUUID().substring(0, 8).toUpperCase();
  const dateStr = new Date().toISOString().split('T')[0];

  // Record export snapshot
  await query(
    `INSERT INTO timeline_exports (
      id, export_id, member_id, jemp_id, format, scope, filter_val, event_count, generated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      crypto.randomUUID(),
      exportId,
      events[0]?.member_id || jempId,
      jempId,
      format,
      scope,
      filterVal || null,
      events.length,
    ]
  );

  await logAudit({
    action: 'export_generated',
    actor: options.actor || jempId,
    source_system: 'TIMELINE',
    jemp_id: jempId,
    details: {
      exportId,
      format,
      scope,
      eventCount: events.length,
    },
  });

  if (format === 'json') {
    const jsonOutput = JSON.stringify(
      {
        institution: 'JOBLESS EMPIRE (JEMP)',
        document: 'CANONICAL PROOF-OF-WORK TIMELINE RECORD',
        snapshotId: exportId,
        generatedAt: new Date().toISOString(),
        memberJempId: jempId,
        status: 'ACTIVE',
        scope,
        filter: filterVal || null,
        statistics: {
          totalEntries: stats.total_entries,
          officialVerifiedEntries: stats.official_entries,
          projectsParticipated: stats.projects_participated,
          brainstormsParticipated: stats.brainstorms_participated,
          clientOpportunities: stats.client_opportunities,
          milestonesCompleted: stats.milestones_completed,
          reportsSubmitted: stats.reports_submitted,
        },
        notice: 'Official timeline events are immutable and system-recorded. Hours worked are deliberately not estimated.',
        events: events.map((e) => ({
          eventId: e.event_id,
          date: e.occurred_at,
          eventType: e.event_type,
          authority: e.authority,
          title: e.title,
          description: e.description,
          sourceSystem: e.source_system,
          sourceEntity: e.source_entity_id
            ? {
                type: e.source_entity_type,
                id: e.source_entity_id,
                name: e.source_entity_name,
              }
            : null,
          visibility: e.visibility,
          correction: e.corrected_by_event_id
            ? {
                correctedByEventId: e.corrected_by_event_id,
                reason: e.correction_reason,
              }
            : null,
        })),
        verificationUrl: `https://despair.us`,
      },
      null,
      2
    );

    return {
      text: jsonOutput,
      contentType: 'application/json',
      filename: `${jempId}_timeline_${dateStr}.json`,
      eventCount: events.length,
    };
  }

  if (format === 'markdown') {
    let md = `# JOBLESS EMPIRE\n`;
    md += `## PROOF-OF-WORK TIMELINE RECORD\n\n`;
    md += `**MEMBER:** ${jempId}  \n`;
    md += `**STATUS:** ACTIVE MEMBER  \n`;
    md += `**DOCUMENT ID:** ${exportId}  \n`;
    md += `**GENERATED:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}  \n\n`;
    md += `> "A job title can disappear. Your work doesn't have to."  \n`;
    md += `> "NO JOB. STILL BUILDING."\n\n`;
    md += `---\n\n`;
    md += `### DOCUMENTED PROOF-OF-WORK SUMMARY\n\n`;
    md += `| Metric | Count |\n`;
    md += `| :--- | :--- |\n`;
    md += `| Verified Timeline Entries | ${stats.official_entries} |\n`;
    md += `| Projects Participated | ${stats.projects_participated} |\n`;
    md += `| Brainstorms Participated | ${stats.brainstorms_participated} |\n`;
    md += `| Client/Hiring Opportunities | ${stats.client_opportunities} |\n`;
    md += `| Documented Milestones | ${stats.milestones_completed} |\n`;
    md += `| Formal Reports Published | ${stats.reports_submitted} |\n\n`;
    md += `---\n\n`;
    md += `### CHRONOLOGICAL TIMELINE\n\n`;

    if (events.length === 0) {
      md += `*No documented timeline events found for this filter criteria.*\n\n`;
    } else {
      events.forEach((e) => {
        const d = new Date(e.occurred_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        });
        md += `#### ${d} — ${e.title}\n`;
        md += `**Type:** \`${e.event_type}\` | **Authority:** \`${e.authority}\`  \n`;
        if (e.source_entity_name && e.source_entity_id) {
          md += `**Entity:** [${e.source_entity_id}] ${e.source_entity_name}  \n`;
        }
        md += `**Source System:** ${e.source_system}  \n\n`;
        md += `${e.description}\n\n`;
        if (e.corrected_by_event_id) {
          md += `> ⚠️ *Administrative Correction on file (${e.corrected_by_event_id}): ${e.correction_reason}*\n\n`;
        }
        md += `---\n\n`;
      });
    }

    md += `\n*Jobless Empire • https://despair.us • "Your work should leave a trail."*\n`;

    return {
      text: md,
      contentType: 'text/markdown',
      filename: `${jempId}_timeline_${dateStr}.md`,
      eventCount: events.length,
    };
  }

  if (format === 'pdf') {
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        info: {
          Title: `Proof-of-Work Timeline - ${jempId}`,
          Author: 'Jobless Empire',
          Subject: 'Verified Proof of Work',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Styling: despair.us aesthetic - dark slate text, clean rules, high contrast
      // Header
      doc.fontSize(10).fillColor('#666666').text('JOBLESS EMPIRE', { characterSpacing: 2 });
      doc.fontSize(22).fillColor('#111111').text('PROOF-OF-WORK TIMELINE', { characterSpacing: 1 });
      doc.moveDown(0.2);
      doc.fontSize(14).fillColor('#222222').text(`${jempId} · ACTIVE MEMBER`);
      doc.moveDown(0.3);

      doc.fontSize(8).fillColor('#777777').text(
        `Document ID: ${exportId}   ·   Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
      );

      // Separator rule
      doc.moveDown(0.5);
      doc.strokeColor('#cccccc').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Motto
      doc.fontSize(9).fillColor('#444444').font('Helvetica-Oblique').text(
        '"A job title can disappear. Your work doesn\'t have to." — No job. Still building.'
      );
      doc.font('Helvetica');
      doc.moveDown(1);

      // Summary Box
      doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold').text('DOCUMENTED PROOF-OF-WORK SUMMARY');
      doc.font('Helvetica');
      doc.moveDown(0.4);

      const summaryY = doc.y;
      doc.rect(50, summaryY, 495, 48).fillAndStroke('#f8f9fa', '#e5e7eb');

      doc.fillColor('#111111').fontSize(9);
      doc.text(`Projects: ${stats.projects_participated}`, 65, summaryY + 10);
      doc.text(`Brainstorms: ${stats.brainstorms_participated}`, 180, summaryY + 10);
      doc.text(`Client Work: ${stats.client_opportunities}`, 320, summaryY + 10);

      doc.text(`Verified Entries: ${stats.official_entries}`, 65, summaryY + 28);
      doc.text(`Milestones: ${stats.milestones_completed}`, 180, summaryY + 28);
      doc.text(`Reports: ${stats.reports_submitted}`, 320, summaryY + 28);

      doc.y = summaryY + 60;
      doc.moveDown(0.8);

      // Timeline entries header
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111111').text('CHRONOLOGICAL PROOF OF WORK');
      doc.font('Helvetica');
      doc.moveDown(0.5);

      if (events.length === 0) {
        doc.fontSize(9).fillColor('#777777').text('No documented timeline events matching criteria.');
      } else {
        events.forEach((ev, i) => {
          // Check for page break
          if (doc.y > 700) {
            doc.addPage();
          }

          const dateStr = new Date(ev.occurred_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
          });

          const currentY = doc.y;

          // Date column
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#555555').text(dateStr.toUpperCase(), 50, currentY);

          // Event type & title
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#111111').text(ev.title, 130, currentY);

          // Entity badge & Source
          let entityLine = `${ev.event_type}  ·  Source: ${ev.source_system}`;
          if (ev.source_entity_name && ev.source_entity_id) {
            entityLine += `  ·  ${ev.source_entity_id}: ${ev.source_entity_name}`;
          }
          doc.fontSize(8).font('Helvetica').fillColor('#666666').text(entityLine, 130, doc.y + 2);

          // Description
          doc.fontSize(8.5).fillColor('#333333').text(ev.description, 130, doc.y + 3, {
            width: 410,
            lineGap: 1.5,
          });

          if (ev.corrected_by_event_id) {
            doc.fontSize(7.5).fillColor('#b91c1c').text(
              `[Correction on file: ${ev.correction_reason}]`,
              130,
              doc.y + 2
            );
          }

          doc.moveDown(0.8);
          // Subtle divider line between items
          if (i < events.length - 1) {
            doc.strokeColor('#f0f0f0').lineWidth(0.5).moveTo(130, doc.y).lineTo(540, doc.y).stroke();
            doc.moveDown(0.6);
          }
        });
      }

      // Footer
      const totalPages = doc.bufferedPageRange().count;
      for (let p = 0; p < totalPages; p++) {
        doc.switchToPage(p);
        doc.fontSize(8).fillColor('#888888').text(
          'Jobless Empire  ·  https://despair.us  ·  "Your work should leave a trail."',
          50,
          780,
          { align: 'center', width: 495 }
        );
      }

      doc.end();
    });

    return {
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      filename: `${jempId}_timeline_${dateStr}.pdf`,
      eventCount: events.length,
    };
  }

  // DOCX Export
  const docxDoc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'JOBLESS EMPIRE',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            text: 'PROOF-OF-WORK TIMELINE',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${jempId} — ACTIVE MEMBER`, bold: true }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Document ID: ${exportId}  |  Generated: ${new Date().toLocaleDateString('en-US')}`,
                italics: true,
                color: '666666',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '"A job title can disappear. Your work doesn\'t have to." — NO JOB. STILL BUILDING.',
                italics: true,
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'PROOF-OF-WORK SUMMARY',
            heading: HeadingLevel.HEADING_3,
          }),
          new Paragraph({
            text: `Projects Participated: ${stats.projects_participated} | Brainstorms: ${stats.brainstorms_participated} | Client Opportunities: ${stats.client_opportunities}`,
          }),
          new Paragraph({
            text: `Verified Entries: ${stats.official_entries} | Milestones Completed: ${stats.milestones_completed} | Reports: ${stats.reports_submitted}`,
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'CHRONOLOGICAL RECORDS',
            heading: HeadingLevel.HEADING_3,
          }),
          ...events.flatMap((ev) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${new Date(ev.occurred_at).toLocaleDateString('en-US')} — ${ev.title}`,
                  bold: true,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Type: ${ev.event_type} | Source: ${ev.source_system} ${
                    ev.source_entity_id ? `| Entity: ${ev.source_entity_id} (${ev.source_entity_name})` : ''
                  }`,
                  color: '555555',
                }),
              ],
            }),
            new Paragraph({ text: ev.description }),
            new Paragraph({ text: '----------------------------------------' }),
          ]),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Jobless Empire • https://despair.us • "Your work should leave a trail."',
                italics: true,
                color: '777777',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const { Packer } = await import('docx');
  const docxBuffer = await Packer.toBuffer(docxDoc);

  return {
    buffer: docxBuffer,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    filename: `${jempId}_timeline_${dateStr}.docx`,
    eventCount: events.length,
  };
}
