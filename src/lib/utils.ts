import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind CSS 클래스명을 안전하게 합성한다.
 * `clsx`로 조건부 클래스를 처리하고, `tailwind-merge`로 충돌하는 클래스를 합친다.
 * @param inputs - 합성할 클래스명 또는 조건부 클래스 객체
 * @returns 합성된 클래스명 문자열
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
