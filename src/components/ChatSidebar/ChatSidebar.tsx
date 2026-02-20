"use client";

import { Button } from "@/components/ui/button";
import { useGenerationApi } from "@/hooks/useGenerationApi";
import { cn } from "@/lib/utils";
import type { AttachedFile } from "@/hooks/useMediaAttachments";
import type {
  AssistantMetadata,
  ConversationContextMessage,
  ConversationMessage,
  EditOperation,
  ErrorCorrectionContext,
} from "@/types/conversation";
import {
  MODELS,
  type GenerationErrorType,
  type ModelId,
  type StreamPhase,
} from "@/types/generation";
import { PanelLeftClose, PanelLeftOpen, RotateCcw } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { ChatHistory } from "./ChatHistory";
import { ChatInput } from "./ChatInput";

export interface ChatSidebarRef {
  triggerGeneration: (options?: {
    silent?: boolean;
    attachedImages?: string[];
    attachedFiles?: AttachedFile[];
  }) => void;
}

interface ChatSidebarProps {
  messages: ConversationMessage[];
  pendingMessage?: {
    skills?: string[];
    startedAt: number;
  };
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  hasManualEdits: boolean;
  // Generation callbacks
  onCodeGenerated?: (code: string) => void;
  onStreamingChange?: (isStreaming: boolean) => void;
  onStreamPhaseChange?: (phase: StreamPhase) => void;
  onError?: (
    error: string,
    type: GenerationErrorType,
    failedEdit?: EditOperation,
  ) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  currentCode?: string;
  conversationHistory?: ConversationContextMessage[];
  previouslyUsedSkills?: string[];
  isFollowUp?: boolean;
  onMessageSent?: (prompt: string, attachedImages?: string[]) => void;
  onGenerationComplete?: (
    code: string,
    summary?: string,
    metadata?: AssistantMetadata,
  ) => void;
  onErrorMessage?: (
    message: string,
    errorType: "edit_failed" | "api" | "validation",
  ) => void;
  errorCorrection?: ErrorCorrectionContext;
  onPendingMessage?: (skills?: string[]) => void;
  onClearPendingMessage?: () => void;
  /** Callback when media files are attached — adds them to the media assets map, returns resolved assets */
  onFilesAttached?: (
    files: File[],
  ) => Array<{ name: string; type: string }>;
  /** Current cumulative list of all available asset metadata for the LLM */
  allAvailableAssets?: Array<{ name: string; type: string }>;
  // Frame capture props
  Component?: ComponentType | null;
  fps?: number;
  durationInFrames?: number;
  currentFrame?: number;
}

export const ChatSidebar = forwardRef<ChatSidebarRef, ChatSidebarProps>(
  function ChatSidebar(
    {
      messages,
      pendingMessage,
      isCollapsed,
      onToggleCollapse,
      hasManualEdits,
      onCodeGenerated,
      onStreamingChange,
      onStreamPhaseChange,
      onError,
      prompt,
      onPromptChange,
      currentCode,
      conversationHistory = [],
      previouslyUsedSkills = [],
      isFollowUp = false,
      onMessageSent,
      onGenerationComplete,
      onErrorMessage,
      errorCorrection,
      onPendingMessage,
      onClearPendingMessage,
      onFilesAttached,
      allAvailableAssets,
      Component,
      fps = 30,
      durationInFrames = 150,
      currentFrame = 0,
    },
    ref,
  ) {
    const [model, setModel] = useState<ModelId>(MODELS[1].id);
    const promptRef = useRef<string>("");

    const { isLoading, runGeneration } = useGenerationApi();

    // Keep prompt ref in sync for use in triggerGeneration
    useEffect(() => {
      promptRef.current = prompt;
    }, [prompt]);

    const handleGeneration = async (options?: {
      silent?: boolean;
      attachedImages?: string[];
      attachedFiles?: AttachedFile[];
    }) => {
      const currentPrompt = promptRef.current;
      if (!currentPrompt.trim()) return;

      onPromptChange(""); // Clear input immediately

      // Add files to the media assets map (creates blob URLs) and get resolved names
      let newAssetMeta: Array<{ name: string; type: string }> = [];
      if (options?.attachedFiles && options.attachedFiles.length > 0) {
        const rawFiles = options.attachedFiles
          .map((f) => f.file)
          .filter((f) => f.size > 0);
        if (rawFiles.length > 0 && onFilesAttached) {
          newAssetMeta = onFilesAttached(rawFiles);
        }
      }

      // Extract base64 images for LLM visual context
      const frameImages =
        options?.attachedImages ||
        options?.attachedFiles
          ?.filter((f) => f.type === "image" && f.base64)
          .map((f) => f.base64 as string);

      // Merge existing + newly added assets for the LLM context
      const existingAssets = allAvailableAssets || [];
      const availableAssets =
        existingAssets.length > 0 || newAssetMeta.length > 0
          ? [...existingAssets, ...newAssetMeta]
          : undefined;

      await runGeneration(
        currentPrompt,
        model,
        {
          currentCode,
          conversationHistory,
          previouslyUsedSkills,
          isFollowUp,
          hasManualEdits,
          errorCorrection,
          frameImages,
          availableAssets,
        },
        {
          onCodeGenerated,
          onStreamingChange,
          onStreamPhaseChange,
          onError,
          onMessageSent,
          onGenerationComplete,
          onErrorMessage,
          onPendingMessage,
          onClearPendingMessage,
        },
        options,
      );
    };

    // Expose triggerGeneration via ref
    useImperativeHandle(ref, () => ({
      triggerGeneration: handleGeneration,
    }));

    return (
      <div
        className={cn(
          "flex flex-col bg-background transition-all duration-300",
          isCollapsed
            ? "w-12 shrink-0"
            : "w-full h-[40vh] min-[1000px]:h-auto min-[1000px]:w-[40%] min-[1000px]:min-w-[320px] min-[1000px]:max-w-[520px] shrink",
        )}
      >
        {isCollapsed ? (
          <div className="flex justify-center px-4 mb-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleCollapse}
              className="text-muted-foreground hover:text-foreground"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          /* Chat area with subtle backdrop */
          <div className="flex-1 flex flex-col min-h-0 ml-12 mr-8 mb-8 rounded-xl bg-muted/20 border border-border/30 shadow-sm">
            {/* Header */}
            <div className="flex items-start justify-between px-4 pt-4 pb-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Assistant Chat
              </h2>
              <div className="flex items-center gap-1 -mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Start over? This will reset your animation.",
                      )
                    ) {
                      window.location.href = "/";
                    }
                  }}
                  title="Start over"
                  className="text-muted-foreground hover:text-foreground text-xs gap-1 h-7 px-2"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleCollapse}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ChatHistory messages={messages} pendingMessage={pendingMessage} />

            {/* Input */}
            <ChatInput
              prompt={prompt}
              onPromptChange={onPromptChange}
              model={model}
              onModelChange={setModel}
              isLoading={isLoading}
              onSubmit={(attachedFiles) =>
                handleGeneration({ attachedFiles })
              }
              Component={Component}
              fps={fps}
              durationInFrames={durationInFrames}
              currentFrame={currentFrame}
            />
          </div>
        )}
      </div>
    );
  },
);
