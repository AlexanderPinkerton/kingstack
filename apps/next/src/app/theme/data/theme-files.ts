export type ThemeFile = {
  id: string;
  className: string;
  label: string;
  fileName: string;
  description: string;
};

export const THEME_FILES: ThemeFile[] = [
  {
    id: "island-light",
    className: "theme-island-light",
    label: "Island Light",
    fileName: "island_light.css",
    description: "Tropical blues and corals for bright, airy workspaces.",
  },
  {
    id: "british-phone-booth",
    className: "theme-british-phone-booth",
    label: "British Phone Booth",
    fileName: "british_phone_booth.css",
    description: "Signal-red primaries accented with mint and teal highlights.",
  },
  {
    id: "adonis-rose-yellow",
    className: "theme-adonis-rose-yellow",
    label: "Adonis Rose Yellow",
    fileName: "adonis_rose_yellow.css",
    description: "Sunlit rose gold with powder-blue accents and porcelain surfaces.",
  },
  {
    id: "spectral-green",
    className: "theme-spectral-green",
    label: "Spectral Green",
    fileName: "spectral_green.css",
    description: "Deep emerald primaries paired with blush neutrals and stark contrasts.",
  },
  {
    id: "sky-dancer",
    className: "theme-sky-dancer",
    label: "Sky Dancer",
    fileName: "sky_dancer.css",
    description: "Azure gradients with apricot supports inspired by crisp alpine skies.",
  },
  {
    id: "yellow",
    className: "theme-yellow",
    label: "Sunburst Yellow",
    fileName: "yellow.css",
    description: "Bold citrus primaries paired with electric violets.",
  },
  {
    id: "apricot-buff",
    className: "theme-apricot-buff",
    label: "Apricot Buff",
    fileName: "apricot_buff.css",
    description: "Warm apricot primaries with arctic blues and porcelain whites.",
  },
  {
    id: "apocalyptic-orange",
    className: "theme-apocalyptic-orange",
    label: "Apocalyptic Orange",
    fileName: "apocalyptic_orange.css",
    description: "Blazing oranges with arctic support tones for high-drama surfaces.",
  },
  {
    id: "maya-blue",
    className: "theme-maya-blue",
    label: "Maya Blue",
    fileName: "maya_blue.css",
    description: "Airy blues with sun-bleached neutrals reminiscent of coastal mornings.",
  },
  {
    id: "miami-coral",
    className: "theme-miami-coral",
    label: "Miami Coral",
    fileName: "miami_coral.css",
    description: "Vibrant coral gradients with muted sand and gold support tones.",
  },
  {
    id: "jade-glass",
    className: "theme-jade-glass",
    label: "Jade Glass",
    fileName: "jade_glass.css",
    description: "Translucent jade primaries with smoky neutrals and minimalist contrast.",
  },
  {
    id: "james-blonde",
    className: "theme-james-blonde",
    label: "James Blonde",
    fileName: "james_blonde.css",
    description: "Champagne gold base tones with moody mauves for playful luxury.",
  },
  {
    id: "crystal-green",
    className: "theme-crystal-green",
    label: "Crystal Green",
    fileName: "crystal_green.css",
    description: "Glassy verdant hues with deep forest anchors and luminous surfaces.",
  },
  {
    id: "cyan-sky",
    className: "theme-cyan-sky",
    label: "Cyan Sky",
    fileName: "cyan_sky.css",
    description: "Electric cyan primaries with warm amber neutrals inspired by tropical sunrises.",
  },
  {
    id: "koopa-green-shell",
    className: "theme-koopa-green-shell",
    label: "Koopa Green Shell",
    fileName: "koopa_green_shell.css",
    description: "Playful mint primaries with warm coral support inspired by retro game palettes.",
  },
  {
    id: "thuja-green",
    className: "theme-thuja-green",
    label: "Thuja Green",
    fileName: "thuja_green.css",
    description: "Deep evergreen primaries paired with terracotta accents and lavender lights.",
  },
  {
    id: "celtic-queen",
    className: "theme-celtic-queen",
    label: "Celtic Queen",
    fileName: "celtic_queen.css",
    description: "Emerald primaries with sea-glass blues and moody teals for regal dashboards.",
  },
  {
    id: "pinkman",
    className: "theme-pinkman",
    label: "Pinkman",
    fileName: "pinkman.css",
    description: "High-energy magenta primaries with golden highlights and teal supports.",
  },
  {
    id: "if-i-could-fly",
    className: "theme-if-i-could-fly",
    label: "If I Could Fly",
    fileName: "if_i_could_fly.css",
    description: "Violet primaries with blush highlights and eucalyptus greens for dreamy apps.",
  },
  {
    id: "crop-circle",
    className: "theme-crop-circle",
    label: "Crop Circle",
    fileName: "crop_circle.css",
    description: "Golden primaries with teal shadows for organic editorial layouts.",
  },
  {
    id: "apricot-sorbet",
    className: "theme-apricot-sorbet",
    label: "Apricot Sorbet",
    fileName: "apricot_sorbet.css",
    description: "Sun-baked apricot gradients with deep amber accents and cocoa neutrals.",
  },
  {
    id: "mesa-sunrise",
    className: "theme-mesa-sunrise",
    label: "Mesa Sunrise",
    fileName: "mesa_sunrise.css",
    description: "Earthy canyon primaries with smoldering reds for desert-inspired dashboards.",
  },
  {
    id: "fountain",
    className: "theme-fountain",
    label: "Fountain",
    fileName: "fountain.css",
    description: "Spa blues with blush undertones for serene, watery interfaces.",
  },
];

export const DEFAULT_THEME_CLASS = THEME_FILES[0]?.className ?? "";

