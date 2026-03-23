/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'obsidian': '#111312',
                'slate-dark': '#212621',
                'lime': '#C8F826',
                'lime-hover': '#A8D815',
                'danger': '#EF4444',
                // New bold colors
                'emerald': '#10B981',
                'neon-yellow': '#FDE047',
                'olive': '#A3E635',
            },
            fontFamily: {
                sans: ['Inter', 'SF Pro Display', 'Satoshi', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'pill': '999px',
                '4xl': '24px',
                '5xl': '32px',
            },
            boxShadow: {
                'card': '0 4px 24px rgba(0,0,0,0.4)',
                'card-hover': '0 8px 32px rgba(0,0,0,0.6)',
                'stat': '0 2px 8px rgba(0,0,0,0.2)',
                'heavy': '0 12px 48px rgba(0,0,0,0.8)',
            },
        },
    },
    plugins: [],
}
