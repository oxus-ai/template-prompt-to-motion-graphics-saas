import { useCallback, useEffect, useRef, useState } from "react";

export interface MediaAsset {
  name: string;
  originalName: string;
  type: "image" | "video" | "audio";
  mimeType: string;
  blobUrl: string;
  size: number;
}

export interface UseMediaAssetsReturn {
  /** filename → blobUrl map for the compiler ASSETS variable */
  assets: Record<string, string>;
  /** Full metadata for all assets (for UI and LLM context) */
  assetList: MediaAsset[];
  /** Add files to the asset map. Returns resolved assets with final names. */
  addFiles: (files: File[]) => MediaAsset[];
  /** Revoke all blob URLs and clear the map */
  clearAll: () => void;
}

function classifyFileType(
  mimeType: string,
): "image" | "video" | "audio" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return null;
}

function resolveFilename(name: string, existing: Set<string>): string {
  if (!existing.has(name)) return name;

  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : "";

  let counter = 2;
  while (existing.has(`${base}_${counter}${ext}`)) {
    counter++;
  }
  return `${base}_${counter}${ext}`;
}

export function useMediaAssets(): UseMediaAssetsReturn {
  const [assetList, setAssetList] = useState<MediaAsset[]>([]);
  const blobUrlsRef = useRef<string[]>([]);

  const assets: Record<string, string> = {};
  for (const asset of assetList) {
    assets[asset.name] = asset.blobUrl;
  }

  const addFiles = useCallback((files: File[]): MediaAsset[] => {
    const newAssets: MediaAsset[] = [];

    setAssetList((prev) => {
      const existingNames = new Set(prev.map((a) => a.name));

      for (const file of files) {
        const fileType = classifyFileType(file.type);
        if (!fileType) continue;

        const resolvedName = resolveFilename(file.name, existingNames);
        existingNames.add(resolvedName);

        const blobUrl = URL.createObjectURL(file);
        blobUrlsRef.current.push(blobUrl);

        const asset: MediaAsset = {
          name: resolvedName,
          originalName: file.name,
          type: fileType,
          mimeType: file.type,
          blobUrl,
          size: file.size,
        };
        newAssets.push(asset);
      }

      return [...prev, ...newAssets];
    });

    return newAssets;
  }, []);

  const clearAll = useCallback(() => {
    for (const url of blobUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    blobUrlsRef.current = [];
    setAssetList([]);
  }, []);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  return { assets, assetList, addFiles, clearAll };
}
