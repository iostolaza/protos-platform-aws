const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  darkMode: 'class',  // Enables your .dark {} variables in styles.css
  theme: {
    extend: {
      // Optional: if you want to define colors as Tailwind theme (instead of only CSS vars)
      // colors: {
      //   primary: 'var(--primary)',
      //   // etc.
      // },
    },
  },
  plugins: [],
};
