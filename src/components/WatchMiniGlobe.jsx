import { useEffect, useRef } from 'react';

const CONTINENTS = [
  [[-170,70],[-140,62],[-128,52],[-120,50],[-95,50],[-75,47],[-68,44],[-80,30],[-90,29],[-97,24],[-117,32],[-126,37],[-130,50],[-155,57],[-165,62],[-170,70]],
  [[-80,12],[-62,12],[-50,5],[-36,-4],[-38,-14],[-35,-24],[-50,-30],[-55,-38],[-65,-42],[-68,-50],[-75,-55],[-75,-42],[-72,-30],[-76,-14],[-78,0],[-80,12]],
  [[-10,36],[10,36],[28,38],[32,46],[26,52],[22,57],[14,57],[5,58],[0,51],[-5,48],[-10,44],[-10,36]],
  [[-17,15],[0,16],[10,22],[22,22],[30,30],[36,22],[42,12],[44,0],[40,-10],[38,-18],[32,-26],[26,-34],[20,-36],[14,-34],[10,-28],[10,-16],[0,-5],[-5,0],[-10,5],[-17,15]],
  [[26,72],[50,72],[80,70],[105,70],[140,72],[160,65],[150,58],[142,46],[130,38],[122,28],[104,22],[100,5],[95,0],[105,-8],[120,-5],[130,10],[140,25],[142,36],[140,42],[132,50],[142,55],[155,58],[160,65],[140,72]],
  [[114,-22],[125,-14],[130,-12],[136,-12],[142,-10],[148,-18],[152,-24],[152,-32],[148,-38],[142,-38],[136,-34],[130,-32],[124,-30],[114,-22]],
  [[-44,60],[-24,63],[-18,68],[-18,72],[-26,76],[-36,78],[-50,80],[-58,76],[-58,70],[-52,65],[-44,60]],
];

const CITY_COORDS = {
  Paris:[2.35,48.85],Tokyo:[139.69,35.69],London:[-0.13,51.51],'New York':[-74.01,40.71],
  Sydney:[151.21,-33.87],Berlin:[13.40,52.52],Rome:[12.50,41.90],Madrid:[-3.70,40.42],
  Amsterdam:[4.90,52.37],Lisbon:[-9.14,38.72],Barcelona:[2.15,41.39],Istanbul:[28.98,41.01],
  Dubai:[55.27,25.20],Singapore:[103.82,1.35],Seoul:[126.98,37.57],Beijing:[116.41,39.90],
  Shanghai:[121.47,31.23],Mumbai:[72.88,19.08],Bangkok:[100.50,13.76],
  'Los Angeles':[-118.24,34.05],Chicago:[-87.63,41.88],Toronto:[-79.38,43.65],
  'Mexico City':[-99.13,19.43],Cairo:[31.24,30.04],Nairobi:[36.82,-1.29],
  Moscow:[37.62,55.76],Marrakech:[-7.99,31.63],Lofoten:[14.57,68.24],
  Chamonix:[6.87,45.92],Mallorca:[2.65,39.57],Split:[16.44,43.51],
  Cappadocia:[34.83,38.64],Srinagar:[74.80,34.08],Portland:[-122.68,45.52],
  Prague:[14.42,50.08],Ericeira:[-9.42,38.96],Reykjavik:[-22.0,64.14],
  Bergen:[5.33,60.39],Queenstown:[168.67,-45.03],Bali:[115.19,-8.41],
  Bogota:[-74.08,4.71],Lima:[-77.04,-12.05],Santiago:[-70.67,-33.45],
  Havana:[-82.38,23.13],Vienna:[16.37,48.21],Warsaw:[21.01,52.23],
  Athens:[23.73,37.98],Copenhagen:[12.57,55.68],Stockholm:[18.07,59.33],
  Helsinki:[24.94,60.17],Budapest:[19.04,47.50],
  Dolomites:[11.87,46.41],
};

