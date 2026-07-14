// Renders a landing page from its LIVE variants (engine.v_page_live rows). The page
// is data-driven: whatever variant is live for each element is what shows. Applying a
// different variant through the API changes the data, and this view follows it.
// Used both standalone (DynamicPage) and embedded as the live preview in Test Engine.

export interface LiveElement {
  element_key: string;
  content: Record<string, unknown>;
}

export function LandingPreview({ live }: { live: LiveElement[] }) {
  const byKey: Record<string, Record<string, unknown>> = {};
  for (const e of live) byKey[e.element_key] = e.content ?? {};

  const headline = (byKey.headline?.text as string) ?? "Headline";
  const testimonialQuote = (byKey.testimonial?.quote as string) ?? "";
  const testimonialAuthor = (byKey.testimonial?.author as string) ?? "";
  const ctaLabel = (byKey.cta?.label as string) ?? "Get Started";
  const ctaColor = (byKey.cta?.color as string) ?? "blue";
  const ctaClass = ctaColor === "green" ? "bg-green-600 hover:bg-green-700"
    : ctaColor === "amber" ? "bg-amber-500 hover:bg-amber-600"
    : "bg-blue-600 hover:bg-blue-700";

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="bg-gradient-to-b from-slate-50 to-white px-6 py-10 text-center space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 max-w-xl mx-auto">{headline}</h1>
        <div className="mx-auto max-w-md aspect-video rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 text-sm">
          ▶ VSL video
        </div>
        {testimonialQuote && (
          <figure className="mx-auto max-w-md rounded-lg bg-slate-50 border px-4 py-3">
            <blockquote className="text-slate-600 text-sm italic">"{testimonialQuote}"</blockquote>
            <figcaption className="text-slate-400 text-xs mt-1">— {testimonialAuthor}</figcaption>
          </figure>
        )}
        <button className={`px-6 py-3 rounded-lg text-white text-sm font-semibold ${ctaClass}`}>{ctaLabel}</button>
      </div>
    </div>
  );
}
