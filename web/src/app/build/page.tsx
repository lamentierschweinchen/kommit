"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { BrutalInput, BrutalTextarea } from "@/components/common/BrutalInput";
import { BrutalSelect } from "@/components/common/BrutalSelect";
import { Icon } from "@/components/common/Icon";

// Caps per Codex M6 — every freeform field has an explicit max so an oversized
// payload can't slip through to the future server-side route. Matches what
// the admin queue (Pass 3) will accept.
//
// `.trim()` on text fields rejects whitespace-only input (platform-test Low #13).
const schema = z.object({
  name: z.string().trim().min(1, "Required").max(120, "Max 120 characters"),
  pitch: z.string().trim().min(1, "Required").max(80, "Max 80 characters"),
  sector: z.string().min(1, "Required").max(40, "Pick from the list"),
  longer: z.string().trim().min(20, "Tell us more").max(4000, "Max 4000 characters"),
  founders: z.string().trim().min(1, "Required").max(2000, "Max 2000 characters"),
  stage: z.string().min(1, "Required").max(40, "Pick from the list"),
  extra: z.string().trim().max(2000, "Max 2000 characters").optional(),
  email: z.string().trim().email("Valid email required").max(254, "Max 254 characters"),
});

type FormValues = z.infer<typeof schema>;

const SECTORS = ["Climate", "Fintech", "Bio", "Health", "Edu", "Consumer", "Creator tools", "Media", "Other"];
const STAGES = ["Idea", "Building", "Shipping", "Revenue"];

type SubmitErrorCode =
  | "invalid-input"
  | "rate-limit"
  | "config"
  | "server-error"
  | "network";

const ERROR_COPY: Record<SubmitErrorCode, string> = {
  "invalid-input":
    "We couldn't read the form. Check each field — every required one has a green border when valid.",
  "rate-limit":
    "Slow down — one application per minute. Wait a moment and try again.",
  config:
    "The application queue isn't wired up on this deployment. Email Lukas directly: lukas@kommit.now.",
  "server-error":
    "Save failed on our side. Try again — if it keeps happening, ping Lukas.",
  network:
    "Couldn't reach the server. Check your connection and try again.",
};