const COUNTRY_CENTERS = {
  France:[2.35,46.5],Japan:[138.25,36.2],Portugal:[-8.0,39.5],Iceland:[-19.02,64.96],
  Turkey:[35.0,39.0],India:[78.0,22.0],'United States':[-98.0,39.5],USA:[-98.0,39.5],
  Australia:[133.0,-27.0],Germany:[10.45,51.17],Italy:[12.56,41.87],Spain:[-3.75,40.0],
  Morocco:[-7.09,31.79],Kenya:[37.9,0.02],Croatia:[15.2,45.1],Norway:[8.47,60.47],
  Sweden:[18.07,59.33],Denmark:[9.50,56.26],Netherlands:[4.90,52.37],
  Switzerland:[8.23,46.82],Poland:[19.14,51.92],Greece:[21.82,39.07],
  Brazil:[-51.93,-14.24],Argentina:[-63.62,-38.42],Colombia:[-74.30,4.57],
  China:[104.19,35.86],'South Korea':[127.77,36.64],Indonesia:[113.92,-0.79],
  Thailand:[100.99,15.87],Egypt:[30.80,26.82],'South Africa':[25.08,-29.0],
  Russia:[105.32,61.52],Canada:[-96.81,56.13],Mexico:[-102.55,23.63],
  'New Zealand':[172.81,-40.9],'Czech Republic':[15.47,49.82],
};

export function getStreamCoords(stream) {
  if (stream?.coordinates?.length === 2) {
    return { lng: stream.coordinates[0], lat: stream.coordinates[1], city: stream.city };
  }
  if (stream?.city) {
    const c = CITY_COORDS[stream.city];
    if (c) return { lng: c[0], lat: c[1], city: stream.city };
  }
  if (stream?.country) {
    const c = COUNTRY_CENTERS[stream.country];
    if (c) return { lng: c[0], lat: c[1], city: stream.city ?? stream.country };
  }
  return null;
}

function toRad(d) { return d * Math.PI / 180; }

function project(lng, lat, cLng, cLat, r) {
  const dLng = toRad(lng - cLng);
  const latR = toRad(lat), cLatR = toRad(cLat);
  const x = Math.cos(latR) * Math.sin(dLng);
  const y = -(Math.sin(latR) * Math.cos(cLatR) - Math.cos(latR) * Math.sin(cLatR) * Math.cos(dLng));
  const z = Math.sin(latR) * Math.sin(cLatR) + Math.cos(latR) * Math.cos(cLatR) * Math.cos(dLng);
  if (z < -0.04) return null;
  return { x: x * r, y: y * r, z };
}

function toCart(lng, lat) {
  const lr = toRad(lat), gr = toRad(lng);
  return [Math.cos(lr)*Math.cos(gr), Math.cos(lr)*Math.sin(gr), Math.sin(lr)];
}

function arcPoints(lng1, lat1, lng2, lat2) {
  const steps = 26;
  const a = toCart(lng1, lat1), b = toCart(lng2, lat2);
  const dot = Math.max(-1, Math.min(1, a[0]*b[0]+a[1]*b[1]+a[2]*b[2]));
  const angle = Math.acos(dot);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (angle < 0.001) { pts.push([lng1, lat1]); continue; }
    const s = Math.sin(angle);
    const c = a.map((v, k) => (Math.sin((1-t)*angle)/s)*v + (Math.sin(t*angle)/s)*b[k]);
    pts.push([Math.atan2(c[1],c[0])*180/Math.PI, Math.asin(Math.max(-1,Math.min(1,c[2])))*180/Math.PI]);
  }
  return pts;
}

function lerpCenter(a, b, t) {
  let dLng = b.lng - a.lng;
  if (dLng > 180) dLng -= 360;
  if (dLng < -180) dLng += 360;
  return { lng: a.lng + dLng * t, lat: a.lat + (b.lat - a.lat) * t };
}

