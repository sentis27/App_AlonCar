-- 0030_purchase_docs_extracted_text.sql
-- Soporte para búsqueda nivel 2 en texto digital extraído de PDFs adjuntos (sin IA)

ALTER TABLE public.purchase_documents
  ADD COLUMN IF NOT EXISTS extracted_text TEXT;

CREATE INDEX IF NOT EXISTS idx_purchase_docs_order_id ON public.purchase_documents(purchase_order_id);
