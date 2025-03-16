
declare module 'pdf-lib' {
  export class PDFDocument {
    static load(data: ArrayBuffer): Promise<PDFDocument>;
    registerFontkit(fontkit: any): void;
    getForm(): PDFForm;
    setTitle(title: string): void;
    embedFont(fontData: ArrayBuffer): Promise<PDFFont>;
    embedPng(pngData: ArrayBuffer): Promise<PDFImage>;
    save(): Promise<Uint8Array>;
  }

  export class PDFForm {
    getTextField(name: string): PDFTextField;
    getButton(name: string): PDFButton;
    flatten(): void;
  }

  export class PDFTextField {
    setText(text: string): void;
    updateAppearances(font: PDFFont): void;
  }

  export class PDFButton {
    setImage(image: PDFImage): void;
  }

  interface PDFFont {}
  interface PDFImage {}
}

declare module '@pdf-lib/fontkit' {
  const fontkit: any;
  export default fontkit;
}
