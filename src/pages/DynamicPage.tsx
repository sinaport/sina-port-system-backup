// A real, data-driven funnel page. It reads its LIVE variants from
// engine.v_page_live and renders them. When an approved test applies a new variant
// through the API, the data changes and this page follows - no redeploy. This is
// the "own dynamic page system" the agentic execution v1 runs on.
import { useParams } from "react-router-dom";
import { useRoleView } from "@/hooks/useRoleView";
import { LandingPreview, type LiveElement } from "@/components/LandingPreview";

interface LiveRow { page_slug: string; element_key: string; content: Record<string, unknown>; }

export function DynamicPage() {
  const { slug = "demo-vsl" } = useParams();
  const { data, loading } = useRoleView<LiveRow>("v_page_live");
  const live: LiveElement[] = (data ?? []).filter((r) => r.page_slug === slug)
    .map((r) => ({ element_key: r.element_key, content: r.content }));

  if (loading) return <div className="p-6 text-slate-500">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-3">
      <div className="text-xs text-slate-400">Live page · {slug} · served from data</div>
      <LandingPreview live={live} />
    </div>
  );
}
