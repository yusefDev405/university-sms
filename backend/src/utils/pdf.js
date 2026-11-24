/**
 * Pure-JS zero-dependency PDF 1.4 transcript generator.
 * Produces an authentic multi-line official transcript PDF with Helvetica + Courier fonts.
 */

function escapePdfText(text) {
  return String(text ?? '')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdfFromLines(lines) {
  const ops = ['BT'];
  let y = 760;

  for (const line of lines) {
    if (y < 52) break;
    const font = line.mono ? '/F2' : line.bold ? '/F3' : '/F1';
    const size = line.size || 10;
    ops.push(`${font} ${size} Tf`);
    ops.push(`1 0 0 1 48 ${y} Tm`);
    ops.push(`(${escapePdfText(line.text)}) Tj`);
    y -= line.gap || 15;
  }
  ops.push('ET');

  const stream = ops.join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `7 0 obj\n<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream\nendobj\n`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

export function generateTranscriptPdfBuffer(transcript) {
  const { student, summary, courses } = transcript;
  const gpaText = summary.gpa !== null ? summary.gpa.toFixed(2) : 'N/A';

  const lines = [
    { text: 'GALALA UNIVERSITY - OFFICE OF THE REGISTRAR', bold: true, size: 14, gap: 18 },
    { text: 'OFFICIAL ACADEMIC TRANSCRIPT', bold: true, size: 11, gap: 22 },
    { text: `Student: ${student.first_name} ${student.last_name}   |   ID: ${student.student_number}`, size: 10, gap: 15 },
    { text: `Department: ${student.department_code} - ${student.department_name}   |   Status: ${student.status}`, size: 10, gap: 15 },
    { text: `Cumulative GPA: ${gpaText}   |   Standing: ${summary.standing}   |   Credits Earned: ${summary.creditsEarned} / ${summary.creditsAttempted}`, size: 10, gap: 20 },
    { text: '--------------------------------------------------------------------------', mono: true, size: 9, gap: 14 },
    { text: 'CODE      COURSE TITLE                       TERM           CR  GRADE  PTS', mono: true, size: 9, gap: 14 },
    { text: '--------------------------------------------------------------------------', mono: true, size: 9, gap: 14 }
  ];

  if (!courses || courses.length === 0) {
    lines.push({ text: 'No completed graded coursework on record.', size: 10, gap: 16 });
  } else {
    for (const c of courses) {
      const code = String(c.course_code).padEnd(9).slice(0, 9);
      const title = String(c.course_title).padEnd(34).slice(0, 34);
      const term = String(c.term_name).padEnd(14).slice(0, 14);
      const cr = String(c.credits).padStart(2);
      const letter = String(c.grade_letter || '-').padEnd(5).slice(0, 5);
      const pts = Number(c.grade_points).toFixed(2);
      lines.push({
        text: `${code} ${title} ${term} ${cr}  ${letter}  ${pts}`,
        mono: true,
        size: 9,
        gap: 14
      });
    }
  }

  lines.push({ text: '--------------------------------------------------------------------------', mono: true, size: 9, gap: 18 });
  lines.push({ text: `Issued: ${new Date().toISOString().slice(0, 10)} (Verified Electronic Record)`, size: 8, gap: 12 });

  return buildPdfFromLines(lines);
}
