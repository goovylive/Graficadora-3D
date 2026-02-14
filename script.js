// --- Core Engine ---
let isAnimating = false;
let animationId = null;
let compiledEq = null;

const UI = {
    eq: document.getElementById('equation-input'),
    xmin: document.getElementById('x-min'), xmax: document.getElementById('x-max'),
    ymin: document.getElementById('y-min'), ymax: document.getElementById('y-max'),
    zmin: document.getElementById('z-min'), zmax: document.getElementById('z-max'),
    tmin: document.getElementById('t-min'), tmax: document.getElementById('t-max'),
    res: document.getElementById('resolution'),
    slider: document.getElementById('t-slider'),
    tDisplay: document.getElementById('t-display'),
    btnPlay: document.getElementById('btn-play'),
    playIcon: document.getElementById('play-icon'),
    pauseIcon: document.getElementById('pause-icon'),
    speed: document.getElementById('speed-select'),
    error: document.getElementById('error-overlay'),
    renderInfo: document.getElementById('render-info')
};

const EXAMPLES = {
    wave: { eq: "sin(sqrt(x^2 + y^2) - t) - z", x: [-5, 5], y: [-5, 5], z: [-2, 2], t: [0, 6.28] },
    pulse: { eq: "x^2 + y^2 + z^2 - (2 + sin(t))^2", x: [-4, 4], y: [-4, 4], z: [-4, 4], t: [0, 6.28] },
    torus: { eq: "(sqrt(x^2 + y^2) - 2.5)^2 + z^2 - (0.8 + 0.3*cos(t))^2", x: [-4, 4], y: [-4, 4], z: [-2, 2], t: [0, 6.28] },
    ripple: { eq: "z - 0.5*sin(x + t)*cos(y + t)", x: [-5, 5], y: [-5, 5], z: [-2, 2], t: [0, 6.28] }
};

function showError(msg) {
    UI.error.innerText = msg;
    UI.error.style.display = 'block';
    setTimeout(() => UI.error.style.display = 'none', 5000);
}

function loadExample(key) {
    const ex = EXAMPLES[key];
    UI.eq.value = ex.eq;
    UI.xmin.value = ex.x[0]; UI.xmax.value = ex.x[1];
    UI.ymin.value = ex.y[0]; UI.ymax.value = ex.y[1];
    UI.zmin.value = ex.z[0]; UI.zmax.value = ex.z[1];
    UI.tmin.value = ex.t[0]; UI.tmax.value = ex.t[1];
    updatePlot();
}

function updatePlot() {
    try {
        const rawEq = UI.eq.value.split('=')[0].trim();
        compiledEq = math.compile(rawEq);
        compiledEq.evaluate({x:0, y:0, z:0, t:0});
        UI.error.style.display = 'none';
    } catch (err) {
        showError("Error: " + err.message);
        return;
    }
    UI.slider.min = UI.tmin.value;
    UI.slider.max = UI.tmax.value;
    renderFrame();
}

async function renderFrame() {
    if (!compiledEq) return;

    const t = parseFloat(UI.slider.value);
    UI.tDisplay.innerText = t.toFixed(2);

    const res = parseInt(UI.res.value);
    const x0 = parseFloat(UI.xmin.value), x1 = parseFloat(UI.xmax.value);
    const y0 = parseFloat(UI.ymin.value), y1 = parseFloat(UI.ymax.value);
    const z0 = parseFloat(UI.zmin.value), z1 = parseFloat(UI.zmax.value);

    const x = [], y = [], z = [], v = [], intensity = [];
    const dx = (x1 - x0) / (res - 1), dy = (y1 - y0) / (res - 1), dz = (z1 - z0) / (res - 1);

    const startTime = performance.now();

    for (let i = 0; i < res; i++) {
        const curX = x0 + i * dx;
        for (let j = 0; j < res; j++) {
            const curY = y0 + j * dy;
            for (let k = 0; k < res; k++) {
                const curZ = z0 + k * dz;
                x.push(curX); y.push(curY); z.push(curZ);
                v.push(compiledEq.evaluate({x: curX, y: curY, z: curZ, t: t}));
                intensity.push(curZ); // Coloreado por altura Z
            }
        }
    }

    const data = [{
        type: 'isosurface',
        x: x, y: y, z: z, value: v,
        isomin: -0.01, isomax: 0.01,
        intensity: intensity,
        surface: { show: true, fill: 1, count: 1 },
        spaceframe: { show: false }, contour: { show: false },
        caps: { x: {show: false}, y: {show: false}, z: {show: false} },
        colorscale: [
            [0, '#0000ff'], [0.1, '#0088ff'], [0.2, '#00ffff'], 
            [0.4, '#00ff00'], [0.6, '#ffff00'], [0.8, '#ff8800'], [1, '#ff0000']
        ],
        showscale: true,
        colorbar: { title: 'Z', thickness: 15 },
        lighting: { ambient: 0.6, diffuse: 0.7, specular: 0.3, roughness: 0.4 }
    }];

    const layout = {
        autosize: true, margin: { t: 0, b: 0, l: 0, r: 0 },
        scene: {
            aspectmode: 'cube',
            xaxis: { title: 'X', gridcolor: "#ddd" },
            yaxis: { title: 'Y', gridcolor: "#ddd" },
            zaxis: { title: 'Z', gridcolor: "#ddd" },
            camera: { eye: { x: 1.8, y: 1.8, z: 1.2 } }
        }
    };

    await Plotly.react('plot', data, layout, { responsive: true, displaylogo: false });
    const endTime = performance.now();
    UI.renderInfo.innerText = `${(endTime - startTime).toFixed(0)}ms | ${res}³ pts`;
}

function animate() {
    if (!isAnimating) return;
    let t = parseFloat(UI.slider.value);
    const tMin = parseFloat(UI.slider.min), tMax = parseFloat(UI.slider.max);
    t += parseFloat(UI.speed.value);
    if (t > tMax) t = tMin;
    UI.slider.value = t;
    renderFrame().then(() => {
        animationId = requestAnimationFrame(animate);
    });
}

function toggleAnimation() {
    isAnimating = !isAnimating;
    if (isAnimating) {
        UI.playIcon.style.display = 'none'; UI.pauseIcon.style.display = 'block';
        UI.btnPlay.classList.add('active'); animate();
    } else {
        UI.playIcon.style.display = 'block'; UI.pauseIcon.style.display = 'none';
        UI.btnPlay.classList.remove('active');
        if (animationId) cancelAnimationFrame(animationId);
    }
}

function resetAnimation() {
    UI.slider.value = UI.slider.min;
    if (!isAnimating) renderFrame();
}

UI.slider.addEventListener('input', () => { if (!isAnimating) renderFrame(); });
window.addEventListener('load', updatePlot);
