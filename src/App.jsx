import { Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard.jsx';
import { ContactDetail } from './pages/ContactDetail.jsx';

export default function App() {
    return (
        <div className="min-h-screen bg-obsidian text-white selection:bg-lime selection:text-obsidian">
            {/* <header className="bg-slate-dark border-b border-white/5 shadow-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center">
          <h1 className="text-sm font-bold tracking-widest uppercase text-white">
            SLF <span className="text-gray-500 font-medium">Rolodex</span>
          </h1>
        </div>
      </header> */}

            <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/contact/:id" element={<ContactDetail />} />
                </Routes>
            </main>
        </div>
    );
}
