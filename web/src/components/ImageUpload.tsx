'use client';

import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { formatBytes } from '@/lib/format';

interface ImageUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export function ImageUpload({ file, onChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File | null) => {
    setError(null);
    if (!f) {
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      onChange(null);
      return;
    }
    if (!ALLOWED.includes(f.type)) {
      setError('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    onChange(f);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-blue-500 hover:bg-blue-50/30 transition-colors"
        >
          <ImagePlus className="h-6 w-6 text-slate-400" />
          <span className="text-xs font-medium text-slate-700">
            Attach photo evidence (optional)
          </span>
          <span className="text-[11px] text-slate-400">JPEG, PNG, or WebP up to 5 MB</span>
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-3 min-w-0">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Selected attachment preview"
                className="h-14 w-14 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-900 truncate">{file.name}</p>
              <p className="text-[11px] text-slate-500">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleFile(null)}
            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
            aria-label="Remove photo"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
