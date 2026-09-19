import type { jsPDF } from 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
    };
    internal: {
      getNumberOfPages?: () => number;
      pageSize: {
        getHeight(): number;
        getWidth(): number;
      };
    };
  }
}

declare module 'jspdf-autotable' {
  import type { jsPDF } from 'jspdf';
  export default function autoTable(doc: jsPDF, options: Record<string, unknown>): void;
}

