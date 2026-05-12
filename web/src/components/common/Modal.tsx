"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tape } from "./Tape";
import { Icon } from "@/components/common/Icon";

export type ModalShadow = "default" | "purple";

export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hide the title (still announced to screen readers) */
  titleSrOnly?: boolean;
  description?: string;
  children: ReactNode;
  shadow?: ModalShadow;
  /** Tapes — pass `null` to suppress; defaults to two tapes (most modals) */
  tapes?: ReactNode | null;
  className?: string;
  /** Used by trigger buttons — pass JSX wrapped in <Dialog.Trigger asChild> */
  trigger?: ReactNode;
  /** Max-width override; default max-w-md */
  maxWidth?: string;
  /** Optional non-scrolling footer pinned to the bottom of the modal card.
   *  Use for primary actions that must stay accessible when the body
   *  overflows (handoff 78 P0-3 — CommitModal Submit was disappearing
   *  below the marketing blocks on 375px viewports). */
  footer?: ReactNode;
};

export function Modal({
  open,
  onOpenChange,
  title,
  titleSrOnly,
  description,
  children,
  shadow = "purple",
  tapes,
  className,
  trigger,
  maxWidth = "max-w-md",
  footer,
}: ModalProps) {
  const defaultTapes = (
    <>
      <Tape color="black" size="md" rotation={12} className="absolute -top-3 -right-3" />
      <Tape color="secondary" size="md" rotation={-12} className="absolute -bottom-3 -left-3" />
    </>
  );
  const renderedTapes = tapes === null ? null : tapes ?? defaultTapes;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger}
      <Dialog.Portal>
        {/* Pass-2 P0 #2 fix: scrim was reported as missing on first paint. The
            animate-scrim-in keyframe starts at opacity:0; if the GPU drops
            the first frame, the scrim is invisible until 180ms later. We
            keep the animation but force bg-black/50 to land on initial render
            via the explicit opacity-100 override on data-state=open. */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-40 bg-black/50 opacity-100",
            "data-[state=open]:animate-scrim-in",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100vw-2rem)]",
            maxWidth,
            "focus:outline-none",
            // Force opacity:1 on content. Pass-2 P0 #2 fix: the change-display-name
            // modal was rendering with low-opacity title + input, which we suspect
            // was animation timing leaving the content mid-fade. Explicit
            // opacity-100 guarantees the final state regardless of animation
            // resolution.
            "opacity-100",
            "data-[state=open]:animate-modal-in",
            className,
          )}
        >
          <div className="relative">
            {renderedTapes}
            <div
              className={cn(
                "bg-white border-[3px] border-black",
                "max-h-[92vh] flex flex-col",
                "opacity-100",
                shadow === "purple" ? "shadow-brutal-purple" : "shadow-brutal-lg",
              )}
            >
              <Dialog.Close
                aria-label="Close"
                className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center border-[2px] border-black bg-white shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform z-20"
              >
                <Icon name="close" size="md" />
              </Dialog.Close>

              <div className="overflow-y-auto p-7 md:p-8 flex-1 min-h-0">
                {titleSrOnly ? (
                  <Dialog.Title className="sr-only">{title}</Dialog.Title>
                ) : (
                  <Dialog.Title className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter leading-tight pr-14">
                    {title}
                  </Dialog.Title>
                )}
                {description ? (
                  <Dialog.Description className="sr-only">{description}</Dialog.Description>
                ) : null}

                {children}
              </div>

              {footer ? (
                <div className="border-t-[3px] border-black px-7 md:px-8 py-5 md:py-6 shrink-0 bg-white pb-[max(env(safe-area-inset-bottom),1.25rem)]">
                  {footer}
                </div>
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;
