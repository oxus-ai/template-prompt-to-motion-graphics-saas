import { fileToBase64 } from "@/helpers/capture-frame";
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";

const MAX_ATTACHED_FILES = 10;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export interface AttachedFile {
  file: File;
  /** Base64 data URL — only populated for images (for LLM visual context) */
  base64?: string;
  name: string;
  type: "image" | "video" | "audio";
  mimeType: string;
  size: number;
}

function isMediaFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    file.type.startsWith("audio/")
  );
}

function getMaxSizeForType(mimeType: string): number {
  if (mimeType.startsWith("video/")) return MAX_VIDEO_SIZE_BYTES;
  if (mimeType.startsWith("audio/")) return MAX_AUDIO_SIZE_BYTES;
  return MAX_IMAGE_SIZE_BYTES;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

function getFileType(mimeType: string): "image" | "video" | "audio" {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "image";
}

interface UseMediaAttachmentsReturn {
  attachedFiles: AttachedFile[];
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  addImageFromBase64: (base64: string) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  handleFileSelect: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handlePaste: (e: ClipboardEvent) => Promise<void>;
  handleDragOver: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDrop: (e: DragEvent) => Promise<void>;
  canAddMore: boolean;
  error: string | null;
  clearError: () => void;
}

export function useMediaAttachments(): UseMediaAttachmentsReturn {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const filterValidFiles = useCallback((files: File[]): File[] => {
    const validFiles: File[] = [];
    const oversizedFiles: string[] = [];

    for (const file of files) {
      const maxSize = getMaxSizeForType(file.type);
      if (file.size > maxSize) {
        oversizedFiles.push(`${file.name} (max ${formatSize(maxSize)})`);
      } else {
        validFiles.push(file);
      }
    }

    if (oversizedFiles.length > 0) {
      setError(
        `${oversizedFiles.length === 1 ? "File" : "Files"} too large: ${oversizedFiles.join(", ")}`,
      );
    }

    return validFiles;
  }, []);

  const processFiles = useCallback(
    async (files: File[]) => {
      const mediaFiles = files.filter(isMediaFile);
      const validFiles = filterValidFiles(mediaFiles);
      if (validFiles.length === 0) return;

      const newAttachments: AttachedFile[] = await Promise.all(
        validFiles.map(async (file) => {
          const fileType = getFileType(file.type);
          const base64 =
            fileType === "image" ? await fileToBase64(file) : undefined;

          return {
            file,
            base64,
            name: file.name,
            type: fileType,
            mimeType: file.type,
            size: file.size,
          };
        }),
      );

      setAttachedFiles((prev) => {
        const combined = [...prev, ...newAttachments];
        return combined.slice(0, MAX_ATTACHED_FILES);
      });
    },
    [filterValidFiles],
  );

  const addImageFromBase64 = useCallback((base64: string) => {
    const attachment: AttachedFile = {
      file: new File([], "frame-capture.jpg", { type: "image/jpeg" }),
      base64,
      name: "frame-capture.jpg",
      type: "image",
      mimeType: "image/jpeg",
      size: 0,
    };
    setAttachedFiles((prev) => {
      const combined = [...prev, attachment];
      return combined.slice(0, MAX_ATTACHED_FILES);
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      await processFiles(files);
      e.target.value = "";
    },
    [processFiles],
  );

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const mediaItems = items.filter((item) => isMediaFile(item as unknown as File) || item.type.startsWith("image/"));
      if (mediaItems.length > 0) {
        e.preventDefault();
        const files = mediaItems
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null);
        await processFiles(files);
      }
    },
    [processFiles],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      await processFiles(files);
    },
    [processFiles],
  );

  return {
    attachedFiles,
    isDragging,
    fileInputRef,
    addImageFromBase64,
    removeFile,
    clearFiles,
    handleFileSelect,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    canAddMore: attachedFiles.length < MAX_ATTACHED_FILES,
    error,
    clearError,
  };
}