export default function BuildApplicationPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<SubmitErrorCode | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const pitchLength = watch("pitch")?.length ?? 0;

  const onSubmit = handleSubmit(
    async (values) => {
      setSubmitError(null);
      try {
        const res = await fetch("/api/founder-application", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        });
        if (res.ok) {
          router.push("/build/submitted");
          return;
        }
        // Non-2xx — surface the route's structured error code.
        try {
          const body = (await res.json()) as { error?: SubmitErrorCode };
          setSubmitError(body.error ?? "server-error");
        } catch {
          setSubmitError("server-error");
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setSubmitError("network");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    // Pass-2 P2: instead of bouncing the user to the page top on first
    // invalid submit, focus the first errored field. RHF's `setFocus` uses
    // each registered input's ref directly; modern browsers scroll the
    // focused element into view automatically, so the user lands on the
    // first thing they need to fix.
    (errs) => {
      const firstError = Object.keys(errs)[0] as keyof FormValues | undefined;
      if (firstError) setFocus(firstError);
    },
  );

  return (
    <>
      <AuthHeader />
      <main className="flex-1 px-6 md:px-12 pb-32">
        <section className="max-w-2xl mx-auto pt-16 md:pt-20 pb-10 md:pb-14 relative">
          <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter leading-[0.95] -rotate-[0.3deg]">
            Apply to launch on Kommit.
          </h1>
          <p className="mt-6 font-epilogue font-bold text-lg md:text-xl text-gray-800 leading-snug border-l-[4px] border-primary pl-5">
            Invite-only. Tell us what you&rsquo;re building. We get back within a week.
          </p>
        </section>

        <FounderPitchBox />

        <form onSubmit={onSubmit} className="max-w-2xl mx-auto space-y-7">
          {submitError ? (
            <div
              role="alert"
              className="bg-primary/10 border-[3px] border-primary p-4 shadow-brutal-sm"
            >
              <div className="font-epilogue font-black uppercase text-[11px] tracking-widest text-primary">
                Couldn&rsquo;t submit
              </div>
              <p className="mt-2 text-sm font-medium text-gray-800 leading-relaxed">
                {ERROR_COPY[submitError]}
              </p>
            </div>
          ) : null}

          <Field
            label="Project name"
            error={errors.name?.message}
            required
            help="Display name."
          >
            <BrutalInput {...register("name")} type="text" maxLength={120} />
          </Field>
          <Field
            label="One-sentence pitch"
            error={errors.pitch?.message}
            required
            help={`Plain English. Goes on the project card. ${pitchLength}/80 characters.`}
          >
            <BrutalInput {...register("pitch")} type="text" maxLength={80} />
          </Field>
          <Field label="Sector" error={errors.sector?.message} required>
            <BrutalSelect {...register("sector")} className="w-full">
              <option value="">Choose one</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </BrutalSelect>
          </Field>
          <Field
            label="The longer pitch"
            error={errors.longer?.message}
            required
            help="What you're building, why now, why this team."
          >
            <BrutalTextarea {...register("longer")} rows={6} maxLength={4000} />
          </Field>
          <Field
            label="Founders & links"
            error={errors.founders?.message}
            required
            help="Names, roles, and links — LinkedIn / GitHub / past work. One per line."
          >
            <BrutalTextarea
              {...register("founders")}
              rows={5}
              maxLength={2000}
              placeholder={`Lina Park, CEO — linkedin.com/in/lina\nDiego Romero, COO — github.com/diegoromero`}
            />
          </Field>
          <Field
            label="Stage"
            error={errors.stage?.message}
            required
            help="Where you are right now."
          >
            <BrutalSelect {...register("stage")} className="w-full">
              <option value="">Choose one</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </BrutalSelect>
          </Field>
          <Field
            label="Anything we should know?"
            error={errors.extra?.message}
            help="Pivots, prior versions, what you want from the cohort. Anything worth flagging."
          >
            <BrutalTextarea {...register("extra")} rows={4} maxLength={2000} />
          </Field>
          <Field
            label="Email"
            error={errors.email?.message}
            required
            help="Where we send the response."
          >
            <BrutalInput {...register("email")} type="email" maxLength={254} />
          </Field>

          <div className="pt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full md:w-auto bg-primary text-white font-epilogue font-black uppercase tracking-wide text-base md:text-lg px-10 py-4 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-brutal-lg flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? "Submitting…" : "Apply"}
              <Icon name="arrow_forward" className="font-bold" />
            </button>
          </div>
        </form>
      </main>
      <Footer />
    </>
  );
}

/**
 * Pitch panel that sits between the hero and the form. Translates the
 * cohort-manifesto's case for kommitters into the four things a founder
 * actually gets in return for listing here. Lives on /build only.
 */
function FounderPitchBox() {
  const bullets: { title: string; body: string }[] = [
    {
      title: "An early community rooting for you",
      body: "Kommitters have a real stake in your success — monetary (they want to invest), idea-care (the thing you're building matters to them), or product (they're future customers). Cold-start solved before launch.",
    },
    {
      title: "Signal you can trust",
      body: "Kommitters back you with real money over real time. Read the count and learn something true — not opinion volume.",
    },
    {
      title: "Your round is yours",
      body: "Zero platform cut when you raise. No carry, no success fee, no fine print.",
    },
    {
      title: "First-dibs cohort, earned through patience",
      body: "Backers who held through pivots get first-dibs at round price. They've watched you for months — your round closes faster.",
    },
  ];
  return (
    <section className="max-w-2xl mx-auto mb-14 md:mb-16">
      <article className="bg-white border-[3px] border-black shadow-brutal-purple p-6 md:p-8">
        <header>
          <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
            What founders get
          </h2>
          <p className="mt-4 text-sm md:text-base font-medium text-gray-600 leading-snug">
            What backing looks like when it&rsquo;s measured in patience, not pitches.
          </p>
        </header>
        <ul className="mt-7 space-y-5">
          {bullets.map((b) => (
            <li key={b.title} className="flex gap-4">
              <span
                className="shrink-0 w-7 h-7 mt-0.5 bg-primary text-white border-[2px] border-black flex items-center justify-center"
                aria-hidden
              >
                <Icon name="check" size="sm" />
              </span>
              <div>
                <div className="font-epilogue font-black uppercase text-sm md:text-base tracking-tight">
                  {b.title}
                </div>
                <p className="mt-1 text-sm md:text-base font-medium text-gray-800 leading-relaxed">
                  {b.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}

function Field({
  label,
  error,
  required,
  help,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block font-epilogue font-black uppercase text-[11px] tracking-widest mb-2">
        {label} {required ? <span className="text-gray-500">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-2 font-epilogue font-bold uppercase text-[11px] text-primary tracking-widest">
          {error}
        </p>
      ) : help ? (
        <p className="mt-2 text-sm font-medium text-gray-500 leading-relaxed">{help}</p>
      ) : null}
    </div>
  );
}
