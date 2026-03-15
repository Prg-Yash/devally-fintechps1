import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleHelp,
  Coins,
  FileText,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TocItem = {
  href: string;
  label: string;
};

const toc: TocItem[] = [
  { href: "#overview", label: "Overview" },
  { href: "#connect-wallet", label: "Connect Wallet" },
  { href: "#agreements", label: "Create Agreements" },
  { href: "#agreement-streams", label: "Incoming and Outgoing" },
  { href: "#contract-generator", label: "Contract Generator" },
  { href: "#agreement-chat", label: "Agreement Collaboration" },
  { href: "#ai-verification", label: "AI Auto Verification" },
  { href: "#pcc", label: "Buy and Use PCC" },
  { href: "#ticketing", label: "Ticketing System" },
  { href: "#copilot", label: "Use Paycrow Copilot" },
  { href: "#security", label: "Security Checklist" },
  { href: "#troubleshooting", label: "Troubleshooting" },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#1A2406]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,242,79,0.12),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(26,36,6,0.06),transparent_45%)]" />

      <main className="relative mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-14">
        <section className="rounded-[32px] border border-[#1A2406]/10 bg-white/80 p-8 shadow-[0_24px_64px_-32px_rgba(26,36,6,0.45)] backdrop-blur md:p-12">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className="border-none bg-[#D9F24F]/30 text-[#1A2406] text-[10px] font-bold uppercase tracking-[0.18em]"
            >
              Documentation Hub
            </Badge>
            <Badge
              variant="outline"
              className="border-[#1A2406]/20 bg-white text-[#1A2406]/70 text-[10px] font-bold uppercase tracking-[0.18em]"
            >
              PayCrow User Guide
            </Badge>
          </div>

          <h1 className="mt-5 font-jakarta text-4xl font-bold tracking-[-0.04em] md:text-6xl">
            Learn Every Flow,
            <span className="ml-2 font-light italic text-[#1A2406]/45">
              Step by Step
            </span>
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#1A2406]/70 md:text-base">
            This guide shows exactly how to connect wallets, draft agreements,
            lock funds, buy PCC, and use Nexus Intelligence confidently. Keep
            this page open while working in dashboard.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard">
              <Button className="h-11 rounded-xl bg-[#1A2406] px-5 text-xs font-bold uppercase tracking-widest text-[#D9F24F] hover:bg-[#24310a]">
                Open Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/tickets">
              <Button
                variant="outline"
                className="h-11 rounded-xl border-[#1A2406]/20 bg-white px-5 text-xs font-bold uppercase tracking-widest text-[#1A2406] hover:bg-[#1A2406]/5"
              >
                Contact Support
              </Button>
            </Link>
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <Card
              id="overview"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <Sparkles className="h-5 w-5 text-[#1A2406]/65" />
                  Platform Overview
                </CardTitle>
                <CardDescription className="text-[#1A2406]/65">
                  PayCrow secures project payments in escrow and releases funds
                  by milestone.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-[#1A2406]/80 md:grid-cols-2">
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">1. Create a draft agreement</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Define scope, amount, timeline, and payment milestones.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">
                    2. Freelancer reviews and approves
                  </p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Both parties align before any release transaction.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">3. Funds are managed on-chain</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Escrow status and milestones remain transparent and
                    auditable.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">4. Use Copilot for speed</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Nexus Intelligence can fetch balances, agreements, and
                    trigger actions.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              id="connect-wallet"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <Wallet className="h-5 w-5 text-[#1A2406]/65" />
                  Connect Wallet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#1A2406]/80">
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  Click Connect Node in dashboard sidebar. The app supports
                  smart account flow and uses admin signer fallback where
                  required for transaction signing.
                </p>
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">Best practice</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Always verify the shown signer address before funding or
                    releasing escrow.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              id="agreements"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <FileText className="h-5 w-5 text-[#1A2406]/65" />
                  Create Agreements Correctly
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#1A2406]/80">
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">Minimum required fields</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Receiver email, total amount, title, and target completion
                    date.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">Milestone rule</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Milestone total must match agreement amount and dates must
                    stay within valid timeline.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">Tip</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Use AI Agreement Generator for first draft, then review and
                    edit before sending.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              id="agreement-streams"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <FileText className="h-5 w-5 text-[#1A2406]/65" />
                  Incoming and Outgoing Agreements
                </CardTitle>
                <CardDescription className="text-[#1A2406]/65">
                  The Agreements page separates work you receive and work you
                  create.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#1A2406]/80">
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">Incoming</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Agreements where you are the receiver or freelancer. Review
                    terms, request changes, or approve to move funding forward.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">Outgoing</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Agreements you raised as client. Track negotiation, publish
                    and fund after approval, and monitor active milestones.
                  </p>
                </div>
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  Open any agreement card to view full details, status timeline,
                  milestone data, and protocol-level on-chain context.
                </p>
              </CardContent>
            </Card>

            <Card
              id="contract-generator"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <Sparkles className="h-5 w-5 text-[#1A2406]/65" />
                  AI Contract Generator
                </CardTitle>
                <CardDescription className="text-[#1A2406]/65">
                  Speed up drafting with AI, then edit every field manually
                  before sending.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#1A2406]/80">
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  Open <span className="font-bold">New Agreement</span>,
                  describe your project idea, and generate title, description,
                  budget, timeline, and milestones.
                </p>
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  Copilot can also send you directly with a pre-filled idea
                  using the same generator flow, then you can refine details
                  before creating the draft.
                </p>
              </CardContent>
            </Card>

            <Card
              id="agreement-chat"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <Bot className="h-5 w-5 text-[#1A2406]/65" />
                  Per-Agreement Collaboration
                </CardTitle>
                <CardDescription className="text-[#1A2406]/65">
                  Keep negotiation and updates tied to each specific agreement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#1A2406]/80">
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  Use the agreement detail page for collaboration actions like
                  requesting changes, approving for funding, and tracking
                  progress per milestone.
                </p>
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  If your deployment enables chat thread UI per agreement, keep
                  conversation there so every decision remains context-linked
                  and auditable.
                </p>
              </CardContent>
            </Card>

            <Card
              id="ai-verification"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <ShieldCheck className="h-5 w-5 text-[#1A2406]/65" />
                  AI Auto Verification
                </CardTitle>
                <CardDescription className="text-[#1A2406]/65">
                  Combine AI checks with user approval before final release
                  actions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#1A2406]/80">
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  AI verification can evaluate deliverable quality and summarize
                  findings to support release decisions. Use it as decision
                  support, then confirm manually in product flow.
                </p>
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  On-chain actions still use signature verification and network
                  checks before state change, so critical payment transitions
                  remain verifiable.
                </p>
              </CardContent>
            </Card>

            <Card
              id="pcc"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <Coins className="h-5 w-5 text-[#1A2406]/65" />
                  Buy and Use PCC
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#1A2406]/80">
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  Open Buy PCC from sidebar or ask Copilot. Enter INR amount and
                  complete Razorpay payment.
                </p>
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  After successful payment, PCC balance updates in dashboard and
                  can be checked in Copilot.
                </p>
              </CardContent>
            </Card>

            <Card
              id="ticketing"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <CircleHelp className="h-5 w-5 text-[#1A2406]/65" />
                  Ticketing System
                </CardTitle>
                <CardDescription className="text-[#1A2406]/65">
                  Raise and track disputes with clear raised and received views.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#1A2406]/80">
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">Raised by me</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Tickets you created against counterparty behavior, payment
                    issues, or scope disputes.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">Against me</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Tickets where you are the responding side. Review severity,
                    status, and related agreement.
                  </p>
                </div>
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  When creating a ticket, link the agreement, add reason and
                  evidence URL, and include enough context for quick resolution.
                </p>
              </CardContent>
            </Card>

            <Card
              id="copilot"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <Bot className="h-5 w-5 text-[#1A2406]/65" />
                  Use PayCrow Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#1A2406]/80">
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">Useful prompts</p>
                  <ul className="mt-2 space-y-1 text-[#1A2406]/65">
                    <li>Am I connected?</li>
                    <li>Show my agreements</li>
                    <li>Check my PCC balance</li>
                    <li>Buy PCC for 1000 INR</li>
                    <li>Draft new agreement for a landing page project</li>
                  </ul>
                </div>
                <p className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  Copilot can render action buttons for wallet connect, buy PCC,
                  release flow, and draft agreement launch.
                </p>
              </CardContent>
            </Card>

            <Card
              id="security"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <ShieldCheck className="h-5 w-5 text-[#1A2406]/65" />
                  Security Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-[#1A2406]/80">
                <p className="flex items-start gap-2 rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#1f6a42]" />
                  Verify wallet and signer addresses before every funding
                  action.
                </p>
                <p className="flex items-start gap-2 rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#1f6a42]" />
                  Confirm milestone amounts and due dates before sending draft
                  to freelancer.
                </p>
                <p className="flex items-start gap-2 rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#1f6a42]" />
                  Never approve unexpected wallet signature prompts.
                </p>
              </CardContent>
            </Card>

            <Card
              id="troubleshooting"
              className="rounded-3xl border-[#1A2406]/10 bg-white/80"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-jakarta tracking-[-0.03em]">
                  <CircleHelp className="h-5 w-5 text-[#1A2406]/65" />
                  Troubleshooting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[#1A2406]/80">
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">Wallet not detected</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Reconnect from sidebar and refresh the current dashboard
                    page.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">PCC balance looks wrong</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Use Copilot balance check and verify displayed wallet and
                    contract details.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#1A2406]/10 bg-[#FAFAF9] p-4">
                  <p className="font-bold">Need direct help</p>
                  <p className="mt-1 text-[#1A2406]/65">
                    Open a support ticket with screenshots and wallet address
                    context.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="lg:col-span-4">
            <div className="sticky top-6 space-y-4">
              <Card className="rounded-3xl border-[#1A2406]/10 bg-white/90">
                <CardHeader>
                  <CardTitle className="text-lg font-jakarta">
                    On this page
                  </CardTitle>
                  <CardDescription>
                    Jump to any guide section instantly.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {toc.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="flex items-center justify-between rounded-xl border border-[#1A2406]/10 bg-[#FAFAF9] px-3 py-2 text-sm font-medium text-[#1A2406]/80 transition hover:bg-[#D9F24F]/20 hover:text-[#1A2406]"
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-[#1A2406]/10 bg-[#1A2406] text-white">
                <CardHeader>
                  <CardTitle className="text-lg font-jakarta">
                    Quick Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link
                    href="/dashboard"
                    className="block rounded-xl bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15"
                  >
                    Open Dashboard
                  </Link>
                  <Link
                    href="/agreements"
                    className="block rounded-xl bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15"
                  >
                    Agreements
                  </Link>
                  <Link
                    href="/buy-pcc"
                    className="block rounded-xl bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15"
                  >
                    Buy PCC
                  </Link>
                  <Link
                    href="/tickets"
                    className="block rounded-xl bg-white/10 px-3 py-2 text-sm font-medium hover:bg-white/15"
                  >
                    Support Tickets
                  </Link>
                </CardContent>
              </Card>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
