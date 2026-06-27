/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Scan both apps (relative to workspace root)
    "./admin/src/**/*.{html,ts,tsx}",
    "./portal/src/**/*.{html,ts,tsx}",
    // Add this later if you create shared libs
    // "./libs/**/*.{html,ts,tsx}",
  ],
  darkMode: 'class',  // Matches your .dark {} in styles.css
  theme: {
    extend: {
      // Optional: Define custom colors here (or keep using :root vars)
      // colors: {
      //   primary: 'var(--primary)',
      //   success: 'var(--success)',
      // },
      // You can extend fonts, spacing, etc. here too
    },
  },
  plugins: [
    // Add if needed (e.g., for forms or typography)
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/typography'),
  ],
}
