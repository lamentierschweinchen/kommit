import Link from "next/link";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { Icon } from "@/components/common/Icon";

export const metadata = {
  title: "Status — Kommit",
};

/**
 * Minimal status page so the footer link doesn't 404.
 * v0.1: single static cell. v1+ replace with a programmatic uptime
 * dashboard (RPC reachability, indexer health, faucet status).
 */
export default function StatusPage() {
  return (
    <>
      <AuthHeader />
      <main className="flex-1 px-6 md:px-12 pb-24 max-w-3xl mx-auto w-full">
        <section className="mt-16 md:mt-24">
          <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
            Status
          </h1>
        </section>

        <section className="mt-10">
          <div className="bg-white border-[3px] border-black shadow-brutal-lg p-8 flex items-center gap-5">
            <div className="bg-secondary border-[3px] border-black w-14 h-14 flex items-center justify-center shadow-brutal-sm shrink-0">
              <Icon name="check" size="lg" className="text-black" />
            </div>
            <div>
              <div className="font-epilogue font-black uppercase text-xl md:text-2xl tracking-tight">
                All systems operational
              </div>
              <div className="mt-1 font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
                Solana devnet · v0.1 hackathon build
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12 max-w-2xl">
          <p className="text-base font-medium text-gray-800 leading-relaxed">
            Kommit is a hackathon/devnet-grade build. There&rsquo;s no production traffic yet, no
            third-party audit, and no SLA — but the deployed Anchor program at
            {" "}
            <code className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 border-[2px] border-black">
              GxM3sxMp4FyrkHK4g1DaDrmwYLrwd2BJKxqKZqvGgkc3
            </code>
            {" "}is live on Solana devnet, the Vercel deploy serves the surfaces you see here,
            and the faucet flow on the dashboard points at Circle/Solana&rsquo;s public devnet
            faucets.
          </p>
          <p className="mt-4 text-base font-medium text-gray-800 leading-relaxed">
            If something looks broken, ping us at the GitHub link in the footer.
          </p>
          <div className="mt-8">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 bg-primary text-white font-epilogue font-black uppercase tracking-tight text-sm px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
            >
              Browse projects
              <Icon name="arrow_forward" size="sm" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
