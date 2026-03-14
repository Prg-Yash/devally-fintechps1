"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { Plus, Menu, X, ArrowRight, Activity, ArrowLeft, Facebook, Instagram, Send } from "lucide-react";
import Lenis from "lenis";

// --- Configuration & Variants ---
const SPRING_TRANSITION_GLO = { type: "spring", stiffness: 100, damping: 20 };

const maskedRevealVariant = {
  hidden: { y: 30, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 70, damping: 15 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleUpVariant = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: SPRING_TRANSITION_GLO },
};

const floatingAnimation = {
  y: ["-6px", "6px", "-6px"],
  transition: {
    duration: 4,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

// --- Helper component to enforce text masked reveals ---
const MaskedText = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className="overflow-hidden inline-block w-full">
    <motion.div variants={maskedRevealVariant} className={className}>
      {children}
    </motion.div>
  </div>
);

// --- Components ---

const CustomCursor = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName.toLowerCase() === "button" ||
        target.tagName.toLowerCase() === "a" ||
        target.closest("button") ||
        target.closest("a")
      ) {
        setIsHovered(true);
      } else {
        setIsHovered(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, []);

  const springX = useSpring(mousePosition.x, { stiffness: 500, damping: 28 });
  const springY = useSpring(mousePosition.y, { stiffness: 500, damping: 28 });
  const springRingX = useSpring(mousePosition.x, { stiffness: 150, damping: 20 });
  const springRingY = useSpring(mousePosition.y, { stiffness: 150, damping: 20 });

  useEffect(() => {
    springX.set(mousePosition.x);
    springY.set(mousePosition.y);
    springRingX.set(mousePosition.x);
    springRingY.set(mousePosition.y);
  }, [mousePosition, springX, springY, springRingX, springRingY]);

  return (
    <>
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9999] h-2 w-2 rounded-full bg-[#D9F24F] mix-blend-difference"
        style={{
          x: springX,
          y: springY,
          translateX: "-50%",
          translateY: "-50%",
        }}
      />
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9998] rounded-full border border-black/30 dark:border-white/30 mix-blend-difference"
        style={{
          x: springRingX,
          y: springRingY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          width: isHovered ? 48 : 32,
          height: isHovered ? 48 : 32,
          backgroundColor: isHovered ? "rgba(255, 255, 255, 1)" : "rgba(0, 0, 0, 0)",
        }}
        transition={SPRING_TRANSITION_GLO}
      />
    </>
  );
};

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_TRANSITION_GLO}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 mix-blend-difference text-white"
    >
      <div className="hidden md:flex gap-6 rounded-full bg-[#1A2406]/20 backdrop-blur-md px-6 py-3">
        <a href="#service" className="text-sm font-medium hover:opacity-70 transition-opacity">Service</a>
        <a href="#members-benefits" className="text-sm font-medium hover:opacity-70 transition-opacity">Members benefits</a>
        <a href="#products" className="text-sm font-medium hover:opacity-70 transition-opacity">Products</a>
      </div>

      <div className="flex items-center gap-2">
        <Activity className="h-6 w-6" />
        <span className="text-xl font-bold tracking-tight font-jakarta">Nexus Escrow</span>
      </div>

      <div className="hidden md:flex items-center gap-4">
        <a href="/register" className="text-sm font-medium hover:opacity-70 transition-opacity">Sign Up</a>
        <button className="rounded-full bg-white text-black px-6 py-2.5 text-sm font-semibold hover:scale-105 transition-transform">
          Sign In
        </button>
      </div>

      <button className="md:hidden text-white" onClick={() => setIsOpen(true)}>
        <Menu className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={SPRING_TRANSITION_GLO}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#1A2406] text-white"
          >
            <button className="absolute top-6 right-6" onClick={() => setIsOpen(false)}>
              <X className="h-8 w-8" />
            </button>
            <div className="flex flex-col gap-8 text-2xl font-medium items-center font-jakarta tracking-[-0.04em]">
              <a href="#about" onClick={() => setIsOpen(false)}>Protocol</a>
              <a href="#features" onClick={() => setIsOpen(false)}>Security</a>
              <a href="#docs" onClick={() => setIsOpen(false)}>Developers</a>
              <a href="#app" onClick={() => setIsOpen(false)}>Sign Up</a>
              <button className="mt-4 rounded-full bg-[#D9F24F] text-[#1A2406] px-8 py-3 text-lg font-bold">
                Sign In
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

