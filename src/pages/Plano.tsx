import { useState } from 'react'

const GOLD = '#c9a84c'

export default function Plano() {
  const [zoom, setZoom] = useState(100)

  return (
    <div className="p-6 flex flex-col gap-5 max-w-7xl mx-auto" style={{ minHeight: 'calc(100vh - 64px)' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.max(25, z - 10))}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all text-lg leading-none">
            −
          </button>
          <span className="text-sm text-zinc-400 w-14 text-center" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(300, z + 10))}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all text-lg leading-none">
            +
          </button>
          <div className="w-px h-5 bg-zinc-800 mx-1" />
          <button onClick={() => setZoom(100)}
            className="px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all">
            Restablecer
          </button>
          <button onClick={() => setZoom(z => Math.min(300, Math.max(25, z)))}
            className="px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all">
            Ajustar pantalla
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 border border-zinc-800 hover:bg-zinc-800 transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            Cargar archivo
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ backgroundColor: GOLD, color: '#09090b' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e4c97a')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = GOLD)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
            Cargar plano
          </button>
        </div>
      </div>

      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex items-center justify-center relative" style={{ minHeight: 500 }}>
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(#c9a84c 1px, transparent 1px), linear-gradient(90deg, #c9a84c 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />

        <div className="text-center space-y-5 relative z-10 transition-all duration-200" style={{ transform: `scale(${zoom / 100})` }}>
          <div className="w-20 h-20 rounded-2xl border flex items-center justify-center mx-auto" style={{ backgroundColor: '#18181b', borderColor: '#27272a' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-500">Sin plano cargado</p>
            <p className="text-xs text-zinc-700 max-w-xs">Carga un archivo de imagen o PDF para visualizar el plano del establecimiento</p>
          </div>
          <div className="flex justify-center gap-3">
            <button className="px-4 py-2 text-sm font-medium rounded-lg border text-zinc-500 border-zinc-700 hover:text-zinc-200 hover:border-zinc-600 transition-all">
              Seleccionar PDF
            </button>
            <button className="px-4 py-2 text-sm font-medium rounded-lg border text-zinc-500 border-zinc-700 hover:text-zinc-200 hover:border-zinc-600 transition-all">
              Seleccionar imagen
            </button>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs text-zinc-700">
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>Zoom: {zoom}%</span>
          <span>·</span>
          <span>Sin archivo</span>
        </div>
      </div>
    </div>
  )
}
