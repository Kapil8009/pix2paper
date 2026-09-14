'use client';

import { DragEvent, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Download,
  FileArchive,
  FileImage,
  FileText,
  ImageDown,
  Layers3,
  LockKeyhole,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';

type Mode = 'pdf' | 'compress';
type PageSize = 'a4' | 'letter' | 'fit';
type Orientation = 'auto' | 'portrait' | 'landscape';
type Margin = 'none' | 'narrow' | 'classic';
type PdfQuality = 'small' | 'balanced' | 'best';
type ImageFormat = 'image/jpeg' | 'image/webp' | 'image/png';

type ImageItem = {
  id: string;
  file: File;
  name: string;
  size: number;
  url: string;
};

type Result = {
  title: string;
  detail: string;
};

const acceptedExtensions = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'svg', 'heic', 'heif', 'tif', 'tiff',
]);

const pdfQualityMap: Record<PdfQuality, { quality: number; maxEdge: number; label: string }> = {
  small: { quality: 0.48, maxEdge: 1600, label: 'Small file' },
  balanced: { quality: 0.72, maxEdge: 2560, label: 'Balanced' },
  best: { quality: 0.92, maxEdge: 4096, label: 'Best quality' },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

function extensionOf(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'image';
}

function isSupported(file: File) {
  return file.type.startsWith('image/') || acceptedExtensions.has(extensionOf(file.name));
}

function canvasToBlob(canvas: HTMLCanvasElement, type: ImageFormat, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('This browser could not create the output image.'))),
      type,
      quality,
    );
  });
}

function loadImage(blob: Blob) {
  return new Promise<{ image: HTMLImageElement; release: () => void }>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve({ image, release: () => URL.revokeObjectURL(url) });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The image could not be decoded.'));
    };
    image.src = url;
  });
}