// --- Custom Slot Machine Rolling Counter ---
const RollingCounter = ({ value, prefix = "", suffix = "", decimals = 0 }: { value: number, prefix?: string, suffix?: string, decimals?: number }) => {
  const springValue = useSpring(value, { stiffness: 80, damping: 20 });
  const [displayValue, setDisplayValue] = useState(value);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      setDisplayValue(latest);
    });
  }, [springValue]);

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  return (
    <span className="tabular-nums font-mono tracking-tighter">
      {prefix}
      {isMounted ? formatNumber(displayValue) : formatNumber(value)}
      {suffix}
    </span>
  );
};

const CalculatorSection = () => {
  const [sliderValue, setSliderValue] = useState(15000);
  const [currency, setCurrency] = useState('INR');
  const maxUsdc = 50000;
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(Number(e.target.value));
  };

  const rates: Record<string, number> = {
    INR: 92.57,
    USD: 1.00,
    EUR: 0.92,
    GBP: 0.77,
  };

  const prefixes: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };

  const payout = sliderValue * rates[currency];
  const currentPrefix = prefixes[currency];

  return (
    <motion.section 
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={staggerContainer}
      className="py-32 px-6 md:px-12 max-w-7xl mx-auto flex flex-col md:flex-row gap-16 items-center"
    >
      <div className="flex-1 space-y-8">
        <MaskedText className="text-5xl md:text-6xl font-jakarta tracking-[-0.04em] font-medium text-[#1A2406] leading-tight">
          Stable Settlement.<br />
          No Volatility.
        </MaskedText>
        <MaskedText className="text-lg text-gray-700 max-w-md">
          Deposit ETH into the escrow smart contract and guarantee your global contractors receive true stablecoin value when milestones are completed.
        </MaskedText>
        <motion.div variants={maskedRevealVariant}>
          <button className="rounded-full bg-[#1A2406] text-white px-8 py-4 text-base font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
            Create Escrow <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>

      <motion.div 
        variants={scaleUpVariant}
        className="flex-1 w-full bg-[#D9F24F] rounded-[40px] p-8 md:p-12 shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none text-6xl">✨</div>
        
        <div className="flex items-center justify-between mb-8 border-b border-[#1A2406]/10 pb-4">
          <span className="text-xl font-medium text-[#1A2406] font-jakarta tracking-[-0.04em]">Converter</span>
        </div>
        
        <div className="space-y-4 mb-12">
          <span className="text-sm text-[#1A2406]/70">Amount in Escrow (USDC)</span>
          <div className="text-5xl font-medium text-[#1A2406] flex items-center font-jakarta tabular-nums">
            <RollingCounter value={sliderValue} decimals={0} prefix="$" />
            <span className="text-2xl pt-2 pl-2 font-sans">USDC</span>
          </div>
          <div className="relative pt-6">
            <input 
              type="range" 
              min="500" 
              max={maxUsdc} 
              step="100"
              onInput={handleSliderChange}
              defaultValue={15000}
              className="w-full appearance-none bg-[#1A2406]/20 h-1.5 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#1A2406] [&::-webkit-slider-thumb]:rounded-sm cursor-none"
            />
          </div>
        </div>

        <div className="space-y-4">
          <span className="text-sm text-[#1A2406]/70">Recipient Payout</span>
          <div className="text-4xl md:text-5xl font-medium text-[#1A2406] font-jakarta flex flex-wrap items-center gap-x-4 gap-y-2">
            <div>
              <RollingCounter value={payout} decimals={2} prefix={currentPrefix} />
            </div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-transparent border border-[#1A2406]/20 text-[#1A2406] text-xl md:text-2xl font-sans rounded-xl px-3 py-1 outline-none cursor-pointer hover:border-[#1A2406]/50 transition-colors"
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
};

const FAQItem = ({ question, answer, isOpen, onClick }: { question: string, answer: string, isOpen: boolean, onClick: () => void }) => {
  return (
    <div className="border-b border-[#D9F24F]/20 py-6">
      <button 
        onClick={onClick}
        className="w-full flex justify-between items-center text-left text-xl md:text-2xl text-[#D9F24F] font-jakarta tracking-[-0.04em] font-medium"
      >
        <span>{question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={SPRING_TRANSITION_GLO}
        >
          <Plus className="h-6 w-6 text-[#D9F24F]" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING_TRANSITION_GLO}
            className="overflow-hidden"
          >
            <p className="pt-4 text-[#D9F24F]/70 text-base leading-relaxed max-w-2xl font-sans">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function Home() {
  const [openFAQ, setOpenFAQ] = useState<number>(0);
  const parallaxRef = useRef(null);
  
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ["start end", "end start"]});
  const yParallaxFast = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const yParallaxSlow = useTransform(scrollYProgress, [0, 1], [80, -80]);

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.08, 
      wheelMultiplier: 0.9,
      smoothWheel: true,
    });
    function raf(time: number) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    return () => { lenis.destroy(); };
  }, []);

  return (
    <main className="landing-cursor-none min-h-screen bg-[#FDFCF8] text-[#1A2406] selection:bg-[#D9F24F] selection:text-[#1A2406] overflow-x-hidden font-sans">
      <CustomCursor />
      <Navbar />

      {/* --- Hero Section --- */}
      <section className="relative min-h-screen pt-32 pb-16 flex flex-col justify-end px-6 md:px-12 bg-[#1A2406] text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=2100&auto=format&fit=crop')] bg-cover bg-center opacity-60" />
        <div 
          className="absolute inset-0 backdrop-blur-[16px]" 
          style={{ WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)', maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 80%)' }} 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A2406] via-[#1A2406]/80 to-transparent opacity-90" />
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-[#D9F24F]/20 rounded-full blur-[120px]" />
        
        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            // Changed from lg:grid-cols-2 to give the text column more width
            className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-12 items-end"
          >
            {/* Added lg:-ml-8 to push it to the left on larger screens */}
            <div className="space-y-6 lg:-ml-8">
              <MaskedText className="text-6xl md:text-8xl tracking-[-0.04em] leading-[1.1] font-medium font-jakarta">
                Trustless Payments <br/> for the Global Digital Workforce.
              </MaskedText>
              <MaskedText className="text-lg text-white/70 max-w-md">
                Secure, autonomous escrow powered by Ethereum smart contracts. Ensure accountability with milestone-based stablecoin payouts.
              </MaskedText>
              <motion.div variants={maskedRevealVariant}>
                <button className="rounded-full bg-[#D9F24F] text-[#1A2406] px-8 py-4 text-base font-medium hover:bg-white transition-colors flex items-center gap-2 mt-4">
                  Connect Wallet <ArrowRight className="h-5 w-5" />
                </button>
              </motion.div>
            </div>

            <motion.div variants={maskedRevealVariant} className="relative w-full flex justify-end">
              {/* Floating Escrow Widget */}
              <motion.div 
                animate={floatingAnimation}
                className="bg-white text-[#1A2406] rounded-[24px] p-6 w-80 shadow-2xl relative z-20 will-change-transform"
              >
                <div className="flex justify-between items-center mb-6">
                  <span className="text-xl font-medium font-jakarta tracking-[-0.04em]">Escrow Status</span>
                  <span className="bg-[#1A2406] text-[#D9F24F] text-xs font-bold px-3 py-1 rounded-full tabular-nums">Secured</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-400 mb-6 font-medium">
                  <span className="text-[#1A2406] border-b border-[#1A2406]">Locked</span>
                  <span>In Review</span>
                  <span>Released</span>
                </div>
                <div className="flex items-end justify-between h-32 gap-2">
                  <div className="w-10 bg-[#D9F24F] rounded-t-md h-12" />
                  <div className="w-10 bg-[#1A2406]/20 rounded-t-md h-16" />
                  <div className="flex flex-col gap-1 items-center w-10">
                     <div className="w-10 bg-[#1A2406] rounded-md h-8" />
                     <div className="w-10 bg-[#D9F24F] rounded-md h-12" />
                  </div>
                  <div className="w-10 bg-[#1A2406] rounded-t-md h-24" />
                </div>
                <div className="mt-4 text-xs text-gray-400">Total Staked Assets verifiable on-chain</div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* --- Marquee Social Proof --- */}
      <section className="py-12 border-b border-black/5 flex flex-col items-center overflow-hidden">
        <span className="text-sm font-medium bg-black/5 rounded-full px-6 py-2 mb-8 inline-block">
          Join over 500 cross-border teams already growing with Nexus Escrow.
        </span>
        <div className="w-full overflow-hidden whitespace-nowrap mask-image-linear">
           <motion.div 
             animate={{ x: [0, -1000] }} 
             transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
             className="flex gap-16 items-center px-8"
           >
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex gap-16 items-center flex-shrink-0 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all font-jakarta tracking-[-0.04em]">
                  <span className="text-2xl font-bold flex items-center gap-2"><Activity className="text-gray-400"/> BuilderDao</span>
                  <span className="text-2xl font-bold font-serif">MetaGuild</span>
                  <span className="text-2xl font-bold flex items-center gap-1"><div className="w-6 h-6 bg-black rounded-sm transform rotate-45"/> DevNet</span>
                  <span className="text-2xl font-bold">Node.ai</span>
                  <span className="text-2xl font-bold flex items-center gap-2"><div className="w-4 h-4 bg-black rotate-45"/> chainlink</span>
                  <span className="text-2xl font-bold text-gray-800">Nexus.</span>
                </div>
              ))}
           </motion.div>
        </div>
      </section>

      {/* --- Multi-Section / Features --- */}
      <section ref={parallaxRef} className="py-24 px-6 md:px-12 max-w-7xl mx-auto space-y-32">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12"
        >
          <div className="space-y-8">
            <MaskedText className="text-4xl md:text-5xl font-jakarta tracking-[-0.04em] font-medium leading-tight text-[#1A2406]">
              Build for your global <br /> decentralized workforce
            </MaskedText>
            <motion.div variants={maskedRevealVariant} className="flex gap-4">
              <button className="rounded-full bg-[#1A2406] text-white px-6 py-3 text-sm font-medium flex items-center gap-2 hover:opacity-90">
                Deploy Contract <ArrowRight className="h-4 w-4" />
              </button>
              <button className="rounded-full border border-black/20 px-6 py-3 text-sm font-medium hover:border-black transition-colors">
                Read Docs
              </button>
            </motion.div>
            <MaskedText className="text-gray-600 max-w-md pt-6">
              Experience seamless integration of blockchain technology and finance, built for zero-trust environments.
              <br/><br/>
              <strong className="text-black">The power of smart contracts</strong>, with none of the manual arbitration. Nexus gives global teams an intuitive platform for verified payouts.
            </MaskedText>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            {/* Light Blue Card with Parallax */}
            <motion.div style={{ y: yParallaxSlow }} className="bg-[#E5F1F3] rounded-[32px] p-8 flex flex-col justify-between aspect-square mt-0 md:mt-24 shadow-sm will-change-transform">
              <div>
                <h3 className="text-2xl font-medium font-jakarta tracking-[-0.04em] leading-tight mb-4 text-[#1A2406]">Autonomous Milestone Release</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex gap-2 items-start"><span className="text-gray-400">→</span> Sender adds money to smart contract</li>
                  <li className="flex gap-2 items-start"><span className="text-gray-400">→</span> Receiver confirms deliverables</li>
                  <li className="flex gap-2 items-start"><span className="text-gray-400">→</span> 2-day auto-payout logic eliminates defaults</li>
                </ul>
              </div>
              <button className="rounded-full bg-[#1A2406] text-white px-5 py-3 text-sm font-medium hover:opacity-90 w-fit flex items-center gap-2">
                Manage Escrows <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
            
            {/* Dark Green Card with Parallax */}
            <motion.div style={{ y: yParallaxFast }} className="bg-[#1A2406] text-[#D9F24F] rounded-[32px] p-8 flex flex-col justify-between aspect-square shadow-[0px_20px_40px_-10px_rgba(0,0,0,0.3)] will-change-transform">
              <div className="space-y-4">
                 <div className="bg-[#2D3F0F] rounded-2xl p-4 flex gap-3 text-white w-max">
                   <div className="bg-[#D9F24F]/20 text-white rounded-lg p-2 text-xs">Verify Payout</div>
                 </div>
              </div>
              <h3 className="text-2xl font-medium font-jakarta tracking-[-0.04em] leading-tight mt-8">Cross-Border Compliance</h3>
            </motion.div>
          </div>
        </motion.div>

        {/* Access Growth Capital */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-12"
        >
          <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <MaskedText className="text-4xl md:text-5xl font-medium tracking-tight font-jakarta text-[#1A2406]">
              Secure the talent you need, anywhere
            </MaskedText>
            <motion.button variants={maskedRevealVariant} className="rounded-full border border-black/20 px-6 py-3 text-sm font-medium hover:border-black transition-colors whitespace-nowrap flex items-center gap-2">
              Learn more <ArrowRight className="h-4 w-4" />
            </motion.button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={scaleUpVariant} className="bg-gradient-to-br from-[#E2F4C5] to-[#BEE678] rounded-[40px] p-8 aspect-[4/5] flex flex-col items-center justify-center relative overflow-hidden text-center will-change-transform">
               <div className="bg-white rounded-3xl p-6 shadow-xl w-[90%] space-y-4">
                 <h4 className="font-medium font-jakarta tracking-[-0.04em] text-lg text-[#1A2406]">Multi-chain support</h4>
                 <div className="flex flex-wrap gap-2 justify-center text-xs">
                    <span className="bg-[#D9F24F]/40 px-3 py-1 rounded-full text-[#1A2406]">Ethereum</span>
                    <span className="bg-[#1A2406] text-white px-3 py-1 rounded-full">Polygon</span>
                    <span className="bg-blue-100 text-[#1A2406] px-3 py-1 rounded-full">Arbitrum</span>
                 </div>
                 <p className="text-xs text-gray-500 pt-2">Fund your escrows across multiple L2s with zero bridging friction.</p>
               </div>
            </motion.div>

            <motion.div variants={scaleUpVariant} className="bg-[#EEF1FF] rounded-[40px] p-8 aspect-[4/5] flex flex-col relative overflow-hidden will-change-transform">
               <h3 className="text-3xl font-medium font-jakarta tracking-[-0.04em] mb-8 text-[#1A2406]">On-chain <br/> Transparency.</h3>
               <motion.div animate={floatingAnimation} className="bg-white rounded-3xl p-6 shadow-xl w-full mt-auto">
                 <span className="text-xs text-gray-500">Contract Balance</span>
                 <div className="text-4xl font-medium tabular-nums font-jakarta text-[#1A2406] mt-1 mb-4">42,500 <span className="text-sm font-normal text-gray-400">USDC Locked</span></div>
                 <div className="flex gap-4 text-xs mb-4">
                    <div><span className="inline-block w-2 h-2 bg-[#1A2406] mr-1 tabular-nums"/>Released: 22%</div>
                    <div><span className="inline-block w-2 h-2 bg-[#1A2406]/40 mr-1 tabular-nums"/>Pending: 63%</div>
                 </div>
                 <div className="h-3 w-full flex bg-gray-100 rounded-full overflow-hidden">
                    <div className="w-[22%] bg-[#1A2406]" />
                    <div className="w-[63%] bg-[#1A2406]/40" />
                 </div>
               </motion.div>
            </motion.div>

            <motion.div variants={scaleUpVariant} className="bg-[#1A2406] text-white rounded-[40px] p-8 aspect-[4/5] flex flex-col justify-between relative overflow-hidden group will-change-transform">
               <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-70 group-hover:scale-105 transition-transform duration-1000 ease-in-out" />
               <div className="absolute inset-0 bg-gradient-to-t from-[#1A2406] to-transparent opacity-80" />
               <h3 className="text-4xl font-medium font-jakarta tracking-[-0.04em] relative z-10 w-2/3">Trustless Devs</h3>
               <p className="relative z-10 text-xl font-medium">Guarantee payment to developers immediately upon verified code submission to GitHub.</p>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* --- Calculator Section --- */}
      <CalculatorSection />

      {/* --- FAQ Section --- */}
      <section className="bg-[#1A2406] py-32 px-6 md:px-12 text-[#D9F24F]">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16"
        >
          <div className="space-y-6">
            <MaskedText className="text-5xl md:text-6xl font-medium font-jakarta tracking-[-0.04em] leading-[1.1]">
              Frequently<br />Asked Questions
            </MaskedText>
            <MaskedText className="text-[#D9F24F]/70 text-lg max-w-sm">
              Clear answers to the most common questions about smart contracts, compliance, and resolution.
            </MaskedText>
          </div>
          
          <motion.div variants={maskedRevealVariant} className="flex flex-col justify-center">
            <FAQItem 
              question="Smart Contract Security"
              answer="Our escrow smart contracts are fully open-source and have been audited by tier-1 security firms. The funds are non-custodial; neither Nexus nor any third party can access the escrowed stablecoins without the explicit execution of your milestone conditions."
              isOpen={openFAQ === 0}
              onClick={() => setOpenFAQ(openFAQ === 0 ? -1 : 0)}
            />
            <FAQItem 
              question="Jurisdictional Compliance"
              answer="By utilizing decentralized stablecoins (USDC) and strictly executing programmatic transfers based on on-chain proofs, Nexus Escrow operates agnostically across borders, severely reducing international banking compliance roadblocks."
              isOpen={openFAQ === 1}
              onClick={() => setOpenFAQ(openFAQ === 1 ? -1 : 1)}
            />
            <FAQItem 
              question="Dispute Resolution via Verification"
              answer="If a deliverable is challenged, the smart contract prevents automatic payout. The dispute is then sent to our decentralized arbitration layer, optionally allowing third-party multisig signers to review the external data (such as accepted GitHub PRs) to resolve the conflict objectively."
              isOpen={openFAQ === 2}
              onClick={() => setOpenFAQ(openFAQ === 2 ? -1 : 2)}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* --- Testimonial Section --- */}
      <section className="relative w-full h-[80vh] min-h-[600px] max-h-[800px] bg-[#1A2406] text-[#D9F24F] overflow-hidden flex flex-col justify-end p-6 md:p-16">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center md:bg-top opacity-50 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A2406] via-[#1A2406]/60 to-transparent" />
        
        <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-8">
           <div className="max-w-4xl space-y-6">
              <MaskedText className="text-xl md:text-2xl font-medium text-[#D9F24F] font-jakarta tracking-[-0.04em]">
                Alex Chen, Tech Lead at DeFi-Proto
              </MaskedText>
              <MaskedText className="text-3xl md:text-5xl lg:text-6xl font-medium leading-[1.15] font-jakarta">
                “The smart contract automation was flawless. Knowing our developer bounties were secured in escrow allowed us to attract top-tier global talent instantly. Dispute-free and fully autonomous.”
              </MaskedText>
           </div>
           
           <motion.div variants={maskedRevealVariant} className="flex gap-4 mb-4">
              <button className="h-14 w-14 rounded-full border border-[#D9F24F]/40 flex items-center justify-center hover:bg-[#D9F24F]/20 hover:scale-105 transition-all text-[#D9F24F]">
                 <ArrowLeft className="h-5 w-5" />
              </button>
              <button className="h-14 w-14 rounded-full border border-[#D9F24F]/40 flex items-center justify-center hover:bg-[#D9F24F]/20 hover:scale-105 transition-all text-[#D9F24F]">
                 <ArrowRight className="h-5 w-5" />
              </button>
           </motion.div>
        </div>
      </section>

      {/* --- Gradient Wrapper for Bottom Sections --- */}
      <div className="bg-gradient-to-b from-[#FDFCF8] via-[#F4F9D8] to-[#DEF48F] pt-32 pb-6">
        
        {/* --- Speak to Experts --- */}
        <section className="px-6 md:px-12 max-w-4xl mx-auto text-center space-y-8 mb-32">
          <MaskedText className="text-5xl md:text-7xl font-medium font-jakarta tracking-[-0.04em] text-[#1A2406] leading-[1.1]">
            Speak to our security <br/> engineers
          </MaskedText>
          <MaskedText className="text-lg text-gray-700 max-w-2xl mx-auto">
            Our team is here to answer your questions, review your contract integration needs, and guide you toward deploying your first secure escrow.
          </MaskedText>
          <motion.div variants={maskedRevealVariant} initial="hidden" whileInView="visible" viewport={{ once: true }} className="flex justify-center items-center font-medium text-sm text-[#1A2406] gap-4 pt-4">
            <span className="text-base text-[#1A2406]">Engineers</span>
            <div className="flex -space-x-3">
              <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop" className="w-10 h-10 rounded-full border border-[#F4F9D8] object-cover" alt="Expert 1" />
              <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop" className="w-10 h-10 rounded-full border border-[#F4F9D8] object-cover" alt="Expert 2" />
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" className="w-10 h-10 rounded-full border border-[#F4F9D8] object-cover" alt="Expert 3" />
              <div className="w-10 h-10 rounded-full border border-[#F4F9D8] bg-[#1A2406] tabular-nums text-white flex items-center justify-center text-xs">3+</div>
            </div>
            <span className="text-black/20">|</span>
            <button className="bg-[#1A2406] text-white px-6 py-3 rounded-full flex items-center gap-2 hover:opacity-90 transition-opacity">
              Join Discord <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        </section>

        {/* --- Articles --- */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto mb-32">
          <motion.div variants={maskedRevealVariant} initial="hidden" whileInView="visible" viewport={{ once: true }} className="flex justify-between items-end mb-12">
            <h2 className="text-4xl md:text-6xl font-medium tracking-tight font-jakarta text-[#1A2406]">Documentation</h2>
            <button className="text-[#1A2406] font-medium underline underline-offset-4 hover:opacity-70 transition-opacity">
              View Specs
            </button>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Integrating Web3 Escrows with React", img: "https://images.unsplash.com/photo-1639322537504-6427a16b0a28?q=80&w=1600&auto=format&fit=crop" },
              { title: "Best Practices for Dispute Oracles", img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1600&auto=format&fit=crop" },
              { title: "Managing Multi-signature Release Events", img: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?q=80&w=1600&auto=format&fit=crop" }
            ].map((article, i) => (
              <motion.div key={i} variants={scaleUpVariant} className="group relative rounded-[32px] overflow-hidden aspect-[4/5] md:aspect-square flex items-end p-8 text-white cursor-pointer will-change-transform">
                 <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 will-change-transform" style={{ backgroundImage: `url(${article.img})` }} />
                 <div className="absolute inset-0 bg-gradient-to-t from-[#1A2406]/90 via-[#1A2406]/30 to-transparent transition-opacity duration-700 opacity-80 group-hover:opacity-100" />
                 <h3 className="relative z-10 text-2xl md:text-3xl font-medium font-jakarta tracking-[-0.04em] leading-tight max-w-[90%]">{article.title}</h3>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* --- New Footer --- */}
        <footer className="px-4 md:px-8 max-w-full pb-8">
           <div className="bg-[#1A2406] overflow-hidden relative rounded-[48px] p-10 md:p-16 text-[#D9F24F]/70 flex flex-col justify-between min-h-[500px]">
              
              <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-16 lg:gap-8">
                 {/* Left Column */}
                 <div className="space-y-6 max-w-sm shrink-0">
                    <div className="flex items-center gap-2 mb-8 text-white">
                      <Activity className="h-10 w-10 text-white -rotate-45" />
                      <span className="text-4xl font-bold font-jakarta tracking-[-0.04em] text-white">Nexus</span>
                    </div>
                    <p className="text-base font-light text-[#D9F24F]/70 leading-relaxed font-sans">
                      AI-first ERP powering next-gen finance & accounting. <br/>
                      General ledger, revenue automation, close management.
                    </p>
                    <div className="flex items-center gap-3 pt-6 group cursor-pointer w-fit">
                      <div className="w-2 h-2 rounded-full bg-[#D9F24F]/50 group-hover:bg-[#D9F24F] transition-colors" />
                      <span className="text-sm font-medium hover:text-[#D9F24F] transition-colors">More about us</span>
                    </div>
                 </div>

                 {/* Right Column Layout */}
                 <div className="flex flex-col justify-between lg:items-end w-full space-y-16">
                    <div className="flex flex-wrap gap-8 lg:gap-12 text-white/90 font-medium text-base font-jakarta tracking-tight">
                      <a href="#" className="hover:text-[#D9F24F] transition-colors">Service</a>
                      <a href="#" className="hover:text-[#D9F24F] transition-colors">Members benefits</a>
                      <a href="#" className="hover:text-[#D9F24F] transition-colors">Products</a>
                      <a href="#" className="hover:text-[#D9F24F] transition-colors">Contacts.</a>
                    </div>
                    {/* Contact & Location Block */}
                    <div className="w-full lg:w-[60%] grid grid-cols-1 md:grid-cols-2 gap-12 text-sm text-left lg:mr-auto">
                       <div className="space-y-4">
                         <h4 className="text-white text-base font-medium font-jakarta tracking-tight">Contact Us</h4>
                         <div className="space-y-2 text-[#D9F24F]/70 tabular-nums font-mono text-xs md:text-sm">
                           <p className="hover:text-white transition-colors cursor-pointer">+1 (999) 283-77-44</p>
                           <p className="hover:text-white transition-colors cursor-pointer font-sans text-sm">hello@Solvcompany.com</p>
                         </div>
                       </div>
                       <div className="space-y-4">
                         <h4 className="text-white text-base font-medium font-jakarta tracking-tight">Location</h4>
                         <div className="space-y-2 text-[#D9F24F]/70 tabular-nums font-sans">
                           <p>483920, Moscow,</p>
                           <p>Myasnitskaya 21/2/4, Office 13</p>
                         </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Bottom Row */}
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center sm:items-end gap-12 mt-20 pt-1 border-t border-[#D9F24F]/10 text-sm">
                 <div className="flex gap-4 pt-10">
                   <a href="#" aria-label="Facebook" className="w-12 h-12 bg-[#FDFCF8] text-[#1A2406] rounded-full flex items-center justify-center hover:scale-110 hover:-rotate-12 transition-all shadow-lg">
                     <Facebook fill="currentColor" className="w-5 h-5" />
                   </a>
                   <a href="#" aria-label="Instagram" className="w-12 h-12 bg-[#FDFCF8] text-[#1A2406] rounded-full flex items-center justify-center hover:scale-110 hover:rotate-12 transition-all shadow-lg">
                     <Instagram className="w-5 h-5" />
                   </a>
                   <a href="#" aria-label="Telegram" className="w-12 h-12 bg-[#FDFCF8] text-[#1A2406] rounded-full flex items-center justify-center hover:scale-110 hover:rotate-45 transition-all shadow-lg pl-0.5 pt-0.5">
                     <Send className="w-5 h-5" />
                   </a>
                 </div>

                 <div className="text-center space-y-1 opacity-70 flex-col flex leading-loose order-last md:order-none tabular-nums font-sans pt-10">
                    <span>© 2025 — Copyright</span>
                    <span>All Rights reserved</span>
                 </div>

                 <div className="flex flex-col md:items-end md:justify-end gap-3 text-white pt-10">
                    <span className="text-[#D9F24F]/70 text-xs text-center md:text-right w-full">Languages</span>
                    <div className="flex gap-4 text-base tracking-wide font-jakarta">
                      <button className="font-semibold text-white">En</button>
                      <button className="text-white/50 hover:text-white transition-colors">Es</button>
                      <button className="text-white/50 hover:text-white transition-colors">Fr</button>
                      <button className="text-white/50 hover:text-white transition-colors">De</button>
                      <button className="text-white/50 hover:text-white transition-colors">Ru</button>
                    </div>
                 </div>
              </div>

           </div>
        </footer>

      </div>
    </main>
  );
}
