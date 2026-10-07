import { useState } from 'react'
import { Sparkles, Zap, Layers, Rocket, CheckCircle2, ArrowRight } from 'lucide-react'

export default function App() {
  const [count, setCount] = useState(0)

  const features = [
    {
      icon: <Zap className="w-6 h-6 text-amber-400" />,
      title: 'Vite 6+ Bundler',
      description: 'Lightning-fast Hot Module Replacement (HMR) and instant server start.'
    },
    {
      icon: <Layers className="w-6 h-6 text-cyan-400" />,
      title: 'Tailwind CSS v4',
      description: 'Modern utility-first CSS framework configured via the official Vite plugin.'
    },
    {
      icon: <Rocket className="w-6 h-6 text-indigo-400" />,
      title: 'React 19 Ready',
      description: 'Modern declarative React with latest ecosystem support and hooks.'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-between p-6 sm:p-12 relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* Top Header */}
      <header className="w-full max-w-5xl flex items-center justify-between py-4 border-b border-slate-800/80 z-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            ⚡
          </div>
          <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            SSA Frontend
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Ready to build
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-4xl my-auto py-12 flex flex-col items-center text-center z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-slate-800/80 text-indigo-300 border border-indigo-500/30 mb-6 backdrop-blur-sm shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          React + Vite + Tailwind CSS Configured
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent leading-tight">
          Supercharge your <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Frontend Development
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mb-8 leading-relaxed">
          Your project is initialized with Vite, React, and Tailwind CSS. Start building modern, responsive, and blazing-fast user interfaces.
        </p>

        {/* Counter & Action CTA */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-14">
          <button
            onClick={() => setCount((prev) => prev + 1)}
            className="group px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all duration-200 active:scale-95 flex items-center gap-2.5 cursor-pointer"
          >
            <span>Interactive Counter:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-white/20 font-bold font-mono">
              {count}
            </span>
          </button>

          <a
            href="https://tailwindcss.com/docs"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white font-medium border border-slate-700 hover:border-slate-600 transition-all duration-200 flex items-center gap-2"
          >
            <span>Tailwind Docs</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </a>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full text-left">
          {features.map((item, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all duration-300 backdrop-blur-sm group hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-950/30"
            >
              <div className="p-3 rounded-xl bg-slate-800/70 w-fit mb-4 border border-slate-700/50 group-hover:scale-110 transition-transform duration-200">
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl py-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4 z-10">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Setup completed successfully</span>
        </div>
        <p>Edit <code className="text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">src/App.jsx</code> to build your application</p>
      </footer>
    </div>
  )
}
