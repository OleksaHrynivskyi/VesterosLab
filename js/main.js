// Розміри картинки карти в пікселях
const MAP_WIDTH = 1758;
const MAP_HEIGHT = 2560;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 3;

const mapBox = document.getElementById('map-viewport');
const mapStage = document.getElementById('map-stage');
const tooltip = document.getElementById('region-tooltip');
const zoomText = document.getElementById('zoom-level');
const welcomeBlock = document.getElementById('welcome-info');
const regionBlock = document.getElementById('region-info');

let baseScale = 1; // масштаб, при якому вся карта влазить у вікно
let zoom = 1;      // масштаб, який вибрав користувач (1 = 100%)
let posX = 0;      // зсув карти
let posY = 0;
let currentRegion = null;

function limit(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// Список земель у бічній панелі 

for (const id in regionsData) {
    const region = regionsData[id];
    const list = document.getElementById(region.group + '-list');

    list.innerHTML += `
        <li>
            <button class="land-link" data-id="${id}">
                <img src="${region.sigil}" alt="">
                <span>
                    <span class="land-name">${region.name}</span>
                    <span class="land-ruler">${region.ruler}</span>
                </span>
            </button>
        </li>`;
}

const landButtons = document.querySelectorAll('.land-link');

for (const button of landButtons) {
    button.addEventListener('click', function () {
        location.hash = button.dataset.id;
    });
}

// Переміщення і масштаб карти 

function updateMap(animate) {
    const scale = baseScale * zoom;
    const mapWidth = MAP_WIDTH * scale;
    const mapHeight = MAP_HEIGHT * scale;
    const boxWidth = mapBox.clientWidth;
    const boxHeight = mapBox.clientHeight;

    // якщо карта менша за вікно - ставимо по центру,
    // інакше не даємо відтягнути її за край
    if (mapWidth <= boxWidth) {
        posX = (boxWidth - mapWidth) / 2;
    } else {
        posX = limit(posX, boxWidth - mapWidth, 0);
    }

    if (mapHeight <= boxHeight) {
        posY = (boxHeight - mapHeight) / 2;
    } else {
        posY = limit(posY, boxHeight - mapHeight, 0);
    }

    if (animate) {
        mapStage.classList.add('is-animating');
    } else {
        mapStage.classList.remove('is-animating');
    }

    mapStage.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
    zoomText.textContent = Math.round(zoom * 100) + '%';
}

function calcBaseScale() {
    let padding = 48;
    if (window.innerWidth <= 760) {
        padding = 20;
    }
    const scaleX = (mapBox.clientWidth - padding) / MAP_WIDTH;
    const scaleY = (mapBox.clientHeight - padding) / MAP_HEIGHT;
    baseScale = Math.min(scaleX, scaleY);
}

// показати всю карту
function fitMap(animate) {
    calcBaseScale();
    zoom = 1;
    updateMap(animate);
}

// змінити масштаб так, щоб точка (x, y) залишилась на місці
function zoomAt(x, y, newZoom) {
    const oldScale = baseScale * zoom;
    const pointX = (x - posX) / oldScale;
    const pointY = (y - posY) / oldScale;

    zoom = limit(newZoom, MIN_ZOOM, MAX_ZOOM);

    const newScale = baseScale * zoom;
    posX = x - pointX * newScale;
    posY = y - pointY * newScale;
    updateMap(false);
}

function zoomBy(factor) {
    zoomAt(mapBox.clientWidth / 2, mapBox.clientHeight / 2, zoom * factor);
}

function moveMap(dx, dy) {
    posX += dx;
    posY += dy;
    updateMap(false);
}

// наблизити карту до вибраного регіону
function focusRegion(id, animate) {
    calcBaseScale();

    const box = document.querySelector(`.region-poly[data-id="${id}"]`).getBBox();
    const boxWidth = mapBox.clientWidth;
    const boxHeight = mapBox.clientHeight;
    const margin = Math.min(64, boxWidth * 0.08, boxHeight * 0.08);

    const zoomX = (boxWidth - margin * 2) / (box.width * baseScale);
    const zoomY = (boxHeight - margin * 2) / (box.height * baseScale);
    zoom = limit(Math.min(zoomX, zoomY) * 0.72, MIN_ZOOM, MAX_ZOOM);

    const scale = baseScale * zoom;
    posX = boxWidth / 2 - (box.x + box.width / 2) * scale;
    posY = boxHeight / 2 - (box.y + box.height / 2) * scale;
    updateMap(animate);
}

// координати мишки відносно блоку з картою
function getPoint(event) {
    const rect = mapBox.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

// Перетягування мишкою і пальцями

const pointers = {}; // всі пальці (або мишка), які зараз натиснуті
let gesture = null;  // стан карти на початку руху
let wasDragged = false;

function startGesture() {
    const points = Object.values(pointers);
    gesture = { x: posX, y: posY, zoom: zoom };

    if (points.length === 1) {
        gesture.startX = points[0].x;
        gesture.startY = points[0].y;
    } else {
        const centerX = (points[0].x + points[1].x) / 2;
        const centerY = (points[0].y + points[1].y) / 2;
        const scale = baseScale * zoom;
        gesture.distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1;
        gesture.mapX = (centerX - posX) / scale;
        gesture.mapY = (centerY - posY) / scale;
    }
}

mapBox.addEventListener('pointerdown', function (event) {
    if (event.button !== 0 || event.target.closest('.map-controls')) {
        return;
    }
    pointers[event.pointerId] = getPoint(event);
    wasDragged = Object.keys(pointers).length > 1;
    mapBox.classList.add('is-dragging');
    startGesture();
});

window.addEventListener('pointermove', function (event) {
    if (!pointers[event.pointerId]) {
        return;
    }
    pointers[event.pointerId] = getPoint(event);
    const points = Object.values(pointers);

    if (points.length >= 2) {
        // масштаб двома пальцями
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        const centerX = (points[0].x + points[1].x) / 2;
        const centerY = (points[0].y + points[1].y) / 2;
        zoom = limit(gesture.zoom * distance / gesture.distance, MIN_ZOOM, MAX_ZOOM);
        posX = centerX - gesture.mapX * baseScale * zoom;
        posY = centerY - gesture.mapY * baseScale * zoom;
    } else {
        const dx = points[0].x - gesture.startX;
        const dy = points[0].y - gesture.startY;

        // маленький рух - це ще клік, а не перетягування
        if (!wasDragged && Math.hypot(dx, dy) <= 5) {
            return;
        }
        wasDragged = true;
        posX = gesture.x + dx;
        posY = gesture.y + dy;
    }
    updateMap(false);
});

function stopPointer(event) {
    if (!pointers[event.pointerId]) {
        return;
    }
    delete pointers[event.pointerId];

    if (Object.keys(pointers).length > 0) {
        startGesture();
    } else {
        mapBox.classList.remove('is-dragging');
    }
}

window.addEventListener('pointerup', stopPointer);
window.addEventListener('pointercancel', stopPointer);

mapBox.addEventListener('wheel', function (event) {
    event.preventDefault();
    const point = getPoint(event);
    zoomAt(point.x, point.y, zoom * Math.exp(-event.deltaY * 0.001));
});

mapBox.addEventListener('keydown', function (event) {
    const key = event.key;

    if (key === '+' || key === '=') {
        zoomBy(1.2);
    } else if (key === '-' || key === '_') {
        zoomBy(1 / 1.2);
    } else if (key === '0') {
        fitMap(true);
    } else if (key === 'ArrowLeft') {
        moveMap(48, 0);
    } else if (key === 'ArrowRight') {
        moveMap(-48, 0);
    } else if (key === 'ArrowUp') {
        moveMap(0, 48);
    } else if (key === 'ArrowDown') {
        moveMap(0, -48);
    } else {
        return;
    }
    event.preventDefault();
});

document.getElementById('zoom-in').addEventListener('click', function () {
    zoomBy(1.25);
});

document.getElementById('zoom-out').addEventListener('click', function () {
    zoomBy(0.8);
});

document.getElementById('center-map').addEventListener('click', function () {
    fitMap(true);
});

window.addEventListener('resize', function () {
    if (currentRegion) {
        focusRegion(currentRegion, false);
    } else {
        fitMap(false);
    }
});

// Регіони на карті 

function showTooltip(text, x, y) {
    tooltip.textContent = text;
    tooltip.classList.remove('is-hidden');
    tooltip.style.left = limit(x + 12, 8, mapBox.clientWidth - tooltip.offsetWidth - 8) + 'px';
    tooltip.style.top = limit(y + 12, 8, mapBox.clientHeight - tooltip.offsetHeight - 8) + 'px';
}

function hideTooltip() {
    tooltip.classList.add('is-hidden');
}

const polygons = document.querySelectorAll('.region-poly');

for (const polygon of polygons) {
    const id = polygon.dataset.id;
    const region = regionsData[id];
    polygon.style.setProperty('--color', region.tincture);

    polygon.addEventListener('click', function () {
        // якщо карту щойно тягнули - не відкриваємо регіон
        if (!wasDragged) {
            location.hash = id;
        }
    });

    polygon.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            location.hash = id;
        }
    });

    polygon.addEventListener('pointermove', function (event) {
        if (event.pointerType !== 'touch') {
            const point = getPoint(event);
            showTooltip(region.name, point.x, point.y);
        }
    });

    // якщо вибрали регіон клавішею Tab - показуємо підказку по центру регіону
    polygon.addEventListener('focus', function () {
        const box = polygon.getBBox();
        const scale = baseScale * zoom;
        showTooltip(region.name, posX + (box.x + box.width / 2) * scale, posY + (box.y + box.height / 2) * scale);
    });

    polygon.addEventListener('pointerleave', hideTooltip);
    polygon.addEventListener('blur', hideTooltip);
}

