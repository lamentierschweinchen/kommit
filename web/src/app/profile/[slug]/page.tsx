import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { ProfileClient } from "./ProfileClient";
import { getUser } from "@/lib/data/users";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = getUser(slug);

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
