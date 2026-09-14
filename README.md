# Pix2Paper

Pix2Paper is a privacy-first browser utility for turning images into PDF files and reducing image file sizes. Processing happens locally in the browser, so selected files are not uploaded to a server.

**Live site:** [pix2paper-convert.kapil-e18497.chatgpt.site](https://pix2paper-convert.kapil-e18497.chatgpt.site)

## Features

- Combine and reorder up to 60 images in one PDF
- Choose A4, US Letter, or image-sized PDF pages
- Control orientation, margins, and PDF quality
- Compress images to JPG, WEBP, or PNG
- Resize images with several maximum-dimension presets
- Download multiple compressed images together as a ZIP file
- Decode common browser image formats plus HEIC/HEIF and TIFF
- Perform all conversion work on the user's device

## Supported inputs

JPG/JPEG, PNG, WEBP, HEIC/HEIF, TIFF, GIF, BMP, AVIF, and SVG. Animated GIFs and multi-page TIFF files use their first frame. Exact decoding support can vary by browser.

## Run locally

Requirements: Node.js 22.13 or later and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production build

```bash
npm run build
```

## Technology

- React 19 and TypeScript
- Vinext and Vite
- Tailwind CSS and shadcn components
- jsPDF for PDF creation
- JSZip for batch downloads
- heic2any and UTIF for additional image formats

## Privacy

Pix2Paper does not send selected images to an application server. Conversion, compression, and archive creation run inside the browser tab.
