export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  brand?: string;
  unit?: string;
}

export interface ProcessedDocument {
  id: string;
  clientName: string;
  receiptDate: string; // YYYY-MM-DD
  docType: 'po' | 'quote' | 'unknown';
  docNumber: string; // PO Number or Quote Ref
  items: LineItem[];
  totalAmount: number;
  currency: string;
  originalFilename: string;
  classifiedPath: string; // e.g. /data/organized/Client_Name/2026-06-10_PO_123.pdf
  status: 'processed' | 'pending' | 'failed';
  processedAt: string;
  telegramUser?: string | null;
  notes?: string;
  summary?: string;
  shipToAddress?: string;
  deliveryDate?: string;
  paymentDays?: string;
  signatureProcurement?: string;
  signatureTechnical?: string;
  signatureManager?: string;
  projectName?: string;
  poSequenceNum?: number;
  withholdingTaxEnabled?: boolean;
  withholdingTaxRate?: number;
  discountPercentage?: number;
  discountAmount?: number;
  projectStatus?: 'in_progress' | 'completed' | 'deferred';
  vatTerms?: string;
  deliveryTerms?: string;
  advancePayment?: string;
  dueDate?: string;
}

export interface AppStats {
  totalProcessedCount: number;
  uniqueClientCount: number;
  totalValueByCurrency: Record<string, number>;
  latestDocumentDate: string | null;
}

export interface TelegramConfig {
  botToken: string;
  isWebhookSet: boolean;
  botUsername: string | null;
  webhookUrl: string;
}

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
