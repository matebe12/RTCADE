import { createContext, useContext } from "react";

export interface AppTutorialContextValue {
  isActive: boolean;
  startTutorial: () => void;
}

export const AppTutorialContext = createContext<AppTutorialContextValue | null>(null);

export function useAppTutorial() {
  const context = useContext(AppTutorialContext);

  if (!context) {
    throw new Error("useAppTutorial must be used within AppTutorialProvider");
  }

  return context;
}
