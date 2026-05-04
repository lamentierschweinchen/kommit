import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t mt-16">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sm text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Kommit</span>
          <span className="mx-2">·</span>
          <span>a primitive for patient capital, on Solana.</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="https://github.com/lamentierschweinchen/kommit" className="hover:text-foreground">
            GitHub
          </Link>
          <span>Built on Solana</span>
        </div>
      </div>
    </footer>
  );
}
