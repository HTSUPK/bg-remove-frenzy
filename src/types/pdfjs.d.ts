
declare module 'pdfjs-dist' {
  export function getDocument(options: { data: Uint8Array }): { promise: Promise<PDFDocumentProxy> };
  
  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }
  
  export interface PDFPageProxy {
    getViewport(options: { scale: number }): PDFViewport;
    getTextContent(): Promise<PDFTextContent>;
    getOperatorList(): Promise<PDFOperatorList>;
    commonObjs: any;
    objs: any;
  }
  
  export interface PDFViewport {
    width: number;
    height: number;
  }
  
  export interface PDFTextContent {
    items: PDFTextItem[];
  }
  
  export interface PDFTextItem {
    str: string;
    transform: number[];
    hasEOL?: boolean;
    height: number;
  }
  
  export interface PDFOperatorList {}
  
  export class SVGGraphics {
    constructor(commonObjs: any, objs: any);
    getSVG(operatorList: PDFOperatorList, viewport: PDFViewport): Promise<SVGElement>;
  }
  
  export const GlobalWorkerOptions: {
    workerSrc: string;
  };
}
