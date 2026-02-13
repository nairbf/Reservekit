"use client";

import { useRef, useState } from "react";

type AcceptType = "image" | "pdf" | "both";

interface FileUploadProps {
  accept?: AcceptType;
  category: string;
  onUpload: (url: string, filename: string, type: string) => void;
  onRemove?: () => void;
  currentUrl?: string;
  currentType?: string;
  label?: string;
  hint?: string;
  maxSizeMB?: number;
}

function acceptMime(accept: AcceptType): string {
  if (accept === "image") return "image/jpeg,image/png,image/webp,image/gif";
  if (accept === "pdf") return "application/pdf";
  return "image/jpeg,image/png,image/webp,image/gif,application/pdf";
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(url);
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

function validateFile(file: File, accept: AcceptType, maxSizeMB: number): string | null {
  if (file.size > maxSizeMB * 1024 * 1024) return `File exceeds ${maxSizeMB}MB limit.`;

  if (accept === "image" && !file.type.startsWith("image/")) {
    return "Please upload an image file (JPG, PNG, WEBP, GIF).";
  }
  if (accept === "pdf" && file.type !== "application/pdf") {
    return "Please upload a PDF file.";
  }
  if (accept === "both" && !(file.type.startsWith("image/") || file.type === "application/pdf")) {
    return "Please upload an image or PDF file.";
  }

  return null;
}

export default function FileUpload({
  accept = "both",
  category,
  onUpload,
  onRemove,
  currentUrl,
  currentType,
  label,
  hint,
  maxSizeMB = 10,
}: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    const validationError = validateFile(file, accept, maxSizeMB);
    if (validationError) {
      setError(validationError);
      return;
    }

    const form = new FormData();
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    setUploading(true);
    setProgress(0);
    setError("");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status < 200 || xhr.status >= 300) {
        try {
          const payload = JSON.parse(xhr.responseText) as { error?: string };
          setError(payload.error || "Upload failed.");
        } catch {
          setError("Upload failed.");
        }
        return;
      }

      try {
        const payload = JSON.parse(xhr.responseText) as { url: string; filename: string; type: string };
        onUpload(payload.url, payload.filename, payload.type);
      } catch {
        setError("Upload completed but response was invalid.");
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError("Network error while uploading.");
    };

    xhr.open("POST", `/api/uploads?category=${encodeURIComponent(category)}`);
    xhr.send(form);
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  const showImage = Boolean(currentUrl && (currentType?.startsWith("image/") || isImageUrl(currentUrl)));
  const showPdf = Boolean(currentUrl && (currentType === "application/pdf" || isPdfUrl(currentUrl)));

  return (
    <div className="space-y-2">
      {label ? <label className="block text-sm font-medium">{label}</label> : null}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-4 transition-all ${dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptMime(accept)}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
          }}
          className="hidden"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Drop file here or browse</p>
            <p className="text-xs text-gray-500">Max {maxSizeMB}MB. PDF, JPG, PNG, WEBP, GIF.</p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm"
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Choose File"}
          </button>
        </div>

        {uploading ? (
          <div className="mt-3">
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-gray-500">{progress}%</p>
          </div>
        ) : null}

        {currentUrl ? (
          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
            {showImage ? (
              <img src={currentUrl} alt="Uploaded preview" className="max-h-48 rounded-md border border-gray-100 object-contain" />
            ) : showPdf ? (
              <div className="text-sm text-gray-700">PDF uploaded.</div>
            ) : (
              <a href={currentUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">View uploaded file</a>
            )}
            {onRemove ? (
              <button
                type="button"
                onClick={onRemove}
                className="mt-3 h-9 rounded-lg border border-red-200 px-3 text-xs text-red-700"
              >
                Remove
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
