import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/kommit/project-card";
import { HeroRotatingWord } from "@/components/kommit/hero-rotating-word";
import { getAllProjects } from "@/lib/queries";

const FAQ = [
  {
    q: "Where does the yield come from?",
    a: "Your USDC sits in a Solana program escrow that only you can withdraw from. Kommit deposits it into a vetted lending market (Kamino USDC reserve in v1) and routes only the yield to the team you back. Your principal never moves to the team.",
  },
  {
    q: "Can I really withdraw anytime?",
    a: "Yes. No lockups, no fees, no minimum tenure. Yield stops on withdrawal; your lifetime points stay on-chain.",
  },
  {
    q: "What are points worth?",
    a: "Points are a soulbound on-chain score representing capital × time. They're not a tradable token. Other Solana protocols can read them as a primitive for patient-capital reputation. What they redeem to on Kommit itself is open incentive design.",
  },
  {
    q: "Is this regulated?",
    a: "Kommit is non-custodial — your principal stays in escrow you control. v1 ships as a private beta with whitelisted users. Public launch waits on the regulatory posture documented in the submission narrative.",
  },
];

export default async function Page() {
  const projects = await getAllProjects();
  const featured = projects.slice(0, 3);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6">
      <section className="py-16 md:py-24 lg:py-32 max-w-3xl">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.05]">
          Back the next{" "}
          <span className="text-primary">
            <HeroRotatingWord />
          </span>
          .
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl">
          Park USDC. Yield streams to the team building it. Withdraw your principal anytime. Earn
          on-chain reputation.
        </p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/projects">Browse projects</Link>
          </Button>
        </div>
      </section>

      <section className="py-12 border-t">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-8">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="space-y-2">
            <div className="text-xs font-mono text-muted-foreground">i</div>
            <h3 className="text-xl font-medium">Park USDC</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Principal stays in an escrow only you can withdraw from. No lockups, no fees.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-mono text-muted-foreground">ii</div>
            <h3 className="text-xl font-medium">Yield streams to a curated team</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The yield from your committed USDC routes weekly to the team you backed. You're the
              support — patient capital, weekly drips.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-mono text-muted-foreground">iii</div>
            <h3 className="text-xl font-medium">Earn on-chain reputation</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A soulbound score that scales with capital × time. Readable by other Solana
              protocols.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 border-t">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Featured teams
          </h2>
          <Button asChild variant="link" size="sm">
            <Link href="/projects">All projects →</Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {featured.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      </section>

      <section className="py-12 border-t">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-8">
          The pain we&rsquo;re solving
        </h2>
        <blockquote className="max-w-3xl">
          <p className="text-3xl md:text-5xl font-medium leading-tight tracking-tight">
            &ldquo;21 of 21 startups I backed failed.&rdquo;
          </p>
          <footer className="mt-4 text-muted-foreground">— Wefunder investor, public review</footer>
        </blockquote>
        <p className="mt-8 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed">
          Equity crowdfunding loses backers their principal. Patreon turns creators into
          performers. Kommit asks for neither: keep your money, loan your yield, accumulate
          reputation for showing up early and staying.
        </p>
      </section>

      <section className="py-12 border-t">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-8">
          FAQ
        </h2>
        <div className="max-w-3xl">
          <Accordion type="single" collapsible defaultValue="item-0">
            {FAQ.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-lg">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
}
