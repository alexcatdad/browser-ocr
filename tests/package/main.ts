import { LocalOcrReader, PSM } from '@alexcatdad/browser-ocr';
import { LocalPdfReader, clearCanvas } from '@alexcatdad/browser-ocr';
let pdfReader: LocalPdfReader | undefined;
const pdfApi = {
  async preparePdfReader() {
    pdfReader = new LocalPdfReader({ assetBaseUrl: '/reader-assets/' });
    await pdfReader.prepare();
  },
  async openPdf() {
    if (!pdfReader) throw new Error('Prepare first');
    const stream = '0 0 0 rg 20 20 100 100 re f';
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Count 1 /Kids [3 0 R] >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return pdfReader.open(new File([pdf], 'synthetic.pdf', { type: 'application/pdf' }));
  },
  async renderPdf() {
    if (!pdfReader) throw new Error('Prepare first');
    let canvas: HTMLCanvasElement | undefined;
    try {
      canvas = await pdfReader.render(1);
      const ctx = canvas.getContext('2d')!;
      const black = Array.from(ctx.getImageData(Math.round(canvas.width * 0.3), Math.round(canvas.height * 0.7), 1, 1).data);
      return { width: canvas.width, height: canvas.height, black };
    } finally {
      if (canvas) clearCanvas(canvas);
      await pdfReader.dispose();
    }
  },
};


let reader: LocalOcrReader | undefined;
function fixture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 220;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000'; context.font = '64px Arial';
  context.fillText('Independent optical reader', 35, 130);
  return canvas;
}
const api = {
  ...pdfApi,
  async prepare() {
    reader = new LocalOcrReader(undefined, { assetBaseUrl: '/reader-assets/', languages: 'eng', pageSegmentation: PSM.SINGLE_BLOCK });
    await reader.prepare();
  },
  async read() {
    if (!reader) throw new Error('Prepare first');
    const canvas = fixture();
    try {
      const first = await reader.read(canvas);
      const second = await reader.read(canvas);
      const borrowed = canvas.width === 1200 && canvas.height === 220;
      await reader.dispose();
      clearCanvas(canvas);
      return { first, second, borrowed, cleared: canvas.width === 0 && canvas.height === 0, ready: reader.ready };
    } finally { clearCanvas(canvas); await reader.dispose(); }
  },
  async cancelRead() {
    if (!reader) throw new Error('Prepare first');
    const canvas = fixture();
    const result = reader.read(canvas).then(() => ({ rejected: false }), () => ({ rejected: true }));
    await reader.cancel();
    const outcome = await result;
    clearCanvas(canvas);
    return { ...outcome, ready: reader.ready, cleared: canvas.width === 0 && canvas.height === 0 };
  },
};
declare global { interface Window { ocrConsumer: typeof api } }
window.ocrConsumer = api;
document.querySelector('#status')!.textContent = 'Consumer ready';
