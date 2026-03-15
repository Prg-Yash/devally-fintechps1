import { Loader2 } from "lucide-react";

const Loading = () => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F6F1] px-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,242,79,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(26,36,6,0.07),transparent_46%)]" />

      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        <span className="rounded-full border border-[#1A2406]/10 bg-white/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1A2406]/55">
          PayCrow
        </span>

        <div className="relative mt-6 h-20 w-20">
          <div className="absolute inset-0 rounded-full border border-[#1A2406]/10" />
          <div className="absolute inset-2 rounded-full border border-[#1A2406]/8" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#1A2406]/70 border-r-[#D9F24F] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[#1A2406]/65" />
          </div>
        </div>

        <p className="mt-6 font-jakarta text-2xl font-bold tracking-[-0.03em] text-[#1A2406]">
          Loading Workspace
        </p>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#1A2406]/45">
          Syncing wallet and escrow state
        </p>

        <div className="mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#1A2406]/10">
          <div className="h-full w-2/3 rounded-full bg-linear-to-r from-[#D9F24F] to-[#cfe74a] animate-pulse" />
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1A2406]/25 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#1A2406]/35 animate-pulse [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#1A2406]/45 animate-pulse [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
};

export default Loading;
