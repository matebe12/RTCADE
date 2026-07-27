import { useState } from "react";

interface ThumbnailImgProps {
  src: string | null;
  fallback: string | null;
  alt: string;
  className?: string;
  /** 기본값 `"lazy"`. 프리뷰 다이얼로그 등 즉시 로딩이 필요하면 `"eager"` 전달 */
  loading?: "lazy" | "eager";
}

export function ThumbnailImg({ src, fallback, alt, className, loading = "lazy" }: ThumbnailImgProps) {
  const [errored, setErrored] = useState(false);
  const displayUrl = !errored && src ? src : fallback;

  if (!displayUrl) return null;

  return (
    <img
      src={displayUrl}
      alt={alt}
      loading={loading}
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
