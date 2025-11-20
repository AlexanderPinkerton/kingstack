export type FontOption = {
  id: string;
  label: string;
  fontFamily: string;
  cssPath?: string;
  className?: string;
};

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "geist",
    label: "Default (Geist)",
    fontFamily: "var(--font-geist-sans)",
  },
  {
    id: "aktura",
    label: "Aktura",
    fontFamily: "\"Aktura\", sans-serif",
    cssPath: "/fonts/Aktura_Complete/Fonts/WEB/css/aktura.css",
  },
  {
    id: "anton",
    label: "Anton",
    fontFamily: "\"Anton\", sans-serif",
    cssPath: "/fonts/Anton_Complete/Fonts/WEB/css/anton.css",
  },
  {
    id: "author",
    label: "Author",
    fontFamily: "\"Author\", sans-serif",
    cssPath: "/fonts/Author_Complete/Fonts/WEB/css/author.css",
  },
  {
    id: "azeret",
    label: "Azeret Mono",
    fontFamily: "\"AzeretMono\", monospace",
    cssPath: "/fonts/AzeretMono_Complete/Fonts/WEB/css/azeret-mono.css",
  },
  {
    id: "cabin",
    label: "Cabin",
    fontFamily: "\"Cabin\", sans-serif",
    cssPath: "/fonts/Cabin_Complete/Fonts/WEB/css/cabin.css",
  },
  {
    id: "cabinet-grotesk",
    label: "Cabinet Grotesk",
    fontFamily: "\"CabinetGrotesk\", sans-serif",
    cssPath: "/fonts/CabinetGrotesk_Complete/Fonts/WEB/css/cabinet-grotesk.css",
  },
  {
    id: "chillax",
    label: "Chillax",
    fontFamily: "\"Chillax\", sans-serif",
    cssPath: "/fonts/Chillax_Complete/Fonts/WEB/css/chillax.css",
  },
  {
    id: "chubbo",
    label: "Chubbo",
    fontFamily: "\"Chubbo\", sans-serif",
    cssPath: "/fonts/Chubbo_Complete/Fonts/WEB/css/chubbo.css",
  },
  {
    id: "clash",
    label: "Clash Display",
    fontFamily: "\"ClashDisplay\", sans-serif",
    cssPath: "/fonts/ClashDisplay_Complete/Fonts/WEB/css/clash-display.css",
  },
  {
    id: "crimson",
    label: "Crimson Pro",
    fontFamily: "\"CrimsonPro\", serif",
    cssPath: "/fonts/CrimsonPro_Complete/Fonts/WEB/css/crimson-pro.css",
  },
  {
    id: "epilogue",
    label: "Epilogue",
    fontFamily: "\"Epilogue\", sans-serif",
    cssPath: "/fonts/Epilogue_Complete/Fonts/WEB/css/epilogue.css",
  },
  {
    id: "excon",
    label: "Excon",
    fontFamily: "\"Excon\", sans-serif",
    cssPath: "/fonts/Excon_Complete/Fonts/WEB/css/excon.css",
  },
  {
    id: "expose",
    label: "Expose",
    fontFamily: "\"Expose\", sans-serif",
    cssPath: "/fonts/Expose_Complete/Fonts/WEB/css/expose.css",
  },
  {
    id: "gambarino",
    label: "Gambarino",
    fontFamily: "\"Gambarino\", serif",
    cssPath: "/fonts/Gambarino_Complete/Fonts/WEB/css/gambarino.css",
  },
  {
    id: "gambetta",
    label: "Gambetta",
    fontFamily: "\"Gambetta\", serif",
    cssPath: "/fonts/Gambetta_Complete/Fonts/WEB/css/gambetta.css",
  },
  {
    id: "jetbrains",
    label: "JetBrains Mono",
    fontFamily: "\"JetBrainsMono\", monospace",
    cssPath: "/fonts/JetBrainsMono_Complete/Fonts/WEB/css/jet-brains-mono.css",
  },
  {
    id: "literata",
    label: "Literata",
    fontFamily: "\"Literata\", serif",
    cssPath: "/fonts/Literata_Complete/Fonts/WEB/css/literata.css",
  },
  {
    id: "lora",
    label: "Lora",
    fontFamily: "\"Lora\", serif",
    cssPath: "/fonts/Lora_Complete/Fonts/WEB/css/lora.css",
  },
  {
    id: "neco",
    label: "Neco",
    fontFamily: "\"Neco\", sans-serif",
    cssPath: "/fonts/Neco_Complete/Fonts/WEB/css/neco.css",
  },
  {
    id: "new-title",
    label: "New Title",
    fontFamily: "\"NewTitle\", serif",
    cssPath: "/fonts/NewTitle_Complete/Fonts/WEB/css/new-title.css",
  },
  {
    id: "nunito",
    label: "Nunito",
    fontFamily: "\"Nunito\", sans-serif",
    cssPath: "/fonts/Nunito_Complete/Fonts/WEB/css/nunito.css",
  },
  {
    id: "oswald",
    label: "Oswald",
    fontFamily: "\"Oswald\", sans-serif",
    cssPath: "/fonts/Oswald_Complete/Fonts/WEB/css/oswald.css",
  },
  {
    id: "pally",
    label: "Pally",
    fontFamily: "\"Pally\", sans-serif",
    cssPath: "/fonts/Pally_Complete/Fonts/WEB/css/pally.css",
  },
  {
    id: "paquito",
    label: "Paquito",
    fontFamily: "\"Paquito\", sans-serif",
    cssPath: "/fonts/Paquito_Complete/Fonts/WEB/css/paquito.css",
  },
  {
    id: "pramukh-rounded",
    label: "Pramukh Rounded",
    fontFamily: "\"PramukhRounded\", sans-serif",
    cssPath: "/fonts/PramukhRounded_Complete/Fonts/WEB/css/pramukh-rounded.css",
  },
  {
    id: "ranade",
    label: "Ranade",
    fontFamily: "\"Ranade\", sans-serif",
    cssPath: "/fonts/Ranade_Complete/Fonts/WEB/css/ranade.css",
  },
  {
    id: "recia",
    label: "Recia",
    fontFamily: "\"Recia\", serif",
    cssPath: "/fonts/Recia_Complete/Fonts/WEB/css/recia.css",
  },
  {
    id: "roundo",
    label: "Roundo",
    fontFamily: "\"Roundo\", sans-serif",
    cssPath: "/fonts/Roundo_Complete/Fonts/WEB/css/roundo.css",
  },
  {
    id: "rowan",
    label: "Rowan",
    fontFamily: "\"Rowan\", serif",
    cssPath: "/fonts/Rowan_Complete/Fonts/WEB/css/rowan.css",
  },
  {
    id: "satoshi",
    label: "Satoshi",
    fontFamily: "\"Satoshi\", sans-serif",
    cssPath: "/fonts/Satoshi_Complete/Fonts/WEB/css/satoshi.css",
  },
  {
    id: "sentient",
    label: "Sentient",
    fontFamily: "\"Sentient\", serif",
    cssPath: "/fonts/Sentient_Complete/Fonts/WEB/css/sentient.css",
  },
  {
    id: "sora",
    label: "Sora",
    fontFamily: "\"Sora\", sans-serif",
    cssPath: "/fonts/Sora_Complete/Fonts/WEB/css/sora.css",
  },
  {
    id: "supreme",
    label: "Supreme",
    fontFamily: "\"Supreme\", sans-serif",
    cssPath: "/fonts/Supreme_Complete/Fonts/WEB/css/supreme.css",
  },
  {
    id: "switzer",
    label: "Switzer",
    fontFamily: "\"Switzer\", sans-serif",
    cssPath: "/fonts/Switzer_Complete/Fonts/WEB/css/switzer.css",
  },
  {
    id: "synonym",
    label: "Synonym",
    fontFamily: "\"Synonym\", sans-serif",
    cssPath: "/fonts/Synonym_Complete/Fonts/WEB/css/synonym.css",
  },
  {
    id: "tabular",
    label: "Tabular",
    fontFamily: "\"Tabular\", sans-serif",
    cssPath: "/fonts/Tabular_Complete/Fonts/WEB/css/tabular.css",
  },
  {
    id: "zodiak",
    label: "Zodiak",
    fontFamily: "\"Zodiak\", serif",
    cssPath: "/fonts/Zodiak_Complete/Fonts/WEB/css/zodiak.css",
  },
];

export const DEFAULT_FONT_ID = FONT_OPTIONS[0]?.id ?? "geist";

