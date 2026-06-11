import { Link } from "react-router-dom";
import LanguageSelector from "../components/LanguageSelector";
import { useI18n } from "../i18n";

const PAGE_COPY = {
  en: {
    badge: "Hotel Operations, Reimagined",
    title: "NextStay turns hotel operations into one connected system.",
    intro:
      "This page is a flexible placeholder for the public business story of NextStay. For now, it outlines the vision, the business model, and a few easy ways to reach the team.",
    storyTitle: "What NextStay Is Building",
    storyText:
      "NextStay combines guest access, staff coordination, messaging, bookings, and operational reporting in one platform. The goal is simple: fewer disconnected tools, faster response times, and a smoother stay for guests.",
    businessTitle: "Business Model",
    businessCards: [
      {
        title: "Platform Subscription",
        text: "Hotels pay a recurring subscription for access to the core operating system, staff tools, and guest-facing workflows.",
      },
      {
        title: "Implementation & Onboarding",
        text: "New properties can purchase setup, data migration, training, and operational playbook support during launch.",
      },
      {
        title: "Premium Automation",
        text: "Advanced pricing, analytics, smart task orchestration, and custom integrations can be offered as higher-tier modules.",
      },
      {
        title: "Guest Experience Add-ons",
        text: "Upsells like branded guest journeys, in-stay messaging, and digital concierge services can expand revenue per property.",
      },
    ],
    reachTitle: "Ways To Reach The Team",
    reachCards: [
      {
        label: "Sales",
        value: "sales@nextstay.example",
        hint: "For demos, pricing, and pilot discussions.",
      },
      {
        label: "Partnerships",
        value: "partners@nextstay.example",
        hint: "For channel, PMS, and ecosystem conversations.",
      },
      {
        label: "Phone",
        value: "+39 06 5555 0123",
        hint: "For quick introductions and follow-ups.",
      },
      {
        label: "Office",
        value: "Via Example 24, Rome",
        hint: "For in-person meetings and workshops.",
      },
    ],
    roadmapTitle: "Current Position",
    roadmapText:
      "At this stage, the messaging here is intentionally editable. We can later replace this with the final investor, hotelier, or partner narrative without changing the page structure.",
    statOne: "Unified platform narrative",
    statTwo: "Core revenue blocks shown below",
    nextStepLabel: "Next Step",
    ctaTitle: "Want to keep shaping the story?",
    ctaText:
      "This page is ready for final copy, testimonials, visuals, pricing language, and real contact details whenever you want to refine it.",
    ctaPrimary: "Back to Booking",
    ctaSecondary: "Go Back",
  },
  it: {
    badge: "Operazioni alberghiere, ripensate",
    title: "NextStay trasforma le operazioni di hotel in un unico sistema connesso.",
    intro:
      "Questa pagina e un segnaposto flessibile per raccontare pubblicamente il progetto NextStay. Per ora descrive la visione, il modello di business e alcuni modi semplici per contattare il team.",
    storyTitle: "Cosa sta costruendo NextStay",
    storyText:
      "NextStay unisce accessi ospiti, coordinamento dello staff, messaggistica, prenotazioni e reporting operativo in una sola piattaforma. L'obiettivo e semplice: meno strumenti scollegati, tempi di risposta piu rapidi e un soggiorno piu fluido per gli ospiti.",
    businessTitle: "Modello di Business",
    businessCards: [
      {
        title: "Abbonamento alla piattaforma",
        text: "Gli hotel pagano un abbonamento ricorrente per accedere al sistema operativo centrale, agli strumenti per lo staff e ai flussi per gli ospiti.",
      },
      {
        title: "Implementazione e onboarding",
        text: "Le nuove strutture possono acquistare setup, migrazione dati, formazione e supporto operativo durante il lancio.",
      },
      {
        title: "Automazione premium",
        text: "Pricing avanzato, analytics, orchestrazione intelligente dei task e integrazioni personalizzate possono essere moduli di fascia superiore.",
      },
      {
        title: "Add-on esperienza ospite",
        text: "Servizi aggiuntivi come journey brandizzati, messaggistica durante il soggiorno e concierge digitale possono aumentare il ricavo per struttura.",
      },
    ],
    reachTitle: "Come raggiungere il team",
    reachCards: [
      {
        label: "Sales",
        value: "sales@nextstay.example",
        hint: "Per demo, prezzi e discussioni su progetti pilota.",
      },
      {
        label: "Partnership",
        value: "partners@nextstay.example",
        hint: "Per dialoghi su canali, PMS ed ecosistema.",
      },
      {
        label: "Telefono",
        value: "+39 06 5555 0123",
        hint: "Per una prima chiamata veloce o follow-up.",
      },
      {
        label: "Ufficio",
        value: "Via Example 24, Roma",
        hint: "Per incontri in presenza e workshop.",
      },
    ],
    roadmapTitle: "Stato attuale",
    roadmapText:
      "In questa fase il testo e volutamente modificabile. In seguito possiamo sostituirlo con la narrazione definitiva per investitori, albergatori o partner senza cambiare la struttura della pagina.",
    statOne: "Narrazione unificata della piattaforma",
    statTwo: "Blocchi principali di ricavo mostrati sotto",
    nextStepLabel: "Prossimo passo",
    ctaTitle: "Vuoi continuare a modellare il racconto?",
    ctaText:
      "La pagina e pronta per copy finale, testimonianze, visual, linguaggio di pricing e contatti reali quando vorrai rifinirla.",
    ctaPrimary: "Torna alla prenotazione",
    ctaSecondary: "Indietro",
  },
} as const;

export default function NextStayPage() {
  const { language } = useI18n();
  const copy = PAGE_COPY[language];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#fef3c7_0%,#f8fafc_28%,#e0f2fe_100%)] px-4 py-8 text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-12 h-52 w-52 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/book"
            className="inline-flex items-center rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white"
          >
            NextStay
          </Link>
          <LanguageSelector compact />
        </div>

        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/75 shadow-[0_30px_100px_-40px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="grid gap-0 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="px-6 py-10 sm:px-10 sm:py-14">
              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                {copy.badge}
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
                {copy.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                {copy.intro}
              </p>
            </div>

            <div className="border-t border-slate-200/70 bg-slate-950 px-6 py-10 text-white lg:border-l lg:border-t-0 sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">
                {copy.storyTitle}
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-200">
                {copy.storyText}
              </p>

              <div className="mt-8 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-black">1</p>
                  <p className="mt-2 text-sm text-slate-300">{copy.statOne}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-2xl font-black">4</p>
                  <p className="mt-2 text-sm text-slate-300">{copy.statTwo}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {copy.businessTitle}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {copy.businessCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-3xl border border-slate-200 bg-slate-50/90 p-5 transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <h2 className="text-lg font-bold text-slate-900">{card.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {copy.reachTitle}
            </p>
            <div className="mt-5 grid gap-4">
              {copy.reachCards.map((item) => (
                <article
                  key={item.label}
                  className="rounded-3xl border border-slate-200 bg-white px-5 py-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.hint}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              {copy.roadmapTitle}
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200">
              {copy.roadmapText}
            </p>
          </div>

          <div className="rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,#fef3c7_0%,#fff7ed_48%,#ffffff_100%)] p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              {copy.nextStepLabel}
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              {copy.ctaTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700">
              {copy.ctaText}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/book"
                className="inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {copy.ctaPrimary}
              </Link>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {copy.ctaSecondary}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
