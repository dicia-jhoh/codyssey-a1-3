/*
 * 화면 동작 — 데이터를 HTML 로 바꾸고, 사용자 입력을 서버 요청으로 바꿉니다.
 *
 * 역할 분담(이 미션의 핵심 개념):
 *   HTML = 무엇이 있는가(구조)   CSS = 어떻게 보이는가(표현)   JavaScript = 무엇이 일어나는가(동작)
 * 그래서 이 파일에는 색·여백이 없고, HTML 에는 계산이 없습니다.
 *
 * 세 페이지가 이 한 파일을 함께 씁니다. 페이지마다 필요한 함수만 골라 부르는 방식이라
 * (index 는 renderCards+initAiCuration, list 는 initFilterChips …) 중복이 생기지 않습니다.
 */

/** 응답을 기다릴 최대 시간(밀리초). 이 시간을 넘기면 사용자에게 안내하고 요청을 끊습니다. */
const REQUEST_TIMEOUT_MS = 12000;

/* ── 사용 이벤트 수집(보너스) ────────────────────────────────── */

/**
 * 행동 하나를 서버(`/api/track`)로 보냅니다.
 *
 * 세 가지를 지킵니다.
 *  ① **기다리지 않는다** — await 하지 않으므로 화면 동작이 수집 때문에 느려지지 않습니다.
 *  ② **실패를 삼킨다** — 수집이 끊겨도 사용자에게는 아무 일도 일어나지 않아야 합니다.
 *  ③ **개인정보를 보내지 않는다** — 이벤트 이름·경로·카페 id 만 보냅니다.
 *     사용자가 입력한 취향 문장은 **보내지 않습니다**(추천에는 쓰지만 기록에는 남기지 않습니다).
 */
function track(event, detail) {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, path: location.pathname, detail: detail || {} }),
      keepalive: true, // 페이지를 떠나는 중에도 전송이 끊기지 않게 한다
    }).catch(() => {});
  } catch (_) {
    /* 수집 실패는 서비스 실패가 아니다 */
  }
}

/* ── 화면 그리기 ─────────────────────────────────────────────── */

/**
 * 카페 배열을 카드 목록으로 그린다.
 * textContent 로 값을 넣는 이유: innerHTML 에 데이터를 그대로 끼우면 값 안의 태그가
 * 실행됩니다(XSS). 지금 데이터는 우리가 만든 것이지만, 나중에 서버·사용자 입력으로
 * 바뀌어도 안전하도록 처음부터 이 방식으로 씁니다.
 */
function renderCards(targetId, cafes) {
  const list = document.getElementById(targetId);
  if (!list) return;
  list.innerHTML = '';

  if (cafes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = '조건에 맞는 카페가 없습니다. 필터를 바꿔 보세요.';
    list.appendChild(empty);
    return;
  }

  cafes.forEach((cafe) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'card';
    link.href = `detail.html?id=${encodeURIComponent(cafe.id)}`;

    const thumb = document.createElement('div');
    thumb.className = 'card-thumb';
    thumb.textContent = '☕';

    const body = document.createElement('div');
    body.className = 'card-body';
    const name = document.createElement('div');
    name.className = 'card-name';
    name.textContent = cafe.name;
    const desc = document.createElement('div');
    desc.className = 'card-desc';
    desc.textContent = cafe.tags.join(' · ');
    body.append(name, desc);

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.textContent = `★ ${cafe.rating}\n${formatDistance(cafe.distanceKm)}`;
    meta.style.whiteSpace = 'pre-line';

    link.addEventListener('click', () => track('cafe_open', { id: cafe.id }));
    link.append(thumb, body, meta);
    item.appendChild(link);
    list.appendChild(item);
  });
}

/** 1km 미만은 m 로 보여 준다 — "0.12 km" 보다 "120 m" 가 거리를 가늠하기 쉽다. */
function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;
}

