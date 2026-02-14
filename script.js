/**
 * HyperSurf 4D Engine
 * Lógica de graficación de superficies implícitas con soporte móvil
 */

let isAnimating = false;
let animationId = null;
let compiledEq = null;

// Elementos UI
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
    sidebar: document.getElementById('sidebar'),
    toggleText: document.getElementById('toggle-text'),
    toggleBtn: document.getElementById('mobile-toggle'),
    error: document.getElementById('error-overlay'),
    renderInfo: document.getElementById('render-info'),
    plot: document.getElementById('plot')
};

// --- Mobile Toggle Logic ---
function toggleControls() {
    const isHidden = UI.sidebar.classList.contains('sidebar-hidden');

    if (isHidden) {
        UI.sidebar.classList.remove('sidebar-hidden');
        UI.sidebar.classList.add('sidebar-open');
        UI.toggleText.innerText = 'Ocultar Controles';
        UI.toggleBtn.classList.add('open');
    } else {
        UI.sidebar.classList.remove('sidebar-open');
        UI.sidebar.classList.add('sidebar-hidden');
        UI.toggleText.innerText = 'Mostrar Controles';
        UI.toggleBtn.classList.remove('open');
    }
}

// --- Plotting Engine ---
const EXAMPLES = {
    wave: { eq: "sin(sqrt(x^2 + y^2) - t) - z", x: [-5, 5], y: [-5, 5], z: [-2, 2] },
    pulse: { eq: "x^2 + y^2 + z^2 - (2 + sin(t))^2", x: [-4, 4], y: [-4, 4], z: [-4, 4] },
    torus: { eq: "(sqrt(x^2 + y^2) - 2.5)^2 + z^2 - (0.8 + 0.3*cos(t))^2", x: [-4, 4], y: [-4, 4], z: [-2, 2] },
    ripple: { eq: "z - 0.5*sin(x + t)*cos(y + t)", x: [-5, 5], y: [-5, 5], z: [-2, 2] }
};

function loadExample(key) {
    const ex = EXAMPLES[key];
    UI.eq.value = ex.eq;
    UI.xmin.value = ex.x[0]; UI.xmax.value = ex.x[1];
    UI.ymin.value = ex.y[0]; UI.ymax.value = ex.y[1];
    UI.zmin.value = ex.z[0]; UI.zmax.value = ex.z[1];

    // Si estamos en móvil y se carga ejemplo, colapsamos para ver el resultado
    if (window.innerWidth < 768) toggleControls();

    updatePlot();
}

function updatePlot() {
    try {
        const rawEq = UI.eq.value.split('=')[0].trim();
        compiledEq = math.compile(rawEq);
        // Test evaluation
        compiledEq.evaluate({ x: 0, y: 0, z: 0, t: 0 });
        UI.error.style.display = 'none';

        // En móvil colapsamos al aplicar manualmente
        if (window.innerWidth < 768 && !isAnimating) {
            UI.sidebar.classList.remove('sidebar-open');
            UI.sidebar.classList.add('sidebar-hidden');
            UI.toggleText.innerText = 'Mostrar Controles';
            UI.toggleBtn.classList.remove('open');
        }
    } catch (err) {
        UI.error.innerText = "Error: " + err.message;
        UI.error.style.display = 'block';
        return;
    }
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

    const start = performance.now();

    for (let i = 0; i < res; i++) {
        const cx = x0 + i * dx;
        for (let j = 0; j < res; j++) {
            const cy = y0 + j * dy;
            for (let k = 0; k < res; k++) {
                const cz = z0 + k * dz;
                x.push(cx); y.push(cy); z.push(cz);
                v.push(compiledEq.evaluate({ x: cx, y: cy, z: cz, t: t }));
                intensity.push(cz);
            }
        }
    }

    const data = [{
        type: 'isosurface',
        x: x, y: y, z: z, value: v,
        isomin: -0.01, isomax: 0.01,
        intensity: intensity,
        surface: { fill: 1, count: 1 },
        colorscale: 'Portland',
        showscale: window.innerWidth > 768, // Ocultar barra en móvil para ganar espacio
        caps: { show: false },
        lighting: { ambient: 0.6, diffuse: 0.7, specular: 0.3 }
    }];

    const layout = {
        margin: { t: 0, b: 0, l: 0, r: 0 },
        scene: {
            aspectmode: 'cube',
            xaxis: { title: 'X', gridcolor: "#eee" },
            yaxis: { title: 'Y', gridcolor: "#eee" },
            zaxis: { title: 'Z', gridcolor: "#eee" },
            camera: { eye: { x: 1.6, y: 1.6, z: 1.2 } }
        },
        paper_bgcolor: 'white'
    };

    await Plotly.react('plot', data, layout, { responsive: true, displaylogo: false });
    UI.renderInfo.innerText = `${(performance.now() - start).toFixed(0)}ms | ${res}³`;
}

// --- Animation Loop ---
function animate() {
    if (!isAnimating) return;

    let t = parseFloat(UI.slider.value);
    let speed = parseFloat(UI.speed ? UI.speed.value : 0.05);

    t += speed;
    if (t > 6.28) t = 0;

    UI.slider.value = t;

    renderFrame().then(() => {
        animationId = requestAnimationFrame(animate);
    });
}

function toggleAnimation() {
    isAnimating = !isAnimating;

    if (isAnimating) {
        UI.playIcon.style.display = 'none';
        UI.pauseIcon.style.display = 'block';
        animate();
    } else {
        UI.playIcon.style.display = 'block';
        UI.pauseIcon.style.display = 'none';
        if (animationId) cancelAnimationFrame(animationId);
    }
}

// --- Init & Observers ---
UI.slider.addEventListener('input', () => {
    if (!isAnimating) renderFrame();
});

window.addEventListener('resize', () => {
    Plotly.Plots.resize(UI.plot);
});

// Inicialización
window.addEventListener('load', () => {
    updatePlot();
});
