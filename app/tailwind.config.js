/**
 * The palette is driven by CSS custom properties (see src/index.css) so light and dark
 * are one source of truth, and a fork can rebrand by editing variables rather than
 * hunting Tailwind classes. `darkMode: "class"` lets the theme toggle stamp the root
 * element; the initial value still follows the OS preference.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        raised: "rgb(var(--raised) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-ink": "rgb(var(--accent-ink) / <alpha-value>)",
        added: "rgb(var(--added) / <alpha-value>)",
        removed: "rgb(var(--removed) / <alpha-value>)",
        vacated: "rgb(var(--vacated) / <alpha-value>)",
      },
      fontFamily: {
        // System stacks only — no webfont fetches, so the site loads fully offline and
        // on locked-down machines that block external requests.
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      maxWidth: {
        reading: "68ch", // comfortable measure for dense specification prose
      },
    },
  },
  plugins: [],
};
