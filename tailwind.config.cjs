const colors = ['blue', 'purple', 'sky', 'rose', 'amber', 'cyan', 'emerald', 'teal', 'indigo', 'orange', 'slate', 'pink'];

module.exports = {
    content: ['./index.html', './js/**/*.js'],
    safelist: colors.flatMap((color) => [`bg-${color}-50`, `text-${color}-600`, `bg-${color}-100/50`]),
    theme: {
        extend: {
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'sans-serif'],
                handwriting: ['Reenie Beanie', 'cursive']
            },
            colors: {
                brand: {
                    blue: '#2563eb',
                    deepBlue: '#1e40af',
                    cyan: '#06b6d4',
                    amber: '#f59e0b',
                    orange: '#ff5722',
                    dark: '#0f172a'
                }
            },
            boxShadow: {
                glass: '0 8px 32px 0 rgba(31, 38, 135, 0.08)',
                'glass-hover': '0 12px 40px 0 rgba(37, 99, 235, 0.18)',
                glow: '0 0 25px rgba(37, 99, 235, 0.35)',
                'glow-orange': '0 0 25px rgba(245, 158, 11, 0.35)'
            }
        }
    },
    plugins: []
};