// Відкриття регіону 
// Вибраний регіон зберігається в адресі сторінки (наприклад index.html#north),
// тому працюють кнопки браузера "назад" і "вперед".

function removeActive() {
    for (const polygon of polygons) {
        polygon.classList.remove('active');
    }
    for (const button of landButtons) {
        button.classList.remove('active');
    }
}

function showRegion(id, animate) {
    const region = regionsData[id];
    currentRegion = id;

    removeActive();
    document.querySelector(`.region-poly[data-id="${id}"]`).classList.add('active');
    document.querySelector(`.land-link[data-id="${id}"]`).classList.add('active');

    document.getElementById('region-name').textContent = region.name;
    document.getElementById('region-ruler').textContent = 'Володар: ' + region.ruler;
    document.getElementById('region-sigil').src = region.sigil;
    document.getElementById('region-tincture').style.background = region.tincture;
    document.getElementById('region-words').textContent = '«' + region.words + '»';
    document.getElementById('region-desc').textContent = region.description;

    let characters = '';
    for (const name of region.characters) {
        characters += '<li>' + name + '</li>';
    }
    document.getElementById('characters-list').innerHTML = characters;

    welcomeBlock.classList.add('is-hidden');
    regionBlock.classList.remove('is-hidden');

    // невелика анімація появи
    regionBlock.classList.add('is-entering');
    setTimeout(function () {
        regionBlock.classList.remove('is-entering');
    }, 20);

    hideTooltip();
    focusRegion(id, animate);
}

function showWelcome(animate) {
    currentRegion = null;
    removeActive();
    regionBlock.classList.add('is-hidden');
    welcomeBlock.classList.remove('is-hidden');
    hideTooltip();
    fitMap(animate);
}

function openFromAddress(animate) {
    const id = location.hash.slice(1);
    if (regionsData[id]) {
        showRegion(id, animate);
    } else if (currentRegion) {
        showWelcome(animate);
    }
}

document.getElementById('back-btn').addEventListener('click', function () {
    location.hash = '';
});

document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && currentRegion) {
        location.hash = '';
    }
});

window.addEventListener('hashchange', function () {
    openFromAddress(true);
});

fitMap(false);
openFromAddress(false);
