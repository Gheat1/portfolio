import { useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { rig } from '../state/rig';
import {
  CAMERA_KEYFRAMES,
  OVERLAY_TIMINGS,
  OVERLAY_RAMP,
  SKILLS_EXPLODE,
  WARP_FLASH,
} from '../config/scene';

gsap.registerPlugin(ScrollTrigger);

/**
 * Builds ONE master GSAP timeline, scrubbed by ScrollTrigger, that writes to the
 * shared `rig` object and the overlay DOM. Renders nothing.
 *
 * ── How the scroll → time mapping works ───────────────────────────────────
 * ScrollTrigger converts the page's scrollTop into `progress ∈ [0,1]`:
 *
 *     progress = (scrollTop − start) / (end − start)
 *
 * We give the timeline a total duration of exactly 1, so with `scrub` the
 * timeline's playhead time === progress. That means any tween we place at
 * absolute position `t` with duration `d` runs over scroll range [t, t+d].
 * In other words: **timeline position parameters ARE scroll percentages.**
 */
export default function ScrollController() {
  useLayoutEffect(() => {
    // Query the spacer from the DOM rather than holding a sibling ref: by the
    // layout phase every host node is committed, so this always resolves — and
    // it sidesteps the ref-attach-vs-effect ordering trap between siblings.
    const el = document.querySelector<HTMLElement>('.scroll-spacer');
    if (!el) return;

    if (import.meta.env.DEV) {
      (window as unknown as { __rig: typeof rig }).__rig = rig;
      (window as unknown as { __refreshST: () => void }).__refreshST = () => ScrollTrigger.refresh();
      (window as unknown as { __tlInfo?: () => unknown }).__tlInfo = () => null; // overwritten below
    }

    const progressBar = document.querySelector<HTMLElement>('.hud__progress');

    // gsap.context scopes every tween/trigger we create so a single revert()
    // cleans them all up (important for React StrictMode's double-mount in dev).
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7, // ~0.7s catch-up: smooths flings without feeling laggy
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            // Report raw progress for the HUD + any debug logic. Writing a number
            // and a transform — no React re-render, no layout thrashing.
            rig.progress = self.progress;
            if (progressBar) progressBar.style.transform = `scaleX(${self.progress})`;
          },
        },
      });

      // (0) Reserve the full [0,1] timeline so positions map 1:1 to scroll %.
      tl.to({}, { duration: 1 }, 0);

      if (import.meta.env.DEV) {
        (window as unknown as { __tlInfo: () => unknown }).__tlInfo = () => ({
          duration: tl.duration(),
          time: tl.time(),
          progress: tl.progress(),
          stProgress: tl.scrollTrigger?.progress,
        });
        // Hard-sync the playhead to the trigger (headless tabs can stall the
        // scrub tween's ticker; harmless in real browsing, handy in dev tools).
        (window as unknown as { __syncTL: () => void }).__syncTL = () => {
          tl.progress(tl.scrollTrigger?.progress ?? 0);
        };
      }

      // (1) CAMERA — tween rig.cam between successive keyframes.
      //     Keyframe[0] is the initial pose (rig already holds it), so we start
      //     from i = 1 and animate from the previous keyframe to this one.
      for (let i = 1; i < CAMERA_KEYFRAMES.length; i++) {
        const prev = CAMERA_KEYFRAMES[i - 1];
        const kf = CAMERA_KEYFRAMES[i];
        tl.to(
          rig.cam,
          {
            px: kf.position[0],
            py: kf.position[1],
            pz: kf.position[2],
            lx: kf.lookAt[0],
            ly: kf.lookAt[1],
            lz: kf.lookAt[2],
            duration: kf.at - prev.at, // span in scroll-fraction units
            ease: kf.ease ?? 'power1.inOut',
          },
          prev.at, // absolute start time === start scroll fraction
        );
      }

      // (2a) WARP FLASH — white-out that covers the burst through CRT-01's
      //      glass at the end of the wire dive (and the 180° camera whip).
      const flash = document.querySelector<HTMLElement>('.warp-flash');
      if (flash) {
        gsap.set(flash, { opacity: 0 });
        tl.to(flash, { opacity: 1, duration: WARP_FLASH.inEnd - WARP_FLASH.inStart, ease: 'power2.in' }, WARP_FLASH.inStart);
        tl.to(flash, { opacity: 0, duration: WARP_FLASH.outEnd - WARP_FLASH.outStart, ease: 'power2.out' }, WARP_FLASH.outStart);
      }

      // (2) SKILLS CORE — scatter from 0 → 1 across its scroll window.
      tl.to(
        rig.skills,
        {
          explode: 1,
          duration: SKILLS_EXPLODE.end - SKILLS_EXPLODE.start,
          ease: 'power2.in',
        },
        SKILLS_EXPLODE.start,
      );

      // (3) OVERLAYS — each [data-overlay] panel fades/​slides in over its window
      //     and back out after it. Driven by the same scrubbed playhead.
      const panels = gsap.utils.toArray<HTMLElement>('[data-overlay]');
      panels.forEach((panel) => {
        const id = panel.dataset.overlay!;
        const timing = OVERLAY_TIMINGS[id];
        if (!timing) return;

        // Ramps live INSIDE [start, end]: fade in over the first OVERLAY_RAMP,
        // hold, then fade out over the last OVERLAY_RAMP. Abutting windows there-
        // fore never show two panels at once.
        const outAt = Math.max(timing.start, timing.end - OVERLAY_RAMP);

        gsap.set(panel, { autoAlpha: 0, y: 26 }); // autoAlpha = opacity + visibility
        tl.to(panel, { autoAlpha: 1, y: 0, duration: OVERLAY_RAMP, ease: 'power2.out' }, timing.start);
        // A timing whose `end` exceeds the timeline is "sticky": skip the fade-out
        // so the panel survives to the bottom of the page (the contact card).
        // Crucially this also keeps the timeline's total duration at exactly 1,
        // preserving the position ⇄ scroll-fraction identity.
        if (timing.end <= 0.999) {
          tl.to(panel, { autoAlpha: 0, y: -22, duration: OVERLAY_RAMP, ease: 'power2.in' }, outAt);
        }
      });
    });

    // Recompute trigger geometry once fonts settle (they can shift layout height)…
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    // …and whenever the viewport/container actually changes size. This also covers
    // the edge case where the page first lays out at 0 height (hidden tab, deferred
    // sizing, SSR hydration): without it ScrollTrigger would latch onto a zero-length
    // scroll range at init and stay pinned at progress 0 forever.
    const ro = new ResizeObserver(() => ScrollTrigger.refresh());
    ro.observe(document.documentElement);

    return () => {
      ro.disconnect();
      ctx.revert();
    };
  }, []);

  return null;
}
