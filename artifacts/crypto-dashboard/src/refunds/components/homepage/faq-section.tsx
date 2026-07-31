import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { getFaqEntries } from "../../data/mocks";
import Reveal from "./reveal";

const FAQS = getFaqEntries();

export default function FaqSection() {
  const [open, setOpen] = useState<string | null>(FAQS[0]?.id ?? null);

  return (
    <section id="faq" className="px-6 lg:px-10 py-16 max-w-3xl mx-auto scroll-mt-24">
      <Reveal>
        <div className="text-center mb-10">
          <span className="text-xs uppercase tracking-wider text-primary font-semibold">
            FAQ
          </span>
          <h2 className="mt-2 text-3xl font-semibold text-foreground tracking-tight">
            Honest answers, no hype
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            What we can do, what we can't, and how your case is protected.
          </p>
        </div>
      </Reveal>

      <div className="space-y-3">
        {FAQS.map((f, i) => {
          const isOpen = open === f.id;
          return (
            <Reveal key={f.id} delay={i * 0.05}>
              <div className="refunds-glass rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : f.id)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {f.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-primary shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                        {f.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
