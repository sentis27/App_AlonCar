import { useState } from 'react'

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-glassBg border border-glassBorder backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="flex gap-2">
            <span className="w-8 h-8 bg-secondary rounded-md"></span>
            <span className="w-8 h-8 bg-primary rounded-md"></span>
            <span className="w-8 h-8 bg-accent rounded-md"></span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Alon Car ERP</h1>
        <p className="text-slate-400 mb-8">Conectado exitosamente a Supabase.</p>
        
        <button className="w-full py-3 bg-gradient-to-r from-primary to-blue-500 text-slate-900 font-bold rounded-lg shadow-[0_0_15px_rgba(0,242,254,0.4)] hover:shadow-[0_0_25px_rgba(0,242,254,0.6)] transition-all">
          Comenzar Desarrollo
        </button>
      </div>
    </div>
  )
}

export default App
