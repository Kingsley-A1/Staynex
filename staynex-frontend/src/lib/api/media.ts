// Direct-to-bucket media upload.

import type { MediaUploadTarget } from "@/lib/types";

export function uploadToTarget(
  target: MediaUploadTarget,
  file: Blob,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.uploadUrl);
    for (const [name, value] of Object.entries(target.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.total > 0 ? event.loaded / event.total : 0);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        reject(
          new Error(
            `Upload failed: ${xhr.status} ${xhr.statusText || "storage rejected the file"}`,
          ),
        );
      }
    };
    // Network-level failure before a response — storage unreachable or the
    // browser blocked it (e.g. missing CORS on the bucket). Config/infra
    // issue, not something the host caused.
    xhr.onerror = () => {
      const host = safeHost(target.uploadUrl);
      reject(
        new Error(
          `Couldn't reach storage${host ? ` (${host})` : ""} to upload this file. ` +
            "Please try again in a moment, or contact support if this keeps happening.",
        ),
      );
    };
    xhr.send(file);
  });
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
