import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
// Original, transparent vector artwork. PNG delivery keeps the same appearance in email clients.
const drawings = {
  lock: '<path d="M32 44V31a16 16 0 0 1 32 0v13" fill="none" stroke="url(#cool)" stroke-width="9"/><rect x="22" y="39" width="52" height="43" rx="11" fill="url(#warm)"/><circle cx="48" cy="58" r="5" fill="#49389d"/><path d="M48 60v9" stroke="#49389d" stroke-width="5" stroke-linecap="round"/>',
  shield: '<path d="M48 10 79 23v24c0 21-20 34-31 40-11-6-31-19-31-40V23z" fill="url(#cool)"/><path d="m32 47 11 12 22-26" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
  lightning: '<path d="M55 7 17 54h28l-5 35 40-52H52z" fill="url(#warm)" stroke="#efab32" stroke-width="2" stroke-linejoin="round"/>',
  people: '<circle cx="64" cy="29" r="14" fill="url(#violet)"/><path d="M43 79V65a21 21 0 0 1 42 0v14z" fill="url(#violet)"/><circle cx="34" cy="28" r="17" fill="url(#cool)"/><path d="M9 81V64a25 25 0 0 1 50 0v17z" fill="url(#cool)"/>',
  chart: '<path d="M12 12v70h73" fill="none" stroke="#849fce" stroke-width="5" stroke-linecap="round"/><rect x="23" y="49" width="14" height="29" rx="4" fill="url(#cool)"/><rect x="44" y="33" width="14" height="45" rx="4" fill="url(#violet)"/><rect x="65" y="15" width="14" height="63" rx="4" fill="url(#green)"/>',
  pie: '<path d="M43 17a33 33 0 1 0 36 36H43z" fill="url(#cool)"/><path d="M51 9v36h36A36 36 0 0 0 51 9" fill="url(#violet)"/>',
  rocket: '<path d="m30 61-8 20 21-8" fill="url(#warm)"/><path d="M38 28 16 38l-5 22 21-5M65 57 58 80l-22 5 5-23" fill="url(#violet)"/><path d="M30 54C41 19 69 8 85 10c2 19-13 47-43 59z" fill="url(#cool)"/><circle cx="62" cy="32" r="9" fill="#f0f8ff"/>',
  target: '<circle cx="46" cy="51" r="34" fill="url(#violet)"/><circle cx="46" cy="51" r="23" fill="#e9e5ff"/><circle cx="46" cy="51" r="13" fill="url(#violet)"/><path d="m46 51 32-34m-1-10v13h13" fill="none" stroke="#35c8cc" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
  calendar: '<rect x="13" y="19" width="70" height="64" rx="11" fill="url(#cool)"/><path d="M13 40h70" stroke="#ebf4ff" stroke-width="4"/><path d="M31 12v16m34-16v16" stroke="#7860d7" stroke-width="7" stroke-linecap="round"/><path d="m31 60 11 10 23-20" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="48" cy="48" r="36" fill="url(#cool)"/><circle cx="48" cy="48" r="28" fill="#eff7ff"/><path d="M48 26v23l16 10" fill="none" stroke="#6661d5" stroke-width="6" stroke-linecap="round"/><circle cx="48" cy="48" r="5" fill="#6661d5"/>',
  check: '<circle cx="48" cy="48" r="36" fill="url(#green)"/><path d="m29 48 13 14 26-30" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path d="m48 8 12 25 28 4-20 20 5 29-25-14-25 14 5-29L8 37l28-4z" fill="url(#warm)" stroke="#efa737" stroke-width="2" stroke-linejoin="round"/>',
  gift: '<rect x="17" y="40" width="62" height="43" rx="6" fill="url(#violet)"/><rect x="12" y="30" width="72" height="18" rx="5" fill="url(#cool)"/><path d="M48 32c-30-1-32-28-13-20 8 3 13 20 13 20s6-17 14-20c19-8 17 19-14 20Z" fill="none" stroke="#f8bd51" stroke-width="6"/><path d="M48 33v50" stroke="#ffd47e" stroke-width="9"/>',
  mail: '<rect x="9" y="22" width="78" height="54" rx="11" fill="url(#cool)"/><path d="m13 28 35 27 35-27M14 70l23-22m45 22L59 48" fill="none" stroke="#e1f2ff" stroke-width="4" stroke-linejoin="round"/>',
  phone: '<rect x="25" y="9" width="46" height="78" rx="10" fill="url(#violet)"/><rect x="31" y="19" width="34" height="50" rx="4" fill="url(#cool)"/><path d="M43 77h10" stroke="#e4deff" stroke-width="4" stroke-linecap="round"/>',
  book: '<path d="M10 18c17-3 29 0 38 9 9-9 21-12 38-9v58c-17-3-29 0-38 9-9-9-21-12-38-9z" fill="url(#cool)"/><path d="M48 27v58" stroke="#ece7ff" stroke-width="4"/><path d="m20 32 17 4m-17 9 17 4m22-13 17-4M59 49l17-4" stroke="#e0f5ff" stroke-width="4" stroke-linecap="round"/>',
  briefcase: '<path d="M33 28V16h30v12" fill="none" stroke="#8d79d9" stroke-width="7" stroke-linejoin="round"/><rect x="9" y="28" width="78" height="55" rx="10" fill="url(#cool)"/><path d="M9 47c19 13 59 13 78 0" fill="none" stroke="#b0d5fc" stroke-width="4"/><rect x="40" y="47" width="16" height="16" rx="4" fill="url(#warm)"/>',
  sparkle: '<path d="M43 13c4 23 11 29 31 33-22 4-28 11-31 35-4-23-11-30-33-35 22-4 29-10 33-33" fill="url(#violet)"/><path d="M77 7c2 10 5 13 13 15-9 2-12 5-13 15-2-10-5-13-14-15 9-2 12-5 14-15M77 65c1 7 3 9 9 10-6 1-8 3-9 10-1-7-3-9-9-10 6-1 8-3 9-10" fill="url(#warm)"/>',
};
await mkdir('public/email-icons', {recursive:true});
for (const [id, drawing] of Object.entries(drawings)) {
 const defs=Object.entries({cool:['#64dcf3','#397ae4'],violet:['#be9bff','#7450df'],warm:['#ffe49a','#ffab36'],green:['#7ce9ba','#1bb396']}).map(([id,colors])=>`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient>`).join('');
 await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 96 96"><defs>${defs}</defs>${drawing}</svg>`)).png().toFile(`public/email-icons/${id}.png`);
}
console.log(`Generated ${Object.keys(drawings).length} transparent email icons`);
