import { ArrowUpRight, BookOpen, Clock } from "lucide-react";
import { getBlogArticles } from "../../data/mocks";
import Reveal from "./reveal";

const ARTICLES = getBlogArticles();

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function EducationSection() {
  return (
    <section id="education" className="px-6 lg:px-10 py-16 max-w-7xl mx-auto scroll-mt-24">
      <Reveal>
        <div className="flex items-end justify-between gap-4 mb-8">
          <div className="max-w-2xl">
            <span className="text-xs uppercase tracking-wider text-primary font-semibold">
              Threat intelligence
            </span>
            <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
              Field notes from active investigations
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Practical guidance on how losses happen on-chain — and what to
              preserve before recovery windows close.
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-primary font-medium">
            <BookOpen className="w-4 h-4" /> Resource library
          </span>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {ARTICLES.map((a, i) => (
          <Reveal key={a.id} delay={(i % 4) * 0.07}>
            <article className="group refunds-glass rounded-2xl p-5 h-full flex flex-col transition-transform duration-300 hover:-translate-y-1 cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md bg-primary/10 border border-primary/25 text-primary">
                  {a.category}
                </span>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-sm font-semibold text-foreground leading-snug">
                {a.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed flex-1">
                {a.excerpt}
              </p>
              <div className="mt-4 pt-3 border-t border-card-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{formatDate(a.publishedAt)}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {a.readMinutes} min
                </span>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
