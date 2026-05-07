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
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-40 bg-black/50",
            "data-[state=open]:animate-scrim-in",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100vw-2rem)]",
            maxWidth,
            "focus:outline-none",
            "data-[state=open]:animate-modal-in",
            className,
          )}
        >
          <div className="relative">
            {renderedTapes}
            <div
              className={cn(
                "bg-white border-[3px] border-black p-7 md:p-8",
                "max-h-[92vh] overflow-y-auto",
                shadow === "purple" ? "shadow-brutal-purple" : "shadow-brutal-lg",
              )}
            >
              <Dialog.Close
                aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center border-[2px] border-black bg-white shadow-brutal-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform z-10"
              >
                <Icon name="close" size="sm" />
              </Dialog.Close>

              {titleSrOnly ? (
                <Dialog.Title className="sr-only">{title}</Dialog.Title>
              ) : (
                <Dialog.Title className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter leading-tight pr-10">
                  {title}
                </Dialog.Title>
              )}
              {description ? (
                <Dialog.Description className="sr-only">{description}</Dialog.Description>
              ) : null}

              {children}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;
