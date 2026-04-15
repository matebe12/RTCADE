export type UserProfile = {
  nickname: string;
  avatar: string;
};

const STORAGE_KEY = "retro-user-profile";

export const AVATAR_OPTIONS = [
  "🎮",
  "🕹️",
  "👾",
  "🤖",
  "🎯",
  "🏆",
  "🔥",
  "⚡",
  "🎲",
  "🃏",
  "🐉",
  "🦊",
  "🎸",
  "🚀",
  "💀",
  "🌟",
];

export function getUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    if (parsed.nickname && parsed.avatar) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}