/** 상세 페이지를 그린다. id 가 없거나 틀리면 목록으로 돌아갈 안내를 띄운다. */
function renderDetail(id) {
  const root = document.getElementById('detailRoot');
  if (!root) return;
  const cafe = findCafe(id);

  if (!cafe) {
    root.innerHTML = '';
    const title = document.createElement('h1');
    title.className = 'page-title';
    title.textContent = '카페를 찾을 수 없습니다';
    const guide = document.createElement('p');
    guide.className = 'muted';
    guide.textContent = '주소의 id 값이 올바르지 않습니다. 목록에서 다시 선택해 주세요.';
    const back = document.createElement('a');
    back.className = 'btn btn-ghost';
    back.href = 'list.html';
    back.textContent = '목록으로';
    root.append(title, guide, back);
    return;
  }

  root.innerHTML = '';

  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.textContent = cafe.name;

  const title = document.createElement('h1');
  title.className = 'page-title';
  title.textContent = `${cafe.name} ★ ${cafe.rating}`;

  const sub = document.createElement('p');
  sub.className = 'page-sub';
  sub.textContent = `${formatDistance(cafe.distanceKm)} · ${cafe.summary}`;

  const menuTitle = document.createElement('h2');
  menuTitle.className = 'section-title';
  menuTitle.textContent = 'Menu';
  const menu = document.createElement('div');
  menu.className = 'menu-chips';
  cafe.menu.forEach((entry) => {
    const chip = document.createElement('span');
    chip.className = 'menu-chip';
    chip.textContent = `${entry.name} $${entry.price.toFixed(2)}`;
    menu.appendChild(chip);
  });

  const reviewTitle = document.createElement('h2');
  reviewTitle.className = 'section-title';
  reviewTitle.textContent = 'Reviews';
  const reviews = document.createElement('div');
  cafe.reviews.forEach((review) => {
    const box = document.createElement('div');
    box.className = 'review';
    const who = document.createElement('div');
    who.className = 'card-name';
    who.textContent = `${review.author} ${'★'.repeat(review.stars)}`;
    const what = document.createElement('div');
    what.className = 'muted';
    what.textContent = review.text;
    box.append(who, what);
    reviews.appendChild(box);
  });

  root.append(hero, title, sub, menuTitle, menu, reviewTitle, reviews);

  const reserve = document.getElementById('reserveBtn');
  if (reserve) {
    reserve.addEventListener('click', () => {
      reserve.textContent = `${cafe.name} 예약 요청됨 (데모)`;
      reserve.disabled = true;
      track('reserve_click', { id: cafe.id });
    });
  }
}

/* ── 검색·필터 ───────────────────────────────────────────────── */

/** 메인의 검색: 입력이 비면 안내하고, 값이 있으면 목록 페이지로 넘긴다. */
function initSearchForm() {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  if (!form || !input) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault(); // 폼 기본 동작(페이지 새로고침)을 막고 우리가 처리한다
    const keyword = input.value.trim();
    if (!keyword) {
      input.focus();
      input.placeholder = '검색어를 입력해 주세요';
      return;
    }
    location.href = `list.html?q=${encodeURIComponent(keyword)}`;
  });
}

/** 필터칩 — 누른 칩 하나만 활성 상태가 되고 목록을 다시 그린다. */
function initFilterChips(initial) {
  const chips = document.querySelectorAll('#filterChips .chip');
  if (chips.length === 0) return;

  const keyword = (new URLSearchParams(location.search).get('q') || '').trim().toLowerCase();

  const apply = (filter) => {
    chips.forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.dataset.filter === filter));
    });

    let result = [...CAFES];
    if (keyword) {
      result = result.filter(
        (cafe) =>
          cafe.name.toLowerCase().includes(keyword) ||
          cafe.tags.some((tag) => tag.toLowerCase().includes(keyword))
      );
    }
    if (filter === 'nearby') result.sort((a, b) => a.distanceKm - b.distanceKm);
    if (filter === 'rating') result.sort((a, b) => b.rating - a.rating);
    if (filter === 'quiet') result = result.filter((cafe) => cafe.tags.includes('조용함'));

    renderCards('cafeList', result);
    const count = document.getElementById('listCount');
    if (count) {
      count.textContent = keyword
        ? `“${keyword}” 검색 결과 ${result.length}곳`
        : `${result.length}곳`;
    }
  };

  chips.forEach((chip) => chip.addEventListener('click', () => apply(chip.dataset.filter)));
  apply(initial);
}

/* ── AI 큐레이션 — 프론트에서 백엔드(Python) 를 부르는 자리 ────── */

/**
 * 사용자 입력 → fetch('/api/recommend') → 응답을 화면에 반영.
 *
 * 세 가지 실패를 **모두** 사용자에게 문장으로 안내합니다(미션 요구는 1개 이상):
 *   ① 빈 입력 — 서버를 부르기 전에 막는다(불필요한 호출·과금을 만들지 않는다)
 *   ② API 오류(4xx/5xx) — 상태코드에 따라 다른 안내를 준다
 *   ③ 지연·타임아웃 — AbortController 로 12초에 끊고 재시도를 권한다
 */
