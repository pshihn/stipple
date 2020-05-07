import { StippleCanvas } from './stipple-canvas';

const canvas = document.querySelector('canvas')!;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const images = [
  './monalisa.jpg',
  './obama.png',
  './scene1.jpg',
  './scene3.png'
];




(async () => {
  const sc = new StippleCanvas(canvas);
  sc.start();

  // append images
  {
    const panel = document.getElementById('panel')!;
    images.forEach((url) => {
      const btn = document.createElement('button');
      btn.style.backgroundImage = `url("${url}")`;
      panel.appendChild(btn);
      btn.addEventListener('click', () => {
        sc.drawImage(url);
      });
    });
  }

  // const info = await stippleImage('./obama.png');
  // const info = await stippleImage('./preet.jpg');
  // const scale = Math.min(canvas.width / info.width, canvas.height / info.height);
  // const points = info.points;
  // const n = Math.floor(points.length / 2);

  // const ctx = canvas.getContext('2d');
  // ctx.clearRect(0, 0, canvas.width, canvas.height);
  // ctx.fillStyle = '#000';
  // for (let i = 0; i < n; i++) {
  //   ctx.beginPath();
  //   ctx.arc(points[i * 2] * scale, points[i * 2 + 1] * scale, 2, 0, Math.PI * 2);
  //   ctx.fill();
  // }

  // console.log(n);
})();