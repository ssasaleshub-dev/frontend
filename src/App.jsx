import Logo from './components/Logo'
import logoImg from './assets/logo.png'

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <img
          src={logoImg}
          alt="SSA Brand Logo"
          className="w-32 h-32 rounded-3xl shadow-2xl shadow-emerald-500/20 hover:scale-105 transition-transform duration-300"
        />
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            SSA Frontend
          </h1>
          <p className="text-slate-400 text-sm">
            Brand logo integrated and ready across your React application.
          </p>
        </div>
      </div>
    </main>
  )
}
