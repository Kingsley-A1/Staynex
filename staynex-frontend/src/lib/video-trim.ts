export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;

const ACCEPTED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const WEBM_TYPE = "video/webm";

export interface PreparedVideoUpload {
  blob: Blob;
  filename: string;
  contentType: string;
  trimmed: boolean;
}

export async function prepareVideoForUpload(file: File): Promise<PreparedVideoUpload> {
  if (!ACCEPTED_VIDEO_TYPES.has(file.type)) {
    throw new Error("Upload an MP4, MOV, or WebM video.");
  }
  if (file.size <= MAX_VIDEO_UPLOAD_BYTES) {
    return { blob: file, filename: file.name, contentType: file.type, trimmed: false };
  }
  return trimVideoToLimit(file);
}

async function trimVideoToLimit(file: File): Promise<PreparedVideoUpload> {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error(
      "This browser cannot trim videos automatically. Please upload a video under 100 MB.",
    );
  }

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = URL.createObjectURL(file);

  try {
    await waitForMetadata(video);
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 30;
    const allowedSeconds = Math.max(
      3,
      Math.floor(duration * (MAX_VIDEO_UPLOAD_BYTES / file.size) * 0.9),
    );
    const stream = captureStream(video);
    const mimeType = supportedRecorderType();
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Video trimming failed."));
      recorder.onstop = () => resolve();
    });

    video.currentTime = 0;
    recorder.start(1_000);
    await video.play();
    window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
      video.pause();
    }, Math.min(allowedSeconds, duration) * 1000);
    await stopped;

    const blob = new Blob(chunks, { type: WEBM_TYPE });
    if (blob.size <= 0 || blob.size > MAX_VIDEO_UPLOAD_BYTES) {
      throw new Error(
        "We tried to trim this video, but it is still over 100 MB. Please upload a shorter clip.",
      );
    }
    return {
      blob,
      filename: replaceExtension(file.name, "webm"),
      contentType: WEBM_TYPE,
      trimmed: true,
    };
  } finally {
    URL.revokeObjectURL(video.src);
  }
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("We couldn't read this video."));
  });
}

function captureStream(video: HTMLVideoElement): MediaStream {
  const source = video as HTMLVideoElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const method =
    source.captureStream ??
    source.mozCaptureStream;
  if (!method) {
    throw new Error(
      "This browser cannot trim videos automatically. Please upload a video under 100 MB.",
    );
  }
  return method.call(video);
}

function supportedRecorderType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", WEBM_TYPE];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function replaceExtension(filename: string, extension: string): string {
  const safe = filename.replace(/\.[^.]+$/, "");
  return `${safe || "property-video"}.${extension}`;
}
