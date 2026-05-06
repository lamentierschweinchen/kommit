"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { BrutalInput, BrutalTextarea } from "@/components/common/BrutalInput";
import { BrutalSelect } from "@/components/common/BrutalSelect";

// Caps per Codex M6 — every freeform field has an explicit max so an oversized
// payload can't slip through to the future server-side route. Matches what
// the admin queue (Pass 3) will accept.
const schema = z.object({
  name: z.string().min(1, "Required").max(120, "Max 120 characters"),
  pitch: z.string().min(1, "Required").max(80, "Max 80 characters"),
  sector: z.string().min(1, "Required").max(40, "Pick from the list"),
  longer: z.string().min(20, "Tell us more").max(4000, "Max 4000 characters"),
  founders: z.string().min(1, "Required").max(2000, "Max 2000 characters"),
  stage: z.string().min(1, "Required").max(40, "Pick from the list"),
  extra: z.string().max(2000, "Max 2000 characters").optional(),
  email: z.string().email("Valid email required").max(254, "Max 254 characters"),
});

type FormValues = z.infer<typeof schema>;

const SECTORS = ["Climate", "Fintech", "Bio", "Health", "Edu", "Consumer", "Creator tools", "Media", "Other"];
const STAGES = ["Idea", "Building", "Shipping", "Revenue"];

export default function BuildApplicationPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async () => {
    // Simulate the submission
    await new Promise((r) => setTimeout(r, 250));
    router.push("/build/submitted");
  });

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

        <form onSubmit={onSubmit} className="max-w-2xl mx-auto space-y-7">
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
            help="Plain English. Goes on the project card. Max 80 characters."
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
              <span className="material-symbols-outlined font-bold">arrow_forward</span>
            </button>
          </div>
        </form>
      </main>
      <Footer />
    </>
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
