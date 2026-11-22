// tiny pictures for each mode in the menus
const frame=(body)=>`<svg viewBox="0 0 40 40" class="glyph" aria-hidden="true"><rect x="4" y="4" width="32" height="32" rx="5" class="glyph-frame"/>${body}</svg>`
const lines='<path d="M14.7 4v32M25.3 4v32M4 14.7h32M4 25.3h32" class="glyph-thin"/>'
const text=(value,size=13,x=20,y=21)=>`<text x="${x}" y="${y}" class="glyph-text" style="font-size:${size}px">${value}</text>`

export const GLYPHS={
  classic:frame(lines+text('5',12,9.5,10.5)+text('3',12,30.5,30.5)),
  mini6:frame('<path d="M20 4v32M4 14.7h32M4 25.3h32" class="glyph-thin"/>'+text('6',12,12,10.5)),
  diagonal:frame(lines+'<path d="M6 6l28 28M34 6L6 34" class="glyph-accent"/>'),
  windoku:frame('<rect x="9" y="9" width="10" height="10" class="glyph-fill"/><rect x="21" y="21" width="10" height="10" class="glyph-fill"/><rect x="21" y="9" width="10" height="10" class="glyph-fill"/><rect x="9" y="21" width="10" height="10" class="glyph-fill"/>'+lines),
  jigsaw:frame('<path d="M4 15h8v6h10v-7h14M15 4v11M22 21v15M12 21v8H4M28 14v12h8" class="glyph-thick"/>'),
  disjoint:frame(lines+'<circle cx="9.4" cy="9.4" r="3" class="glyph-dot-a"/><circle cx="20" cy="9.4" r="3" class="glyph-dot-b"/><circle cx="9.4" cy="20" r="3" class="glyph-dot-b"/><circle cx="20" cy="20" r="3" class="glyph-dot-a"/><circle cx="30.6" cy="30.6" r="3" class="glyph-dot-a"/>'),
  killer:frame('<path d="M9 9h22v11H20v11H9z" class="glyph-dash"/>'+text('17',9,15,15.5)),
  sandwich:frame(text('1',11,10,21)+text('·',13,20,21)+text('9',11,30,21)+'<path d="M13 28h14" class="glyph-accent"/>'),
  arrow:frame('<circle cx="13" cy="13" r="6" class="glyph-thick"/><path d="M17.3 17.3L29 29M29 22v7h-7" class="glyph-thick"/>'),
  thermo:frame('<circle cx="12" cy="28" r="5.5" class="glyph-solid"/><path d="M12 28L28 12" class="glyph-thermo"/>'),
  kropki:frame('<path d="M20 4v32" class="glyph-thin"/><circle cx="20" cy="13" r="4" class="glyph-white"/><circle cx="20" cy="27" r="4" class="glyph-black"/>'),
  consecutive:frame('<path d="M20 4v32M4 20h32" class="glyph-thin"/><circle cx="20" cy="12" r="4" class="glyph-white"/><circle cx="28" cy="20" r="4" class="glyph-white"/>'),
  xv:frame(text('X',13,14,21)+text('V',13,27,21)),
  evenodd:frame('<rect x="8" y="8" width="11" height="11" rx="2" class="glyph-fill"/><circle cx="26.5" cy="26.5" r="6" class="glyph-fill"/>'),
  greater:frame('<path d="M23 13l-7 7 7 7" class="glyph-thick"/>'),
  antiknight:frame(text('♞',22,20,22)),
  antiking:frame(text('♚',22,20,22)),
  nonconsec:frame(text('4',12,12,21)+text('≠',11,20,21)+text('5',12,28,21)),
  calcudoku:frame('<path d="M20 4v32M4 20h32" class="glyph-thick"/>'+text('6+',9,12,13)+text('2÷',9,28,29)),
  futoshiki:frame('<path d="M20 4v32M4 20h32" class="glyph-thin"/><path d="M22.5 9l-5 3 5 3M9 22.5l3 5 3-5" class="glyph-thick"/>'),
  skyscrapers:frame('<path d="M9 31V20h6v11M17 31V11h6v20M25 31V16h6v15" class="glyph-thick"/>')
}
