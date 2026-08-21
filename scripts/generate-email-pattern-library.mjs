import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const outputDirectory = fileURLToPath(
  new URL("../public/email-patterns/", import.meta.url),
);

const patterns = [
  {
    id: "romantic-ribbon",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#FCECF3"/>
      <path d="M0 120C135 42 248 198 382 120S628 42 760 120s250 78 440 0" fill="none" stroke="#78A7E8" stroke-width="2" opacity=".58"/>
      <path d="M0 142C145 74 240 196 382 142s245-68 378 0 258 54 440 0" fill="none" stroke="#D9578C" stroke-width="1.5" opacity=".36"/>
      <g fill="none" stroke="#D9578C" stroke-width="2.2">
        <path d="M570 112c-20-25-56 7 0 48 56-41 20-73 0-48z"/>
        <path d="M630 112c-20-25-56 7 0 48 56-41 20-73 0-48z" opacity=".55"/>
      </g>
      <g fill="#78A7E8"><circle cx="505" cy="136" r="3"/><circle cx="695" cy="136" r="3"/><path d="M470 136l7-7 7 7-7 7z"/><path d="M716 136l7-7 7 7-7 7z"/></g>
    </svg>`,
  },
  {
    id: "botanical-herbarium",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#EEF3E8"/>
      <g fill="none" stroke="#416B50" stroke-linecap="round">
        <path d="M74 228C138 176 152 104 168 18M112 172c-30-38-56-36-76-26M132 132c28-39 58-42 84-35M150 86c-22-24-44-29-64-25" stroke-width="2.3" opacity=".76"/>
        <path d="M1126 228c-64-52-78-124-94-210m56 154c30-38 56-36 76-26m-96-14c-28-39-58-42-84-35m66-11c22-24 44-29 64-25" stroke-width="2.3" opacity=".76"/>
      </g>
      <g fill="#9AB58D" opacity=".72"><ellipse cx="88" cy="154" rx="23" ry="8" transform="rotate(25 88 154)"/><ellipse cx="185" cy="105" rx="25" ry="9" transform="rotate(-28 185 105)"/><ellipse cx="1112" cy="154" rx="23" ry="8" transform="rotate(-25 1112 154)"/><ellipse cx="1015" cy="105" rx="25" ry="9" transform="rotate(28 1015 105)"/></g>
      <path d="M420 120h360" stroke="#6B8065" stroke-width="1" opacity=".22"/>
      <circle cx="600" cy="120" r="19" fill="none" stroke="#416B50" stroke-width="1.5" opacity=".45"/><path d="M600 102c15 12 13 27 0 36-13-9-15-24 0-36z" fill="#6E9A72" opacity=".72"/>
    </svg>`,
  },
  {
    id: "quiet-luxury",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#151411"/>
      <g fill="none" stroke="#C9A45F" opacity=".72">
        <path d="M0 120h430m340 0h430"/><path d="M432 120c0-93 75-168 168-168s168 75 168 168-75 168-168 168-168-75-168-168z" stroke-width="1.5"/><path d="M486 120c0-63 51-114 114-114s114 51 114 114-51 114-114 114-114-51-114-114z"/>
        <path d="M600 65l17 38 41 4-31 27 9 40-36-21-36 21 9-40-31-27 41-4z" stroke-width="1.4"/>
      </g>
      <g fill="#C9A45F" opacity=".55"><circle cx="390" cy="120" r="3"/><circle cx="810" cy="120" r="3"/><circle cx="350" cy="120" r="1.5"/><circle cx="850" cy="120" r="1.5"/></g>
    </svg>`,
  },
  {
    id: "editorial-rules",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#F5F0E6"/>
      <g stroke="#26231F" opacity=".22"><path d="M70 44h1060M70 196h1060"/><path d="M152 44v152M1048 44v152"/></g>
      <path d="M152 96h385M663 144h385" stroke="#B64834" stroke-width="8"/>
      <path d="M152 122h280M768 118h280" stroke="#26231F" stroke-width="2" opacity=".72"/>
      <g fill="#B64834"><circle cx="600" cy="120" r="25"/><path d="M586 120h28M600 106v28" stroke="#F5F0E6" stroke-width="2"/></g>
    </svg>`,
  },
  {
    id: "water-ripples",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#EAF4F8"/>
      <g fill="none" stroke="#367E9E" opacity=".36">
        <path d="M-80 88c120-80 240 80 360 0s240 80 360 0 240 80 360 0 240 80 360 0" stroke-width="2"/>
        <path d="M-80 126c120-80 240 80 360 0s240 80 360 0 240 80 360 0 240 80 360 0"/>
        <path d="M-80 164c120-80 240 80 360 0s240 80 360 0 240 80 360 0 240 80 360 0" stroke-width="2"/>
      </g>
      <circle cx="600" cy="120" r="31" fill="#EAF4F8" stroke="#367E9E" stroke-width="1.5" opacity=".9"/><circle cx="600" cy="120" r="7" fill="#367E9E" opacity=".72"/>
    </svg>`,
  },
  {
    id: "terrazzo-studio",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#FFF8ED"/>
      <g opacity=".72"><path d="M90 58l42-12 22 35-31 29-43-18z" fill="#E16C52"/><path d="M246 162l36-21 33 21-9 41-46 5z" fill="#6D91C8"/><path d="M408 48l25 9-5 33-34 4-15-29z" fill="#E3B95D"/><path d="M770 163l38-27 34 20-8 45-46 5z" fill="#D95A85"/><path d="M1010 56l42-12 22 35-31 29-43-18z" fill="#6D91C8"/><circle cx="568" cy="171" r="18" fill="#5C8C78"/><circle cx="928" cy="152" r="12" fill="#E3B95D"/></g>
      <g fill="none" stroke="#3B3440" opacity=".26"><path d="M174 36l26 27-31 24"/><path d="M340 118l32 19-14 35"/><path d="M650 42l31 19-14 35"/><path d="M882 42l26 27-31 24"/><path d="M1110 137l32 19-14 35"/></g>
    </svg>`,
  },
  {
    id: "celebration-spark",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#FFF8E8"/>
      <g fill="#C7993D" opacity=".76"><path d="M120 68l8 20 20 8-20 8-8 20-8-20-20-8 20-8z"/><path d="M1080 68l8 20 20 8-20 8-8 20-8-20-20-8 20-8z"/><path d="M600 71l13 33 33 13-33 13-13 33-13-33-33-13 33-13z"/></g>
      <g fill="#D86D72" opacity=".65"><circle cx="240" cy="160" r="7"/><circle cx="960" cy="160" r="7"/><circle cx="405" cy="78" r="5"/><circle cx="795" cy="78" r="5"/></g>
      <path d="M180 120h300m240 0h300" stroke="#C7993D" stroke-width="1.5" opacity=".42"/>
    </svg>`,
  },
  {
    id: "moroccan-arches",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#F5E8D6"/>
      <defs><pattern id="p" width="120" height="120" patternUnits="userSpaceOnUse"><path d="M0 60Q30 0 60 60Q90 0 120 60Q90 120 60 60Q30 120 0 60z" fill="none" stroke="#A65E48" stroke-width="1.4" opacity=".5"/><circle cx="60" cy="60" r="5" fill="#315F70" opacity=".54"/></pattern></defs>
      <rect width="1200" height="240" fill="url(#p)"/>
      <rect x="475" y="43" width="250" height="154" rx="77" fill="#F5E8D6" stroke="#A65E48" stroke-width="2"/>
      <path d="M540 120h120" stroke="#315F70" stroke-width="2"/><circle cx="600" cy="120" r="13" fill="none" stroke="#A65E48" stroke-width="2"/>
    </svg>`,
  },
  {
    id: "topographic-lines",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#F0EEE9"/>
      <g fill="none" stroke="#55635E" opacity=".3"><path d="M-40 82c120-110 238 98 360-6s241 101 360-4 240 89 360-8 176-6 240 21"/><path d="M-60 112c124-110 242 98 364-6s241 101 360-4 240 89 360-8 176-6 240 21"/><path d="M-80 143c128-110 246 98 368-6s241 101 360-4 240 89 360-8 176-6 240 21"/><path d="M-100 174c132-110 250 98 372-6s241 101 360-4 240 89 360-8 176-6 240 21"/></g>
      <circle cx="600" cy="120" r="35" fill="#F0EEE9" stroke="#55635E" opacity=".88"/><circle cx="600" cy="120" r="9" fill="#BF6B4E"/>
    </svg>`,
  },
  {
    id: "signal-grid",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#10233B"/>
      <defs><pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0v48" fill="none" stroke="#72C9D6" stroke-width="1" opacity=".13"/></pattern></defs><rect width="1200" height="240" fill="url(#g)"/>
      <path d="M90 120h230l50-54 73 108 75-87 70 61 70-28h452" fill="none" stroke="#72C9D6" stroke-width="2.2" opacity=".72"/>
      <g fill="#EA5AA1"><circle cx="370" cy="66" r="6"/><circle cx="518" cy="87" r="6"/><circle cx="658" cy="120" r="6"/></g><circle cx="600" cy="120" r="29" fill="#10233B" stroke="#72C9D6" stroke-width="1.5"/>
    </svg>`,
  },
  {
    id: "paper-grain",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#F7F3EA"/>
      <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="8"/><feColorMatrix values="0 0 0 0 .20 0 0 0 0 .18 0 0 0 0 .15 0 0 0 .14 0"/></filter><rect width="1200" height="240" filter="url(#n)" opacity=".32"/>
      <path d="M110 120h400m180 0h400" stroke="#4A4339" opacity=".3"/><path d="M600 91l29 29-29 29-29-29z" fill="none" stroke="#8F4E3E" stroke-width="1.6"/><circle cx="600" cy="120" r="4" fill="#8F4E3E"/>
    </svg>`,
  },
  {
    id: "gallery-orbit",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240">
      <rect width="1200" height="240" fill="#F2EEFA"/>
      <g fill="none" stroke="#7357C7" opacity=".38"><ellipse cx="600" cy="120" rx="330" ry="72"/><ellipse cx="600" cy="120" rx="210" ry="105" transform="rotate(-12 600 120)"/><ellipse cx="600" cy="120" rx="100" ry="56" transform="rotate(22 600 120)"/></g>
      <g fill="#D7548C"><circle cx="272" cy="120" r="6"/><circle cx="704" cy="32" r="5"/><circle cx="642" cy="171" r="7"/></g><path d="M600 92l12 16 20 1-12 16 5 19-19-6-17 11 1-20-15-13 20-5z" fill="#7357C7" opacity=".72"/>
    </svg>`,
  },
];

await mkdir(outputDirectory, { recursive: true });
for (const pattern of patterns) {
  await sharp(Buffer.from(pattern.svg))
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toFile(`${outputDirectory}/${pattern.id}.jpg`);
}

console.log(`Generated ${patterns.length} email patterns in ${outputDirectory}`);
