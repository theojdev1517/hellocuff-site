import { useEffect, useState, useId } from "react";
export function rgbToHex(rgb: number[]) {
  return (
    "#" +
    rgb
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function hexToHsl(hex: string) {
  const [r, g, b] = [1, 3, 5].map(
      (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
    ),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min,
    l = (max + min) / 2;
  let h = 0;
  if (d)
    h =
      (max === r
        ? (g - b) / d + (g < b ? 6 : 0)
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4) * 60;
  return { h, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
}
export function hslToHex(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2,
    values =
      h < 60
        ? [c, x, 0]
        : h < 120
          ? [x, c, 0]
          : h < 180
            ? [0, c, x]
            : h < 240
              ? [0, x, c]
              : h < 300
                ? [x, 0, c]
                : [c, 0, x];
  return rgbToHex(values.map((v) => (v + m) * 255));
}
export function hexToHsv(hex:string){const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d)h=(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60;return {h,s:max===0?0:d/max,v:max};}
export function hsvToHex(h:number,s:number,v:number){const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c,values=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return rgbToHex(values.map(n=>(n+m)*255));}
export function UatColorPicker({value,onChange}:{value:string;onChange:(v:string)=>void}){
 const [text,setText]=useState(value),[rgb,setRgb]=useState([1,3,5].map(i=>String(parseInt(value.slice(i,i+2),16)))),help=useId();useEffect(()=>{setText(value);setRgb([1,3,5].map(i=>String(parseInt(value.slice(i,i+2),16))));},[value]);const hsv=hexToHsv(value);
 const paint=(e:React.PointerEvent<HTMLDivElement>)=>{const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/(r.width/2),y=(e.clientY-r.top-r.height/2)/(r.height/2),h=(Math.atan2(x,-y)*180/Math.PI+360)%360,s=Math.min(1,Math.hypot(x,y));onChange(hsvToHex(h,s,hsv.v));};
 return <fieldset className="uc-picker"><legend>Custom color</legend><div className="uc-picker-visual"><div className="uc-color-wheel" role="slider" tabIndex={0} aria-label="Color hue and saturation" aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(hsv.h)} aria-valuetext={Math.round(hsv.h)+' degrees hue, '+Math.round(hsv.s*100)+' percent saturation'} aria-describedby={help} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);paint(e);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))paint(e);}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();onChange(hsvToHex((hsv.h+(e.key==='ArrowRight'?5:e.key==='ArrowLeft'?-5:0)+360)%360,Math.max(0,Math.min(1,hsv.s+(e.key==='ArrowUp'?.02:e.key==='ArrowDown'?-.02:0))),hsv.v));}}><i className="uc-wheel-shade" style={{opacity:1-hsv.v}}/><span style={{left:(50+Math.sin(hsv.h*Math.PI/180)*hsv.s*50)+'%',top:(50-Math.cos(hsv.h*Math.PI/180)*hsv.s*50)+'%'}}/></div><label className="uc-hue-label">Hue<input className="uc-hue" type="range" min="0" max="359" value={Math.round(hsv.h)} onChange={e=>onChange(hsvToHex(Number(e.target.value),hsv.s,hsv.v))}/></label></div><p className="hint" id={help}>Choose any hue in the wheel; the right slider adjusts hue. Keyboard: left/right change hue, up/down change saturation.</p><label className="uc-brightness">Brightness<input type="range" min="0" max="100" value={Math.round(hsv.v*100)} onChange={e=>onChange(hsvToHex(hsv.h,hsv.s,Number(e.target.value)/100))}/></label><label>HEX<input value={text} pattern="#[0-9a-fA-F]{6}" required onChange={e=>{setText(e.target.value);if(/^#[0-9a-fA-F]{6}$/.test(e.target.value))onChange(e.target.value);}}/></label><div className="uc-rgb">{['Red','Green','Blue'].map((label,i)=><label key={label}>{label}<input type="number" min="0" max="255" step="1" required value={rgb[i]} onChange={e=>{const next=rgb.map((v,n)=>i===n?e.target.value:v);setRgb(next);if(next.every(v=>/^\d{1,3}$/.test(v)&&Number(v)<=255))onChange(rgbToHex(next.map(Number)));}}/></label>)}</div></fieldset>;
}
