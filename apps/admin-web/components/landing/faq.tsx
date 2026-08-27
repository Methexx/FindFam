'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export interface FaqEntry {
  question: string;
  answer: string;
}

// A client leaf so the landing page itself stays a Server Component — it
// reads cookies() to decide what the nav says, the same reason
// components/motion/reveal.tsx exists rather than the page going client.
export function Faq({ entries }: { entries: FaqEntry[] }) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {entries.map((entry, index) => (
        <AccordionItem key={entry.question} value={`item-${index}`}>
          <AccordionTrigger>{entry.question}</AccordionTrigger>
          <AccordionContent>{entry.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
