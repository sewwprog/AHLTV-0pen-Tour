// Font options available for a tournament title.
// Every family is served locally from assets/fonts (see fonts.css), so the
// name keeps rendering even without a font CDN.
export const FONTS=[
  {key:"manrope",label:"Manrope",family:"Manrope",weight:800},
  {key:"oswald",label:"Oswald",family:"Oswald",weight:700},
  {key:"russo",label:"Russo One",family:"Russo One",weight:400},
  {key:"rubik",label:"Rubik",family:"Rubik",weight:800},
  {key:"montserrat",label:"Montserrat",family:"Montserrat",weight:800},
  {key:"unbounded",label:"Unbounded",family:"Unbounded",weight:800},
  {key:"comfortaa",label:"Comfortaa",family:"Comfortaa",weight:700}
];

export const FONT_BY_KEY=Object.fromEntries(FONTS.map(f=>[f.key,f]));
export const DEFAULT_FONT="manrope";

export function fontOf(key){
  return FONT_BY_KEY[key]||FONT_BY_KEY[DEFAULT_FONT];
}

export function fontFamily(key){
  return fontOf(key).family;
}

export function fontStack(key){
  const f=fontOf(key);
  return `"${f.family}",ui-sans-serif,system-ui,-apple-system,sans-serif`;
}

export function fontWeight(key){
  return fontOf(key).weight;
}

export function fontLabel(key){
  return fontOf(key).label;
}

// Inline style string used to render a tournament name in its chosen font.
export function fontCss(key){
  const f=fontOf(key);
  return `font-family:${fontStack(key)};font-weight:${f.weight}`;
}
