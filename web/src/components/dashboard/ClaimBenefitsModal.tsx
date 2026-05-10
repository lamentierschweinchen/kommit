"use client";

import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/common/ToastProvider";
import { Icon } from "@/components/common/Icon";
import type { Project } from "@/lib/data/projects";

/**
 * Stub modal: "claim benefits" from a graduated project. Visible affordance
 * only — no real claim flow yet. Confirms the kommitter that the project
 * will reach out, lists the benefits inline, then closes with a toast.
 */
export function ClaimBenefitsModal({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: Project;
}) {
  const { user } = useAuth();
  const { confirm } = useToast();
  const benefits = project.kommitterBenefits ?? [];
  const email = user?.email ?? "your account email";

  const handleConfirm = () => {
    onOpenChange(false);
    setTimeout(
      () =>
        confirm(
          `Reserved. ${project.name} will reach out to ${email} with claim details.`,
        ),
      220,
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Claim your ${project.name} benefits`}
      maxWidth="max-w-lg"
    >
      <p className="mt-5 text-base font-medium text-gray-800 leading-relaxed">
        Your kommitter benefits are reserved.{" "}
        <span className="font-epilogue font-bold uppercase tracking-widest text-[11px] text-black">
          {project.name}
        </span>{" "}
        will contact you at{" "}
        <span className="font-epilogue font-bold uppercase tracking-widest text-[11px] text-primary">
          {email}
        </span>{" "}
        with claim details — usually within a few business days.
      </p>
      <ul className="mt-6 space-y-2">
        {benefits.map((b, i) => (
          <li
            key={i}
            className="flex items-start gap-3 bg-gray-50 border-[2px] border-black p-3"
          >
            <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 bg-primary text-white font-epilogue font-black text-xs border-[2px] border-black">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-sm font-medium leading-snug pt-1">{b}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleConfirm}
        className="mt-7 w-full bg-primary text-white font-epilogue font-black uppercase tracking-tight text-base py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-3"
      >
        Confirm — reserve my spot
        <Icon name="arrow_forward" className="font-bold" />
      </button>
    </Modal>
  );
}
