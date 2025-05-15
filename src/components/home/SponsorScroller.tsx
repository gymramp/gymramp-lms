
"use client";

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import { cn } from "@/lib/utils";

// Define sponsor logos (use placeholders, user needs to replace with actual paths)
const sponsors = [
  { src: 'https://picsum.photos/150/60?grayscale&random=1', alt: 'Sponsor 1' },
  { src: 'https://picsum.photos/150/60?grayscale&random=2', alt: 'Sponsor 2' },
  { src: 'https://picsum.photos/150/60?grayscale&random=3', alt: 'Sponsor 3' },
  { src: 'https://picsum.photos/150/60?grayscale&random=4', alt: 'Sponsor 4' },
  { src: 'https://picsum.photos/150/60?grayscale&random=5', alt: 'Sponsor 5' },
  { src: 'https://picsum.photos/150/60?grayscale&random=6', alt: 'Sponsor 6' },
  { src: 'https://picsum.photos/150/60?grayscale&random=7', alt: 'Sponsor 7' },
  { src: 'https://picsum.photos/150/60?grayscale&random=8', alt: 'Sponsor 8' },
  // Add more sponsors as needed
];

export function SponsorScroller({ className }: { className?: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const scrollerInner = scroller.querySelector<HTMLDivElement>('[data-scroller-inner]');
    if (!scrollerInner) return;

    const scrollerContent = Array.from(scrollerInner.children);

    // Duplicate items for infinite scroll effect
    scrollerContent.forEach(item => {
      const duplicatedItem = item.cloneNode(true) as HTMLElement;
      duplicatedItem.setAttribute("aria-hidden", "true");
      scrollerInner.appendChild(duplicatedItem);
    });

    // Add animation class
    scrollerInner.classList.add('animate-scroll');

  }, []);

  return (
    <div
      ref={scrollerRef}
      className={cn(
        "w-full overflow-hidden py-8 bg-background",
        "[mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]",
        className
      )}
      data-testid="sponsor-scroller"
    >
      <div className="flex w-max" data-scroller-inner>
        {sponsors.map((sponsor, index) => (
          <div key={index} className="flex-shrink-0 px-8 flex items-center justify-center">
            <Image
              src={sponsor.src}
              alt={sponsor.alt}
              width={150}
              height={60}
              className="max-h-[60px] w-auto object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
            />
          </div>
        ))}
         {/* Duplicated items for infinite scroll will be added here by useEffect */}
      </div>
    </div>
  );
}

// Add animation keyframes in globals.css or a relevant CSS file
/*
In src/app/globals.css add:

@layer utilities {
  @keyframes scroll {
    to {
      transform: translate(calc(-50% - 0.5rem)); // Adjust based on gap if needed
    }
  }

  .animate-scroll {
    animation: scroll 40s linear infinite; // Adjust duration as needed
  }
}
*/
