import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#9945FF",
        secondary: "#14F195",
        dark: "#000000",
        light: "#ffffff",
        gray: {
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
        },
      },
      fontFamily: {
        headline: ["var(--font-bricolage)", "sans-serif"],
        display: ["var(--font-bricolage)", "sans-serif"],
        epilogue: ["var(--font-bricolage)", "sans-serif"],
        body: ["var(--font-public-sans)", "sans-serif"],
        label: ["var(--font-bricolage)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0px",
        none: "0px",
        sm: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
        "2xl": "0px",
        "3xl": "0px",
        full: "9999px",
      },
      boxShadow: {
        brutal: "4px 4px 0px 0px rgba(0,0,0,1)",
        "brutal-sm": "2px 2px 0px 0px rgba(0,0,0,1)",
        "brutal-lg": "8px 8px 0px 0px rgba(0,0,0,1)",
        "brutal-purple": "8px 8px 0px 0px rgba(153,69,255,1)",
        "brutal-purple-sm": "6px 6px 0px 0px rgba(153,69,255,1)",
        "brutal-green": "4px 4px 0px 0px rgba(20,241,149,1)",
        "brutal-green-lg": "8px 8px 0px 0px rgba(20,241,149,1)",
        "brutal-white": "6px 6px 0px 0px rgba(255,255,255,1)",
        "brutal-white-lg": "8px 8px 0px 0px rgba(255,255,255,1)",
      },
      keyframes: {
        wordIn: {
          from: { opacity: "0", transform: "translateY(0.3em) rotate(-2deg)" },
          to: { opacity: "1", transform: "translateY(0) rotate(-2deg)" },
        },
        toastIn: {
          from: { opacity: "0", transform: "translateY(8px) translateX(8px)" },
          to: { opacity: "1", transform: "translateY(0) translateX(0)" },
        },
        toastOut: {
          from: { opacity: "1", transform: "translateY(0) translateX(0)" },
          to: { opacity: "0", transform: "translateY(8px) translateX(8px)" },
        },
        modalIn: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        scrimIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        drawerIn: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "word-in": "wordIn 360ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "toast-in": "toastIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "toast-out": "toastOut 180ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
        "modal-in": "modalIn 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "scrim-in": "scrimIn 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "drawer-in": "drawerIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
