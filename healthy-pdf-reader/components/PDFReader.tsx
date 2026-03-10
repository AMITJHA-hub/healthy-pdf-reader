'use client';

import { Document, Page, pdfjs } from 'react-pdf';
import { useState, useEffect, CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHealth } from '../context/HealthContext';

// Setup worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFReaderProps {
  url: string;
  onPageChange?: (page: number) => void;
  onTotalPages?: (total: number) => void;
}

export default function PDFReader({ url, onPageChange, onTotalPages }: PDFReaderProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const { isInBreak } = useHealth();

  useEffect(() => {
    onPageChange?.(pageNumber);
  }, [pageNumber, onPageChange]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    onTotalPages?.(numPages);
  }

  // Book animation variants
  const bookVariants = {
    open: {
      rotateY: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: 0.8 }
    },
    closed: {
      rotateY: -15, // Slight angle to simulate closing
      scale: 1,
      opacity: 0,
      transition: { duration: 0.8 }
    }
  };

  const coverVariants = {
    closed: {
      rotateY: 0,
      opacity: 1,
      zIndex: 20,
      transition: { duration: 0.8 }
    },
    open: {
      rotateY: -180,
      opacity: 0,
      zIndex: -1,
      transition: { duration: 0.8 }
    }
  };

  return (
    <div className="flex flex-col h-full w-full items-center relative perspective-[2000px]">

      {/* Controls - Disabled during break */}
      <div className={`sticky top-0 z-10 w-full bg-background/80 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center shadow-sm transition-opacity duration-300 ${isInBreak ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="p-2 hover:bg-secondary/20 rounded-lg disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-medium text-sm">
            Page {pageNumber} of {numPages}
          </span>
          <button
            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="p-2 hover:bg-secondary/20 rounded-lg disabled:opacity-50 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-2 hover:bg-secondary/20 rounded-lg transition-colors">
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.0, s + 0.1))} className="p-2 hover:bg-secondary/20 rounded-lg transition-colors">
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Document Area with Animation */}
      <div className="flex-1 overflow-auto w-full flex justify-center p-8 bg-secondary/5 relative">

        <AnimatePresence mode="sync">
          {!isInBreak && (
            <motion.div
              key="content"
              variants={bookVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="origin-left shadow-2xl"
              style={{ transformStyle: 'preserve-3d' } as CSSProperties}
            >
              <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                className=""
                loading={
                  <div className="flex items-center justify-center p-20 text-muted-foreground">
                    Loading PDF...
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="rounded-lg overflow-hidden border border-white/5 bg-white shadow-lg"
                />
              </Document>
            </motion.div>
          )}

          {isInBreak && (
            <motion.div
              key="closed-cover"
              initial={{ opacity: 0, scale: 0.9, rotateY: 20 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, rotateY: 20 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-[400px] h-[550px] bg-indigo-900 rounded-lg shadow-2xl border-l-[10px] border-indigo-950 flex flex-col items-center justify-center text-indigo-200">
                <div className="text-4xl font-serif mb-4">Healthy Reader</div>
                <div className="text-sm uppercase tracking-widest opacity-50">Taking a Break</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
