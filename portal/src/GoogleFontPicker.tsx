import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { catalogFamilies } from '../functions/uat-font-catalog.mjs';
import { fonts, fontName, fontFamily, type Plan } from '../functions/uat-contract.mjs';
import { useGoogleFonts } from './google-fonts';

const rowHeight = 44;
const viewportHeight = rowHeight * 7;
const overscan = 2;

export function GoogleFontPicker({ value, onChange, plan, error }: {
  value: string;
  onChange: (id: string) => void;
  plan: Plan;
  error?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const choices = useMemo(() => {
    const aliases = new Set(fonts.map(f => f.name));
    return [
      ...fonts.filter(f => plan.fonts.includes(f.id)),
      ...(plan.fonts.includes('google-catalog')
        ? catalogFamilies.filter(n => !aliases.has(n)).map(name => ({
            id: 'google:' + name, name, family: fontFamily('google:' + name),
          }))
        : []),
    ];
  }, [plan.fonts]);
  const matches = useMemo(() => choices.filter(f =>
    f.name.toLowerCase().includes(query.trim().toLowerCase())), [choices, query]);
  const height = Math.min(viewportHeight, Math.max(1, matches.length) * rowHeight);
  const firstVisible = Math.max(0, Math.floor(scrollTop / rowHeight));
  const lastVisible = Math.min(matches.length, Math.ceil((scrollTop + height) / rowHeight));
  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(matches.length, lastVisible + overscan);
  const shown = matches.slice(start, end);
  useGoogleFonts(open ? matches.slice(firstVisible, lastVisible).map(f => f.id) : []);

  const scrollTo = (index: number) => {
    const element = list.current;
    if (!element) return;
    const top = index * rowHeight;
    const bottom = top + rowHeight;
    if (top < element.scrollTop) element.scrollTop = top;
    else if (bottom > element.scrollTop + element.clientHeight)
      element.scrollTop = bottom - element.clientHeight;
    setScrollTop(element.scrollTop);
  };
  useEffect(() => { if (open) scrollTo(active); }, [active, open]);
  const openChoices = () => {
    setQuery('');
    setActive(Math.max(0, choices.findIndex(f => f.id === value)));
    setOpen(true);
  };
  const close = () => { setOpen(false); setQuery(''); };
  const choose = (index: number) => {
    if (!matches[index]) return;
    onChange(matches[index].id);
    close();
    input.current?.focus();
  };
  const move = (index: number) => {
    const next = Math.max(0, Math.min(matches.length - 1, index));
    setActive(next);
    scrollTo(next);
  };
  const activeRendered = active >= start && active < end && !!matches[active];
  return <div className="uc-font-picker" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }}>
    <label htmlFor={id}>Font</label>
    <div className="uc-font-input">
      <input ref={input} id={id} role="combobox" aria-invalid={!!error}
        aria-describedby={error ? id + '-error' : id + '-help'}
        aria-autocomplete="list" aria-expanded={open} aria-controls={id + '-list'}
        aria-activedescendant={open && activeRendered ? id + '-' + active : undefined}
        value={open ? query : fontName(value)} placeholder="Search Google Fonts"
        onFocus={openChoices}
        onChange={event => {
          setQuery(event.target.value); setOpen(true); setActive(0); setScrollTop(0);
          if (list.current) list.current.scrollTop = 0;
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); close(); }
          else if (event.key === 'Enter' && open) { event.preventDefault(); choose(active); }
          else if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(event.key)) {
            event.preventDefault();
            if (!open) { openChoices(); return; }
            move(event.key === 'Home' ? 0 : event.key === 'End' ? matches.length - 1
              : active + (event.key === 'PageDown' ? 7 : event.key === 'PageUp' ? -7
                : event.key === 'ArrowDown' ? 1 : -1));
          }
        }} />
      <button type="button" aria-label="Show font choices" aria-expanded={open}
        onMouseDown={event => event.preventDefault()}
        onClick={() => { if (open) close(); else { input.current?.focus(); openChoices(); } }}>
        &#9662;
      </button>
    </div>
    {open && <>
      <ul ref={list} role="listbox" id={id + '-list'} aria-label="Google Fonts"
        className="uc-font-results" style={{ height }}
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
        {matches.length > 0 && <li role="presentation" aria-hidden="true"
          className="uc-font-spacer" style={{ height: matches.length * rowHeight }} />}
        {shown.map((font, offset) => {
          const index = start + offset;
          return <li role="option" aria-selected={font.id === value}
            aria-posinset={index + 1} aria-setsize={matches.length}
            id={id + '-' + index} key={font.id} data-active={index === active}
            className="uc-font-option"
            style={{ top: index * rowHeight, height: rowHeight, fontFamily: font.family }}
            onMouseDown={event => event.preventDefault()}
            onMouseEnter={() => setActive(index)} onClick={() => choose(index)}>{font.name}</li>;
        })}
        {!matches.length && <li role="presentation">No matching fonts</li>}
      </ul>
      <span className="sr-only" role="status">{matches.length} matching fonts.</span>
    </>}
    <p className="hint" id={id + '-help'}>Scroll to browse or type a font name.</p>
    {error && <p id={id + '-error'} role="alert" className="field-error">{error}</p>}
  </div>;
}
