import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-poppins)', 'Poppins', 'sans-serif'],
        poppins: ['var(--font-poppins)', 'Poppins', 'sans-serif'],
      },
      colors: {
        brand: {
          50: "#f0f6fe",
          100: "#e0eefe",
          200: "#bae0fd",
          500: "#0284c7",
          600: "#0369a1",
          700: "#075985",
          800: "#0c4a6e",
          900: "#0a2540",
          950: "#061528",
        },
        whatsapp: {
          light: "#dcf8c6",
          DEFAULT: "#25d366",
          dark: "#128c7e",
          teal: "#075e54",
        },
      },
    },
  },
  plugins: [],
};
export default config;
