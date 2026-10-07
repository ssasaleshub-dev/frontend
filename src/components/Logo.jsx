import ssaLogo from '../assets/logo.png'

export default function Logo({ className = "w-10 h-10", showText = true, textClassName = "text-xl font-bold tracking-tight text-white" }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src={ssaLogo}
        alt="SSA Logo"
        className={`rounded-xl object-contain shadow-md shadow-emerald-900/20 ${className}`}
      />
      {showText && (
        <span className={textClassName}>
          SSA
        </span>
      )}
    </div>
  )
}
