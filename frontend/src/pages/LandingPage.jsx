import { Link } from 'react-router-dom';
import BrandMarquee from '../components/common/BrandMarquee';
import { Navigation } from '../components/Navigation/index.js';
import './LandingPage.css';

import amazon from '../assets/logos/amazon.webp';
import flipkart from '../assets/logos/flipkart.webp';
import mamaearth from '../assets/logos/mamaearth.png';
import dermaCo from '../assets/logos/derma-co.png';
import mcaffeine from '../assets/logos/mcaffeine.png';
import juicyChemistry from '../assets/logos/juicy-chemistry.png';
import sugar from '../assets/logos/sugar.png';
import plum from '../assets/logos/plum.svg';
import nykaa from '../assets/logos/nykaa.webp';
import wow from '../assets/logos/wow.webp';
import kamaAyurveda from '../assets/logos/kama-ayurveda.svg';
import forestEssentials from '../assets/logos/forest-essentials.svg';
import healthAndGlow from '../assets/logos/health-and-glow.webp';
import simple from '../assets/logos/simple.jpg';

const BRANDS = [
  { name: 'Amazon', src: amazon },
  { name: 'Flipkart', src: flipkart },
  { name: 'Mamaearth', src: mamaearth },
  { name: 'The Derma Co.', src: dermaCo },
  { name: "m'caffeine", src: mcaffeine },
  { name: 'Juicy Chemistry', src: juicyChemistry },
  { name: 'Sugar Cosmetics', src: sugar },
  { name: 'Plum Goodness', src: plum },
  { name: 'Nykaa', src: nykaa },
  { name: 'WOW Skin Science', src: wow },
  { name: 'Kama Ayurveda', src: kamaAyurveda },
  { name: 'Forest Essentials', src: forestEssentials },
  { name: 'Health & Glow', src: healthAndGlow },
  { name: 'Simple', src: simple },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <Navigation />

      <main className="landing__hero">
        <div className="landing__hero-glow" aria-hidden="true" />

        <h1 className="landing__headline">Tell us about your skin.</h1>
        <p className="landing__subhead">Find skincare products that fit you.</p>

        <Link to="/onboarding" className="landing__cta">
          Analyze My Skin
          <span className="landing__cta-arrow">→</span>
        </Link>

        <p className="landing__cta-note">Free · Personalized · No account required</p>
      </main>

      <section className="landing__marketplace" aria-label="Brands available on the platform">
        <BrandMarquee brands={BRANDS} />

        <h2 className="landing__marketplace-title">Compare &amp; buy from hundreds of brands</h2>
        <p className="landing__marketplace-subtitle">
          Discover products matched to your skin, all in one place.
        </p>
      </section>
    </div>
  );
}
