import Link from 'next/link';
import { ArrowRight, Eye, ShieldCheck, Activity } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20">

      {/* Navbar */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tighter">
          <Eye className="text-primary w-6 h-6" />
          <span>OptiRead</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="px-4 py-2 hover:text-primary transition-colors text-sm font-medium">Log In</Link>
          <Link href="/onboarding" className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-full text-sm font-medium transition-all shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)]">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-8 mt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-secondary text-xs font-medium text-muted-foreground animate-fade-in-up">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          AI-Powered Eye Protection
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
          Read Smarter in a <br />
          <span className="text-primary">Digital World.</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          The only PDF reader that looks after your eyes. Real-time posture correction, blink monitoring, and age-adapted breaks.
        </p>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <Link href="/onboarding" className="group h-12 px-8 rounded-full bg-primary text-primary-foreground font-semibold flex items-center gap-2 hover:scale-105 transition-transform">
            Start Reading Now
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <button className="h-12 px-8 rounded-full border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors font-medium">
            View Features
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-5xl w-full text-left">
          {[
            {
              icon: <Eye className="w-6 h-6 text-blue-400" />,
              title: "Smart Blink Tracking",
              desc: "Uses computer vision to ensure you blink enough to prevent dry eyes."
            },
            {
              icon: <Activity className="w-6 h-6 text-green-400" />,
              title: "Age-Adapted Breaks",
              desc: "Personalized break schedules based on your age group (Child, Adult, Senior)."
            },
            {
              icon: <ShieldCheck className="w-6 h-6 text-purple-400" />,
              title: "Posture Correction",
              desc: "Alerts you when you sit too close to the screen or slouch."
            }
          ].map((f, i) => (
            <div key={i} className="p-6 rounded-2xl bg-secondary/10 border border-white/5 hover:border-white/10 transition-colors hover:bg-secondary/20">
              <div className="mb-4 p-3 bg-background rounded-xl w-fit">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Reviews Section */}
        <div className="mt-32 w-full max-w-5xl text-left">
          <h2 className="text-3xl font-bold mb-10 text-center">What People Are Saying</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Sarah Chen",
                role: "Medical Student",
                content: "This app saved my eyes during finals week. The break reminders are actually smart, not just annoying timers."
              },
              {
                name: "James Wilson",
                role: "Software Engineer",
                content: "I love the dark mode automation. It detects when my room gets dark and adjusts the screen instantly."
              },
              {
                name: "Dr. Emily R.",
                role: "Optometrist",
                content: "Finally, a tool I can recommend to patients. The 20-20-20 rule implementation is perfect."
              }
            ].map((review, i) => (
              <div key={i} className="p-6 rounded-2xl bg-secondary/5 border border-white/5">
                <div className="flex gap-1 text-yellow-500 mb-4">
                  {[...Array(5)].map((_, i) => <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}
                </div>
                <p className="text-muted-foreground mb-4">"{review.content}"</p>
                <div>
                  <div className="font-semibold">{review.name}</div>
                  <div className="text-xs text-muted-foreground">{review.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="p-8 text-center text-sm text-muted-foreground border-t border-white/5 mt-20">
        © 2024 OptiRead. Built with Next.js & MediaPipe.
      </footer>
    </div>
  );
}
