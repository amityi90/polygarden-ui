import { Link } from 'react-router-dom'

// ─── Static data ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    title: 'Define Your Field',
    body: 'Enter the length and width of your field in metres, and provide your latitude (north coordinate). The tool uses this to compute shadow angles from the sun.',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="24" height="24" rx="2" />
        <path d="M4 12h24M12 12v16" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'Choose Your Plants',
    body: 'Browse the plant catalogue and select species you want to grow. Companion plants are grouped automatically — the system knows which plants benefit each other.',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 28V14" />
        <path d="M8 20c0-6 4.5-10 8-10 3.5 0 8 4 8 10" />
        <path d="M10 24c2-3 4-4 6-4" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Configure Your Solar System',
    body: 'Set the PV production (kW), battery size (kWh) and panel height (m). The planner validates your input against the calculated min/max range for your field size.',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 10l4-6h12l4 6-4 6H10z" />
        <path d="M16 16v10M12 26h8" />
      </svg>
    ),
  },
  {
    n: '04',
    title: 'Explore & Download',
    body: 'An interactive canvas shows every plant circle, solar row, shadow zone and tractor path. Hover any element for details, then download the full PDF layout for the field.',
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="24" height="24" rx="2" />
        <circle cx="12" cy="14" r="3" />
        <circle cx="21" cy="18" r="2" />
        <circle cx="17" cy="10" r="2" />
      </svg>
    ),
  },
]

const STATS = [
  { label: 'Higher land-use efficiency', value: 60, suffix: '% more', detail: 'Land Equivalent Ratio (LER) above 1.5 — the same land produces both food and electricity.' },
  { label: 'Water savings under panels', value: 30, suffix: '% less', detail: 'Shade from PV panels reduces soil evaporation and crop water demand.' },
  { label: 'Yield boost for shade crops', value: 20, suffix: '% gain', detail: 'Leafy greens, herbs and root vegetables thrive under partial shade.' },
  { label: 'CO₂ avoided per hectare/yr', value: 75, suffix: 't CO₂', detail: 'Combined renewable energy output and avoided synthetic fertiliser use.' },
]

