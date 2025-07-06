import './styles.css'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import three from './work.js'


 const lenis = new Lenis();

 lenis.on('scroll', ScrollTrigger.update);
 gsap.ticker.add((time) => {
   lenis.raf(time * 1000);
 });
 gsap.ticker.lagSmoothing(0);

three()

console.log("%cDesigned and built by https://namanprat.com", "background:blue;color:#fff;padding: 8px;");
{/* <script type="module" src="https://perception-pod.netlify.app/main.js"></script> */}