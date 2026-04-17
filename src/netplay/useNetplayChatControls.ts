import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";

import { focusEmulator } from "@/components/EmulatorPlayer";
import type { NetplayChatMessage } from "@/components/NetplayChatPanel";
import type { ChatMessage as PeerChatMessage, NetplayPeer } from "@/netplay/peer";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";
import { toast } from "sonner";

const CHAT_TYPING_TIMEOUT_MS = 2000;

interface UseNetplayChatControlsOptions {
  currentStep: string;
  chatOpen: boolean;
  chatDraft: string;
  chatChannelState: string;
  peerRef: MutableRefObject<NetplayPeer | null>;
  emulatorRef: RefObject<HTMLIFrameElement | null>;
  opponentProfileRef: MutableRefObject<{ nickname: string; avatar: string } | null>;
  appendChatMessage: (message: NetplayChatMessage) => void;
  setChatOpen: (chatOpen: boolean) => void;
  setChatDraft: (chatDraft: string) => void;
  setUnreadChatCount: (unreadChatCount: number) => void;
  incrementUnreadChatCount: () => void;
  setIsPeerTyping: (isPeerTyping: boolean) => void;
  resetStoredChatState: () => void;
}

export function useNetplayChatControls({
  currentStep,
  chatOpen,
  chatDraft,
  chatChannelState,
  peerRef,
  emulatorRef,
  opponentProfileRef,
  appendChatMessage,
  setChatOpen,
  setChatDraft,
  setUnreadChatCount,
  incrementUnreadChatCount,
  setIsPeerTyping,
  resetStoredChatState,
}: UseNetplayChatControlsOptions) {
  const chatOpenRef = useRef(false);
  const localTypingActiveRef = useRef(false);
  const localTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const pendingChatFocusRef = useRef(false);

  useEffect(() => {
    return () => {
      if (localTypingTimeoutRef.current) clearTimeout(localTypingTimeoutRef.current);
      if (peerTypingTimeoutRef.current) clearTimeout(peerTypingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) {
      setUnreadChatCount(0);
    }
  }, [chatOpen, setUnreadChatCount]);

  const handleChatOpenChange = useCallback(
    (open: boolean) => {
      chatOpenRef.current = open;
      setChatOpen(open);
      if (open) {
        setUnreadChatCount(0);
      }
    },
    [setChatOpen, setUnreadChatCount],
  );

  const focusEmulatorPlayer = useCallback(() => {
    focusEmulator(emulatorRef);
  }, [emulatorRef]);

  const focusChatComposer = useCallback(() => {
    pendingChatFocusRef.current = true;
    handleChatOpenChange(true);

    if (chatChannelState !== "open") return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chatInputRef.current?.focus();
        chatInputRef.current?.select();
        pendingChatFocusRef.current = false;
      });
    });
  }, [chatChannelState, handleChatOpenChange]);

  const stopLocalTyping = useCallback(() => {
    if (localTypingTimeoutRef.current) {
      clearTimeout(localTypingTimeoutRef.current);
      localTypingTimeoutRef.current = null;
    }
    if (localTypingActiveRef.current) {
      peerRef.current?.sendTypingState(false);
      localTypingActiveRef.current = false;
    }
  }, [peerRef]);

  const resetChatRuntime = useCallback(() => {
    chatOpenRef.current = false;
    localTypingActiveRef.current = false;
    pendingChatFocusRef.current = false;
    if (localTypingTimeoutRef.current) {
      clearTimeout(localTypingTimeoutRef.current);
      localTypingTimeoutRef.current = null;
    }
    if (peerTypingTimeoutRef.current) {
      clearTimeout(peerTypingTimeoutRef.current);
      peerTypingTimeoutRef.current = null;
    }
    resetStoredChatState();
  }, [resetStoredChatState]);

  useEffect(() => {
    if (!chatOpen || chatChannelState !== "open" || !pendingChatFocusRef.current) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chatInputRef.current?.focus();
        chatInputRef.current?.select();
        pendingChatFocusRef.current = false;
      });
    });
  }, [chatChannelState, chatOpen]);

  useEffect(() => {
    if (currentStep !== "playing") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      focusChatComposer();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [currentStep, focusChatComposer]);

  const handleChatDraftChange = useCallback(
    (value: string) => {
      const nextDraft = value.slice(0, 300);
      setChatDraft(nextDraft);

      if (chatChannelState !== "open") return;

      if (!nextDraft.trim()) {
        stopLocalTyping();
        return;
      }

      if (!localTypingActiveRef.current) {
        peerRef.current?.sendTypingState(true);
        localTypingActiveRef.current = true;
      }

      if (localTypingTimeoutRef.current) {
        clearTimeout(localTypingTimeoutRef.current);
      }

      localTypingTimeoutRef.current = setTimeout(() => {
        if (localTypingActiveRef.current) {
          peerRef.current?.sendTypingState(false);
          localTypingActiveRef.current = false;
        }
        localTypingTimeoutRef.current = null;
      }, CHAT_TYPING_TIMEOUT_MS);
    },
    [chatChannelState, peerRef, setChatDraft, stopLocalTyping],
  );

  const handleSendChat = useCallback(() => {
    const trimmed = chatDraft.trim();
    if (!trimmed) return;

    const sentMessage = peerRef.current?.sendChatMessage(trimmed);
    if (!sentMessage) {
      toast.error(NETPLAY_COPY.chatNotReady);
      return;
    }

    appendChatMessage({ ...sentMessage, sender: "local" });
    setChatDraft("");
    stopLocalTyping();
    focusEmulatorPlayer();
  }, [appendChatMessage, chatDraft, focusEmulatorPlayer, peerRef, setChatDraft, stopLocalTyping]);

  const handleChatCancel = useCallback(() => {
    stopLocalTyping();
    pendingChatFocusRef.current = false;
    handleChatOpenChange(false);
    focusEmulatorPlayer();
  }, [focusEmulatorPlayer, handleChatOpenChange, stopLocalTyping]);

  const handleChatToggle = useCallback(() => {
    if (chatOpen) {
      handleChatCancel();
      return;
    }

    focusChatComposer();
  }, [chatOpen, handleChatCancel, focusChatComposer]);

  const handleChatShortcut = useCallback(() => {
    if (currentStep !== "playing") return;
    focusChatComposer();
  }, [currentStep, focusChatComposer]);

  const handleIncomingChatMessage = useCallback(
    (message: PeerChatMessage) => {
      appendChatMessage({ ...message, sender: "remote" });
      if (!chatOpenRef.current) {
        incrementUnreadChatCount();
        toast(`${opponentProfileRef.current?.nickname || "상대방"}: ${message.text}`);
      }
    },
    [appendChatMessage, incrementUnreadChatCount, opponentProfileRef],
  );

  const handleIncomingTypingState = useCallback(
    (isTyping: boolean) => {
      if (peerTypingTimeoutRef.current) {
        clearTimeout(peerTypingTimeoutRef.current);
        peerTypingTimeoutRef.current = null;
      }

      if (!isTyping) {
        setIsPeerTyping(false);
        return;
      }

      setIsPeerTyping(true);
      peerTypingTimeoutRef.current = setTimeout(() => {
        setIsPeerTyping(false);
        peerTypingTimeoutRef.current = null;
      }, CHAT_TYPING_TIMEOUT_MS);
    },
    [setIsPeerTyping],
  );

  return {
    chatInputRef,
    handleChatCancel,
    handleChatDraftChange,
    handleChatShortcut,
    handleChatToggle,
    handleIncomingChatMessage,
    handleIncomingTypingState,
    handleSendChat,
    resetChatRuntime,
  };
}