const BENEFITS = [
  {
    title: 'Dual Income Stream',
    body: 'Farmers earn from crop sales and feed-in electricity tariffs on the same parcel — increasing financial resilience against volatile commodity prices.',
    color: '#c9a84c',
  },
  {
    title: 'Food System Resilience',
    body: 'Agrivoltaic fields diversify local food production and reduce dependency on long supply chains, supporting regional food security.',
    color: '#4caf7d',
  },
  {
    title: 'Biodiversity & Soil Health',
    body: 'Companion planting attracts pollinators, suppresses pests naturally and builds organic matter in the soil — reducing need for pesticides and fertilisers.',
    color: '#7a9cbf',
  },
  {
    title: 'Climate Mitigation',
    body: 'Each agrivoltaic hectare generates clean electricity while sequestering carbon through living root systems and perennial plants throughout the year.',
    color: '#b07ab0',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs tracking-widest text-[#c9a84c] uppercase mb-3">{children}</p>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-['Cormorant_Garant'] text-4xl font-semibold text-[#f0ece3] leading-tight mb-4">
      {children}
    </h2>
  )
}

// Cross-section SVG of the agrivoltaic field
function CrossSection() {
  return (
    <svg viewBox="0 0 600 220" className="w-full max-w-2xl" aria-label="Cross-section of an agrivoltaic field">
      {/* Sky gradient */}
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0a1a" />
          <stop offset="100%" stopColor="#1a1a2e" />
        </linearGradient>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a1f10" />
          <stop offset="100%" stopColor="#1a1208" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="600" height="220" fill="url(#sky)" rx="12" />

      {/* Sun */}
      <circle cx="560" cy="35" r="18" fill="#c9a84c" opacity="0.9" />
      {[0,45,90,135,180,225,270,315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        return (
          <line key={i}
            x1={560 + 22 * Math.cos(rad)} y1={35 + 22 * Math.sin(rad)}
            x2={560 + 30 * Math.cos(rad)} y2={35 + 30 * Math.sin(rad)}
            stroke="#c9a84c" strokeWidth="2" opacity="0.7"
          />
        )
      })}
      <text x="560" y="70" textAnchor="middle" fill="#c9a84c" fontSize="10" opacity="0.8">Sun</text>

      {/* Soil */}
      <rect x="0" y="175" width="600" height="45" fill="url(#soil)" rx="0" />
      <rect x="0" y="175" width="600" height="2" fill="#3a2a18" />

      {/* Ground labels */}
      <text x="300" y="195" textAnchor="middle" fill="#6b5030" fontSize="9" letterSpacing="3">SOIL  ·  ROOT ZONE  ·  IRRIGATION</text>

      {/* PV Panels — 3 panels */}
      {[80, 260, 440].map((x, i) => (
        <g key={i}>
          {/* Post */}
          <rect x={x + 52} y={105} width="6" height="70" fill="#3a3a4a" rx="1" />
          {/* Panel face */}
          <rect x={x} y={70} width="110" height="38" rx="3" fill="#1a2a4a" stroke="#2a4a8a" strokeWidth="1.5" />
          {/* Panel cells */}
          {[0,1,2,3].map(col =>
            [0,1].map(row => (
              <rect key={`${col}-${row}`}
                x={x + 6 + col * 26} y={74 + row * 15}
                width="22" height="12" rx="1"
                fill="#1e3a6e" stroke="#2a5aa0" strokeWidth="0.5"
              />
            ))
          )}
          <text x={x + 55} y={120} textAnchor="middle" fill="#c9a84c" fontSize="8" opacity="0.9">PV Panel</text>
        </g>
      ))}

      {/* Shadow zones */}
      <polygon points="80,108 190,108 150,175 40,175" fill="#1a3a6a" opacity="0.25" />
      <polygon points="260,108 370,108 330,175 220,175" fill="#1a3a6a" opacity="0.25" />
      <polygon points="440,108 550,108 510,175 400,175" fill="#1a3a6a" opacity="0.25" />

      {/* Plants in shadow zones */}
      {/* Shade plants (leafy) */}
      {[60, 100, 140, 240, 280, 320, 420, 460, 500].map((x, i) => (
        <g key={i}>
          {/* Stem */}
          <line x1={x} y1={175} x2={x} y2={155} stroke="#2d6a3f" strokeWidth="1.5" />
          {/* Leaf cluster */}
          <ellipse cx={x} cy={150} rx={7} ry={5} fill="#3a8a50" opacity="0.9" />
          <ellipse cx={x - 5} cy={155} rx={5} ry={4} fill="#2d6a3f" opacity="0.8" />
          <ellipse cx={x + 5} cy={155} rx={5} ry={4} fill="#2d6a3f" opacity="0.8" />
        </g>
      ))}

      {/* Sun plants in gaps */}
      {[205, 385].map((x, i) => (
        <g key={i}>
          <line x1={x} y1={175} x2={x} y2={142} stroke="#4a7a30" strokeWidth="1.5" />
          <ellipse cx={x} cy={136} rx={9} ry={7} fill="#5a9a40" opacity="0.9" />
          {/* Sunflower-like */}
          {[0,60,120,180,240,300].map((deg, j) => {
            const rad = (deg * Math.PI) / 180
            return (
              <ellipse key={j}
                cx={x + 13 * Math.cos(rad)} cy={136 + 13 * Math.sin(rad)}
                rx={4} ry={3}
                fill="#c9a84c" opacity="0.6"
                transform={`rotate(${deg}, ${x + 13 * Math.cos(rad)}, ${136 + 13 * Math.sin(rad)})`}
              />
            )
          })}
          <circle cx={x} cy={136} r={5} fill="#e0a020" opacity="0.9" />
        </g>
      ))}

      {/* Tractor path arrows */}
      {[195, 375].map((x, i) => (
        <g key={i}>
          <rect x={x - 15} y={162} width="30" height="13" rx="2" fill="#1a1a1a" opacity="0.6" stroke="#3a3a3a" strokeWidth="0.5" />
          <text x={x} y={172} textAnchor="middle" fill="#666" fontSize="7">path</text>
        </g>
      ))}

      {/* Labels */}
      <text x="135" y="58" textAnchor="middle" fill="#7a9cbf" fontSize="9">Shadow Zone</text>
      <text x="300" y="58" textAnchor="middle" fill="#9a9080" fontSize="9">Sun Gap</text>

      {/* Sun rays to panels */}
      <line x1="548" y1="43" x2="460" y2="82" stroke="#c9a84c" strokeWidth="1" strokeDasharray="4,3" opacity="0.4" />
      <line x1="550" y1="46" x2="280" y2="82" stroke="#c9a84c" strokeWidth="1" strokeDasharray="4,3" opacity="0.3" />
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AboutPage() {
  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-6 py-16 gap-24">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-5 max-w-2xl">
        <SectionLabel>About PolyGarden</SectionLabel>
        <SectionHeading>
          Where food and energy <span className="text-[#c9a84c]">grow together.</span>
        </SectionHeading>
        <p className="text-[#9a9080] text-base leading-relaxed">
          PolyGarden is a free agrivoltaic field planner that helps farmers, gardeners and
          researchers design fields where solar panels and crops share the same land —
          producing clean energy <em>and</em> food at the same time.
        </p>
      </section>

      {/* ── How to use ───────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>How to Use</SectionLabel>
        <SectionHeading>Four steps to your layout</SectionHeading>
        <p className="text-[#9a9080] text-sm leading-relaxed max-w-xl mb-10">
          The planner guides you through a short wizard. Each step builds on the previous one —
          you can go back at any time to adjust.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {STEPS.map((step, i) => (
            <div key={i} className="rounded-2xl border border-white/8 bg-[#0d0d0d] p-6 flex gap-4 group hover:border-[#c9a84c]/30 transition-colors">
              {/* Number badge */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full border border-[#c9a84c]/30 bg-[#c9a84c]/8 flex items-center justify-center">
                <span className="text-[#c9a84c] text-xs font-semibold tracking-widest">{step.n}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[#c9a84c]">{step.icon}</div>
                <h3 className="text-sm font-semibold text-[#f0ece3] tracking-wide">{step.title}</h3>
                <p className="text-[#9a9080] text-xs leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8">
          <Link
            to="/planner"
            className="inline-flex items-center gap-3 px-8 py-3 bg-[#c9a84c] text-[#0a0a0a] font-semibold text-sm tracking-wide rounded-lg hover:bg-[#e0c068] transition-all no-underline"
          >
            Start Planning
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── What is agrivoltaics ─────────────────────────────────────────── */}
      <section>
        <SectionLabel>The Concept</SectionLabel>
        <SectionHeading>What is agrivoltaics?</SectionHeading>
        <p className="text-[#9a9080] text-sm leading-relaxed max-w-2xl mb-10">
          Agrivoltaics (or agri-PV) places elevated solar panels above crops so that both can coexist
          on the same land. PV panels at 3–5 m height let tractors pass beneath, and their partial
          shade actually <em>benefits</em> many crops — especially leafy vegetables, herbs and
          root crops that would otherwise suffer from intense summer heat.
        </p>

        {/* Cross-section diagram */}
        <div className="rounded-2xl border border-white/8 bg-[#0d0d0d] p-6 flex flex-col items-center gap-4">
          <p className="text-xs text-[#9a9080] tracking-widest uppercase self-start">Cross-section view</p>
          <CrossSection />
          <div className="flex flex-wrap gap-6 justify-center mt-2">
            {[
              { color: '#c9a84c', label: 'PV Panels' },
              { color: '#1a3a6a', label: 'Shadow Zone (shade crops)' },
              { color: '#5a9a40', label: 'Sun Gap (sun crops)' },
              { color: '#1a1a1a', label: 'Tractor Path' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.85 }} />
                <span className="text-[11px] text-[#9a9080]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Environmental impact stats ───────────────────────────────────── */}
      <section>
        <SectionLabel>Environmental Impact</SectionLabel>
        <SectionHeading>
          Why it matters for <span className="text-[#c9a84c]">the planet</span>
        </SectionHeading>
        <p className="text-[#9a9080] text-sm leading-relaxed max-w-2xl mb-10">
          The global agricultural sector uses 50% of habitable land while contributing ~25% of
          greenhouse gas emissions. Agrivoltaics addresses both: it restores land efficiency and
          generates zero-emission electricity on already-farmed soil.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {STATS.map(({ label, value, suffix, detail }) => (
            <div key={label} className="rounded-2xl border border-white/8 bg-[#0d0d0d] p-6 flex flex-col gap-4">
              <div className="flex items-end gap-2">
                <span className="font-['Cormorant_Garant'] text-4xl font-semibold text-[#c9a84c]">{suffix}</span>
              </div>
              <p className="text-sm font-medium text-[#f0ece3]">{label}</p>
              {/* Bar chart */}
              <div className="h-2 rounded-full bg-white/6 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#c9a84c] transition-all"
                  style={{ width: `${value}%` }}
                />
              </div>
              <p className="text-xs text-[#9a9080] leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Benefits ─────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Why Plant Like This</SectionLabel>
        <SectionHeading>Benefits for people and planet</SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8">
          {BENEFITS.map(({ title, body, color }) => (
            <div key={title} className="rounded-2xl border border-white/8 bg-[#0d0d0d] p-6 flex flex-col gap-3">
              <div className="w-1 h-8 rounded-full" style={{ backgroundColor: color }} />
              <h3 className="text-sm font-semibold text-[#f0ece3]">{title}</h3>
              <p className="text-xs text-[#9a9080] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Global context ───────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#c9a84c]/20 bg-[#c9a84c]/4 p-8 flex flex-col gap-5">
        <SectionLabel>The Bigger Picture</SectionLabel>
        <p className="font-['Cormorant_Garant'] text-2xl text-[#f0ece3] leading-snug max-w-2xl">
          "By 2050 the world must feed 10 billion people while cutting agricultural emissions
          in half. Agrivoltaics is one of the few technologies that moves both needles at once."
        </p>
        <p className="text-xs text-[#9a9080]">
          Fraunhofer ISE, Global Agrivoltaics Report 2023 — and confirmed by hundreds of field trials across Europe, Japan, the United States and India.
        </p>
        <div className="flex flex-wrap gap-10 mt-2">
          {[
            { n: '4.5 GW', label: 'agrivoltaic capacity installed worldwide (2023)' },
            { n: '1.7 bn ha', label: 'of cropland globally that could benefit' },
            { n: '>1.5', label: 'average Land Equivalent Ratio in studies' },
          ].map(({ n, label }) => (
            <div key={label} className="flex flex-col gap-1">
              <span className="font-['Cormorant_Garant'] text-3xl font-semibold text-[#c9a84c]">{n}</span>
              <span className="text-xs text-[#9a9080] max-w-[160px] leading-relaxed">{label}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
