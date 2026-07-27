import { useState } from "react";

interface ThumbnailImgProps {
  src: string | null;
  fallback: string | null;
  alt: string;
  className?: string;
}

export function ThumbnailImg({ src, fallback, alt, className }: ThumbnailImgProps) {
  const [errored, setErrored] = useState(false);
  const displayUrl = !errored && src ? src : fallback;

  if (!displayUrl) return null;

  return (
    <img
      src={displayUrl}
      alt={alt}
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