function initAiCuration() {
  const form = document.getElementById('aiForm');
  const input = document.getElementById('aiInput');
  const output = document.getElementById('aiOutput');
  const submit = document.getElementById('aiSubmit');
  if (!form || !input || !output || !submit) return;

  const show = (message, isError) => {
    output.textContent = message;
    output.classList.toggle('is-error', Boolean(isError));
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const wish = input.value.trim();

    // ① 빈 입력
    if (!wish) {
      show('원하는 분위기를 한 문장이라도 적어 주세요. 예) 조용히 작업할 곳', true);
      input.focus();
      track('ai_error', { reason: 'empty_input' });
      return;
    }

    submit.disabled = true;
    show('추천을 만드는 중입니다… (최대 12초)');
    track('ai_request', { length: wish.length }); // 문장 자체가 아니라 길이만 남긴다

    // ③ 지연·타임아웃 — 정해진 시간이 지나면 요청 자체를 취소한다
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wish, cafes: CAFES.map(toBrief) }),
        signal: controller.signal,
      });

      // ② API 오류 — 상태코드별로 사용자가 할 일이 다르다
      if (!response.ok) {
        show(httpMessage(response.status), true);
        track('ai_error', { reason: `http_${response.status}` });
        return;
      }

      const data = await response.json();
      show(data.recommendation || '추천 문구가 비어 있습니다. 다시 시도해 주세요.');
      track('ai_success');
    } catch (error) {
      if (error.name === 'AbortError') {
        show('응답이 12초를 넘겨 요청을 취소했습니다. 잠시 후 다시 시도해 주세요.', true);
        track('ai_error', { reason: 'timeout' });
      } else {
        show('네트워크에 연결할 수 없습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.', true);
        track('ai_error', { reason: 'network' });
      }
    } finally {
      clearTimeout(timer); // 성공·실패 어느 쪽이든 타이머를 반드시 정리한다
      submit.disabled = false;
    }
  });
}

/** 서버에 넘길 최소 정보만 추린다 — 리뷰 전문까지 보내면 요청이 커지고 비용이 는다. */
function toBrief(cafe) {
  return {
    id: cafe.id,
    name: cafe.name,
    rating: cafe.rating,
    distanceKm: cafe.distanceKm,
    tags: cafe.tags,
  };
}

/** 상태코드 → 사용자가 읽고 행동할 수 있는 문장. */
function httpMessage(status) {
  // 404·405 는 "서버 함수가 아예 없다"는 뜻이다. GitHub Pages 처럼 정적 파일만 서빙하는
  // 호스팅에서는 api/recommend.py 가 실행되지 않아 이 코드가 온다. 재시도해도 영영 안 되므로
  // "잠시 후 다시" 로 안내하면 사용자를 헛되이 붙잡는다 — 원인과 대안을 그 자리에서 밝힌다.
  if (status === 404 || status === 405) {
    return 'AI 추천 기능을 찾을 수 없습니다. 서버가 api/ 를 실행하고 있는지 확인해 주세요. '
      + '나머지 기능은 정상입니다.';
  }
  if (status === 400) return '입력을 이해하지 못했습니다. 문장을 조금 더 구체적으로 적어 주세요.';
  if (status === 401 || status === 403) {
    return '서버의 AI 키 설정에 문제가 있습니다. 관리자에게 문의해 주세요.';
  }
  if (status === 429) return '요청이 몰리고 있습니다. 30초쯤 뒤에 다시 시도해 주세요.';
  if (status >= 500) return '서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.';
  return `요청이 실패했습니다 (HTTP ${status}). 잠시 후 다시 시도해 주세요.`;
}

/* ── 다크 모드(보너스) ───────────────────────────────────────── */

/**
 * 선택을 localStorage 에 남긴다 — 페이지를 옮기거나 다시 방문해도 유지됩니다.
 * 저장하지 않으면 링크를 누를 때마다 밝은 화면으로 되돌아가 눈이 부십니다.
 */
function initTheme() {
  const button = document.getElementById('themeToggle');
  if (!button) return;

  const apply = (isDark) => {
    document.body.classList.toggle('dark', isDark);
    button.textContent = isDark ? '☀️ 라이트' : '🌙 다크';
  };

  apply(localStorage.getItem('brewfinder-theme') === 'dark');

  button.addEventListener('click', () => {
    const next = !document.body.classList.contains('dark');
    localStorage.setItem('brewfinder-theme', next ? 'dark' : 'light');
    apply(next);
    track('theme_toggle', { to: next ? 'dark' : 'light' });
  });
}

/**
 * 페이지 열람을 한 번 기록합니다(보너스).
 *
 * 페이지마다 호출하는 이유: 방문 대비 AI 요청 비율(= 기능이 실제로 쓰이는가)을 내려면
 * 분모가 필요합니다. 이벤트 수만 세면 "많이 눌렸다"는 알아도 "몇 명 중 몇 명인지"는 모릅니다.
 */
function initTracking() {
  track('page_view');
}
