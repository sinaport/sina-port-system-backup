// A live, PUBLIC funnel page (no login). Each visitor is bucketed and served an
// A/B variant through the public funnel-ab endpoint (the DB stays locked - the
// function does the work server-side). Exposure is counted on load; a click on the
// CTA is recorded as a conversion, then the visitor is sent to the booking step.
// The autonomous agent (engine.fn_ab_auto_evaluate, cron) promotes the winner on
// its own once the evidence is in. This is the surface real ad traffic points at.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { LandingPreview, type LiveElement } from "@/components/LandingPreview";

// deterministic per-visitor bucket, persisted so a returning visitor stays in-arm
function visitorBucket(): number {
  let b = localStorage.getItem("sp_ab_bucket");
  if (b === null) { b = String(Math.floor(Math.random() * 2)); localStorage.setItem("sp_ab_bucket", b); }
  return Number(b);
}

// where a converted visitor is sent (the real next step)
const BOOKING_URL = "https://sinaport.myclickfunnels.com/gptby-page";

export function FunnelPage() {
  const { slug = "demo-vsl" } = useParams();
  const [live, setLive] = useState<LiveElement[] | null>(null);
  const [ctaLabel, setCtaLabel] = useState("A");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.functions.invoke("funnel-ab", {
        body: { action: "page", page: slug, bucket: visitorBucket() },
      });
      if (data) {
        const els: LiveElement[] = Object.entries(data as Record<string, { content: Record<string, unknown> }>)
          .map(([k, v]) => ({ element_key: k, content: v.content }));
        setLive(els);
        setCtaLabel((data as Record<string, { label: string }>).cta?.label ?? "A");
      } else {
        setLive([]);
      }
    })();
  }, [slug]);

  async function convert() {
    try {
      await supabase.functions.invoke("funnel-ab", {
        body: { action: "convert", page: slug, element: "cta", label: ctaLabel },
      });
    } finally {
      window.location.href = BOOKING_URL;
    }
  }

  if (!live) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <LandingPreview live={live} onCtaClick={convert} />
        <p className="text-center text-xs text-slate-400">Brand With Sina</p>
      </div>
    </div>
  );
}
