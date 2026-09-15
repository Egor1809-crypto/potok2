"use client";
import { useEffect } from "react";

/** Enhance existing content; it stays visible without JavaScript or motion. */
export function LandingEffects() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches || !("IntersectionObserver" in window)) return;
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.setAttribute("data-revealed", "true");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    nodes.forEach(node => { if (node.getBoundingClientRect().top > window.innerHeight) { node.setAttribute("data-revealed", "false"); observer.observe(node); } });
    const stop = () => { observer.disconnect(); nodes.forEach(node => node.removeAttribute("data-revealed")); };
    reduced.addEventListener("change", stop);
    return () => { stop(); reduced.removeEventListener("change", stop); };
  }, []);
  return null;
}
