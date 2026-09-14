declare module 'utif' {
  export type Ifd = {
    width: number;
    height: number;
    [key: string]: unknown;
  };

  const UTIF: {
    decode(buffer: ArrayBuffer): Ifd[];
    decodeImage(buffer: ArrayBuffer, ifd: Ifd): void;
    toRGBA8(ifd: Ifd): Uint8Array;
  };

  export default UTIF;
}
