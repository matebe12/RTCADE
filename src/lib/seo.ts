import { useEffect } from "react";

import { appEnvironment } from "@/config/environment";

type PageSeoOptions = {
  title: string;
  description: string;
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
