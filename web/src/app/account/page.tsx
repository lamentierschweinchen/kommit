"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthHeader } from "@/components/layout/AuthHeader";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { ExportKeyModal } from "@/components/account/ExportKeyModal";
import { StubModal } from "@/components/account/StubModal";
import { DepositModal } from "@/components/account/DepositModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/common/ToastProvider";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/common/Icon";
import { GoogleGlyph } from "@/components/common/GoogleGlyph";

export default function AccountPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { confirm } = useToast();

  const [exportOpen, setExportOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [changeNameOpen, setChangeNameOpen] = useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [addMethodOpen, setAddMethodOpen] = useState(false);
  const [connectWalletOpen, setConnectWalletOpen] = useState(false);

  const handleSignOut = () => {
    signOut();
    router.push("/");
    confirm("Signed out.");
  };

  const handleCopyWallet = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.wallet);
      confirm("Copied.");
    } catch {
      confirm("Copied.");
    }
  };

  return (
    <>
      <AuthHeader />
      <div className="flex flex-1 relative">
        <Sidebar variant="kommitter" />
        <main className="flex-1 lg:ml-64 px-6 md:px-12 pb-24 max-w-[calc(80rem-16rem)] w-full">
          <section className="mt-12 md:mt-16 flex items-end justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-epilogue font-black uppercase text-4xl md:text-6xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit">
                Account
              </h1>
              <p className="mt-5 max-w-xl text-base font-medium text-gray-700 leading-relaxed">
                v1 minimal — email, wallet, sign-in methods, advanced. No notification preferences
                in v1; the dashboard is the inbox.
              </p>
            </div>
            {user ? (
              <button
                type="button"
                onClick={() => setDepositOpen(true)}
                className="bg-secondary text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 self-start sm:self-auto"
              >
                <Icon name="add" size="sm" />
                Deposit
              </button>
            ) : null}
          </section>

          <section className="mt-12 max-w-3xl space-y-5">
            <Row
              label="Display name"
              value={user?.displayName ?? "—"}
              hint="What other kommitters and founders see when you back a project."
              actionLabel="Change"
              onAction={() => setChangeNameOpen(true)}
            />

            <Row
              label="Email"
              value={user?.email ?? "—"}
              actionLabel="Change"
              onAction={() => setChangeEmailOpen(true)}
            />

            <Row
              label="Wallet"
              value={user?.wallet ?? "—"}
              valueClass="font-mono"
              hint="Your account address. Your money lives here."
              actionLabel="Copy"
              actionIcon="content_copy"
              onAction={handleCopyWallet}
            />

            {/* Sign-in methods — audit fix #12: status pill treatment */}
            <article className="bg-white border-[3px] border-black shadow-brutal p-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
              <div>
                <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
                  Sign-in methods
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusPill icon="mail" label="Email" />
                  <StatusPill customGlyph={<GoogleGlyph />} label="Google" />
                  <StatusPill icon="fingerprint" label="Touch ID" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddMethodOpen(true)}
                className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2"
              >
                <Icon name="add" size="sm" />
                Add method
              </button>
            </article>
          </section>

          <section className="mt-20 pt-10 border-t-[8px] border-black max-w-3xl">
            <h2 className="font-epilogue font-black uppercase text-2xl md:text-3xl tracking-tighter border-b-[4px] border-black pb-2 inline-flex max-w-fit mb-8">
              Advanced
            </h2>
            <div className="space-y-5">
              {/* Audit fix #11: Export = outlined (white/black/border) — NOT primary purple */}
              <article className="bg-white border-[3px] border-black shadow-brutal p-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon name="key" className="text-primary" />
                    <div className="font-epilogue font-black uppercase text-base tracking-tight">
                      Export private key
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium text-gray-700 leading-relaxed max-w-md">
                    The master key to your wallet. Anyone with it can move your money — save it
                    somewhere only you can access.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 sm:self-center"
                >
                  Export
                  <Icon name="arrow_outward" size="sm" />
                </button>
              </article>

              <article className="bg-white border-[3px] border-black shadow-brutal p-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon name="account_balance_wallet" />
                    <div className="font-epilogue font-black uppercase text-base tracking-tight">
                      Connect external wallet
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium text-gray-700 leading-relaxed max-w-md">
                    If you already have a Solana wallet, use it instead.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConnectWalletOpen(true)}
                  className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:self-center"
                >
                  Connect
                </button>
              </article>
            </div>
          </section>

          <section className="mt-16 pt-10 border-t-[8px] border-black max-w-3xl">
            <button
              type="button"
              onClick={handleSignOut}
              className="font-epilogue font-bold uppercase tracking-tight text-sm text-gray-700 hover:text-black border-b-[2px] border-gray-300 hover:border-black px-1 py-1 transition-colors flex items-center gap-2"
            >
              <Icon name="logout" size="sm" />
              Sign out
            </button>
          </section>
        </main>
      </div>
      <Footer withSidebarOffset />

      <ExportKeyModal open={exportOpen} onOpenChange={setExportOpen} />
      <DepositModal open={depositOpen} onOpenChange={setDepositOpen} />
      <StubModal
        open={changeNameOpen}
        onOpenChange={setChangeNameOpen}
        title="Change display name"
        fieldLabel="New display name"
        submitLabel="Save"
        successCopy="Display name updated."
      />
      <StubModal
        open={changeEmailOpen}
        onOpenChange={setChangeEmailOpen}
        title="Change email"
        fieldLabel="New email"
        fieldType="email"
        submitLabel="Send confirmation"
        successCopy="Confirmation sent. Click the link in your inbox."
      />
      <StubModal
        open={addMethodOpen}
        onOpenChange={setAddMethodOpen}
        title="Add sign-in method"
        fieldLabel="Method (email, social, passkey)"
        submitLabel="Add"
        successCopy="Method added."
      />
      <StubModal
        open={connectWalletOpen}
        onOpenChange={setConnectWalletOpen}
        title="Connect external wallet"
        fieldLabel="Wallet address"
        submitLabel="Connect"
        successCopy="External wallet connected."
      />
    </>
  );
}

