// small inline icon set
const wrap=(body,extra='')=>`<svg viewBox="0 0 24 24" class="icon" aria-hidden="true" ${extra}>${body}</svg>`

export const ICONS={
  back:wrap('<path d="M15 5l-7 7 7 7"/>'),
  close:wrap('<path d="M6 6l12 12M18 6L6 18"/>'),
  more:wrap('<circle cx="5" cy="12" r="1.6" class="solid"/><circle cx="12" cy="12" r="1.6" class="solid"/><circle cx="19" cy="12" r="1.6" class="solid"/>'),
  undo:wrap('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>'),
  erase:wrap('<path d="M7 20h13"/><path d="M5.5 15.5l9-9a2 2 0 012.8 0l1.2 1.2a2 2 0 010 2.8L12 17H8z"/><path d="M9.5 11.5l4 4"/>'),
  notes:wrap('<path d="M4 20l1.2-4.6L16 4.6a2 2 0 012.8 0l.6.6a2 2 0 010 2.8L8.6 18.8z"/><path d="M14 7l3 3"/>'),
  hint:wrap('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0012 3z"/>'),
  pause:wrap('<path d="M9 6v12M15 6v12"/>'),
  play:wrap('<path d="M8 5.5v13l10-6.5z" class="solid"/>'),
  grid:wrap('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>'),
  calendar:wrap('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  chart:wrap('<path d="M5 20V11M12 20V5M19 20v-6"/>'),
  gear:wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  home:wrap('<path d="M4 11.5L12 4.5l8 7"/><path d="M6.5 10v9.5h11V10"/><path d="M10 19.5v-5h4v5"/>'),
  reset:wrap('<path d="M4.5 12a7.5 7.5 0 107.5-7.5c-2.3 0-4.3 1-5.7 2.6"/><path d="M5.8 3.8v3.6h3.6"/>'),
  help:wrap('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 014.8.9c0 1.8-2.4 2.2-2.4 3.8M12 17.2v.3"/>'),
  check:wrap('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  chevron:wrap('<path d="M9 5l7 7-7 7"/>'),
  info:wrap('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  flame:wrap('<path d="M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.4-2.4-5.6-3.7-7.6-.5 1.8-1.6 2.9-2.8 3.3C12.6 7.3 11 4.6 8.5 3c.3 3.1-3 5.6-3 10.5C5.5 18 8.3 21 12 21z"/>'),
  share:wrap('<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>'),
  upload:wrap('<path d="M12 3v12M7.5 10.5L12 15l4.5-4.5"/><path d="M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"/>')
}