function draw(ctx, S, cLng, cLat, cur, nxt, prog, breath) {
  const cx = S/2, cy = S/2, r = S/2 - 1.5;
  ctx.clearRect(0, 0, S, S);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.clip();

  const bg = ctx.createRadialGradient(cx-r*.3, cy-r*.25, 0, cx, cy, r);
  bg.addColorStop(0, 'rgba(10,28,52,0.93)');
  bg.addColorStop(0.55, 'rgba(3,12,28,0.97)');
  bg.addColorStop(1, 'rgba(1,3,8,0.99)');
  ctx.fillStyle = bg;
  ctx.fill();

  const atm = ctx.createRadialGradient(cx, cy, r*0.72, cx, cy, r);
  atm.addColorStop(0, 'transparent');
  atm.addColorStop(1, 'rgba(43,155,215,0.11)');
  ctx.fillStyle = atm;
  ctx.fill();

  for (const poly of CONTINENTS) {
    ctx.beginPath();
    let started = false;
    for (const [lng, lat] of poly) {
      const p = project(lng, lat, cLng, cLat, r);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(cx+p.x, cy+p.y); started = true; }
      else ctx.lineTo(cx+p.x, cy+p.y);
    }
    ctx.fillStyle = 'rgba(16,52,92,0.56)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,125,182,0.34)';
    ctx.lineWidth = 0.45;
    ctx.stroke();
  }

  const abs = Math.abs(prog);

  if (nxt && abs > 0.04) {
    const pts = arcPoints(cur.lng, cur.lat, nxt.lng, nxt.lat);
    const visible = Math.ceil(pts.length * Math.min(1, abs * 1.2));
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < Math.min(visible+1, pts.length); i++) {
      const [lng, lat] = pts[i];
      const p = project(lng, lat, cLng, cLat, r);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(cx+p.x, cy+p.y); started = true; }
      else ctx.lineTo(cx+p.x, cy+p.y);
    }
    ctx.strokeStyle = `rgba(43,217,200,${Math.min(0.65, abs*0.7)})`;
    ctx.lineWidth = 0.85;
    ctx.setLineDash([2.5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (cur) {
    const p = project(cur.lng, cur.lat, cLng, cLat, r);
    if (p) {
      const sx = cx+p.x, sy = cy+p.y;
      const op = 1 - abs*0.52;
      const hR = 5 + breath*2.8;
      const halo = ctx.createRadialGradient(sx,sy,0,sx,sy,hR);
      halo.addColorStop(0, `rgba(43,217,200,${op*0.44})`);
      halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(sx,sy,hR,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(43,217,200,${op*0.92})`;
      ctx.beginPath(); ctx.arc(sx,sy,2.3,0,Math.PI*2); ctx.fill();
      if (cur.city) {
        ctx.font = '500 7px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(190,228,255,${op*0.78})`;
        ctx.fillText(String(cur.city).toUpperCase(), sx, sy-7);
      }
    }
  }

  if (nxt && abs > 0.04) {
    const p = project(nxt.lng, nxt.lat, cLng, cLat, r);
    if (p) {
      const sx = cx+p.x, sy = cy+p.y;
      const op = Math.min(1, abs*2.2);
      const hR = 4 + op*2.5;
      const halo = ctx.createRadialGradient(sx,sy,0,sx,sy,hR);
      halo.addColorStop(0, `rgba(43,217,200,${op*0.34})`);
      halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(sx,sy,hR,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = `rgba(43,217,200,${op*0.82})`;
      ctx.beginPath(); ctx.arc(sx,sy,2.0,0,Math.PI*2); ctx.fill();
      if (nxt.city && op > 0.42) {
        ctx.font = '500 7px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(190,228,255,${op*0.65})`;
        ctx.fillText(String(nxt.city).toUpperCase(), sx, sy-7);
      }
    }
  }

  ctx.restore();

  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(43,200,220,0.2)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

export default function WatchMiniGlobe({ currentStream, nextStream, swipeProgressRef }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const breathPhaseRef = useRef(0);
  const breathRef = useRef(0);
  const prefersReduced = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const S = canvas.width;
    const cur = getStreamCoords(currentStream);
    const nxt = getStreamCoords(nextStream);

    if (!cur) {
      ctx.clearRect(0, 0, S, S);
      return undefined;
    }

    const loop = () => {
      const prog = swipeProgressRef?.current ?? 0;
      const abs = Math.abs(prog);

      if (!prefersReduced.current) {
        breathPhaseRef.current = (breathPhaseRef.current + 0.016) % (Math.PI*2);
        breathRef.current = (Math.sin(breathPhaseRef.current) + 1) * 0.5;
      }

      let cLng, cLat;
      if (cur && nxt && abs > 0.01 && prog > 0) {
        const center = lerpCenter(cur, nxt, Math.min(1, abs));
        cLng = center.lng; cLat = center.lat;
      } else if (cur && nxt && abs > 0.01 && prog < 0) {
        const center = lerpCenter(cur, nxt, Math.min(1, abs));
        cLng = center.lng; cLat = center.lat;
      } else {
        cLng = cur.lng; cLat = cur.lat;
      }

      draw(ctx, S, cLng, cLat, cur, nxt, prog, breathRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [currentStream, nextStream, swipeProgressRef]);

  if (!getStreamCoords(currentStream)) return null;

  return (
    <canvas
      ref={canvasRef}
      className="watch-mini-globe"
      width={106}
      height={106}
      aria-hidden="true"
    />
  );
}