function Row({
  label,
  value,
  hint,
  actionLabel,
  actionIcon,
  onAction,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  actionLabel: string;
  actionIcon?: IconName;
  onAction: () => void;
  valueClass?: string;
}) {
  return (
    <article className="bg-white border-[3px] border-black shadow-brutal p-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-center">
      <div>
        <div className="font-epilogue font-bold uppercase text-[11px] text-gray-500 tracking-widest">
          {label}
        </div>
        <div
          className={cn(
            "mt-1 font-epilogue font-black text-xl md:text-2xl tracking-tight break-all",
            valueClass,
          )}
        >
          {value}
        </div>
        {hint ? (
          <p className="mt-2 text-sm font-medium text-gray-700 leading-relaxed max-w-md">{hint}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onAction}
        className="bg-white text-black font-epilogue font-black uppercase tracking-tight text-sm px-5 py-3 border-[3px] border-black shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform active:translate-x-[2px] active:translate-y-[2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:self-center flex items-center gap-2"
      >
        {actionIcon ? <Icon name={actionIcon} size="sm" /> : null}
        {actionLabel}
      </button>
    </article>
  );
}

/**
 * Audit fix #12: status pill — drops the brutal-button shadow, keeps 2px border,
 * green bg, green-on-black filled check glyph. Reads as "✓ connected" not "click me".
 */
function StatusPill({
  icon,
  label,
  customGlyph,
}: {
  icon?: IconName;
  label: string;
  customGlyph?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 bg-secondary border-[2px] border-black px-3 py-1.5 font-epilogue font-black uppercase text-xs tracking-tight">
      {customGlyph ?? (icon ? <Icon name={icon} size="sm" /> : null)}
      {label}
      <Icon name="check" size="sm" className="ml-0.5 bg-black text-secondary w-5 h-5 p-0.5" />
    </span>
  );
}
