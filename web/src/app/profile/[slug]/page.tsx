import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { ProfileClient } from "./ProfileClient";
import { getUser, getUserByWallet } from "@/lib/data/users";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Resolution order (handoff 69 B13): persona id first, then wallet address
  // — so a real-Privy user landing on /profile/<wallet> still gets a name
  // when their wallet matches a seeded persona, and gets a wallet-slim
  // profile otherwise.
  const user = getUser(slug) ?? getUserByWallet(slug);

  return (
    <>
      <AuthHeader homeHref="/app" />
      <main className="flex-1 px-6 md:px-12 pb-24 max-w-5xl mx-auto w-full">
        <ProfileClient slug={slug} user={user ?? null} />
      </main>
      <Footer />
    </>
  );
}
