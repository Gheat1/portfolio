import { GALLERY_ITEMS } from '../../../config/sections';
import CrtMonitor from './CrtMonitor';
import Cables from './Cables';
import Backdrop from './Backdrop';

/**
 * Scene 3 — the CRT corridor. A wall of cathode-ray monitors strung together
 * with a pulsing cable loom, hung over a data-center floor with a rack wall
 * blinking behind it. Each monitor streams one gallery item's full description
 * across its glass as the page scrolls (see CrtMonitor).
 */
export default function Gallery() {
  return (
    <group>
      {GALLERY_ITEMS.map((item, i) => (
        <CrtMonitor key={item.id} item={item} index={i} />
      ))}
      <Cables />
      <Backdrop />
    </group>
  );
}