async function renderFile(file: File, maxEdge: number, whiteBackground: boolean) {
  const extension = extensionOf(file.name);
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let release = () => undefined;

  if (extension === 'tif' || extension === 'tiff' || file.type === 'image/tiff') {
    const { default: UTIF } = await import('utif');
    const buffer = await file.arrayBuffer();
    const pages = UTIF.decode(buffer);
    if (!pages.length) throw new Error('No image was found inside this TIFF file.');
    UTIF.decodeImage(buffer, pages[0]);
    const rgba = UTIF.toRGBA8(pages[0]);
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = pages[0].width;
    sourceCanvas.height = pages[0].height;
    const sourceContext = sourceCanvas.getContext('2d');
    if (!sourceContext) throw new Error('Canvas is unavailable in this browser.');
    sourceContext.putImageData(
      new ImageData(new Uint8ClampedArray(rgba), pages[0].width, pages[0].height),
      0,
      0,
    );
    source = sourceCanvas;
    width = sourceCanvas.width;
    height = sourceCanvas.height;
  } else {
    let readableBlob: Blob = file;
    if (['heic', 'heif'].includes(extension) || ['image/heic', 'image/heif'].includes(file.type)) {
      const { default: heic2any } = await import('heic2any');
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.94 });
      readableBlob = Array.isArray(converted) ? converted[0] : converted;
    }
    const loaded = await loadImage(readableBlob);
    source = loaded.image;
    width = loaded.image.naturalWidth;
    height = loaded.image.naturalHeight;
    release = loaded.release;
  }

  try {
    if (!width || !height) throw new Error('The image has invalid dimensions.');
    const scale = maxEdge > 0 ? Math.min(1, maxEdge / Math.max(width, height)) : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable in this browser.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    if (whiteBackground) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    release();
  }
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef(new Set<string>());
  const [mode, setMode] = useState<Mode>('pdf');
  const [items, setItems] = useState<ImageItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [margin, setMargin] = useState<Margin>('narrow');
  const [pdfQuality, setPdfQuality] = useState<PdfQuality>('balanced');
  const [imageFormat, setImageFormat] = useState<ImageFormat>('image/jpeg');
  const [imageQuality, setImageQuality] = useState(72);
  const [maxEdge, setMaxEdge] = useState(1920);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const totalSize = items.reduce((sum, item) => sum + item.size, 0);

  function addFiles(fileList: FileList | File[]) {
    setError('');
    setResult(null);
    const incoming = Array.from(fileList);
    const supported = incoming.filter(isSupported).slice(0, Math.max(0, 60 - items.length));
    if (!supported.length) {
      setError('Choose image files such as JPG, PNG, WEBP, HEIC, TIFF, GIF, BMP, AVIF, or SVG.');
      return;
    }
    if (supported.length < incoming.length) {
      setError('Some unsupported files were skipped. You can add up to 60 images at a time.');
    }
    const next = supported.map((file) => {
      const url = URL.createObjectURL(file);
      urlsRef.current.add(url);
      return {
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        name: file.name,
        size: file.size,
        url,
      };
    });
    setItems((current) => [...current, ...next]);
  }

  function removeItem(id: string) {
    setItems((current) => {
      const found = current.find((item) => item.id === id);
      if (found) {
        URL.revokeObjectURL(found.url);
        urlsRef.current.delete(found.url);
      }
      return current.filter((item) => item.id !== id);
    });
    setResult(null);
  }

  function clearItems() {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current.clear();
    setItems([]);
    setResult(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function moveItem(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    setItems((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    setResult(null);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);
    addFiles(event.dataTransfer.files);
  }

  async function createPdf() {
    if (!items.length || busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    setProgress(4);
    try {
      const { jsPDF } = await import('jspdf');
      const quality = pdfQualityMap[pdfQuality];
      const marginMm = margin === 'none' ? 0 : margin === 'narrow' ? 6 : 14;
      let document: InstanceType<typeof jsPDF> | null = null;

      for (let index = 0; index < items.length; index += 1) {
        const canvas = await renderFile(items[index].file, quality.maxEdge, true);
        const imageLandscape = canvas.width >= canvas.height;
        const pageOrientation = orientation === 'auto' ? (imageLandscape ? 'landscape' : 'portrait') : orientation;
        let format: string | [number, number] = pageSize;
        if (pageSize === 'fit') {
          const ratio = canvas.width / canvas.height;
          let width = 210;
          let height = width / ratio;
          if (height > 297) {
            height = 297;
            width = height * ratio;
          }
          format = [Math.max(10, width), Math.max(10, height)];
        }

        if (!document) {
          document = new jsPDF({ unit: 'mm', format, orientation: pageOrientation, compress: true });
        } else {
          document.addPage(format, pageOrientation);
        }

        const pageWidth = document.internal.pageSize.getWidth();
        const pageHeight = document.internal.pageSize.getHeight();
        const availableWidth = Math.max(1, pageWidth - marginMm * 2);
        const availableHeight = Math.max(1, pageHeight - marginMm * 2);
        const imageRatio = canvas.width / canvas.height;
        let drawWidth = availableWidth;
        let drawHeight = drawWidth / imageRatio;
        if (drawHeight > availableHeight) {
          drawHeight = availableHeight;
          drawWidth = drawHeight * imageRatio;
        }
        const x = (pageWidth - drawWidth) / 2;
        const y = (pageHeight - drawHeight) / 2;
        document.addImage(canvas.toDataURL('image/jpeg', quality.quality), 'JPEG', x, y, drawWidth, drawHeight, undefined, 'FAST');
        setProgress(Math.round(((index + 1) / items.length) * 88));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }

      if (!document) throw new Error('No pages could be created.');
      const output = document.output('blob');
      downloadBlob(output, 'pix2paper-images.pdf');
      setProgress(100);
      setResult({
        title: 'Your PDF is ready',
        detail: `${items.length} page${items.length === 1 ? '' : 's'} · ${formatBytes(output.size)} · download started`,
      });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Unknown conversion error';
      setError(`We could not create the PDF. ${detail}`);
    } finally {
      setBusy(false);
    }
  }

  async function compressImages() {
    if (!items.length || busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    setProgress(4);
    try {
      const extension = imageFormat === 'image/jpeg' ? 'jpg' : imageFormat === 'image/webp' ? 'webp' : 'png';
      const outputs: Array<{ name: string; blob: Blob }> = [];
      let outputBytes = 0;

      for (let index = 0; index < items.length; index += 1) {
        const canvas = await renderFile(items[index].file, maxEdge, imageFormat === 'image/jpeg');
        const blob = await canvasToBlob(canvas, imageFormat, imageQuality / 100);
        outputs.push({ name: `${baseName(items[index].name)}.${extension}`, blob });
        outputBytes += blob.size;
        setProgress(Math.round(((index + 1) / items.length) * 82));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }

      if (outputs.length === 1) {
        downloadBlob(outputs[0].blob, outputs[0].name);
      } else {
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        outputs.forEach((output) => zip.file(output.name, output.blob));
        const archive = await zip.generateAsync(
          { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
          (metadata) => setProgress(82 + Math.round(metadata.percent * 0.18)),
        );
        downloadBlob(archive, 'pix2paper-compressed-images.zip');
      }

      const saving = totalSize > 0 ? Math.max(0, Math.round((1 - outputBytes / totalSize) * 100)) : 0;
      setProgress(100);
      setResult({
        title: outputs.length === 1 ? 'Your image is ready' : 'Your ZIP is ready',
        detail: `${formatBytes(outputBytes)} total · ${saving}% smaller · download started`,
      });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Unknown compression error';
      setError(`We could not compress the images. ${detail}`);
    } finally {
      setBusy(false);
    }
  }

  const primaryAction = mode === 'pdf' ? createPdf : compressImages;

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <a className="flex items-center gap-3 font-bold tracking-[-0.03em]" href="#top" aria-label="Pix2Paper home">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(15,43,38,.16)]">P</span>
          <span className="text-lg">Pix2Paper</span>
        </a>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur">
          <LockKeyhole className="size-3.5 text-primary" />
          <span className="hidden sm:inline">Files stay on your device</span>
          <span className="sm:hidden">Private</span>
        </div>
      </nav>

      <section id="top" className="mx-auto grid max-w-7xl items-start gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[.76fr_1.24fr] lg:gap-14 lg:pt-14">
        <div className="relative pt-3 lg:sticky lg:top-8 lg:pt-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-3.5" /> Free • fast • private
          </div>
          <h1 className="max-w-xl text-[clamp(3rem,6.6vw,5.5rem)] font-black leading-[.91] tracking-[-0.075em]">
            Images in.<span className="block text-primary">Perfect PDF out.</span>
          </h1>
          <p className="mt-7 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
            Convert photos and graphics to a polished PDF, or shrink image sizes with simple controls. No signup. No upload.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-extrabold tracking-[.08em] text-muted-foreground">
            <span>JPG</span><span>PNG</span><span>WEBP</span><span>HEIC</span><span>TIFF</span><span>GIF</span><span>AVIF</span><span>SVG</span>
          </div>
          <div className="mt-9 hidden max-w-sm grid-cols-2 gap-3 lg:grid">
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <ShieldCheck className="mb-3 size-5 text-primary" />
              <p className="text-sm font-extrabold">Browser private</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Your files never leave this tab.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <Layers3 className="mb-3 size-5 text-primary" />
              <p className="text-sm font-extrabold">Batch ready</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Process up to 60 images together.</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div aria-hidden="true" className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_center,rgba(113,193,154,.22),transparent_68%)]" />
          <section className="rounded-[2rem] border border-border bg-card p-3 shadow-[0_24px_80px_rgba(25,45,39,.12)] sm:p-5">
            <div className="flex flex-col gap-4 px-2 pb-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-extrabold">Create your file</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {items.length ? `${items.length} image${items.length === 1 ? '' : 's'} · ${formatBytes(totalSize)}` : 'Add one image or a whole batch'}
                </p>
              </div>
              <div className="flex h-10 w-full items-center gap-1 rounded-lg bg-muted p-1 sm:w-auto" aria-label="Output type">
                <Button
                  size="sm"
                  variant={mode === 'pdf' ? 'default' : 'ghost'}
                  aria-pressed={mode === 'pdf'}
                  className="h-8 flex-1 px-3 font-bold sm:flex-none"
                  onClick={() => { setMode('pdf'); setResult(null); setError(''); }}
                >
                  <FileText /> PDF maker
                </Button>
                <Button
                  size="sm"
                  variant={mode === 'compress' ? 'default' : 'ghost'}
                  aria-pressed={mode === 'compress'}
                  className="h-8 flex-1 px-3 font-bold sm:flex-none"
                  onClick={() => { setMode('compress'); setResult(null); setError(''); }}
                >
                  <ImageDown /> Compress
                </Button>
              </div>
            </div>

            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="image/*,.heic,.heif,.tif,.tiff,.svg,.avif"
              multiple
              onChange={(event) => event.target.files && addFiles(event.target.files)}
            />

            {!items.length ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`group flex min-h-80 w-full flex-col items-center justify-center rounded-[1.55rem] border-2 border-dashed px-6 text-center transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 ${dragActive ? 'border-primary bg-primary/10' : 'border-primary/25 bg-primary/[.035] hover:border-primary/60 hover:bg-primary/[.07]'}`}
              >
                <span className="mb-5 grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(15,79,68,.2)] transition group-hover:-translate-y-1">
                  <FileImage className="size-7" strokeWidth={2.3} />
                </span>
                <strong className="text-xl tracking-[-0.03em]">{dragActive ? 'Release to add images' : 'Drop images here'}</strong>
                <span className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">or click to choose multiple files from your device</span>
                <span className="mt-5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground">Up to 60 images</span>
              </button>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[1.06fr_.94fr]">
                <div className="min-w-0">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <p className="text-xs font-extrabold uppercase tracking-[.12em] text-muted-foreground">Your images</p>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}><Plus /> Add</Button>
                      <Button variant="ghost" size="sm" onClick={clearItems} className="text-destructive"><Trash2 /> Clear</Button>
                    </div>
                  </div>
                  <div className="max-h-[410px] space-y-2 overflow-y-auto pr-1">
                    {items.map((item, index) => (
                      <div key={item.id} className="group grid grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-background/55 p-2.5">
                        <div className="relative grid size-[54px] place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                          <FileImage className="size-5" />
                          <img src={item.url} alt="" className="absolute inset-0 size-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold" title={item.name}>{item.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatBytes(item.size)} · page {index + 1}</p>
                        </div>
                        <div className="flex items-center">
                          <Button variant="ghost" size="icon-sm" aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => moveItem(index, -1)}><ArrowUp /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Move ${item.name} down`} disabled={index === items.length - 1} onClick={() => moveItem(index, 1)}><ArrowDown /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive"><X /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-muted/70 p-4 sm:p-5">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                      {mode === 'pdf' ? <FileText className="size-5" /> : <ImageDown className="size-5" />}
                    </span>
                    <div>
                      <p className="text-sm font-extrabold">{mode === 'pdf' ? 'PDF options' : 'Image options'}</p>
                      <p className="text-xs text-muted-foreground">Choose the output you need</p>
                    </div>
                  </div>

                  {mode === 'pdf' ? (
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold text-muted-foreground">Page size</span>
                        <NativeSelect className="w-full" value={pageSize} onChange={(event) => setPageSize(event.target.value as PageSize)}>
                          <NativeSelectOption value="a4">A4 — standard document</NativeSelectOption>
                          <NativeSelectOption value="letter">US Letter</NativeSelectOption>
                          <NativeSelectOption value="fit">Fit page to each image</NativeSelectOption>
                        </NativeSelect>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold text-muted-foreground">Orientation</span>
                        <NativeSelect className="w-full" value={orientation} onChange={(event) => setOrientation(event.target.value as Orientation)}>
                          <NativeSelectOption value="auto">Auto for each image</NativeSelectOption>
                          <NativeSelectOption value="portrait">Portrait</NativeSelectOption>
                          <NativeSelectOption value="landscape">Landscape</NativeSelectOption>
                        </NativeSelect>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold text-muted-foreground">Page margin</span>
                        <NativeSelect className="w-full" value={margin} onChange={(event) => setMargin(event.target.value as Margin)}>
                          <NativeSelectOption value="none">No margin</NativeSelectOption>
                          <NativeSelectOption value="narrow">Narrow — 6 mm</NativeSelectOption>
                          <NativeSelectOption value="classic">Classic — 14 mm</NativeSelectOption>
                        </NativeSelect>
                      </label>
                      <fieldset>
                        <legend className="mb-1.5 text-xs font-bold text-muted-foreground">PDF quality</legend>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(Object.keys(pdfQualityMap) as PdfQuality[]).map((quality) => (
                            <Button key={quality} type="button" variant={pdfQuality === quality ? 'default' : 'outline'} size="sm" onClick={() => setPdfQuality(quality)} className="px-1 text-[11px]">
                              {pdfQualityMap[quality].label}
                            </Button>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold text-muted-foreground">Output format</span>
                        <NativeSelect className="w-full" value={imageFormat} onChange={(event) => setImageFormat(event.target.value as ImageFormat)}>
                          <NativeSelectOption value="image/jpeg">JPG — smallest & universal</NativeSelectOption>
                          <NativeSelectOption value="image/webp">WEBP — modern & efficient</NativeSelectOption>
                          <NativeSelectOption value="image/png">PNG — sharp & transparent</NativeSelectOption>
                        </NativeSelect>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 flex items-center justify-between text-xs font-bold text-muted-foreground"><span>Quality</span><span>{imageQuality}%</span></span>
                        <input
                          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
                          type="range"
                          min="30"
                          max="95"
                          step="1"
                          value={imageQuality}
                          disabled={imageFormat === 'image/png'}
                          onChange={(event) => setImageQuality(Number(event.target.value))}
                        />
                        <div className="mt-2 flex justify-between text-[10px] font-semibold text-muted-foreground"><span>Smaller</span><span>{imageFormat === 'image/png' ? 'PNG uses lossless quality' : 'Sharper'}</span></div>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold text-muted-foreground">Maximum dimension</span>
                        <NativeSelect className="w-full" value={String(maxEdge)} onChange={(event) => setMaxEdge(Number(event.target.value))}>
                          <NativeSelectOption value="0">Keep original size</NativeSelectOption>
                          <NativeSelectOption value="2560">2560 px — large</NativeSelectOption>
                          <NativeSelectOption value="1920">1920 px — recommended</NativeSelectOption>
                          <NativeSelectOption value="1280">1280 px — compact</NativeSelectOption>
                          <NativeSelectOption value="800">800 px — email</NativeSelectOption>
                        </NativeSelect>
                      </label>
                      <p className="rounded-xl border border-border bg-card/65 p-3 text-xs leading-5 text-muted-foreground">
                        Multiple images download together as one ZIP file.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(busy || error || result) && (
              <div className="mx-1 mt-4 rounded-xl border border-border bg-background/65 p-3" aria-live="polite">
                {busy && (
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs font-bold"><span>Processing on your device…</span><span>{progress}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div>
                  </div>
                )}
                {error && <p className="text-sm font-semibold text-destructive" role="alert">{error}</p>}
                {result && !busy && (
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground"><Check className="size-4" /></span>
                    <div><p className="text-sm font-extrabold">{result.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{result.detail}</p></div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 px-2 pb-1 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><LockKeyhole className="size-3.5 text-primary" /> 100% local processing</p>
              <Button
                size="lg"
                disabled={!items.length || busy}
                onClick={primaryAction}
                className="h-12 rounded-xl px-6 text-sm font-extrabold shadow-[0_10px_24px_rgba(15,79,68,.2)]"
              >
                {busy ? 'Working…' : mode === 'pdf' ? 'Create & download PDF' : 'Compress & download'}
                {mode === 'pdf' ? <ArrowRight data-icon="inline-end" /> : <Download data-icon="inline-end" />}
              </Button>
            </div>
          </section>
        </div>
      </section>

      <section className="border-y border-border bg-card/55" aria-label="How Pix2Paper works">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 sm:px-8 md:grid-cols-3">
          {[
            { icon: FileImage, step: '01', title: 'Add any image', body: 'Mix common formats in one batch, including HEIC and TIFF.' },
            { icon: RotateCcw, step: '02', title: 'Choose your output', body: 'Control page layout, quality, format, margin, and dimensions.' },
            { icon: FileArchive, step: '03', title: 'Download instantly', body: 'Get one PDF or a tidy ZIP, created directly in your browser.' },
          ].map(({ icon: Icon, step, title, body }) => (
            <article key={step} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Icon className="size-5" /></span>
              <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Step {step}</p><h2 className="mt-1 text-base font-extrabold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-9 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="font-semibold">Pix2Paper · A free browser utility</p>
        <p>Animated GIFs and multi-page TIFFs use their first frame. Output support depends on your browser.</p>
      </footer>
    </main>
  );
}
