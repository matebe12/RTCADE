import { useEffect } from "react";

import { appEnvironment } from "@/config/environment";

/** 페이지별 SEO 메타 태그 옵션. */
type PageSeoOptions = {
  /** 페이지 제목 (사이트명이 자동 부가됨). */
  title: string;
  /** 메타 description 및 OG/Twitter 설명 문구. */
  description: string;
  /** `true`이면 `noindex,nofollow`로 검색엔진 수집을 차단한다. */
  noIndex?: boolean;
};

const DEFAULT_OG_IMAGE = "/og_image.png";
const DEFAULT_OG_IMAGE_ALT = "RTCADE 레트로 아케이드 쇼다운 홍보 이미지";
const DEFAULT_OG_IMAGE_WIDTH = "662";
const DEFAULT_OG_IMAGE_HEIGHT = "662";

function updateMetaByName(name: string, content: string) {
  let element = document.head.querySelector(`meta[name="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function updateMetaByProperty(property: string, content: string) {
  let element = document.head.querySelector(`meta[property="${property}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function updateCanonical(url: string) {
  let element = document.head.querySelector('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", url);
}

/**
 * 페이지의 SEO 메타 태그를 동적으로 업데이트하는 React Hook.
 * `<title>`, `description`, `robots`, OG 태그, Twitter Card, canonical URL을 스열친다.
 * @param options - 페이지 SEO 옵션 ({@link PageSeoOptions})
 */
export function usePageSeo({ title, description, noIndex = false }: PageSeoOptions) {
  useEffect(() => {
    const fullTitle = `${title} | ${appEnvironment.siteName}`;
    const currentUrl = window.location.href;
    const robots = noIndex ? "noindex,nofollow" : "index,follow";

    document.title = fullTitle;
    updateMetaByName("description", description);
    updateMetaByName("robots", robots);
    updateMetaByName("twitter:title", fullTitle);
    updateMetaByName("twitter:description", description);
    updateMetaByName("twitter:image", DEFAULT_OG_IMAGE);
    updateMetaByName("twitter:image:alt", DEFAULT_OG_IMAGE_ALT);
    updateMetaByProperty("og:title", fullTitle);
    updateMetaByProperty("og:description", description);
    updateMetaByProperty("og:image", DEFAULT_OG_IMAGE);
    updateMetaByProperty("og:image:width", DEFAULT_OG_IMAGE_WIDTH);
    updateMetaByProperty("og:image:height", DEFAULT_OG_IMAGE_HEIGHT);
    updateMetaByProperty("og:image:alt", DEFAULT_OG_IMAGE_ALT);
    updateMetaByProperty("og:url", currentUrl);
    updateCanonical(currentUrl);
  }, [description, noIndex, title]);
}
